'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { after, test } = require('node:test');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'Booking mutation integration tests require FIRESTORE_EMULATOR_HOST and refuse live Firestore.',
  );
}

if (process.env.GCLOUD_PROJECT !== 'demo-barbersbuddies') {
  throw new Error('Booking mutation tests require GCLOUD_PROJECT=demo-barbersbuddies.');
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor !== 20 && nodeMajor !== 22) {
  throw new Error(
    `Booking mutation integration tests require release Node 20 or migration Node 22, current ${process.version}.`,
  );
}

const admin = require('firebase-admin');
const { sha256Canonical } = require('../../src/booking/domain');
const { renderBookingEmail } = require('../../src/booking/email-templates');
const { BookingError } = require('../../src/booking/errors');
const { createBookingV2 } = require('../../src/booking/create');
const { cancelBookingV2, rescheduleBookingV2 } = require('../../src/booking/mutations');

const PROJECT_ID = 'demo-barbersbuddies';
const APP_NAME = `booking-mutations-emulator-${process.pid}`;
const NOW = Date.UTC(2026, 8, 1, 0, 0, 0);
const app = admin.initializeApp({ projectId: PROJECT_ID }, APP_NAME);
const db = app.firestore();

const CUSTOMER = Object.freeze({
  uid: 'customer-uid',
  email: 'customer@example.test',
  emailVerified: true,
});

function uniqueId(prefix) {
  return `${prefix}-${randomUUID().replaceAll('-', '')}`;
}

function key(prefix) {
  return uniqueId(prefix).slice(0, 80);
}

function availability() {
  return {
    monday: [{ startLocalTime: '09:00', endLocalTime: '18:00' }],
  };
}

function shopFixture(shopId) {
  return {
    schemaVersion: 2,
    active: true,
    ownerId: `owner-${shopId}`,
    name: 'Mutation Test Shop',
    email: 'shop@example.test',
    timeZone: 'Europe/Berlin',
    weeklyAvailability: availability(),
    dateExceptions: {},
    bookingPolicy: {
      consentVersion: 'booking-v2-test',
      guestBookingEnabled: true,
      cancellationNoticeMinutes: 60,
    },
    services: [{
      id: 'haircut',
      name: 'Haircut',
      active: true,
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      priceMinor: 2500,
      currency: 'EUR',
    }, {
      id: 'detail',
      name: 'Detail',
      active: true,
      durationMinutes: 7,
      bufferBeforeMinutes: 3,
      bufferAfterMinutes: 0,
      priceMinor: 950,
      currency: 'EUR',
    }],
    employees: [{
      id: 'employee-a',
      name: 'Employee A',
      active: true,
      bookable: true,
      serviceIds: ['haircut', 'detail'],
      weeklyAvailability: availability(),
      dateExceptions: {},
    }],
  };
}

function createIntent(shopId, localStartTime, serviceIds = ['haircut']) {
  return {
    shopId,
    requestedEmployeeId: 'employee-a',
    serviceIds,
    localDate: '2026-09-07',
    localStartTime,
    customer: {
      name: 'Mutation Customer',
      email: 'customer@example.test',
      phone: '+49 30 123456',
    },
    consentVersion: 'booking-v2-test',
  };
}

async function seedShop(t) {
  const shopId = uniqueId('shop');
  await db.collection('barberShops').doc(shopId).set(shopFixture(shopId));
  t.after(() => cleanupShop(shopId));
  return shopId;
}

async function createBooking(shopId, localStartTime, actor = CUSTOMER, serviceIds = ['haircut']) {
  return createBookingV2({
    db,
    admin,
    actor,
    payload: createIntent(shopId, localStartTime, serviceIds),
    idempotencyKey: key('create'),
  });
}

function cancelArgs(result, actor, overrides = {}) {
  return {
    db,
    admin,
    actor,
    nowEpochMs: NOW,
    idempotencyKey: key('cancel'),
    payload: {
      bookingId: result.booking.bookingId,
      expectedVersion: result.booking.version,
    },
    ...overrides,
  };
}

function rescheduleArgs(result, actor, localStartTime, overrides = {}) {
  return {
    db,
    admin,
    actor,
    nowEpochMs: NOW,
    idempotencyKey: key('reschedule'),
    payload: {
      bookingId: result.booking.bookingId,
      expectedVersion: result.booking.version,
      localDate: '2026-09-07',
      localStartTime,
    },
    ...overrides,
  };
}

async function fetchByShop(collectionName, shopId) {
  return db.collection(collectionName).where('shopId', '==', shopId).get();
}

async function deleteRefs(refs) {
  for (let offset = 0; offset < refs.length; offset += 400) {
    const batch = db.batch();
    for (const ref of refs.slice(offset, offset + 400)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

async function cleanupShop(shopId) {
  const bookings = await fetchByShop('bookings', shopId);
  const eventRefs = [];
  for (const booking of bookings.docs) {
    const events = await booking.ref.collection('events').get();
    eventRefs.push(...events.docs.map((snapshot) => snapshot.ref));
  }
  const infrastructure = await Promise.all([
    fetchByShop('bookingOccupancy', shopId),
    fetchByShop('bookingCommands', shopId),
    fetchByShop('bookingOutbox', shopId),
  ]);
  await deleteRefs([
    ...eventRefs,
    ...bookings.docs.map((snapshot) => snapshot.ref),
    ...infrastructure.flatMap((snapshot) => snapshot.docs.map((document) => document.ref)),
    db.collection('barberShops').doc(shopId),
  ]);
}

async function expectBookingError(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof BookingError, `expected BookingError, received ${error}`);
    assert.equal(error.code, code);
    return true;
  });
}

async function bookingData(bookingId) {
  return (await db.collection('bookings').doc(bookingId).get()).data();
}

async function bookingEvents(bookingId) {
  const snapshot = await db.collection('bookings').doc(bookingId).collection('events').get();
  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((left, right) => left.bookingVersion - right.bookingVersion);
}

async function infrastructureCounts(shopId) {
  const [occupancy, commands, outbox] = await Promise.all([
    fetchByShop('bookingOccupancy', shopId),
    fetchByShop('bookingCommands', shopId),
    fetchByShop('bookingOutbox', shopId),
  ]);
  return { occupancy: occupancy.size, commands: commands.size, outbox: outbox.size };
}

test('bound customer can cancel and only owned occupancy is released', async (t) => {
  const shopId = await seedShop(t);
  const created = await createBooking(shopId, '09:00');
  const cancelled = await cancelBookingV2(cancelArgs(created, CUSTOMER));
  assert.equal(cancelled.booking.status, 'cancelled');
  assert.equal(cancelled.booking.version, 2);
  const stored = await bookingData(created.booking.bookingId);
  assert.equal(stored.customerUid, CUSTOMER.uid);
  assert.deepEqual(stored.occupancyIds, []);
  assert.deepEqual(await infrastructureCounts(shopId), {
    occupancy: 0,
    commands: 2,
    outbox: 4,
  });
});

test('current authoritative owner can cancel but a former owner cannot', async (t) => {
  const shopId = await seedShop(t);
  const created = await createBooking(shopId, '09:30');
  const oldOwner = { uid: `owner-${shopId}`, emailVerified: false };
  await db.collection('barberShops').doc(shopId).update({ ownerId: 'new-owner' });
  await expectBookingError(cancelBookingV2(cancelArgs(created, oldOwner)), 'FORBIDDEN');
  const result = await cancelBookingV2(cancelArgs(created, {
    uid: 'new-owner',
    emailVerified: false,
  }));
  assert.equal(result.booking.status, 'cancelled');
});

test('verified normalized email binds an unowned guest booking exactly once', async (t) => {
  const shopId = await seedShop(t);
  const created = await createBooking(shopId, '10:00', null);
  const result = await rescheduleBookingV2(rescheduleArgs(created, {
    uid: 'legacy-customer',
    email: '  CUSTOMER@EXAMPLE.TEST ',
    email_verified: true,
  }, '10:30'));
  assert.equal(result.booking.version, 2);
  assert.equal((await bookingData(created.booking.bookingId)).customerUid, 'legacy-customer');

  await expectBookingError(cancelBookingV2(cancelArgs({
    booking: { ...result.booking },
  }, {
    uid: 'different-uid',
    email: 'customer@example.test',
    emailVerified: true,
  })), 'FORBIDDEN');
});

test('legacy binding requires userEmail and exact canonical stored customerUid', async (t) => {
  const shopId = await seedShop(t);
  const guest = await createBooking(shopId, '10:30', null);
  const guestRef = db.collection('bookings').doc(guest.booking.bookingId);
  await guestRef.update({ userEmail: admin.firestore.FieldValue.delete() });
  await expectBookingError(cancelBookingV2(cancelArgs(guest, {
    uid: 'email-only-customer',
    email: 'customer@example.test',
    emailVerified: true,
  })), 'FORBIDDEN');

  await guestRef.update({
    userEmail: 'customer@example.test',
    customerUid: ' padded-customer ',
  });
  await expectBookingError(cancelBookingV2(cancelArgs(guest, {
    uid: 'padded-customer',
    emailVerified: true,
  })), 'BOOKING_MIGRATION_REQUIRED');
});

test('unrelated, unverified-email, missing, and request-body-spoofed identities are rejected', async (t) => {
  const shopId = await seedShop(t);
  const created = await createBooking(shopId, '11:00', null);
  await expectBookingError(cancelBookingV2(cancelArgs(created, null)), 'UNAUTHENTICATED');
  await expectBookingError(cancelBookingV2(cancelArgs(created, {
    uid: 'unverified', email: 'customer@example.test', emailVerified: false,
  })), 'FORBIDDEN');
  await expectBookingError(cancelBookingV2(cancelArgs(created, {
    uid: 'unrelated', email: 'other@example.test', emailVerified: true,
  }, {
    payload: {
      bookingId: created.booking.bookingId,
      expectedVersion: 1,
      customerUid: 'unrelated',
      ownerId: 'unrelated',
      email: 'customer@example.test',
    },
  })), 'FORBIDDEN');
});

test('padded and DEL-bearing verified actor UIDs fail before any mutation', async (t) => {
  const shopId = await seedShop(t);
  const created = await createBooking(shopId, '11:15');
  const counts = await infrastructureCounts(shopId);
  await expectBookingError(cancelBookingV2(cancelArgs(created, {
    uid: ` ${CUSTOMER.uid} `,
    emailVerified: true,
  })), 'UNAUTHENTICATED');
  await expectBookingError(cancelBookingV2(cancelArgs(created, {
    uid: `${CUSTOMER.uid}\u007f`,
    emailVerified: true,
  })), 'UNAUTHENTICATED');
  assert.equal((await bookingData(created.booking.bookingId)).status, 'pending');
  assert.deepEqual(await infrastructureCounts(shopId), counts);
});

test('a padded authoritative owner ID is rejected as invalid configuration, not authority',
  async (t) => {
    const shopId = await seedShop(t);
    const created = await createBooking(shopId, '11:20');
    const ownerUid = `owner-${shopId}`;
    const counts = await infrastructureCounts(shopId);
    await db.collection('barberShops').doc(shopId).update({ ownerId: ` ${ownerUid} ` });
    await expectBookingError(cancelBookingV2(cancelArgs(created, {
      uid: ownerUid,
      emailVerified: false,
    })), 'INVALID_ARGUMENT');
    assert.equal((await bookingData(created.booking.bookingId)).status, 'pending');
    assert.deepEqual(await infrastructureCounts(shopId), counts);
  });

test('padded or DEL-bearing canonical shop and resource IDs require migration write-free',
  async (t) => {
    const shopId = await seedShop(t);
    const created = await createBooking(shopId, '11:25');
    const bookingRef = db.collection('bookings').doc(created.booking.bookingId);
    const original = await bookingData(created.booking.bookingId);
    const counts = await infrastructureCounts(shopId);

    try {
      await bookingRef.update({ shopId: ` ${shopId} ` });
      await expectBookingError(cancelBookingV2(cancelArgs(created, CUSTOMER)),
        'BOOKING_MIGRATION_REQUIRED');
      await bookingRef.update({ shopId: `${shopId}\u007f` });
      await expectBookingError(cancelBookingV2(cancelArgs(created, CUSTOMER)),
        'BOOKING_MIGRATION_REQUIRED');
    } finally {
      await bookingRef.update({ shopId });
    }

    await bookingRef.update({ resourceId: ` ${original.resourceId} ` });
    await expectBookingError(cancelBookingV2(cancelArgs(created, CUSTOMER)),
      'BOOKING_MIGRATION_REQUIRED');
    await bookingRef.update({ resourceId: `${original.resourceId}\u007f` });
    await expectBookingError(cancelBookingV2(cancelArgs(created, CUSTOMER)),
      'BOOKING_MIGRATION_REQUIRED');
    await bookingRef.update({ resourceId: original.resourceId });

    const after = await bookingData(created.booking.bookingId);
    assert.equal(after.status, 'pending');
    assert.equal(after.version, 1);
    assert.deepEqual(await infrastructureCounts(shopId), counts);
  });

test('stale expectedVersion fails without command, outbox, or occupancy changes', async (t) => {
  const shopId = await seedShop(t);
  const created = await createBooking(shopId, '11:30');
  const before = await infrastructureCounts(shopId);
  await expectBookingError(cancelBookingV2(cancelArgs(created, CUSTOMER, {
    payload: { bookingId: created.booking.bookingId, expectedVersion: 2 },
  })), 'BOOKING_VERSION_CONFLICT');
  assert.equal((await bookingData(created.booking.bookingId)).version, 1);
  assert.deepEqual(await infrastructureCounts(shopId), before);
});

test('legacy or corrupt occupancy ownership requires migration and is never deleted', async (t) => {
  const shopId = await seedShop(t);
  const created = await createBooking(shopId, '12:00');
  const booking = await bookingData(created.booking.bookingId);
  const occupancyRef = db.collection('bookingOccupancy').doc(booking.occupancyIds[0]);
  await occupancyRef.update({ bookingId: 'some-other-booking' });
  await expectBookingError(cancelBookingV2(cancelArgs(created, CUSTOMER)),
    'BOOKING_MIGRATION_REQUIRED');
  assert.equal((await occupancyRef.get()).exists, true);
  assert.equal((await bookingData(created.booking.bookingId)).status, 'pending');
});

test('a schema-v1 legacy booking cannot enter the v2 mutation path', async (t) => {
  const shopId = await seedShop(t);
  const created = await createBooking(shopId, '12:15');
  await db.collection('bookings').doc(created.booking.bookingId).update({
    schemaVersion: admin.firestore.FieldValue.delete(),
  });
  const counts = await infrastructureCounts(shopId);
  await expectBookingError(cancelBookingV2(cancelArgs(created, CUSTOMER)),
    'BOOKING_MIGRATION_REQUIRED');
  assert.deepEqual(await infrastructureCounts(shopId), counts);
});

test('same idempotency key replays; changed intent is rejected', async (t) => {
  const shopId = await seedShop(t);
  const created = await createBooking(shopId, '12:30');
  const idempotencyKey = key('same-cancel');
  const args = cancelArgs(created, CUSTOMER, { idempotencyKey });
  const first = await cancelBookingV2(args);
  const replay = await cancelBookingV2(args);
  assert.equal(replay.replayed, true);
  assert.equal(replay.commandId, first.commandId);
  assert.deepEqual(replay.booking, first.booking);
  await expectBookingError(cancelBookingV2({
    ...args,
    payload: { ...args.payload, expectedVersion: 2 },
  }), 'IDEMPOTENCY_KEY_REUSED');
});

test('a committed replay is independent of later shop state and detects changed booking intent first',
  async (t) => {
    const shopId = await seedShop(t);
    const created = await createBooking(shopId, '12:45');
    const idempotencyKey = key('durable-replay');
    const args = cancelArgs(created, CUSTOMER, { idempotencyKey });
    const first = await cancelBookingV2(args);
    await db.collection('barberShops').doc(shopId).update({
      active: false,
      ownerId: 'replacement-owner',
    });
    const replay = await cancelBookingV2(args);
    assert.equal(replay.replayed, true);
    assert.deepEqual(replay.booking, first.booking);

    await expectBookingError(cancelBookingV2({
      ...args,
      payload: {
        bookingId: uniqueId('missing-booking'),
        expectedVersion: 1,
      },
    }), 'IDEMPOTENCY_KEY_REUSED');
  });

test('same-key cancelled replay succeeds while a new cancellation command fails write-free',
  async (t) => {
  const shopId = await seedShop(t);
  const created = await createBooking(shopId, '13:00');
  const originalArgs = cancelArgs(created, CUSTOMER);
  const first = await cancelBookingV2(originalArgs);
  const before = await infrastructureCounts(shopId);
  const bookingRef = db.collection('bookings').doc(created.booking.bookingId);
  const eventsBefore = (await bookingRef.collection('events').get()).size;

  const replay = await cancelBookingV2(originalArgs);
  assert.equal(replay.replayed, true);
  assert.equal(replay.commandId, first.commandId);
  assert.deepEqual(replay.booking, first.booking);
  assert.deepEqual(await infrastructureCounts(shopId), before);
  assert.equal((await bookingRef.collection('events').get()).size, eventsBefore);

  await expectBookingError(cancelBookingV2(cancelArgs(created, CUSTOMER)),
    'INVALID_STATUS_TRANSITION');
  assert.deepEqual(await infrastructureCounts(shopId), before);
  assert.equal((await bookingRef.collection('events').get()).size, eventsBefore);
});

test('commands and mutation outbox records contain hashes and routing metadata, not raw PII',
  async (t) => {
    const shopId = await seedShop(t);
    const created = await createBooking(shopId, '13:15');
    const rawKey = key('private-cancel-key');
    const cancelled = await cancelBookingV2(cancelArgs(created, CUSTOMER, {
      idempotencyKey: rawKey,
    }));
    const command = (await db.collection('bookingCommands')
      .doc(cancelled.commandId).get()).data();
    assert.match(command.actorScopeHash, /^[a-f0-9]{64}$/);
    assert.equal(Object.hasOwn(command, 'actorScope'), false);
    assert.equal(Object.hasOwn(command, 'actorUid'), false);
    assert.equal(Object.hasOwn(command, 'idempotencyKey'), false);

    const commandText = JSON.stringify(command);
    assert.equal(commandText.includes(rawKey), false);
    assert.equal(commandText.includes(CUSTOMER.uid), false);
    assert.equal(commandText.includes(CUSTOMER.email), false);

    const outbox = await fetchByShop('bookingOutbox', shopId);
    for (const snapshot of outbox.docs) {
      const data = snapshot.data();
      assert.equal(Object.hasOwn(data, 'recipient'), false);
      assert.equal(Object.hasOwn(data, 'payload'), false);
      const text = JSON.stringify(data);
      assert.equal(text.includes(CUSTOMER.uid), false);
      assert.equal(text.includes(CUSTOMER.email), false);
      assert.equal(text.includes('Mutation Customer'), false);
      assert.equal(text.includes('+49 30 123456'), false);
    }
  });

test('created, rescheduled, and cancelled events retain immutable version-linked email snapshots',
  async (t) => {
    const shopId = await seedShop(t);
    const created = await createBooking(shopId, '09:00');
    const moved = await rescheduleBookingV2(rescheduleArgs(created, CUSTOMER, '10:30'));
    const cancelled = await cancelBookingV2(cancelArgs({ booking: moved.booking }, CUSTOMER));
    assert.equal(cancelled.booking.version, 3);

    const events = await bookingEvents(created.booking.bookingId);
    assert.equal(events.length, 3);
    assert.deepEqual(events.map((event) => event.eventType), [
      'booking.created',
      'booking.rescheduled',
      'booking.cancelled',
    ]);
    assert.deepEqual(events.map((event) => event.notificationSnapshot.startAt), [
      '2026-09-07T07:00:00.000Z',
      '2026-09-07T08:30:00.000Z',
      '2026-09-07T08:30:00.000Z',
    ]);
    assert.deepEqual(events.map((event) => event.notificationSnapshot.localStartTime), [
      '09:00', '10:30', '10:30',
    ]);

    const outbox = await fetchByShop('bookingOutbox', shopId);
    assert.equal(outbox.size, 6);
    for (const event of events) {
      const expectedEventId = sha256Canonical({
        scope: 'booking-event:v2',
        bookingId: created.booking.bookingId,
        version: event.bookingVersion,
        eventType: event.eventType,
      });
      assert.equal(event.id, expectedEventId);
      assert.equal(event.eventId, expectedEventId);
      const linked = outbox.docs.filter((document) => document.data().eventId === event.eventId);
      assert.equal(linked.length, 2);
      assert.deepEqual(new Set(linked.map((document) => document.data().audience)),
        new Set(['customer', 'shop']));
      for (const document of linked) {
        const data = document.data();
        assert.equal(data.bookingId, event.bookingId);
        assert.equal(data.bookingVersion, event.bookingVersion);
        assert.equal(data.commandId, event.commandId);
        const rendered = renderBookingEmail({
          eventType: data.eventType,
          snapshot: event.notificationSnapshot,
        }, { recipientEmail: 'delivery@example.test' });
        assert.match(rendered.text, /Mutation Test Shop/u);
        assert.equal(Object.hasOwn(data, 'recipient'), false);
        assert.equal(Object.hasOwn(data, 'body'), false);
        assert.equal(Object.hasOwn(data, 'provider'), false);
      }
      const serialized = JSON.stringify(event.notificationSnapshot);
      assert.equal(serialized.includes('Mutation Customer'), false);
      assert.equal(serialized.includes(CUSTOMER.email), false);
      assert.equal(serialized.includes('+49 30 123456'), false);
    }
  });

test('cancellation fails write-free when the pre-cancel notification projection is malformed',
  async (t) => {
    const shopId = await seedShop(t);
    const created = await createBooking(shopId, '09:15');
    const bookingRef = db.collection('bookings').doc(created.booking.bookingId);
    await bookingRef.update({ services: [] });
    const before = await infrastructureCounts(shopId);
    const eventsBefore = (await bookingEvents(created.booking.bookingId)).length;

    await expectBookingError(cancelBookingV2(cancelArgs(created, CUSTOMER)),
      'BOOKING_MIGRATION_REQUIRED');

    assert.equal((await bookingData(created.booking.bookingId)).status, 'pending');
    assert.deepEqual(await infrastructureCounts(shopId), before);
    assert.equal((await bookingEvents(created.booking.bookingId)).length, eventsBefore);
  });

test('reschedule conflict leaves source booking and occupancy unchanged', async (t) => {
  const shopId = await seedShop(t);
  const source = await createBooking(shopId, '13:30');
  await createBooking(shopId, '14:30');
  const before = await bookingData(source.booking.bookingId);
  const beforeIds = Array.from(before.occupancyIds);
  const counts = await infrastructureCounts(shopId);
  await expectBookingError(rescheduleBookingV2(
    rescheduleArgs(source, CUSTOMER, '14:30'),
  ), 'SLOT_CONFLICT');
  const after = await bookingData(source.booking.bookingId);
  assert.equal(after.version, 1);
  assert.equal(after.localStartTime, '13:30');
  assert.deepEqual(after.occupancyIds, beforeIds);
  assert.deepEqual(await infrastructureCounts(shopId), counts);
});

test('reschedule blocks a changed consent version without fabricating acceptance or writes',
  async (t) => {
    const shopId = await seedShop(t);
    const source = await createBooking(shopId, '13:45');
    const before = await bookingData(source.booking.bookingId);
    const counts = await infrastructureCounts(shopId);
    await db.collection('barberShops').doc(shopId).update({
      'bookingPolicy.consentVersion': 'booking-v3',
    });
    await expectBookingError(rescheduleBookingV2(
      rescheduleArgs(source, CUSTOMER, '14:15'),
    ), 'INVALID_ARGUMENT');
    const after = await bookingData(source.booking.bookingId);
    assert.equal(after.consentVersion, 'booking-v2-test');
    assert.equal(after.version, before.version);
    assert.deepEqual(after.occupancyIds, before.occupancyIds);
    assert.deepEqual(await infrastructureCounts(shopId), counts);
  });

test('reschedule preserves status and permits half-open adjacency', async (t) => {
  const shopId = await seedShop(t);
  const source = await createBooking(shopId, '14:00');
  const neighbor = await createBooking(shopId, '15:00');
  await db.collection('bookings').doc(source.booking.bookingId).update({ status: 'confirmed' });
  const moved = await rescheduleBookingV2(rescheduleArgs(source, CUSTOMER, '14:30'));
  assert.equal(moved.booking.status, 'confirmed');
  assert.equal(moved.booking.version, 2);
  assert.equal(moved.booking.endAt, neighbor.booking.startAt);
  const occupancy = await fetchByShop('bookingOccupancy', shopId);
  assert.equal(occupancy.size, 12);
  assert.equal(occupancy.docs.filter((doc) =>
    doc.data().bookingId === source.booking.bookingId).length, 6);
});

test('reschedule preserves exact bucket instants for a seven-minute service with pre-buffer',
  async (t) => {
    const shopId = await seedShop(t);
    const source = await createBooking(shopId, '10:00', CUSTOMER, ['detail']);
    const moved = await rescheduleBookingV2(rescheduleArgs(source, CUSTOMER, '10:15'));
    assert.equal(moved.booking.startAt, '2026-09-07T08:15:00.000Z');
    assert.equal(moved.booking.endAt, '2026-09-07T08:22:00.000Z');

    const occupancy = await fetchByShop('bookingOccupancy', shopId);
    const owned = occupancy.docs
      .filter((doc) => doc.data().bookingId === source.booking.bookingId)
      .map((doc) => doc.data())
      .sort((left, right) => left.bucketStartMinute - right.bucketStartMinute);
    assert.deepEqual(owned.map((bucket) => bucket.bucketStartTime), [
      '10:10', '10:15', '10:20',
    ]);
    assert.deepEqual(owned.map((bucket) => bucket.startAt.toDate().toISOString()), [
      '2026-09-07T08:10:00.000Z',
      '2026-09-07T08:15:00.000Z',
      '2026-09-07T08:20:00.000Z',
    ]);
    assert.deepEqual(owned.map((bucket) => bucket.endAt.toDate().toISOString()), [
      '2026-09-07T08:15:00.000Z',
      '2026-09-07T08:20:00.000Z',
      '2026-09-07T08:25:00.000Z',
    ]);
  });

test('multi-service reschedule refreshes canonical and legacy money metadata', async (t) => {
  const shopId = await seedShop(t);
  const source = await createBooking(shopId, '10:00', CUSTOMER, ['haircut', 'detail']);
  const moved = await rescheduleBookingV2(rescheduleArgs(source, CUSTOMER, '11:00'));
  const booking = await bookingData(moved.booking.bookingId);

  assert.equal(booking.totalPriceMinor, 3450);
  assert.equal(booking.currency, 'EUR');
  assert.equal(booking.minorUnitDigits, 2);
  assert.equal(booking.totalPrice, '34.50');
  assert.equal(booking.durationMinutes, 37);
  assert.equal(booking.bufferBeforeMinutes, 3);
  assert.deepEqual(booking.services.map((service) => ({
    id: service.id,
    minorUnitDigits: service.minorUnitDigits,
  })), [
    { id: 'haircut', minorUnitDigits: 2 },
    { id: 'detail', minorUnitDigits: 2 },
  ]);
  assert.deepEqual(booking.selectedServices.map((service) => ({
    id: service.id,
    currency: service.currency,
    minorUnitDigits: service.minorUnitDigits,
    price: service.price,
  })), [
    { id: 'haircut', currency: 'EUR', minorUnitDigits: 2, price: '25.00' },
    { id: 'detail', currency: 'EUR', minorUnitDigits: 2, price: '9.50' },
  ]);
});

test('current shop owner can reschedule while unrelated and missing actors cannot', async (t) => {
  const shopId = await seedShop(t);
  const created = await createBooking(shopId, '15:00');
  await expectBookingError(rescheduleBookingV2(
    rescheduleArgs(created, null, '15:30'),
  ), 'UNAUTHENTICATED');
  await expectBookingError(rescheduleBookingV2(rescheduleArgs(created, {
    uid: 'unrelated', email: 'other@example.test', emailVerified: true,
  }, '15:30')), 'FORBIDDEN');
  const moved = await rescheduleBookingV2(rescheduleArgs(created, {
    uid: `owner-${shopId}`,
    emailVerified: false,
  }, '15:30'));
  assert.equal(moved.booking.version, 2);
  assert.equal(moved.booking.status, 'pending');
});

test('cancel versus reschedule race commits exactly one mutation without leaked buckets', async (t) => {
  const shopId = await seedShop(t);
  const created = await createBooking(shopId, '15:30');
  const attempts = await Promise.allSettled([
    cancelBookingV2(cancelArgs(created, CUSTOMER)),
    rescheduleBookingV2(rescheduleArgs(created, CUSTOMER, '16:00')),
  ]);
  assert.equal(attempts.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(attempts.filter(({ status }) => status === 'rejected').length, 1);
  const rejected = attempts.find(({ status }) => status === 'rejected').reason;
  assert.ok(rejected instanceof BookingError);
  assert.equal(rejected.code, 'BOOKING_VERSION_CONFLICT');

  const booking = await bookingData(created.booking.bookingId);
  const occupancy = await fetchByShop('bookingOccupancy', shopId);
  const owned = occupancy.docs.filter((doc) => doc.data().bookingId === created.booking.bookingId);
  assert.equal(booking.version, 2);
  assert.equal(owned.length, booking.status === 'cancelled' ? 0 : 6);
  assert.deepEqual(new Set(owned.map((doc) => doc.id)), new Set(booking.occupancyIds));
});

test('two concurrent reschedules with one version yield one winner and no leaked buckets', async (t) => {
  const shopId = await seedShop(t);
  const created = await createBooking(shopId, '16:30');
  const attempts = await Promise.allSettled([
    rescheduleBookingV2(rescheduleArgs(created, CUSTOMER, '17:00')),
    rescheduleBookingV2(rescheduleArgs(created, CUSTOMER, '17:30')),
  ]);
  assert.equal(attempts.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(attempts.filter(({ status }) => status === 'rejected').length, 1);
  const rejected = attempts.find(({ status }) => status === 'rejected').reason;
  assert.ok(rejected instanceof BookingError);
  assert.equal(rejected.code, 'BOOKING_VERSION_CONFLICT');

  const booking = await bookingData(created.booking.bookingId);
  assert.equal(booking.version, 2);
  assert.ok(['17:00', '17:30'].includes(booking.localStartTime));
  const occupancy = await fetchByShop('bookingOccupancy', shopId);
  const owned = occupancy.docs.filter((doc) => doc.data().bookingId === created.booking.bookingId);
  assert.equal(owned.length, 6);
  assert.deepEqual(new Set(owned.map((doc) => doc.id)), new Set(booking.occupancyIds));
});

after(async () => {
  await app.delete();
});
