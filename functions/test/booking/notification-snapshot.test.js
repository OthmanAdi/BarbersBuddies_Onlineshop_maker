'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  NotificationSnapshotError,
  SNAPSHOT_SCHEMA_VERSION,
  buildBookingNotificationSnapshot,
} = require('../../src/booking/notification-snapshot');
const { renderBookingEmail } = require('../../src/booking/email-templates');

function makeSource(overrides = {}) {
  return {
    schemaVersion: 1,
    shopName: 'Barbers & Buddies',
    services: [
      {
        id: 'haircut',
        name: 'Cut & Style',
        durationMinutes: 30,
        priceMinor: 2550,
        currency: 'EUR',
        minorUnitDigits: 2,
      },
      {
        id: 'beard',
        name: 'Beard Detail',
        durationMinutes: 15,
        priceMinor: 950,
        currency: 'EUR',
        minorUnitDigits: 2,
      },
    ],
    totalPriceMinor: 3500,
    currency: 'EUR',
    minorUnitDigits: 2,
    localDate: '2026-09-05',
    localStartTime: '14:05',
    timeZone: 'Europe/Berlin',
    startAt: '2026-09-05T12:05:00.000Z',
    ...overrides,
  };
}

function expectSnapshotError(callback) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof NotificationSnapshotError);
    assert.equal(error.code, 'INVALID_NOTIFICATION_SNAPSHOT_SOURCE');
    assert.equal(error.message, 'Invalid booking notification snapshot source.');
    assert.equal(error.message.includes('attacker'), false);
    return true;
  });
}

test('builds exactly the email snapshot contract as a deeply frozen detached value', () => {
  const source = makeSource({ shopName: 'Cafe\u0301 Cuts' });
  const snapshot = buildBookingNotificationSnapshot(source);

  assert.equal(SNAPSHOT_SCHEMA_VERSION, 1);
  assert.deepEqual(Object.keys(snapshot), [
    'schemaVersion',
    'shopName',
    'services',
    'totalPriceMinor',
    'currency',
    'minorUnitDigits',
    'localDate',
    'localStartTime',
    'timeZone',
    'startAt',
  ]);
  assert.equal(snapshot.shopName, 'Caf\u00e9 Cuts');
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.services), true);
  assert.equal(Object.isFrozen(snapshot.services[0]), true);

  source.shopName = 'Changed';
  source.services[0].name = 'Changed';
  assert.equal(snapshot.shopName, 'Caf\u00e9 Cuts');
  assert.equal(snapshot.services[0].name, 'Cut & Style');
  assert.equal(JSON.stringify(snapshot).includes('email'), false);
  assert.equal(JSON.stringify(snapshot).includes('phone'), false);
  assert.equal(JSON.stringify(snapshot).includes('customer'), false);
});

test('is directly compatible with the booking email renderer', () => {
  const snapshot = buildBookingNotificationSnapshot(makeSource());
  const email = renderBookingEmail(
    { eventType: 'booking.created.customer-email', snapshot },
    { recipientEmail: 'delivery@example.test' },
  );

  assert.match(email.text, /EUR 25\.50/u);
  assert.match(email.text, /EUR 35\.00/u);
  assert.match(email.text, /14:05 \(Europe\/Berlin\)/u);
});

test('requires the active server-authoritative EUR and two-digit currency policy', () => {
  const snapshot = buildBookingNotificationSnapshot(makeSource());
  assert.equal(snapshot.currency, 'EUR');
  assert.equal(snapshot.minorUnitDigits, 2);

  for (const policy of [
    { currency: 'JPY', minorUnitDigits: 0 },
    { currency: 'KWD', minorUnitDigits: 3 },
  ]) {
    expectSnapshotError(() => buildBookingNotificationSnapshot(makeSource({
      services: [{
        id: 'service',
        name: 'Service',
        durationMinutes: 30,
        priceMinor: 3500,
        currency: policy.currency,
        minorUnitDigits: policy.minorUnitDigits,
      }],
      totalPriceMinor: 3500,
      currency: policy.currency,
      minorUnitDigits: policy.minorUnitDigits,
    })));
  }

  expectSnapshotError(() => buildBookingNotificationSnapshot(makeSource({ minorUnitDigits: 3 })));
  expectSnapshotError(() => buildBookingNotificationSnapshot(makeSource({
    services: [{ ...makeSource().services[0], minorUnitDigits: 3 }],
    totalPriceMinor: 2550,
  })));
});

test('converts an inert millisecond-precision Firestore Timestamp-like value canonically', () => {
  const snapshot = buildBookingNotificationSnapshot(makeSource({
    startAt: { seconds: 1788609900, nanoseconds: 0 },
  }));
  assert.equal(snapshot.startAt, '2026-09-05T12:05:00.000Z');

  const adjacentMinute = buildBookingNotificationSnapshot(makeSource({
    localStartTime: '14:10',
    startAt: { seconds: 1788610200, nanoseconds: 0 },
  }));
  assert.equal(adjacentMinute.startAt, '2026-09-05T12:10:00.000Z');
});

test('converts a valid negative epoch and rejects timestamp overflow', () => {
  const historical = buildBookingNotificationSnapshot(makeSource({
    localDate: '1969-12-31',
    localStartTime: '23:55',
    timeZone: 'UTC',
    startAt: { seconds: -300, nanoseconds: 0 },
  }));
  assert.equal(historical.startAt, '1969-12-31T23:55:00.000Z');

  for (const seconds of [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]) {
    expectSnapshotError(() => buildBookingNotificationSnapshot(makeSource({
      startAt: { seconds, nanoseconds: 0 },
    })));
  }
});

test('rejects executable, imprecise, or non-canonical Timestamp-like values', () => {
  let getterInvoked = false;
  let methodInvoked = false;
  const accessorTimestamp = { nanoseconds: 0 };
  Object.defineProperty(accessorTimestamp, 'seconds', {
    enumerable: true,
    get() {
      getterInvoked = true;
      return 1788609900;
    },
  });
  class ExecutableTimestamp {
    constructor() {
      this.seconds = 1788609900;
      this.nanoseconds = 0;
    }

    toMillis() {
      methodInvoked = true;
      return 1788609900000;
    }
  }

  for (const startAt of [
    accessorTimestamp,
    { seconds: 1788609900, nanoseconds: 1 },
    { seconds: 1788609900, nanoseconds: 123456789 },
    { seconds: 1788609900, nanoseconds: 0, toMillis: () => 0 },
    new ExecutableTimestamp(),
    new Date('2026-09-05T12:05:00.000Z'),
  ]) {
    expectSnapshotError(() => buildBookingNotificationSnapshot(makeSource({ startAt })));
  }
  assert.equal(getterInvoked, false);
  assert.equal(methodInvoked, false);
});

test('requires callers to project authoritative services and interval time before building', () => {
  const authoritativeService = {
    ...makeSource().services[0],
    bufferBeforeMinutes: 5,
    bufferAfterMinutes: 10,
  };
  const authoritativeInterval = { startAtEpochMs: 1788609900000 };

  expectSnapshotError(() => buildBookingNotificationSnapshot(makeSource({
    services: [authoritativeService],
    totalPriceMinor: 2550,
  })));
  expectSnapshotError(() => buildBookingNotificationSnapshot({
    ...makeSource(),
    startAtEpochMs: authoritativeInterval.startAtEpochMs,
  }));

  const projected = buildBookingNotificationSnapshot(makeSource({
    services: [{
      id: authoritativeService.id,
      name: authoritativeService.name,
      durationMinutes: authoritativeService.durationMinutes,
      priceMinor: authoritativeService.priceMinor,
      currency: authoritativeService.currency,
      minorUnitDigits: authoritativeService.minorUnitDigits,
    }],
    totalPriceMinor: authoritativeService.priceMinor,
    startAt: new Date(authoritativeInterval.startAtEpochMs).toISOString(),
  }));
  assert.equal(projected.startAt, '2026-09-05T12:05:00.000Z');
  assert.equal(Object.hasOwn(projected.services[0], 'bufferBeforeMinutes'), false);
  assert.equal(Object.hasOwn(projected.services[0], 'bufferAfterMinutes'), false);
});

test('rejects DST gaps, folds, and civil-instant mismatches', () => {
  for (const source of [
    makeSource({
      localDate: '2026-03-29',
      localStartTime: '02:30',
      startAt: '2026-03-29T01:30:00.000Z',
    }),
    makeSource({
      localDate: '2026-10-25',
      localStartTime: '02:30',
      startAt: '2026-10-25T00:30:00.000Z',
    }),
    makeSource({ startAt: '2026-09-05T13:05:00.000Z' }),
  ]) {
    expectSnapshotError(() => buildBookingNotificationSnapshot(source));
  }
});

test('rejects PII, unknown fields, symbols, accessors, sparse arrays, and array metadata', () => {
  expectSnapshotError(() => buildBookingNotificationSnapshot(makeSource({
    customerEmail: 'attacker@example.test',
  })));
  expectSnapshotError(() => buildBookingNotificationSnapshot(makeSource({
    services: [{ ...makeSource().services[0], customerName: 'attacker' }],
    totalPriceMinor: 2550,
  })));

  let invoked = false;
  const accessor = makeSource();
  Object.defineProperty(accessor, 'shopName', {
    enumerable: true,
    get() {
      invoked = true;
      throw new Error('attacker');
    },
  });
  expectSnapshotError(() => buildBookingNotificationSnapshot(accessor));
  assert.equal(invoked, false);

  const symbolSource = makeSource();
  symbolSource[Symbol('attacker')] = 'value';
  expectSnapshotError(() => buildBookingNotificationSnapshot(symbolSource));

  const sparseServices = [];
  sparseServices.length = 1;
  expectSnapshotError(() => buildBookingNotificationSnapshot(makeSource({ services: sparseServices })));

  const servicesWithMetadata = [{ ...makeSource().services[0] }];
  servicesWithMetadata.attacker = 'metadata';
  expectSnapshotError(() => buildBookingNotificationSnapshot(makeSource({
    services: servicesWithMetadata,
    totalPriceMinor: 2550,
  })));
});

test('contains hostile and revoked proxies without invoking their traps or leaking errors', () => {
  let trapInvoked = false;
  const hostile = new Proxy(makeSource(), {
    ownKeys() {
      trapInvoked = true;
      throw new Error('attacker-ownKeys');
    },
  });
  expectSnapshotError(() => buildBookingNotificationSnapshot(hostile));
  assert.equal(trapInvoked, false);

  const hostileServices = new Proxy(makeSource().services, {
    getOwnPropertyDescriptor() {
      trapInvoked = true;
      throw new Error('attacker-descriptor');
    },
  });
  expectSnapshotError(() => buildBookingNotificationSnapshot(makeSource({ services: hostileServices })));
  assert.equal(trapInvoked, false);

  const revoked = Proxy.revocable(makeSource(), {});
  revoked.revoke();
  expectSnapshotError(() => buildBookingNotificationSnapshot(revoked.proxy));
});
