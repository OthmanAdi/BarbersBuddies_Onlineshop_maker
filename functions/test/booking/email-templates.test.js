'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BOOKING_EMAIL_EVENT_TYPES,
  BookingEmailTemplateError,
  normalizeBookingEmailSnapshot,
  renderBookingEmail,
} = require('../../src/booking/email-templates');

function makeSnapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    shopName: 'Barbers & Buddies <Berlin>',
    services: [
      {
        id: 'haircut',
        name: 'Cut & Style <Premium>',
        durationMinutes: 30,
        priceMinor: 2550,
        currency: 'EUR',
        minorUnitDigits: 2,
      },
      {
        id: 'beard',
        name: 'Beard "Detail"',
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

function render(eventType, snapshot = makeSnapshot(), delivery = {}) {
  return renderBookingEmail(
    { eventType, snapshot },
    { recipientEmail: 'delivery@example.test', ...delivery },
  );
}

function expectTemplateError(callback, code, category) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof BookingEmailTemplateError);
    assert.equal(error.code, code);
    assert.equal(error.category, category);
    assert.equal(error.message.includes('attacker'), false);
    return true;
  });
}

test('renders the exact six event and audience combinations', () => {
  assert.deepEqual(BOOKING_EMAIL_EVENT_TYPES, [
    'booking.created.customer-email',
    'booking.created.shop-email',
    'booking.cancelled.customer-email',
    'booking.cancelled.shop-email',
    'booking.rescheduled.customer-email',
    'booking.rescheduled.shop-email',
  ]);

  for (const eventType of BOOKING_EMAIL_EVENT_TYPES) {
    const email = render(eventType);
    assert.equal(email.to, 'delivery@example.test');
    assert.match(email.subject, /Booking|booking/u);
    assert.match(email.text, /2026-09-05/u);
    assert.match(email.text, /14:05 \(Europe\/Berlin\)/u);
    assert.match(email.text, /EUR 35\.00/u);
    assert.match(email.html, /<!doctype html><html><body>/u);
    assert.equal(Object.isFrozen(email), true);
  }
});

test('normalizes a PII-free snapshot into a deeply immutable value', () => {
  const input = makeSnapshot({ shopName: 'Cafe\u0301 Cuts' });
  const snapshot = normalizeBookingEmailSnapshot(input);

  assert.equal(snapshot.shopName, 'Caf\u00e9 Cuts');
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.services), true);
  assert.equal(Object.isFrozen(snapshot.services[0]), true);
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
  assert.equal(JSON.stringify(snapshot).includes('email'), false);
  assert.equal(JSON.stringify(snapshot).includes('phone'), false);
  assert.equal(JSON.stringify(snapshot).includes('customer'), false);
});

test('escapes every dynamic HTML field and does not create URL-bearing markup', () => {
  const snapshot = makeSnapshot({
    shopName: '<script src="https://attacker.test/t.js">& Shop</script>',
    services: [{
      id: 'hostile',
      name: '<img src=x onerror="attacker()">\' & Service',
      durationMinutes: 5,
      priceMinor: 1,
      currency: 'EUR',
      minorUnitDigits: 2,
    }],
    totalPriceMinor: 1,
  });
  const email = render('booking.created.shop-email', snapshot, {
    customerDisplayName: '<svg onload="attacker()">Name</svg>',
  });

  assert.equal(email.html.includes('<script'), false);
  assert.equal(email.html.includes('<img'), false);
  assert.equal(email.html.includes('<svg'), false);
  const actualTags = email.html.match(/<[^>]+>/gu) || [];
  assert.equal(actualTags.some((tag) => /(?:href|src|onerror|onload)\s*=/iu.test(tag)), false);
  assert.match(email.html, /&lt;script src=&quot;https:\/\/attacker\.test\/t\.js&quot;&gt;/u);
  assert.match(email.html, /&lt;svg onload=&quot;attacker\(\)&quot;&gt;/u);
});

test('keeps customer display name ephemeral and out of subject headers', () => {
  const snapshot = makeSnapshot();
  const normalized = normalizeBookingEmailSnapshot(snapshot);
  const email = render('booking.rescheduled.customer-email', snapshot, {
    customerDisplayName: 'Ren\u00e9e \ud83d\udc88',
  });

  assert.equal(email.subject, 'Booking rescheduled');
  assert.equal(email.subject.includes('Ren\u00e9e'), false);
  assert.match(email.text, /^Hello Ren\u00e9e \ud83d\udc88,/u);
  assert.equal(JSON.stringify(normalized).includes('Ren\u00e9e'), false);
});

test('rejects recipient and display-name header or control injection', () => {
  expectTemplateError(
    () => render('booking.created.customer-email', makeSnapshot(), {
      recipientEmail: 'victim@example.test\r\nBcc: attacker@example.test',
    }),
    'INVALID_DELIVERY',
    'delivery',
  );
  expectTemplateError(
    () => render('booking.created.customer-email', makeSnapshot(), {
      customerDisplayName: 'attacker\u202e@example.test',
    }),
    'INVALID_DELIVERY',
    'delivery',
  );
});

test('rejects unsupported event strings without echoing them', () => {
  for (const eventType of ['booking.attacker.shop-email', '__proto__', 'constructor']) {
    expectTemplateError(
      () => render(eventType),
      'UNSUPPORTED_EVENT_TYPE',
      'event-type',
    );
  }
});

test('rejects unknown fields, PII fields, accessors, and malformed arrays', () => {
  expectTemplateError(
    () => normalizeBookingEmailSnapshot(makeSnapshot({ customerEmail: 'attacker@example.test' })),
    'INVALID_SNAPSHOT',
    'snapshot',
  );
  expectTemplateError(
    () => normalizeBookingEmailSnapshot({ ...makeSnapshot(), services: [{
      ...makeSnapshot().services[0],
      customerName: 'attacker',
    }] }),
    'INVALID_SNAPSHOT',
    'snapshot',
  );
  const accessor = makeSnapshot();
  Object.defineProperty(accessor, 'shopName', { enumerable: true, get: () => 'attacker' });
  expectTemplateError(
    () => normalizeBookingEmailSnapshot(accessor),
    'INVALID_SNAPSHOT',
    'snapshot',
  );
  const sparseServices = [];
  sparseServices.length = 1;
  expectTemplateError(
    () => normalizeBookingEmailSnapshot(makeSnapshot({ services: sparseServices, totalPriceMinor: 0 })),
    'INVALID_SNAPSHOT',
    'snapshot',
  );
  const servicesWithMetadata = [{ ...makeSnapshot().services[0] }];
  servicesWithMetadata.attacker = 'metadata';
  expectTemplateError(
    () => normalizeBookingEmailSnapshot(makeSnapshot({ services: servicesWithMetadata, totalPriceMinor: 2550 })),
    'INVALID_SNAPSHOT',
    'snapshot',
  );
});

test('contains hostile object and array traps at fixed public error boundaries', () => {
  const trapNames = ['get', 'ownKeys', 'getPrototypeOf', 'getOwnPropertyDescriptor'];
  for (const trapName of trapNames) {
    const trap = () => {
      throw new Error(`attacker-${trapName}`);
    };
    expectTemplateError(
      () => normalizeBookingEmailSnapshot(new Proxy(makeSnapshot(), { [trapName]: trap })),
      'INVALID_SNAPSHOT',
      'snapshot',
    );
    expectTemplateError(
      () => renderBookingEmail(
        new Proxy({ eventType: 'booking.created.customer-email', snapshot: makeSnapshot() }, { [trapName]: trap }),
        { recipientEmail: 'delivery@example.test' },
      ),
      'INVALID_NOTIFICATION',
      'notification',
    );
    expectTemplateError(
      () => renderBookingEmail(
        { eventType: 'booking.created.customer-email', snapshot: makeSnapshot() },
        new Proxy({ recipientEmail: 'delivery@example.test' }, { [trapName]: trap }),
      ),
      'INVALID_DELIVERY',
      'delivery',
    );
  }

  const getterSnapshot = makeSnapshot();
  Object.defineProperty(getterSnapshot, 'shopName', {
    enumerable: true,
    get() {
      throw new Error('attacker-getter');
    },
  });
  expectTemplateError(
    () => normalizeBookingEmailSnapshot(getterSnapshot),
    'INVALID_SNAPSHOT',
    'snapshot',
  );

  const getterNotification = { snapshot: makeSnapshot() };
  Object.defineProperty(getterNotification, 'eventType', {
    enumerable: true,
    get() {
      throw new Error('attacker-getter');
    },
  });
  expectTemplateError(
    () => renderBookingEmail(getterNotification, { recipientEmail: 'delivery@example.test' }),
    'INVALID_NOTIFICATION',
    'notification',
  );

  const trappedServices = new Proxy(makeSnapshot().services, {
    ownKeys() {
      throw new Error('attacker-array');
    },
  });
  expectTemplateError(
    () => normalizeBookingEmailSnapshot(makeSnapshot({ services: trappedServices })),
    'INVALID_SNAPSHOT',
    'snapshot',
  );

  const revokedSnapshot = Proxy.revocable(makeSnapshot(), {});
  revokedSnapshot.revoke();
  expectTemplateError(
    () => normalizeBookingEmailSnapshot(revokedSnapshot.proxy),
    'INVALID_SNAPSHOT',
    'snapshot',
  );
  const revokedNotification = Proxy.revocable(
    { eventType: 'booking.created.customer-email', snapshot: makeSnapshot() },
    {},
  );
  revokedNotification.revoke();
  expectTemplateError(
    () => renderBookingEmail(
      revokedNotification.proxy,
      { recipientEmail: 'delivery@example.test' },
    ),
    'INVALID_NOTIFICATION',
    'notification',
  );
  const revokedDelivery = Proxy.revocable({ recipientEmail: 'delivery@example.test' }, {});
  revokedDelivery.revoke();
  expectTemplateError(
    () => renderBookingEmail(
      { eventType: 'booking.created.customer-email', snapshot: makeSnapshot() },
      revokedDelivery.proxy,
    ),
    'INVALID_DELIVERY',
    'delivery',
  );
});

test('rejects symbol keys and never invokes accessor properties', () => {
  let invoked = false;
  const delivery = { recipientEmail: 'delivery@example.test' };
  Object.defineProperty(delivery, 'customerDisplayName', {
    enumerable: true,
    get() {
      invoked = true;
      throw new Error('attacker');
    },
  });
  expectTemplateError(
    () => renderBookingEmail(
      { eventType: 'booking.created.customer-email', snapshot: makeSnapshot() },
      delivery,
    ),
    'INVALID_DELIVERY',
    'delivery',
  );
  assert.equal(invoked, false);

  const snapshot = makeSnapshot();
  snapshot[Symbol('attacker')] = 'value';
  expectTemplateError(
    () => normalizeBookingEmailSnapshot(snapshot),
    'INVALID_SNAPSHOT',
    'snapshot',
  );
});

test('rejects malformed civil time, timezone, service identity, and duplicate services', () => {
  for (const snapshot of [
    makeSnapshot({ localDate: '2026-02-29' }),
    makeSnapshot({ localStartTime: '14:03' }),
    makeSnapshot({ timeZone: 'Not/A_TimeZone' }),
    makeSnapshot({ services: [{ ...makeSnapshot().services[0], id: '../attacker' }], totalPriceMinor: 2550 }),
    makeSnapshot({
      services: [makeSnapshot().services[0], { ...makeSnapshot().services[0] }],
      totalPriceMinor: 5100,
    }),
  ]) {
    expectTemplateError(
      () => normalizeBookingEmailSnapshot(snapshot),
      'INVALID_SNAPSHOT',
      'snapshot',
    );
  }
});

test('requires one currency and an exact non-negative minor-unit total', () => {
  const usdService = { ...makeSnapshot().services[1], currency: 'USD' };
  for (const snapshot of [
    makeSnapshot({ services: [makeSnapshot().services[0], usdService] }),
    makeSnapshot({ totalPriceMinor: 3499 }),
    makeSnapshot({ totalPriceMinor: -1 }),
    makeSnapshot({ currency: 'eur' }),
    makeSnapshot({ services: [{ ...makeSnapshot().services[0], priceMinor: 1.5 }], totalPriceMinor: 1.5 }),
  ]) {
    expectTemplateError(
      () => normalizeBookingEmailSnapshot(snapshot),
      'INVALID_SNAPSHOT',
      'snapshot',
    );
  }
  const email = render('booking.cancelled.customer-email');
  assert.match(email.text, /EUR 25\.50/u);
  assert.match(email.text, /EUR 9\.50/u);
  assert.match(email.text, /EUR 35\.00/u);
});

test('formats EUR, JPY, and KWD using explicit consistent minor-unit digits', () => {
  const eur = render('booking.created.customer-email');
  assert.match(eur.text, /EUR 25\.50/u);
  assert.match(eur.text, /EUR 35\.00/u);

  const jpy = render('booking.created.customer-email', makeSnapshot({
    services: [{
      id: 'jpy-service',
      name: 'Tokyo Cut',
      durationMinutes: 30,
      priceMinor: 3500,
      currency: 'JPY',
      minorUnitDigits: 0,
    }],
    totalPriceMinor: 3500,
    currency: 'JPY',
    minorUnitDigits: 0,
  }));
  assert.match(jpy.text, /JPY 3500/u);
  assert.equal(jpy.text.includes('JPY 35.00'), false);

  const kwd = render('booking.created.customer-email', makeSnapshot({
    services: [{
      id: 'kwd-service',
      name: 'Kuwait Cut',
      durationMinutes: 30,
      priceMinor: 1234,
      currency: 'KWD',
      minorUnitDigits: 3,
    }],
    totalPriceMinor: 1234,
    currency: 'KWD',
    minorUnitDigits: 3,
  }));
  assert.match(kwd.text, /KWD 1\.234/u);

  expectTemplateError(
    () => normalizeBookingEmailSnapshot(makeSnapshot({
      services: [{ ...makeSnapshot().services[0], minorUnitDigits: 3 }],
      totalPriceMinor: 2550,
    })),
    'INVALID_SNAPSHOT',
    'snapshot',
  );
  expectTemplateError(
    () => normalizeBookingEmailSnapshot(makeSnapshot({ minorUnitDigits: 4 })),
    'INVALID_SNAPSHOT',
    'snapshot',
  );
});

test('validates authoritative startAt against winter and summer civil time', () => {
  const winter = normalizeBookingEmailSnapshot(makeSnapshot({
    localDate: '2026-01-15',
    localStartTime: '10:00',
    startAt: '2026-01-15T09:00:00.000Z',
  }));
  assert.equal(winter.startAt, '2026-01-15T09:00:00.000Z');

  const summer = normalizeBookingEmailSnapshot(makeSnapshot({
    localDate: '2026-07-15',
    localStartTime: '10:00',
    startAt: '2026-07-15T08:00:00.000Z',
  }));
  assert.equal(summer.startAt, '2026-07-15T08:00:00.000Z');
});

test('rejects Berlin DST gaps, folds, and instant mismatches', () => {
  for (const snapshot of [
    makeSnapshot({
      localDate: '2026-03-29',
      localStartTime: '02:30',
      startAt: '2026-03-29T01:30:00.000Z',
    }),
    makeSnapshot({
      localDate: '2026-10-25',
      localStartTime: '02:30',
      startAt: '2026-10-25T00:30:00.000Z',
    }),
    makeSnapshot({
      localDate: '2026-01-15',
      localStartTime: '10:00',
      startAt: '2026-01-15T10:00:00.000Z',
    }),
    makeSnapshot({ startAt: '2026-09-05T12:05:00Z' }),
  ]) {
    expectTemplateError(
      () => normalizeBookingEmailSnapshot(snapshot),
      'INVALID_SNAPSHOT',
      'snapshot',
    );
  }
});

test('enforces text, service-count, price, and delivery bounds', () => {
  const overlongShop = 'x'.repeat(121);
  const overlongName = 'x'.repeat(101);
  const tooManyServices = Array.from({ length: 21 }, (_, index) => ({
    id: `service-${index}`,
    name: `Service ${index}`,
    durationMinutes: 5,
    priceMinor: 0,
    currency: 'EUR',
    minorUnitDigits: 2,
  }));
  for (const snapshot of [
    makeSnapshot({ shopName: overlongShop }),
    makeSnapshot({ services: tooManyServices, totalPriceMinor: 0 }),
    makeSnapshot({ services: [{ ...makeSnapshot().services[0], priceMinor: 1000000000 }], totalPriceMinor: 1000000000 }),
  ]) {
    expectTemplateError(
      () => normalizeBookingEmailSnapshot(snapshot),
      'INVALID_SNAPSHOT',
      'snapshot',
    );
  }
  expectTemplateError(
    () => render('booking.created.customer-email', makeSnapshot(), { customerDisplayName: overlongName }),
    'INVALID_DELIVERY',
    'delivery',
  );
});

test('does not invent a cancellation reason or include hidden tracking', () => {
  for (const eventType of [
    'booking.cancelled.customer-email',
    'booking.cancelled.shop-email',
  ]) {
    const email = render(eventType);
    assert.equal(email.text.includes('because'), false);
    assert.equal(email.text.toLowerCase().includes('reason'), false);
    assert.equal(email.html.includes('<img'), false);
    assert.equal(email.html.includes('<a'), false);
    assert.equal(email.html.includes('style='), false);
    assert.equal(email.html.includes('data-'), false);
    assert.equal(email.html.includes('tracking'), false);
  }
});
