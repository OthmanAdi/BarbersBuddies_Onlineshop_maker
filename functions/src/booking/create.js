'use strict';

const {
  createCommandId,
  createOccupancyId,
  createRequestHash,
  sha256Canonical,
  validateIdempotencyKey,
} = require('./domain');
const { BookingError } = require('./errors');
const {
  buildAuthoritativeNotificationSnapshot,
  buildCreateBookingOutbox,
} = require('./outbox');
const {
  formatMinorAmount,
  normalizeCreateIntent,
  resolveAuthoritativeBooking,
} = require('./services');

function createError(code, message, httpStatus, details = {}) {
  return new BookingError(code, message, {
    httpStatus,
    retryable: false,
    details,
  });
}

function requireDependencies(db, admin) {
  if (!db || typeof db.collection !== 'function' || typeof db.runTransaction !== 'function') {
    throw new TypeError('createBookingV2 requires an Admin Firestore db');
  }
  if (
    !admin?.firestore?.Timestamp ||
    !admin?.firestore?.FieldValue ||
    typeof admin.firestore.Timestamp.fromMillis !== 'function' ||
    typeof admin.firestore.FieldValue.serverTimestamp !== 'function'
  ) {
    throw new TypeError('createBookingV2 requires the Firebase Admin SDK');
  }
}

function isoInstant(epochMilliseconds) {
  return new Date(epochMilliseconds).toISOString();
}

function createPublicResult({ commandId, bookingId, resource, interval }) {
  return Object.freeze({
    ok: true,
    commandId,
    replayed: false,
    booking: Object.freeze({
      bookingId,
      version: 1,
      status: 'pending',
      resourceId: resource.resourceId,
      startAt: isoInstant(interval.startAtEpochMs),
      endAt: isoInstant(interval.endAtEpochMs),
    }),
  });
}

function buildBookingDocument({
  bookingId,
  commandId,
  intent,
  actor,
  authoritative,
  resource,
  occupancyIds,
  admin,
  serverTimestamp,
}) {
  const { interval, policy, service, shop } = authoritative;
  const startAt = admin.firestore.Timestamp.fromMillis(interval.startAtEpochMs);
  const endAt = admin.firestore.Timestamp.fromMillis(interval.endAtEpochMs);
  const occupiedStartAt = admin.firestore.Timestamp.fromMillis(interval.occupiedStartAtEpochMs);
  const occupiedEndAt = admin.firestore.Timestamp.fromMillis(interval.occupiedEndAtEpochMs);
  const selectedServices = service.snapshots.map((snapshot) => ({
    id: snapshot.id,
    name: snapshot.name,
    durationMinutes: snapshot.durationMinutes,
    duration: String(snapshot.durationMinutes),
    priceMinor: snapshot.priceMinor,
    currency: snapshot.currency,
    minorUnitDigits: snapshot.minorUnitDigits,
    price: formatMinorAmount(snapshot.priceMinor, snapshot.currency),
  }));

  return {
    schemaVersion: 2,
    bookingId,
    commandId,
    version: 1,
    status: 'pending',
    shopId: shop.id,
    shopName: shop.name,
    shopOwnerId: shop.ownerId,
    ownerId: shop.ownerId,
    shopEmail: shop.email,
    customerUid: actor.uid,
    createdByUid: actor.uid,
    customer: {
      name: intent.customer.name,
      email: intent.customer.email,
      phone: intent.customer.phone,
    },
    serviceIds: Array.from(intent.serviceIds),
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
    startAt,
    endAt,
    occupiedStartAt,
    occupiedEndAt,
    occupancyIds,
    policy: { ...policy },
    consentVersion: policy.consentVersion,
    createdAt: serverTimestamp,
    updatedAt: serverTimestamp,

    // Temporary, server-owned legacy read projection for uncut screens.
    userName: intent.customer.name,
    userEmail: intent.customer.email,
    userPhone: intent.customer.phone,
    selectedDate: interval.localDate,
    selectedTime: interval.localStartTime,
    selectedServices,
    totalPrice: formatMinorAmount(service.totalPriceMinor, service.currency),
  };
}

async function readOccupancy(transaction, refs) {
  if (refs.length === 0) {
    return [];
  }
  if (typeof transaction.getAll === 'function') {
    return transaction.getAll(...refs);
  }
  return Promise.all(refs.map((ref) => transaction.get(ref)));
}

function selectVacantResource({ authoritative, occupancyByPath, occupancyRefsByResource }) {
  for (const resource of authoritative.resources) {
    const refs = occupancyRefsByResource.get(resource.resourceId);
    const vacant = refs.every((ref) => occupancyByPath.get(ref.path)?.exists === false);
    if (vacant) {
      return resource;
    }
  }
  throw createError('SLOT_CONFLICT', 'requested booking interval is already occupied', 409);
}

async function createBookingV2({
  db,
  admin,
  payload,
  actor = null,
  idempotencyKey,
}) {
  requireDependencies(db, admin);
  const validatedKey = validateIdempotencyKey(idempotencyKey);
  const { actor: normalizedActor, intent } = normalizeCreateIntent(payload, actor);
  const actorScope = normalizedActor.uid === null
    ? `guest:${intent.shopId}`
    : `uid:${normalizedActor.uid}`;
  const actorScopeHash = sha256Canonical({
    scope: 'booking-actor-scope:v2',
    actorScope,
  });
  const commandId = createCommandId({
    operation: 'create',
    actorId: actorScope,
    idempotencyKey: validatedKey,
  });
  const requestHash = createRequestHash({ operation: 'create', intent });

  // A random booking ID is allocated once. Firestore may retry the callback, but
  // every retry uses this same reference and every logical replay uses the command result.
  const bookingRef = db.collection('bookings').doc();
  const commandRef = db.collection('bookingCommands').doc(commandId);
  const shopRef = db.collection('barberShops').doc(intent.shopId);
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  return db.runTransaction(async (transaction) => {
    const commandSnapshot = await transaction.get(commandRef);
    if (commandSnapshot.exists) {
      const command = commandSnapshot.data();
      if (command.operation !== 'create' || command.requestHash !== requestHash) {
        throw createError(
          'IDEMPOTENCY_KEY_REUSED',
          'idempotency key was already used for different booking intent',
          409,
        );
      }
      if (!command.result || command.state !== 'succeeded') {
        throw createError('INTERNAL', 'stored command result is incomplete', 500);
      }
      return {
        ...command.result,
        replayed: true,
      };
    }

    const shopSnapshot = await transaction.get(shopRef);
    if (!shopSnapshot.exists) {
      throw createError('SHOP_NOT_FOUND', 'shop does not exist or is inactive', 404, {
        shopId: intent.shopId,
      });
    }
    const authoritative = resolveAuthoritativeBooking({
      shopId: intent.shopId,
      shop: shopSnapshot.data(),
      intent,
      actor: normalizedActor,
    });

    const occupancyRefsByResource = new Map();
    const allOccupancyRefs = [];
    for (const resource of authoritative.resources) {
      const refs = authoritative.buckets.map((bucket) => db.collection('bookingOccupancy').doc(
        createOccupancyId({
          shopId: intent.shopId,
          resourceId: resource.resourceId,
          localDate: bucket.localDate,
          bucketStartMinute: bucket.startMinute,
        }),
      ));
      occupancyRefsByResource.set(resource.resourceId, refs);
      allOccupancyRefs.push(...refs);
    }

    // This is the last transaction read. Every candidate is read before resource
    // selection so the write phase is deterministic and contains no read-after-write.
    const occupancySnapshots = await readOccupancy(transaction, allOccupancyRefs);
    const occupancyByPath = new Map(occupancySnapshots.map((snapshot) => [
      snapshot.ref.path,
      snapshot,
    ]));
    const resource = selectVacantResource({
      authoritative,
      occupancyByPath,
      occupancyRefsByResource,
    });
    const occupancyRefs = occupancyRefsByResource.get(resource.resourceId);
    const occupancyIds = occupancyRefs.map((ref) => ref.id);
    const publicResult = createPublicResult({
      commandId,
      bookingId: bookingRef.id,
      resource,
      interval: authoritative.interval,
    });
    const booking = buildBookingDocument({
      bookingId: bookingRef.id,
      commandId,
      intent,
      actor: normalizedActor,
      authoritative,
      resource,
      occupancyIds,
      admin,
      serverTimestamp,
    });
    const eventId = sha256Canonical({
      scope: 'booking-event:v2',
      bookingId: bookingRef.id,
      version: 1,
      eventType: 'booking.created',
    });
    const eventRef = bookingRef.collection('events').doc(eventId);
    const notificationSnapshot = buildAuthoritativeNotificationSnapshot({
      shopName: authoritative.shop.name,
      service: authoritative.service,
      interval: authoritative.interval,
    });
    const outbox = buildCreateBookingOutbox({
      db,
      bookingId: bookingRef.id,
      bookingVersion: booking.version,
      shopId: booking.shopId,
      commandId,
      eventId,
      serverTimestamp,
    });

    transaction.create(bookingRef, booking);
    authoritative.buckets.forEach((bucket, index) => {
      const occupancyRef = occupancyRefs[index];
      const bucketStartAtEpochMs = authoritative.interval.startAtEpochMs +
        ((bucket.startMinute - authoritative.interval.startMinute) * 60 * 1000);
      transaction.create(occupancyRef, {
        schemaVersion: 2,
        occupancyId: occupancyRef.id,
        shopId: intent.shopId,
        resourceId: resource.resourceId,
        bookingId: bookingRef.id,
        bookingVersion: 1,
        localDate: bucket.localDate,
        bucketStartMinute: bucket.startMinute,
        bucketEndMinute: bucket.endMinute,
        bucketStartTime: bucket.startTime,
        bucketEndTime: bucket.endTime,
        startAt: admin.firestore.Timestamp.fromMillis(bucketStartAtEpochMs),
        endAt: admin.firestore.Timestamp.fromMillis(bucketStartAtEpochMs + (5 * 60 * 1000)),
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      });
    });
    transaction.create(eventRef, {
      schemaVersion: 2,
      eventId,
      eventType: 'booking.created',
      bookingId: bookingRef.id,
      bookingVersion: 1,
      shopId: intent.shopId,
      actor: {
        kind: normalizedActor.kind,
        uid: normalizedActor.uid,
      },
      commandId,
      notificationSnapshot,
      occurredAt: serverTimestamp,
    });
    for (const write of outbox) {
      transaction.create(write.ref, write.data);
    }
    transaction.create(commandRef, {
      schemaVersion: 2,
      commandId,
      operation: 'create',
      actorScopeHash,
      shopId: intent.shopId,
      requestHash,
      state: 'succeeded',
      bookingId: bookingRef.id,
      result: publicResult,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });

    return publicResult;
  }, { maxAttempts: 20 });
}

module.exports = {
  createBookingV2,
};
