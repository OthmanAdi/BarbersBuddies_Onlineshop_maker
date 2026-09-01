'use strict';

const {
  assertStatusTransition,
  createCommandId,
  createOccupancyBuckets,
  createOccupancyId,
  createRequestHash,
  parseLocalDate,
  parseLocalTime,
  resolveResourceCandidates,
  sha256Canonical,
  statusAfterReschedule,
  validateIdempotencyKey,
} = require('./domain');
const { BookingError } = require('./errors');
const { authorizeBookingMutation, normalizeVerifiedActor } = require('./authz');
const {
  formatMinorAmount,
  normalizeCreateIntent,
  resolveAuthoritativeBooking,
} = require('./services');
const { resolveBookingInterval } = require('./time');

const ACTIVE_MUTATION_STATUSES = new Set(['pending', 'confirmed']);
const IDENTIFIER_PATTERN = /^[^\u0000-\u001f\u007f/]{1,128}$/;

function mutationError(code, message, httpStatus, details = {}) {
  return new BookingError(code, message, {
    httpStatus,
    retryable: false,
    details,
  });
}

function migrationRequired(message = 'booking requires migration before it can be mutated') {
  return mutationError('BOOKING_MIGRATION_REQUIRED', message, 409);
}

function requireDependencies(db, admin) {
  if (!db || typeof db.collection !== 'function' || typeof db.runTransaction !== 'function') {
    throw new TypeError('booking mutations require an Admin Firestore db');
  }
  if (
    !admin?.firestore?.Timestamp ||
    !admin?.firestore?.FieldValue ||
    typeof admin.firestore.Timestamp.fromMillis !== 'function' ||
    typeof admin.firestore.FieldValue.serverTimestamp !== 'function'
  ) {
    throw new TypeError('booking mutations require the Firebase Admin SDK');
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeIdentifier(value, field) {
  if (typeof value !== 'string') {
    throw mutationError('INVALID_ARGUMENT', `${field} must be a string`, 400, { field });
  }
  if (value !== value.trim() || !IDENTIFIER_PATTERN.test(value)) {
    throw mutationError('INVALID_ARGUMENT', `${field} is not valid`, 400, { field });
  }
  return value;
}

function normalizeExpectedVersion(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw mutationError(
      'INVALID_ARGUMENT',
      'expectedVersion must be a positive integer',
      400,
      { field: 'expectedVersion' },
    );
  }
  return value;
}

function normalizeCancelIntent(payload) {
  if (!isPlainObject(payload)) {
    throw mutationError('INVALID_ARGUMENT', 'payload must be an object', 400, {
      field: 'payload',
    });
  }
  return Object.freeze({
    bookingId: normalizeIdentifier(payload.bookingId, 'bookingId'),
    expectedVersion: normalizeExpectedVersion(payload.expectedVersion),
  });
}

function normalizeRescheduleIntent(payload) {
  const cancelIntent = normalizeCancelIntent(payload);
  return Object.freeze({
    ...cancelIntent,
    localDate: parseLocalDate(payload.localDate).value,
    localStartTime: parseLocalTime(payload.localStartTime).value,
  });
}

function normalizeNow(nowEpochMs) {
  const value = nowEpochMs === undefined ? Date.now() : nowEpochMs;
  if (!Number.isFinite(value)) {
    throw new TypeError('nowEpochMs must be a finite epoch-millisecond value');
  }
  return value;
}

function timestampMillis(value, field) {
  if (!value || typeof value.toMillis !== 'function') {
    throw migrationRequired(`booking ${field} is not a Firestore timestamp`);
  }
  const milliseconds = value.toMillis();
  if (!Number.isFinite(milliseconds)) {
    throw migrationRequired(`booking ${field} is not a valid timestamp`);
  }
  return milliseconds;
}

function assertShopForMutation(shop, shopId) {
  if (!isPlainObject(shop)) {
    throw mutationError('SHOP_NOT_FOUND', 'shop does not exist or is inactive', 404, { shopId });
  }
  const status = typeof shop.status === 'string' ? shop.status.trim().toLowerCase() : '';
  if (shop.active === false || ['inactive', 'disabled', 'archived'].includes(status)) {
    throw mutationError('SHOP_NOT_FOUND', 'shop does not exist or is inactive', 404, { shopId });
  }
  normalizeIdentifier(shop.ownerId, 'shop.ownerId');
  if (!isPlainObject(shop.bookingPolicy)) {
    throw mutationError('INVALID_ARGUMENT', 'shop booking policy is not configured', 400);
  }
  const notice = shop.bookingPolicy.cancellationNoticeMinutes ?? 0;
  if (!Number.isSafeInteger(notice) || notice < 0) {
    throw mutationError('INVALID_ARGUMENT', 'shop cancellation policy is invalid', 400);
  }
  return Object.freeze({ cancellationNoticeMinutes: notice });
}

function assertNoticeWindow(booking, policy, nowEpochMs) {
  const startAtEpochMs = timestampMillis(booking.startAt, 'startAt');
  const minimumStart = nowEpochMs + (policy.cancellationNoticeMinutes * 60 * 1000);
  if (startAtEpochMs < minimumStart) {
    throw mutationError(
      'OUTSIDE_AVAILABILITY',
      'booking is inside the cancellation or reschedule notice window',
      422,
    );
  }
}

function employeeIdForResource(resourceId) {
  if (resourceId.startsWith('employee:')) {
    return resourceId.slice('employee:'.length);
  }
  return null;
}

function assertCurrentResource(shop, booking) {
  if (!Array.isArray(shop.employees)) {
    throw mutationError(
      'SHOP_RESOURCE_CONFIG_REQUIRED',
      'shop employee roster is not deterministic',
      422,
    );
  }
  const employeeId = employeeIdForResource(booking.resourceId);
  let resources;
  try {
    resources = resolveResourceCandidates({
      shopId: booking.shopId,
      preferredEmployeeId: employeeId,
      employees: shop.employees,
    });
  } catch (error) {
    if (error instanceof BookingError) {
      throw error;
    }
    throw mutationError(
      'SHOP_RESOURCE_CONFIG_REQUIRED',
      'booking resource cannot be resolved from the authoritative roster',
      422,
    );
  }
  if (resources.length !== 1 || resources[0] !== booking.resourceId) {
    throw mutationError(
      'SHOP_RESOURCE_CONFIG_REQUIRED',
      'booking resource no longer matches the authoritative shop roster',
      422,
    );
  }
  if (employeeId !== null) {
    const employee = shop.employees.find((entry) => isPlainObject(entry) && entry.id === employeeId);
    const status = typeof employee?.status === 'string'
      ? employee.status.trim().toLowerCase()
      : '';
    if (
      employee?.bookable === false ||
      employee?.active === false ||
      ['inactive', 'disabled', 'archived'].includes(status)
    ) {
      throw mutationError('EMPLOYEE_UNAVAILABLE', 'booking employee is not active', 422);
    }
  }
}

function resolveStoredInterval(booking) {
  try {
    return resolveBookingInterval({
      localDate: booking.localDate,
      localStartTime: booking.localStartTime,
      timeZone: booking.timeZone,
      durationMinutes: booking.durationMinutes,
      bufferBeforeMinutes: booking.bufferBeforeMinutes,
      bufferAfterMinutes: booking.bufferAfterMinutes,
    });
  } catch (error) {
    if (error instanceof BookingError) {
      throw migrationRequired('booking time snapshot cannot be trusted');
    }
    throw error;
  }
}

function expectedOccupancyForBooking({ db, booking, interval }) {
  let buckets;
  try {
    buckets = createOccupancyBuckets({
      localDate: booking.localDate,
      localStartTime: booking.localStartTime,
      durationMinutes: booking.durationMinutes,
      bufferBeforeMinutes: booking.bufferBeforeMinutes,
      bufferAfterMinutes: booking.bufferAfterMinutes,
    });
  } catch (error) {
    if (error instanceof BookingError) {
      throw migrationRequired('booking occupancy snapshot cannot be reconstructed');
    }
    throw error;
  }

  return Object.freeze(buckets.map((bucket) => {
    const id = createOccupancyId({
      shopId: booking.shopId,
      resourceId: booking.resourceId,
      localDate: bucket.localDate,
      bucketStartMinute: bucket.startMinute,
    });
    const bucketStartAtEpochMs = interval.startAtEpochMs +
      ((bucket.startMinute - interval.startMinute) * 60 * 1000);
    return Object.freeze({
      id,
      ref: db.collection('bookingOccupancy').doc(id),
      bucket,
      bucketStartAtEpochMs,
    });
  }));
}

function assertCanonicalBooking({ db, snapshot }) {
  if (!snapshot.exists) {
    throw mutationError('BOOKING_NOT_FOUND', 'booking does not exist', 404);
  }
  const booking = snapshot.data();
  if (!isPlainObject(booking) || booking.schemaVersion !== 2) {
    throw migrationRequired();
  }
  if (
    booking.bookingId !== snapshot.id ||
    !Number.isSafeInteger(booking.version) ||
    booking.version < 1 ||
    (
      !ACTIVE_MUTATION_STATUSES.has(booking.status) &&
      booking.status !== 'cancelled' &&
      booking.status !== 'completed' &&
      booking.status !== 'rejected'
    )
  ) {
    throw migrationRequired('booking canonical identity, version, or status is invalid');
  }
  try {
    normalizeIdentifier(booking.shopId, 'booking.shopId');
    normalizeIdentifier(booking.resourceId, 'booking.resourceId');
  } catch (error) {
    if (error instanceof BookingError) {
      throw migrationRequired('booking shop or resource identity is invalid');
    }
    throw error;
  }
  if (!Array.isArray(booking.occupancyIds)) {
    throw migrationRequired('booking occupancy ownership is missing');
  }
  if (
    booking.customerUid !== null &&
    (
      typeof booking.customerUid !== 'string' ||
      booking.customerUid !== booking.customerUid.trim() ||
      !IDENTIFIER_PATTERN.test(booking.customerUid.trim())
    )
  ) {
    throw migrationRequired('booking customer ownership is malformed');
  }
  const uniqueOccupancyIds = new Set(booking.occupancyIds);
  if (
    uniqueOccupancyIds.size !== booking.occupancyIds.length ||
    booking.occupancyIds.some((id) => typeof id !== 'string' || id.length === 0)
  ) {
    throw migrationRequired('booking occupancy ownership is malformed');
  }

  if (booking.status === 'cancelled') {
    if (booking.occupancyIds.length !== 0) {
      throw migrationRequired('cancelled booking still declares occupancy');
    }
    return Object.freeze({ booking, interval: null, expectedOccupancy: Object.freeze([]) });
  }

  const interval = resolveStoredInterval(booking);
  if (
    timestampMillis(booking.startAt, 'startAt') !== interval.startAtEpochMs ||
    timestampMillis(booking.endAt, 'endAt') !== interval.endAtEpochMs ||
    timestampMillis(booking.occupiedStartAt, 'occupiedStartAt') !==
      interval.occupiedStartAtEpochMs ||
    timestampMillis(booking.occupiedEndAt, 'occupiedEndAt') !== interval.occupiedEndAtEpochMs
  ) {
    throw migrationRequired('booking timestamp and civil-time snapshots disagree');
  }

  const expectedOccupancy = expectedOccupancyForBooking({ db, booking, interval });
  const expectedIds = expectedOccupancy.map(({ id }) => id);
  if (
    expectedIds.length !== booking.occupancyIds.length ||
    expectedIds.some((id) => !uniqueOccupancyIds.has(id))
  ) {
    throw migrationRequired('booking occupancy identifiers are incomplete or inconsistent');
  }
  return Object.freeze({ booking, interval, expectedOccupancy });
}

function assertOwnedOccupancy({ booking, expectedOccupancy, occupancySnapshot }) {
  const documents = occupancySnapshot.docs;
  const byId = new Map(documents.map((snapshot) => [snapshot.id, snapshot]));
  if (documents.length !== expectedOccupancy.length) {
    throw migrationRequired('booking occupancy ownership does not match stored buckets');
  }

  for (const expected of expectedOccupancy) {
    const snapshot = byId.get(expected.id);
    const occupancy = snapshot?.data();
    if (
      !snapshot?.exists ||
      !isPlainObject(occupancy) ||
      occupancy.schemaVersion !== 2 ||
      occupancy.occupancyId !== expected.id ||
      occupancy.bookingId !== booking.bookingId ||
      occupancy.bookingVersion !== booking.version ||
      occupancy.shopId !== booking.shopId ||
      occupancy.resourceId !== booking.resourceId ||
      occupancy.localDate !== expected.bucket.localDate ||
      occupancy.bucketStartMinute !== expected.bucket.startMinute
    ) {
      throw migrationRequired('booking does not exclusively own its declared occupancy');
    }
  }
}

function assertNoOwnedOccupancy(occupancySnapshot) {
  if (occupancySnapshot.size !== 0) {
    throw migrationRequired('cancelled booking still owns occupancy documents');
  }
}

function assertExpectedVersion(booking, expectedVersion) {
  if (booking.version !== expectedVersion) {
    throw mutationError(
      'BOOKING_VERSION_CONFLICT',
      'booking version changed before this command committed',
      409,
      { expectedVersion, actualVersion: booking.version },
    );
  }
}

function publicBooking(bookingId, booking) {
  return Object.freeze({
    bookingId,
    version: booking.version,
    status: booking.status,
    resourceId: booking.resourceId,
    startAt: new Date(timestampMillis(booking.startAt, 'startAt')).toISOString(),
    endAt: new Date(timestampMillis(booking.endAt, 'endAt')).toISOString(),
  });
}

function successResult({ commandId, bookingId, booking }) {
  return Object.freeze({
    ok: true,
    commandId,
    replayed: false,
    booking: publicBooking(bookingId, booking),
  });
}

function buildEvent({ bookingRef, eventType, booking, previousVersion, authorization, commandId,
  serverTimestamp }) {
  const eventId = sha256Canonical({
    scope: 'booking-event:v2',
    bookingId: booking.bookingId,
    version: booking.version,
    eventType,
  });
  return Object.freeze({
    ref: bookingRef.collection('events').doc(eventId),
    data: {
      schemaVersion: 2,
      eventId,
      eventType,
      bookingId: booking.bookingId,
      bookingVersion: booking.version,
      previousVersion,
      shopId: booking.shopId,
      actor: {
        kind: authorization.role,
        uid: authorization.actor.uid,
      },
      commandId,
      occurredAt: serverTimestamp,
    },
  });
}

function buildMutationOutbox({ db, operation, booking, commandId, serverTimestamp }) {
  const eventRoot = operation === 'cancel' ? 'booking.cancelled' : 'booking.rescheduled';
  const audiences = ['customer', 'shop'];
  return Object.freeze(audiences.map((audience) => {
    const eventType = `${eventRoot}.${audience}-email`;
    const id = sha256Canonical({
      scope: 'booking-outbox:v2',
      bookingId: booking.bookingId,
      version: booking.version,
      eventType,
    });
    return Object.freeze({
      ref: db.collection('bookingOutbox').doc(id),
      data: {
        schemaVersion: 2,
        id,
        eventType,
        channel: 'email',
        audience,
        bookingId: booking.bookingId,
        shopId: booking.shopId,
        bookingVersion: booking.version,
        commandId,
        state: 'pending',
        attempts: 0,
        availableAt: serverTimestamp,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      },
    });
  }));
}

function replayOrThrow(commandSnapshot, operation, requestHash) {
  if (!commandSnapshot.exists) {
    return null;
  }
  const command = commandSnapshot.data();
  if (command.operation !== operation || command.requestHash !== requestHash) {
    throw mutationError(
      'IDEMPOTENCY_KEY_REUSED',
      'idempotency key was already used for different booking intent',
      409,
    );
  }
  if (command.state !== 'succeeded' || !isPlainObject(command.result)) {
    throw mutationError('INTERNAL', 'stored command result is incomplete', 500);
  }
  return {
    ...command.result,
    replayed: true,
  };
}

async function getAll(transaction, refs) {
  if (refs.length === 0) {
    return [];
  }
  if (typeof transaction.getAll === 'function') {
    return transaction.getAll(...refs);
  }
  return Promise.all(refs.map((ref) => transaction.get(ref)));
}

function writeOutbox(transaction, outbox) {
  for (const entry of outbox) {
    transaction.create(entry.ref, entry.data);
  }
}

async function cancelBookingV2({
  db,
  admin,
  payload,
  actor,
  idempotencyKey,
  nowEpochMs,
}) {
  requireDependencies(db, admin);
  const verifiedActor = normalizeVerifiedActor(actor);
  const intent = normalizeCancelIntent(payload);
  const validatedKey = validateIdempotencyKey(idempotencyKey);
  const effectiveNow = normalizeNow(nowEpochMs);
  const commandId = createCommandId({
    operation: 'cancel',
    actorId: `uid:${verifiedActor.uid}`,
    idempotencyKey: validatedKey,
  });
  const actorScopeHash = sha256Canonical({
    scope: 'booking-actor-scope:v2',
    actorScope: `uid:${verifiedActor.uid}`,
  });
  const requestHash = createRequestHash({ operation: 'cancel', intent });
  const commandRef = db.collection('bookingCommands').doc(commandId);
  const bookingRef = db.collection('bookings').doc(intent.bookingId);
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  return db.runTransaction(async (transaction) => {
    const commandSnapshot = await transaction.get(commandRef);
    const replay = replayOrThrow(commandSnapshot, 'cancel', requestHash);
    if (replay !== null) {
      return replay;
    }
    const bookingSnapshot = await transaction.get(bookingRef);
    if (!bookingSnapshot.exists) {
      throw mutationError('BOOKING_NOT_FOUND', 'booking does not exist', 404);
    }
    const rawBooking = bookingSnapshot.data();
    let shopId;
    try {
      shopId = normalizeIdentifier(rawBooking?.shopId, 'booking.shopId');
    } catch (error) {
      if (error instanceof BookingError) {
        throw migrationRequired('booking shop identity is missing or noncanonical');
      }
      throw error;
    }
    const shopRef = db.collection('barberShops').doc(shopId);
    const shopSnapshot = await transaction.get(shopRef);
    if (!shopSnapshot.exists) {
      throw mutationError('SHOP_NOT_FOUND', 'shop does not exist or is inactive', 404, { shopId });
    }
    const shop = shopSnapshot.data();
    const policy = assertShopForMutation(shop, shopId);
    const canonical = assertCanonicalBooking({ db, snapshot: bookingSnapshot });
    const authorization = authorizeBookingMutation({
      actor: verifiedActor,
      booking: canonical.booking,
      shop,
    });

    const occupancyQuery = db.collection('bookingOccupancy')
      .where('bookingId', '==', intent.bookingId);
    const occupancySnapshot = await transaction.get(occupancyQuery);

    if (canonical.booking.status === 'cancelled') {
      assertNoOwnedOccupancy(occupancySnapshot);
      assertStatusTransition(canonical.booking.status, 'cancelled');
    }

    assertExpectedVersion(canonical.booking, intent.expectedVersion);
    assertStatusTransition(canonical.booking.status, 'cancelled');
    assertCurrentResource(shop, canonical.booking);
    assertNoticeWindow(canonical.booking, policy, effectiveNow);
    assertOwnedOccupancy({
      booking: canonical.booking,
      expectedOccupancy: canonical.expectedOccupancy,
      occupancySnapshot,
    });

    const nextVersion = canonical.booking.version + 1;
    const updatedBooking = {
      ...canonical.booking,
      status: 'cancelled',
      version: nextVersion,
      occupancyIds: [],
      customerUid: authorization.bindCustomerUid
        ? authorization.actor.uid
        : canonical.booking.customerUid ?? null,
      commandId,
      cancelledAt: serverTimestamp,
      updatedAt: serverTimestamp,
    };
    const resultBooking = {
      ...updatedBooking,
      startAt: canonical.booking.startAt,
      endAt: canonical.booking.endAt,
    };
    const result = successResult({
      commandId,
      bookingId: intent.bookingId,
      booking: resultBooking,
    });
    const event = buildEvent({
      bookingRef,
      eventType: 'booking.cancelled',
      booking: { ...resultBooking, bookingId: intent.bookingId },
      previousVersion: canonical.booking.version,
      authorization,
      commandId,
      serverTimestamp,
    });
    const outbox = buildMutationOutbox({
      db,
      operation: 'cancel',
      booking: { ...resultBooking, bookingId: intent.bookingId },
      commandId,
      serverTimestamp,
    });

    transaction.update(bookingRef, updatedBooking);
    for (const expected of canonical.expectedOccupancy) {
      transaction.delete(expected.ref);
    }
    transaction.create(event.ref, event.data);
    writeOutbox(transaction, outbox);
    transaction.create(commandRef, {
      schemaVersion: 2,
      commandId,
      operation: 'cancel',
      actorScopeHash,
      shopId,
      requestHash,
      state: 'succeeded',
      bookingId: intent.bookingId,
      result,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });

    return result;
  }, { maxAttempts: 20 });
}

function rescheduleAuthoritative({ shopId, shop, booking, intent, actor }) {
  if (!Array.isArray(booking.serviceIds) || booking.serviceIds.length === 0) {
    throw migrationRequired('booking service identity snapshot is missing');
  }
  if (!isPlainObject(booking.customer)) {
    throw migrationRequired('booking customer snapshot is missing');
  }

  const requestedEmployeeId = employeeIdForResource(booking.resourceId);
  const policyConsentVersion = booking.consentVersion;
  if (policyConsentVersion !== shop.bookingPolicy?.consentVersion) {
    throw mutationError(
      'INVALID_ARGUMENT',
      'current booking consent must be accepted before rescheduling',
      400,
      { field: 'consentVersion' },
    );
  }
  let normalized;
  try {
    normalized = normalizeCreateIntent({
      shopId,
      requestedEmployeeId,
      serviceIds: booking.serviceIds,
      localDate: intent.localDate,
      localStartTime: intent.localStartTime,
      customer: booking.customer,
      consentVersion: policyConsentVersion,
    }, actor);
  } catch (error) {
    if (error instanceof BookingError && error.code === 'INVALID_ARGUMENT') {
      const field = error.details?.field;
      if (
        field === 'email' ||
        field === 'serviceIds' ||
        field?.startsWith('customer') ||
        field?.startsWith('serviceIds[')
      ) {
        throw migrationRequired('booking customer or service snapshot cannot be reused safely');
      }
    }
    throw error;
  }

  const authoritative = resolveAuthoritativeBooking({
    shopId,
    shop,
    intent: normalized.intent,
    actor: normalized.actor,
  });
  if (
    authoritative.resources.length !== 1 ||
    authoritative.resources[0].resourceId !== booking.resourceId
  ) {
    throw mutationError(
      'SHOP_RESOURCE_CONFIG_REQUIRED',
      'reschedule cannot retain the booking resource under current shop configuration',
      422,
    );
  }
  return Object.freeze({ authoritative, normalized });
}

function buildRescheduledBooking({ booking, authoritative, commandId, authorization, admin,
  serverTimestamp, occupancyIds }) {
  const { interval, policy, service, shop } = authoritative;
  const resource = authoritative.resources[0];
  return {
    ...booking,
    commandId,
    version: booking.version + 1,
    status: statusAfterReschedule(booking.status),
    customerUid: authorization.bindCustomerUid
      ? authorization.actor.uid
      : booking.customerUid ?? null,
    shopName: shop.name,
    shopOwnerId: shop.ownerId,
    ownerId: shop.ownerId,
    shopEmail: shop.email,
    services: service.snapshots.map((snapshot) => ({ ...snapshot })),
    totalPriceMinor: service.totalPriceMinor,
    currency: service.currency,
    minorUnitDigits: service.minorUnitDigits,
    resourceId: resource.resourceId,
    resource: {
      id: resource.resourceId,
      type: resource.employeeId === null ? 'shop-primary' : 'employee',
      employeeId: resource.employeeId,
      employeeName: resource.employeeName,
    },
    employeeId: resource.employeeId,
    employeeName: resource.employeeName,
    localDate: interval.localDate,
    localStartTime: interval.localStartTime,
    timeZone: interval.timeZone,
    durationMinutes: interval.durationMinutes,
    bufferBeforeMinutes: interval.bufferBeforeMinutes,
    bufferAfterMinutes: interval.bufferAfterMinutes,
    startAt: admin.firestore.Timestamp.fromMillis(interval.startAtEpochMs),
    endAt: admin.firestore.Timestamp.fromMillis(interval.endAtEpochMs),
    occupiedStartAt: admin.firestore.Timestamp.fromMillis(interval.occupiedStartAtEpochMs),
    occupiedEndAt: admin.firestore.Timestamp.fromMillis(interval.occupiedEndAtEpochMs),
    occupancyIds,
    policy: { ...policy },
    consentVersion: policy.consentVersion,
    selectedDate: interval.localDate,
    selectedTime: interval.localStartTime,
    selectedServices: service.snapshots.map((snapshot) => ({
      id: snapshot.id,
      name: snapshot.name,
      durationMinutes: snapshot.durationMinutes,
      duration: String(snapshot.durationMinutes),
      priceMinor: snapshot.priceMinor,
      currency: snapshot.currency,
      minorUnitDigits: snapshot.minorUnitDigits,
      price: formatMinorAmount(snapshot.priceMinor, snapshot.currency),
    })),
    totalPrice: formatMinorAmount(service.totalPriceMinor, service.currency),
    rescheduledAt: serverTimestamp,
    updatedAt: serverTimestamp,
  };
}

async function rescheduleBookingV2({
  db,
  admin,
  payload,
  actor,
  idempotencyKey,
  nowEpochMs,
}) {
  requireDependencies(db, admin);
  const verifiedActor = normalizeVerifiedActor(actor);
  const intent = normalizeRescheduleIntent(payload);
  const validatedKey = validateIdempotencyKey(idempotencyKey);
  const effectiveNow = normalizeNow(nowEpochMs);
  const commandId = createCommandId({
    operation: 'reschedule',
    actorId: `uid:${verifiedActor.uid}`,
    idempotencyKey: validatedKey,
  });
  const actorScopeHash = sha256Canonical({
    scope: 'booking-actor-scope:v2',
    actorScope: `uid:${verifiedActor.uid}`,
  });
  const requestHash = createRequestHash({ operation: 'reschedule', intent });
  const commandRef = db.collection('bookingCommands').doc(commandId);
  const bookingRef = db.collection('bookings').doc(intent.bookingId);
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  return db.runTransaction(async (transaction) => {
    const commandSnapshot = await transaction.get(commandRef);
    const replay = replayOrThrow(commandSnapshot, 'reschedule', requestHash);
    if (replay !== null) {
      return replay;
    }
    const bookingSnapshot = await transaction.get(bookingRef);
    if (!bookingSnapshot.exists) {
      throw mutationError('BOOKING_NOT_FOUND', 'booking does not exist', 404);
    }
    const rawBooking = bookingSnapshot.data();
    let shopId;
    try {
      shopId = normalizeIdentifier(rawBooking?.shopId, 'booking.shopId');
    } catch (error) {
      if (error instanceof BookingError) {
        throw migrationRequired('booking shop identity is missing or noncanonical');
      }
      throw error;
    }
    const shopRef = db.collection('barberShops').doc(shopId);
    const shopSnapshot = await transaction.get(shopRef);
    if (!shopSnapshot.exists) {
      throw mutationError('SHOP_NOT_FOUND', 'shop does not exist or is inactive', 404, { shopId });
    }
    const shop = shopSnapshot.data();
    const policy = assertShopForMutation(shop, shopId);
    const canonical = assertCanonicalBooking({ db, snapshot: bookingSnapshot });
    const authorization = authorizeBookingMutation({
      actor: verifiedActor,
      booking: canonical.booking,
      shop,
    });

    assertExpectedVersion(canonical.booking, intent.expectedVersion);
    statusAfterReschedule(canonical.booking.status);
    assertCurrentResource(shop, canonical.booking);
    assertNoticeWindow(canonical.booking, policy, effectiveNow);

    const occupancyQuery = db.collection('bookingOccupancy')
      .where('bookingId', '==', intent.bookingId);
    const oldOccupancySnapshot = await transaction.get(occupancyQuery);
    assertOwnedOccupancy({
      booking: canonical.booking,
      expectedOccupancy: canonical.expectedOccupancy,
      occupancySnapshot: oldOccupancySnapshot,
    });

    const { authoritative } = rescheduleAuthoritative({
      shopId,
      shop,
      booking: canonical.booking,
      intent,
      actor: verifiedActor,
    });
    if (authoritative.interval.startAtEpochMs < effectiveNow) {
      throw mutationError('OUTSIDE_AVAILABILITY', 'reschedule target must be in the future', 422);
    }
    const newOccupancy = authoritative.buckets.map((bucket) => {
      const id = createOccupancyId({
        shopId,
        resourceId: canonical.booking.resourceId,
        localDate: bucket.localDate,
        bucketStartMinute: bucket.startMinute,
      });
      const bucketStartAtEpochMs = authoritative.interval.startAtEpochMs +
        ((bucket.startMinute - authoritative.interval.startMinute) * 60 * 1000);
      return Object.freeze({
        id,
        ref: db.collection('bookingOccupancy').doc(id),
        bucket,
        bucketStartAtEpochMs,
      });
    });
    const newSnapshots = await getAll(transaction, newOccupancy.map(({ ref }) => ref));
    const newSnapshotById = new Map(newSnapshots.map((snapshot) => [snapshot.id, snapshot]));
    const oldIds = new Set(canonical.expectedOccupancy.map(({ id }) => id));
    for (const expected of newOccupancy) {
      const snapshot = newSnapshotById.get(expected.id);
      if (snapshot?.exists && !oldIds.has(expected.id)) {
        throw mutationError('SLOT_CONFLICT', 'reschedule target is already occupied', 409);
      }
      if (snapshot?.exists && oldIds.has(expected.id)) {
        const occupancy = snapshot.data();
        if (
          occupancy.bookingId !== intent.bookingId ||
          occupancy.bookingVersion !== canonical.booking.version
        ) {
          throw migrationRequired('shared occupancy is not owned by the booking');
        }
      }
    }

    const newVersion = canonical.booking.version + 1;
    const newIds = newOccupancy.map(({ id }) => id);
    const updatedBooking = buildRescheduledBooking({
      booking: canonical.booking,
      authoritative,
      commandId,
      authorization,
      admin,
      serverTimestamp,
      occupancyIds: newIds,
    });
    const result = successResult({
      commandId,
      bookingId: intent.bookingId,
      booking: updatedBooking,
    });
    const event = buildEvent({
      bookingRef,
      eventType: 'booking.rescheduled',
      booking: { ...updatedBooking, bookingId: intent.bookingId },
      previousVersion: canonical.booking.version,
      authorization,
      commandId,
      serverTimestamp,
    });
    const outbox = buildMutationOutbox({
      db,
      operation: 'reschedule',
      booking: { ...updatedBooking, bookingId: intent.bookingId },
      commandId,
      serverTimestamp,
    });
    const newById = new Map(newOccupancy.map((entry) => [entry.id, entry]));

    transaction.update(bookingRef, updatedBooking);
    for (const old of canonical.expectedOccupancy) {
      if (!newById.has(old.id)) {
        transaction.delete(old.ref);
      }
    }
    for (const expected of newOccupancy) {
      const occupancyData = {
        schemaVersion: 2,
        occupancyId: expected.id,
        shopId,
        resourceId: canonical.booking.resourceId,
        bookingId: intent.bookingId,
        bookingVersion: newVersion,
        localDate: expected.bucket.localDate,
        bucketStartMinute: expected.bucket.startMinute,
        bucketEndMinute: expected.bucket.endMinute,
        bucketStartTime: expected.bucket.startTime,
        bucketEndTime: expected.bucket.endTime,
        startAt: admin.firestore.Timestamp.fromMillis(expected.bucketStartAtEpochMs),
        endAt: admin.firestore.Timestamp.fromMillis(
          expected.bucketStartAtEpochMs + (5 * 60 * 1000),
        ),
        updatedAt: serverTimestamp,
      };
      if (oldIds.has(expected.id)) {
        transaction.update(expected.ref, occupancyData);
      } else {
        transaction.create(expected.ref, {
          ...occupancyData,
          createdAt: serverTimestamp,
        });
      }
    }
    transaction.create(event.ref, event.data);
    writeOutbox(transaction, outbox);
    transaction.create(commandRef, {
      schemaVersion: 2,
      commandId,
      operation: 'reschedule',
      actorScopeHash,
      shopId,
      requestHash,
      state: 'succeeded',
      bookingId: intent.bookingId,
      result,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });

    return result;
  }, { maxAttempts: 20 });
}

module.exports = {
  cancelBookingV2,
  rescheduleBookingV2,
};
