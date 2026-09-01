'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { sha256Canonical } = require('../../src/booking/domain');
const {
  EVENT_CONTRACT,
  createBookingDeliveryResolver,
} = require('../../src/booking/delivery-resolver');

function hash(value) {
  return sha256Canonical(value);
}

function makeSnapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    shopName: 'Historical Shop',
    services: [{
      id: 'haircut',
      name: 'Historical Cut',
      durationMinutes: 30,
      priceMinor: 2550,
      currency: 'EUR',
      minorUnitDigits: 2,
    }],
    totalPriceMinor: 2550,
    currency: 'EUR',
    minorUnitDigits: 2,
    localDate: '2026-09-05',
    localStartTime: '14:05',
    timeZone: 'Europe/Berlin',
    startAt: '2026-09-05T12:05:00.000Z',
    ...overrides,
  };
}

function operationFor(eventType) {
  return eventType.replace(/\.(customer|shop)-email$/u, '');
}

function makeEnvelope({
  eventType = 'booking.created.customer-email',
  bookingVersion = 1,
  bookingId = 'booking-1',
  shopId = 'shop-1',
  commandId = 'c'.repeat(64),
} = {}) {
  const operation = operationFor(eventType);
  return {
    outboxId: hash({
      scope: 'booking-outbox:v2',
      bookingId,
      version: bookingVersion,
      eventType,
    }),
    eventType,
    channel: 'email',
    audience: EVENT_CONTRACT[eventType].audience,
    bookingId,
    bookingVersion,
    shopId,
    commandId,
    eventId: hash({
      scope: 'booking-event:v2',
      bookingId,
      version: bookingVersion,
      eventType: operation,
    }),
  };
}

function makeBooking(envelope, overrides = {}) {
  return {
    schemaVersion: 2,
    bookingId: envelope.bookingId,
    shopId: envelope.shopId,
    version: envelope.bookingVersion,
    commandId: envelope.commandId,
    customer: {
      name: 'Private Customer',
      email: 'customer@example.test',
      phone: '+490000000',
    },
    ...overrides,
  };
}

function makeEvent(envelope, overrides = {}) {
  const event = {
    schemaVersion: 2,
    eventId: envelope.eventId,
    eventType: operationFor(envelope.eventType),
    bookingId: envelope.bookingId,
    bookingVersion: envelope.bookingVersion,
    shopId: envelope.shopId,
    actor: { kind: 'customer', uid: 'customer-uid' },
    commandId: envelope.commandId,
    notificationSnapshot: makeSnapshot(),
    occurredAt: { seconds: 1, nanoseconds: 0 },
    ...overrides,
  };
  if (event.eventType !== 'booking.created' && !Object.hasOwn(event, 'previousVersion')) {
    event.previousVersion = envelope.bookingVersion - 1;
  }
  return event;
}

function createFixture(envelope, overrides = {}) {
  const booking = overrides.booking ?? makeBooking(envelope);
  const event = overrides.event ?? makeEvent(envelope);
  const shop = overrides.shop ?? { email: 'current-shop@example.test' };
  const records = new Map([
    [`bookings/${envelope.bookingId}`, { exists: true, data: booking }],
    [`bookings/${envelope.bookingId}/events/${envelope.eventId}`, { exists: true, data: event }],
    [`barberShops/${envelope.shopId}`, { exists: true, data: shop }],
  ]);
  for (const [path, value] of Object.entries(overrides.records ?? {})) {
    records.set(path, value);
  }
  const paths = [];
  const readDocument = overrides.readDocument ?? (async (path) => {
    paths.push(path);
    return records.get(path) ?? { exists: false };
  });
  return {
    paths,
    resolve: createBookingDeliveryResolver({ readDocument }),
  };
}

test('resolves all six operation and audience pairs through the exact three source paths', async () => {
  for (const eventType of Object.keys(EVENT_CONTRACT)) {
    const envelope = makeEnvelope({
      eventType,
      bookingVersion: eventType.includes('created') ? 1 : 2,
    });
    const fixture = createFixture(envelope);
    const result = await fixture.resolve(envelope);

    assert.equal(result.kind, 'deliver');
    assert.equal(
      result.delivery.to,
      envelope.audience === 'customer'
        ? 'customer@example.test'
        : 'current-shop@example.test',
    );
    assert.match(result.delivery.text, /Historical Cut/u);
    assert.deepEqual(fixture.paths, [
      `bookings/${envelope.bookingId}`,
      `bookings/${envelope.bookingId}/events/${envelope.eventId}`,
      `barberShops/${envelope.shopId}`,
    ]);
  }
});

test('delayed create-v1 and reschedule-v2 deliveries render their own historical events', async () => {
  const createEnvelope = makeEnvelope({
    eventType: 'booking.created.customer-email',
    bookingVersion: 1,
  });
  const createBooking = makeBooking(createEnvelope, {
    version: 2,
    commandId: 'd'.repeat(64),
    localDate: '2026-10-10',
    localStartTime: '18:00',
  });
  const createFixtureV1 = createFixture(createEnvelope, { booking: createBooking });
  const createResult = await createFixtureV1.resolve(createEnvelope);

  const rescheduleEnvelope = makeEnvelope({
    eventType: 'booking.rescheduled.customer-email',
    bookingVersion: 2,
    commandId: 'd'.repeat(64),
  });
  const rescheduleBooking = makeBooking(rescheduleEnvelope, {
    localDate: '2026-10-10',
    localStartTime: '18:00',
  });
  const rescheduleEvent = makeEvent(rescheduleEnvelope, {
    notificationSnapshot: makeSnapshot({
      localDate: '2026-10-10',
      localStartTime: '18:00',
      startAt: '2026-10-10T16:00:00.000Z',
    }),
  });
  const rescheduleFixtureV2 = createFixture(rescheduleEnvelope, {
    booking: rescheduleBooking,
    event: rescheduleEvent,
  });
  const rescheduleResult = await rescheduleFixtureV2.resolve(rescheduleEnvelope);

  assert.equal(createResult.kind, 'deliver');
  assert.match(createResult.delivery.text, /2026-09-05/u);
  assert.match(createResult.delivery.text, /14:05/u);
  assert.equal(createResult.delivery.text.includes('2026-10-10'), false);
  assert.equal(createResult.delivery.text.includes('18:00'), false);
  assert.equal(rescheduleResult.kind, 'deliver');
  assert.match(rescheduleResult.delivery.text, /2026-10-10/u);
  assert.match(rescheduleResult.delivery.text, /18:00/u);
});

test('fails closed when envelope identity, channel, audience, or deterministic links drift', async () => {
  const envelope = makeEnvelope();
  const prototypeEventType = '__proto__';
  const cases = [
    { ...envelope, extra: true },
    { ...envelope, channel: 'push' },
    { ...envelope, audience: 'shop' },
    { ...envelope, bookingId: '../other' },
    { ...envelope, bookingVersion: 0 },
    { ...envelope, commandId: 'wrong' },
    { ...envelope, eventId: 'a'.repeat(64) },
    { ...envelope, outboxId: 'b'.repeat(64) },
    {
      ...envelope,
      eventType: prototypeEventType,
      audience: undefined,
      outboxId: hash({
        scope: 'booking-outbox:v2',
        bookingId: envelope.bookingId,
        version: envelope.bookingVersion,
        eventType: prototypeEventType,
      }),
      eventId: 'a'.repeat(64),
    },
  ];
  const fixture = createFixture(envelope);
  for (const candidate of cases) {
    assert.deepEqual(await fixture.resolve(candidate), {
      kind: 'dead', category: 'SOURCE_MALFORMED',
    });
  }
  assert.deepEqual(fixture.paths, []);
});

test('enforces create-v1 and mutation-v2-or-later boundaries for both audiences', async () => {
  const forged = [];
  for (const audience of ['customer', 'shop']) {
    forged.push(makeEnvelope({
      eventType: `booking.created.${audience}-email`,
      bookingVersion: 2,
    }));
    for (const operation of ['cancelled', 'rescheduled']) {
      forged.push(makeEnvelope({
        eventType: `booking.${operation}.${audience}-email`,
        bookingVersion: 1,
      }));
    }
  }

  for (const envelope of forged) {
    const fixture = createFixture(envelope);
    assert.deepEqual(await fixture.resolve(envelope), {
      kind: 'dead', category: 'SOURCE_MALFORMED',
    });
    assert.deepEqual(fixture.paths, []);
  }
});

test('rejects mismatched booking and event identities, versions, operations, and commands', async () => {
  const envelope = makeEnvelope({ eventType: 'booking.rescheduled.customer-email', bookingVersion: 2 });
  const cases = [
    { booking: makeBooking(envelope, { schemaVersion: 1 }) },
    { booking: makeBooking(envelope, { bookingId: 'other-booking' }) },
    { booking: makeBooking(envelope, { shopId: 'other-shop' }) },
    { booking: makeBooking(envelope, { version: 1 }) },
    { booking: makeBooking(envelope, { commandId: 'd'.repeat(64) }) },
    { event: makeEvent(envelope, { eventId: 'e'.repeat(64) }) },
    { event: makeEvent(envelope, { eventType: 'booking.cancelled' }) },
    { event: makeEvent(envelope, { bookingId: 'other-booking' }) },
    { event: makeEvent(envelope, { bookingVersion: 3 }) },
    { event: makeEvent(envelope, { previousVersion: 0 }) },
    { event: makeEvent(envelope, { shopId: 'other-shop' }) },
    { event: makeEvent(envelope, { commandId: 'd'.repeat(64) }) },
  ];
  for (const overrides of cases) {
    const result = await createFixture(envelope, overrides).resolve(envelope);
    assert.deepEqual(result, { kind: 'dead', category: 'SOURCE_MALFORMED' });
  }
});

test('rejects malformed, PII-bearing, and civil-time-invalid historical snapshots', async () => {
  const envelope = makeEnvelope();
  const cases = [
    makeSnapshot({ customerEmail: 'private@example.test' }),
    makeSnapshot({ totalPriceMinor: 1 }),
    makeSnapshot({ localDate: '2026-02-29' }),
    makeSnapshot({ startAt: '2026-09-05T13:05:00.000Z' }),
  ];
  for (const notificationSnapshot of cases) {
    const event = makeEvent(envelope, { notificationSnapshot });
    const result = await createFixture(envelope, { event }).resolve(envelope);
    assert.deepEqual(result, { kind: 'dead', category: 'SOURCE_MALFORMED' });
  }
});

test('maps missing documents and malformed document-reader results to fixed worker outcomes', async () => {
  const envelope = makeEnvelope();
  const bookingPath = `bookings/${envelope.bookingId}`;
  const eventPath = `${bookingPath}/events/${envelope.eventId}`;
  const shopPath = `barberShops/${envelope.shopId}`;
  const cases = [
    [bookingPath, { exists: false }, 'BOOKING_NOT_FOUND'],
    [eventPath, { exists: false }, 'SOURCE_MALFORMED'],
    [shopPath, { exists: false }, 'SHOP_NOT_FOUND'],
    [bookingPath, { exists: false, data: {} }, 'SOURCE_MALFORMED'],
    [eventPath, { exists: true }, 'SOURCE_MALFORMED'],
    [shopPath, { exists: true, data: null }, 'SOURCE_MALFORMED'],
  ];
  for (const [path, source, category] of cases) {
    const fixture = createFixture(envelope, { records: { [path]: source } });
    assert.deepEqual(await fixture.resolve(envelope), { kind: 'dead', category });
  }
});

test('uses only canonical booking customer email and current shop email as recipient authority', async () => {
  const customerEnvelope = makeEnvelope();
  const customerCases = [
    makeBooking(customerEnvelope, {
      customer: { name: 'Customer', phone: '1' },
      userEmail: 'legacy@example.test',
      email: 'root@example.test',
    }),
    makeBooking(customerEnvelope, {
      customer: { email: 'not-an-email' },
      userEmail: 'legacy@example.test',
    }),
  ];
  for (const booking of customerCases) {
    const result = await createFixture(customerEnvelope, { booking }).resolve(customerEnvelope);
    assert.deepEqual(result, { kind: 'dead', category: 'RECIPIENT_MISSING' });
  }

  const shopEnvelope = makeEnvelope({ eventType: 'booking.created.shop-email' });
  const shopCases = [
    { ownerEmail: 'owner@example.test' },
    { email: 'not-an-email', ownerEmail: 'owner@example.test' },
  ];
  for (const shop of shopCases) {
    const booking = makeBooking(shopEnvelope, { shopEmail: 'snapshot@example.test' });
    const result = await createFixture(shopEnvelope, { booking, shop }).resolve(shopEnvelope);
    assert.deepEqual(result, { kind: 'dead', category: 'RECIPIENT_MISSING' });
  }
});

test('reader failures become safe retries without leaking thrown text', async () => {
  const privateMarker = 'private-person@example.test';
  const envelope = makeEnvelope();
  const fixture = createFixture(envelope, {
    readDocument: async () => {
      throw new Error(privateMarker);
    },
  });
  const result = await fixture.resolve(envelope);

  assert.deepEqual(result, { kind: 'retry', category: 'SOURCE_UNAVAILABLE' });
  assert.equal(JSON.stringify(result).includes(privateMarker), false);
});

test('hostile source proxies and accessors fail closed without executing payload code', async () => {
  const envelope = makeEnvelope();
  let trapCalls = 0;
  let getterCalls = 0;
  const hostileProxy = new Proxy({}, {
    get() {
      trapCalls += 1;
      throw new Error('private-proxy-marker@example.test');
    },
    ownKeys() {
      trapCalls += 1;
      throw new Error('private-proxy-marker@example.test');
    },
    getPrototypeOf() {
      trapCalls += 1;
      throw new Error('private-proxy-marker@example.test');
    },
    getOwnPropertyDescriptor() {
      trapCalls += 1;
      throw new Error('private-proxy-marker@example.test');
    },
  });
  const accessorBooking = makeBooking(envelope);
  Object.defineProperty(accessorBooking, 'shopId', {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error('private-getter-marker@example.test');
    },
  });
  const hostileOccurredAt = {};
  Object.defineProperty(hostileOccurredAt, 'seconds', {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error('private-time-marker@example.test');
    },
  });
  Object.defineProperty(hostileOccurredAt, 'nanoseconds', {
    enumerable: true,
    value: 0,
  });
  const accessorEvent = makeEvent(envelope, { occurredAt: hostileOccurredAt });

  const proxyResult = await createFixture(envelope, { booking: hostileProxy }).resolve(envelope);
  const accessorResult = await createFixture(envelope, { booking: accessorBooking }).resolve(envelope);
  const timeResult = await createFixture(envelope, { event: accessorEvent }).resolve(envelope);

  assert.deepEqual(proxyResult, { kind: 'dead', category: 'SOURCE_MALFORMED' });
  assert.deepEqual(accessorResult, { kind: 'dead', category: 'SOURCE_MALFORMED' });
  assert.deepEqual(timeResult, { kind: 'dead', category: 'SOURCE_MALFORMED' });
  assert.equal(trapCalls, 0);
  assert.equal(getterCalls, 0);
  assert.equal(JSON.stringify([proxyResult, accessorResult, timeResult]).includes('private-'), false);
});

test('requires a trusted injected reader and exposes no provider or network side effect', () => {
  assert.throws(() => createBookingDeliveryResolver(), /document reader/u);
  assert.throws(() => createBookingDeliveryResolver({ readDocument: null }), /document reader/u);
  assert.deepEqual(Object.keys(require('../../src/booking/delivery-resolver')).sort(), [
    'EVENT_CONTRACT',
    'createBookingDeliveryResolver',
  ]);
});
