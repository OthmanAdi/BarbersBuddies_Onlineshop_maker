'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { after, test } = require('node:test');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'Booking create integration tests require FIRESTORE_EMULATOR_HOST and refuse to use live Firestore.',
  );
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor !== 20 && nodeMajor !== 22) {
  throw new Error(
    `Booking create integration tests require the release Node 20 or migration Node 22 runtime, current runtime is ${process.version}.`,
  );
}

const admin = require('firebase-admin');
const { sha256Canonical } = require('../../src/booking/domain');
const { renderBookingEmail } = require('../../src/booking/email-templates');
const { BookingError } = require('../../src/booking/errors');
const { createBookingV2 } = require('../../src/booking/create');

const APP_NAME = `booking-create-emulator-${process.pid}`;
const PROJECT_ID = 'demo-barbersbuddies';
const app = admin.initializeApp({ projectId: PROJECT_ID }, APP_NAME);
const db = app.firestore();

const WEEKLY_AVAILABILITY = Object.freeze({
  monday: Object.freeze([
    Object.freeze({ startLocalTime: '09:00', endLocalTime: '18:00' }),
  ]),
});

function uniqueId(prefix) {
  return `${prefix}-${randomUUID().replaceAll('-', '')}`;
}

function idempotencyKey(prefix) {
  return uniqueId(prefix).slice(0, 80);
}

function shopFixture(shopId) {
  return {
    schemaVersion: 2,
    active: true,
    ownerId: `owner-${shopId}`,
    name: 'Emulator Barber Shop',
    email: 'shop@example.test',
    timeZone: 'Europe/Berlin',
    weeklyAvailability: WEEKLY_AVAILABILITY,
    dateExceptions: {},
    bookingPolicy: {
      consentVersion: 'booking-v2-test',
      guestBookingEnabled: true,
      cancellationNoticeMinutes: 60,
    },
    services: [
      {
        id: 'haircut',
        name: 'Haircut',
        active: true,
        durationMinutes: 30,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        priceMinor: 2500,
        currency: 'EUR',
      },
      {
        id: 'detail',
        name: 'Detail',
        active: true,
        durationMinutes: 7,
        bufferBeforeMinutes: 3,
        bufferAfterMinutes: 0,
        priceMinor: 950,
        currency: 'EUR',
      },
    ],
    employees: [
      {
        id: 'employee-a',
        name: 'Employee A',
        active: true,
        bookable: true,
        serviceIds: ['haircut', 'detail'],
        weeklyAvailability: WEEKLY_AVAILABILITY,
        dateExceptions: {},
      },
      {
        id: 'employee-b',
        name: 'Employee B',
        active: true,
        bookable: true,
        serviceIds: ['haircut', 'detail'],
        weeklyAvailability: WEEKLY_AVAILABILITY,
        dateExceptions: {},
      },
    ],
  };
}

function createIntent(shopId, localStartTime, overrides = {}) {
  return {
    shopId,
    requestedEmployeeId: 'employee-a',
    serviceIds: ['haircut'],
    localDate: '2026-09-07',
    localStartTime,
    customer: {
      name: 'Emulator Customer',
      email: 'customer@example.test',
      phone: '+49 30 123456',
    },
    consentVersion: 'booking-v2-test',
    ...overrides,
  };
}

async function seedShop(t) {
  const shopId = uniqueId('shop');
  await db.collection('barberShops').doc(shopId).set(shopFixture(shopId));
  t.after(() => cleanupShop(shopId));
  return shopId;
}

async function queryByShop(collectionName, shopId) {
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
  const bookings = await queryByShop('bookings', shopId);
  const eventRefs = [];
  for (const booking of bookings.docs) {
    const events = await booking.ref.collection('events').get();
    eventRefs.push(...events.docs.map((snapshot) => snapshot.ref));
  }
  await deleteRefs(eventRefs);

  const infrastructure = await Promise.all([
    queryByShop('bookingOccupancy', shopId),
    queryByShop('bookingCommands', shopId),
    queryByShop('bookingOutbox', shopId),
  ]);
  await deleteRefs([
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

async function countBookingEvents(bookings) {
  let count = 0;
  for (const booking of bookings.docs) {
    count += (await booking.ref.collection('events').get()).size;
  }
  return count;
}

async function assertInfrastructureCounts(shopId, expected) {
  const [bookings, occupancy, commands, outbox] = await Promise.all([
    queryByShop('bookings', shopId),
    queryByShop('bookingOccupancy', shopId),
    queryByShop('bookingCommands', shopId),
    queryByShop('bookingOutbox', shopId),
  ]);
  assert.equal(bookings.size, expected.bookings, 'booking document count');
  assert.equal(occupancy.size, expected.occupancy, 'occupancy document count');
  assert.equal(commands.size, expected.commands, 'successful command document count');
  assert.equal(outbox.size, expected.outbox, 'outbox document count');
  assert.equal(await countBookingEvents(bookings), expected.events, 'booking event count');
  return { bookings, occupancy, commands, outbox };
}

test('authenticated create derives identity from actor and ignores spoofed authority and money', async (t) => {
  const shopId = await seedShop(t);
  const key = idempotencyKey('authenticated');
  const result = await createBookingV2({
    db,
    admin,
    actor: { uid: 'verified-customer', email: 'verified@example.test' },
    idempotencyKey: key,
    payload: createIntent(shopId, '09:00', {
      customerUid: 'spoofed-uid',
      ownerId: 'spoofed-owner',
      shopEmail: 'attacker@example.test',
      status: 'completed',
      priceMinor: 1,
      totalPrice: '0.01',
      durationMinutes: 5,
      timeZone: 'UTC',
      createdAt: '2000-01-01T00:00:00.000Z',
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.replayed, false);
  const booking = (await db.collection('bookings').doc(result.booking.bookingId).get()).data();
  assert.equal(booking.customerUid, 'verified-customer');
  assert.equal(booking.shopOwnerId, `owner-${shopId}`);
  assert.equal(booking.shopEmail, 'shop@example.test');
  assert.equal(booking.status, 'pending');
  assert.equal(booking.totalPriceMinor, 2500);
  assert.equal(booking.durationMinutes, 30);
  assert.equal(booking.timeZone, 'Europe/Berlin');
  assert.equal(booking.schemaVersion, 2);
  const infrastructure = await assertInfrastructureCounts(shopId, {
    bookings: 1, occupancy: 6, commands: 1, outbox: 2, events: 1,
  });
  const command = infrastructure.commands.docs[0].data();
  assert.match(command.actorScopeHash, /^[a-f0-9]{64}$/);
  assert.equal(Object.hasOwn(command, 'idempotencyKey'), false);
  assert.equal(Object.hasOwn(command, 'actorScope'), false);
  assert.equal(Object.hasOwn(command, 'actorUid'), false);
  assert.equal(JSON.stringify(command).includes(key), false);
  assert.equal(JSON.stringify(command).includes('verified-customer'), false);
  const bookingRef = db.collection('bookings').doc(result.booking.bookingId);
  const events = await bookingRef.collection('events').get();
  assert.equal(events.size, 1);
  const event = events.docs[0].data();
  const expectedEventId = sha256Canonical({
    scope: 'booking-event:v2',
    bookingId: result.booking.bookingId,
    version: 1,
    eventType: 'booking.created',
  });
  assert.equal(events.docs[0].id, expectedEventId);
  assert.equal(event.eventId, expectedEventId);
  assert.equal(event.bookingVersion, 1);
  assert.equal(event.notificationSnapshot.startAt, result.booking.startAt);
  assert.equal(event.notificationSnapshot.localStartTime, '09:00');
  assert.equal(Object.hasOwn(event.notificationSnapshot.services[0], 'bufferBeforeMinutes'), false);
  assert.equal(Object.hasOwn(event.notificationSnapshot.services[0], 'bufferAfterMinutes'), false);
  const rendered = renderBookingEmail({
    eventType: 'booking.created.customer-email',
    snapshot: event.notificationSnapshot,
  }, { recipientEmail: 'delivery@example.test' });
  assert.match(rendered.text, /EUR 25\.00/u);
  const notificationText = JSON.stringify(event.notificationSnapshot);
  assert.equal(notificationText.includes('Emulator Customer'), false);
  assert.equal(notificationText.includes('customer@example.test'), false);
  assert.equal(notificationText.includes('+49 30 123456'), false);
  for (const outboxDocument of infrastructure.outbox.docs) {
    const outbox = outboxDocument.data();
    assert.equal(outbox.eventId, expectedEventId);
    assert.equal(outbox.bookingVersion, event.bookingVersion);
    assert.equal(outbox.bookingId, event.bookingId);
    assert.equal(outbox.commandId, event.commandId);
    assert.equal(Object.hasOwn(outbox, 'recipient'), false);
    assert.equal(Object.hasOwn(outbox, 'payload'), false);
    assert.equal(Object.hasOwn(outbox, 'body'), false);
    assert.equal(Object.hasOwn(outbox, 'provider'), false);
    assert.equal(Object.hasOwn(outbox, 'customerName'), false);
    const serialized = JSON.stringify(outbox);
    assert.equal(serialized.includes('Emulator Customer'), false);
    assert.equal(serialized.includes('customer@example.test'), false);
    assert.equal(serialized.includes('+49 30 123456'), false);
  }
});

test('guest create replays the same key and rejects a changed request hash', async (t) => {
  const shopId = await seedShop(t);
  const key = idempotencyKey('guest-replay');
  const payload = createIntent(shopId, '10:00');
  const first = await createBookingV2({ db, admin, payload, actor: null, idempotencyKey: key });
  const replay = await createBookingV2({ db, admin, payload, actor: null, idempotencyKey: key });

  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.commandId, first.commandId);
  assert.deepEqual(replay.booking, first.booking);
  await expectBookingError(createBookingV2({
    db,
    admin,
    actor: null,
    idempotencyKey: key,
    payload: createIntent(shopId, '10:05'),
  }), 'IDEMPOTENCY_KEY_REUSED');
  await assertInfrastructureCounts(shopId, {
    bookings: 1, occupancy: 6, commands: 1, outbox: 2, events: 1,
  });
});

test('concurrent same-key retries converge on one booking and nineteen replays', async (t) => {
  const shopId = await seedShop(t);
  const key = idempotencyKey('same-key-race');
  const payload = createIntent(shopId, '10:00');
  const results = await Promise.all(Array.from({ length: 20 }, () => createBookingV2({
    db,
    admin,
    payload,
    actor: null,
    idempotencyKey: key,
  })));

  assert.equal(results.filter((result) => result.replayed === false).length, 1);
  assert.equal(results.filter((result) => result.replayed === true).length, 19);
  assert.equal(new Set(results.map((result) => result.commandId)).size, 1);
  assert.equal(new Set(results.map((result) => result.booking.bookingId)).size, 1);
  await assertInfrastructureCounts(shopId, {
    bookings: 1, occupancy: 6, commands: 1, outbox: 2, events: 1,
  });
});

test('half-open adjacency succeeds while a partial overlap conflicts', async (t) => {
  const shopId = await seedShop(t);
  const first = await createBookingV2({
    db,
    admin,
    payload: createIntent(shopId, '10:00'),
    idempotencyKey: idempotencyKey('adjacent-first'),
  });
  const adjacent = await createBookingV2({
    db,
    admin,
    payload: createIntent(shopId, '10:30'),
    idempotencyKey: idempotencyKey('adjacent-second'),
  });
  assert.equal(first.booking.endAt, adjacent.booking.startAt);

  await expectBookingError(createBookingV2({
    db,
    admin,
    payload: createIntent(shopId, '10:25'),
    idempotencyKey: idempotencyKey('partial-overlap'),
  }), 'SLOT_CONFLICT');
  await assertInfrastructureCounts(shopId, {
    bookings: 2, occupancy: 12, commands: 2, outbox: 4, events: 2,
  });
});

test('seven-minute service with a three-minute pre-buffer reserves conservative buckets', async (t) => {
  const shopId = await seedShop(t);
  const result = await createBookingV2({
    db,
    admin,
    payload: createIntent(shopId, '10:00', { serviceIds: ['detail'] }),
    idempotencyKey: idempotencyKey('seven-minute-buffer'),
  });
  const infrastructure = await assertInfrastructureCounts(shopId, {
    bookings: 1, occupancy: 3, commands: 1, outbox: 2, events: 1,
  });
  const booking = infrastructure.bookings.docs[0].data();
  const occupancy = infrastructure.occupancy.docs
    .map((document) => document.data())
    .sort((left, right) => left.bucketStartMinute - right.bucketStartMinute);

  assert.equal(result.booking.startAt, '2026-09-07T08:00:00.000Z');
  assert.equal(result.booking.endAt, '2026-09-07T08:07:00.000Z');
  assert.equal(booking.durationMinutes, 7);
  assert.equal(booking.bufferBeforeMinutes, 3);
  assert.equal(booking.totalPriceMinor, 950);
  assert.equal(booking.occupiedStartAt.toMillis(), Date.parse('2026-09-07T07:57:00.000Z'));
  assert.deepEqual(occupancy.map((bucket) => bucket.bucketStartMinute), [595, 600, 605]);
  assert.equal(occupancy[0].startAt.toMillis(), Date.parse('2026-09-07T07:55:00.000Z'));
  assert.equal(occupancy[0].endAt.toMillis(), Date.parse('2026-09-07T08:00:00.000Z'));
});

test('multi-service create persists server-owned money metadata in canonical and legacy views',
  async (t) => {
    const shopId = await seedShop(t);
    const result = await createBookingV2({
      db,
      admin,
      payload: createIntent(shopId, '10:00', { serviceIds: ['haircut', 'detail'] }),
      idempotencyKey: idempotencyKey('multi-service-money'),
    });
    const booking = (await db.collection('bookings').doc(result.booking.bookingId).get()).data();

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

test('the same local slot is independent across different employees', async (t) => {
  const shopId = await seedShop(t);
  const employeeA = await createBookingV2({
    db,
    admin,
    payload: createIntent(shopId, '11:00', { requestedEmployeeId: 'employee-a' }),
    idempotencyKey: idempotencyKey('employee-a'),
  });
  const employeeB = await createBookingV2({
    db,
    admin,
    payload: createIntent(shopId, '11:00', { requestedEmployeeId: 'employee-b' }),
    idempotencyKey: idempotencyKey('employee-b'),
  });
  assert.equal(employeeA.booking.resourceId, 'employee:employee-a');
  assert.equal(employeeB.booking.resourceId, 'employee:employee-b');
  await assertInfrastructureCounts(shopId, {
    bookings: 2, occupancy: 12, commands: 2, outbox: 4, events: 2,
  });
});

test('any-employee allocation chooses the first lexicographically vacant candidate', async (t) => {
  const shopId = await seedShop(t);
  await createBookingV2({
    db,
    admin,
    payload: createIntent(shopId, '12:00', { requestedEmployeeId: 'employee-a' }),
    idempotencyKey: idempotencyKey('occupy-first'),
  });
  const allocated = await createBookingV2({
    db,
    admin,
    payload: createIntent(shopId, '12:00', { requestedEmployeeId: null }),
    idempotencyKey: idempotencyKey('allocate-any'),
  });
  assert.equal(allocated.booking.resourceId, 'employee:employee-b');
  await assertInfrastructureCounts(shopId, {
    bookings: 2, occupancy: 12, commands: 2, outbox: 4, events: 2,
  });
});

test('an intentionally empty roster uses the deterministic primary shop resource', async (t) => {
  const shopId = await seedShop(t);
  await db.collection('barberShops').doc(shopId).update({ employees: [] });
  const result = await createBookingV2({
    db,
    admin,
    payload: createIntent(shopId, '13:00', { requestedEmployeeId: null }),
    idempotencyKey: idempotencyKey('primary-fallback'),
  });

  assert.equal(result.booking.resourceId, `shop:${shopId}:primary`);
  const infrastructure = await assertInfrastructureCounts(shopId, {
    bookings: 1, occupancy: 6, commands: 1, outbox: 2, events: 1,
  });
  assert.ok(infrastructure.occupancy.docs.every((document) =>
    document.data().resourceId === `shop:${shopId}:primary`));
});

test('noncanonical persisted employee identifiers fail closed', async (t) => {
  const shopId = await seedShop(t);
  const malformedEmployees = shopFixture(shopId).employees;
  malformedEmployees[0].id = ' employee-a ';
  await db.collection('barberShops').doc(shopId).update({ employees: malformedEmployees });

  await expectBookingError(createBookingV2({
    db,
    admin,
    payload: createIntent(shopId, '13:30'),
    idempotencyKey: idempotencyKey('noncanonical-roster'),
  }), 'SHOP_RESOURCE_CONFIG_REQUIRED');
  await assertInfrastructureCounts(shopId, {
    bookings: 0, occupancy: 0, commands: 0, outbox: 0, events: 0,
  });
});

test('a missing canonical requested employee remains EMPLOYEE_NOT_FOUND', async (t) => {
  const shopId = await seedShop(t);
  await expectBookingError(createBookingV2({
    db,
    admin,
    payload: createIntent(shopId, '13:30', { requestedEmployeeId: 'employee-missing' }),
    idempotencyKey: idempotencyKey('missing-employee'),
  }), 'EMPLOYEE_NOT_FOUND');
  await assertInfrastructureCounts(shopId, {
    bookings: 0, occupancy: 0, commands: 0, outbox: 0, events: 0,
  });
});

test('twenty concurrent creates yield one success and nineteen slot conflicts', async (t) => {
  const shopId = await seedShop(t);
  const attempts = await Promise.allSettled(Array.from({ length: 20 }, (_, index) =>
    createBookingV2({
      db,
      admin,
      payload: createIntent(shopId, '14:00'),
      idempotencyKey: idempotencyKey(`race-${String(index).padStart(2, '0')}`),
    })));
  const successes = attempts.filter((attempt) => attempt.status === 'fulfilled');
  const failures = attempts.filter((attempt) => attempt.status === 'rejected');

  assert.equal(successes.length, 1);
  assert.equal(failures.length, 19);
  for (const failure of failures) {
    assert.ok(failure.reason instanceof BookingError);
    assert.equal(failure.reason.code, 'SLOT_CONFLICT');
  }
  await assertInfrastructureCounts(shopId, {
    bookings: 1, occupancy: 6, commands: 1, outbox: 2, events: 1,
  });
});

after(async () => {
  await app.delete();
});
