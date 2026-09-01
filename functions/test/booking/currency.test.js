'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  SUPPORTED_CURRENCY,
  SUPPORTED_MINOR_UNIT_DIGITS,
  formatMinorAmount,
  resolveCurrencyPolicy,
} = require('../../src/booking/currency');
const { BookingError } = require('../../src/booking/errors');
const { resolveAuthoritativeBooking } = require('../../src/booking/services');

function expectBookingError(code, field) {
  return (error) => {
    assert.ok(error instanceof BookingError);
    assert.equal(error.code, code);
    assert.equal(error.httpStatus, 400);
    assert.equal(error.retryable, false);
    assert.equal(error.details.field, field);
    return true;
  };
}

function expectSafeCatalogError(code, httpStatus) {
  return (error) => {
    assert.ok(error instanceof BookingError);
    assert.equal(error.code, code);
    assert.equal(error.httpStatus, httpStatus);
    assert.equal(error.retryable, false);
    assert.equal(error.message.includes('hostile raw failure'), false);
    return true;
  };
}

function detailService() {
  return {
    id: 'detail',
    name: 'Detail',
    active: true,
    durationMinutes: 7,
    bufferBeforeMinutes: 3,
    bufferAfterMinutes: 0,
    priceMinor: 950,
    currency: 'EUR',
  };
}

function shopFixture(serviceOverrides = {}) {
  return {
    active: true,
    ownerId: 'owner-1',
    name: 'Currency Test Shop',
    email: 'shop@example.test',
    timeZone: 'Europe/Berlin',
    weeklyAvailability: {
      monday: [{ startLocalTime: '09:00', endLocalTime: '18:00' }],
    },
    bookingPolicy: {
      consentVersion: 'currency-test-v1',
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
      priceMinor: 2550,
      currency: 'EUR',
      ...serviceOverrides,
    }],
    employees: [],
  };
}

function bookingIntent() {
  return {
    shopId: 'shop-1',
    requestedEmployeeId: null,
    serviceIds: ['haircut'],
    localDate: '2026-09-07',
    localStartTime: '10:00',
    customer: {
      name: 'Currency Customer',
      email: 'customer@example.test',
      phone: '+49 30 123456',
    },
    consentVersion: 'currency-test-v1',
  };
}

test('the server exposes one immutable EUR minor-unit policy', () => {
  const policy = resolveCurrencyPolicy('EUR');
  assert.deepEqual(policy, { currency: 'EUR', minorUnitDigits: 2 });
  assert.equal(policy.currency, SUPPORTED_CURRENCY);
  assert.equal(policy.minorUnitDigits, SUPPORTED_MINOR_UNIT_DIGITS);
  assert.equal(Object.isFrozen(policy), true);
});

test('unsupported, malformed, and hostile currency values fail with one public error', () => {
  const hostile = new Proxy({}, {
    get() {
      throw new Error('currency object must not be inspected');
    },
    getPrototypeOf() {
      throw new Error('currency object must not be inspected');
    },
  });

  for (const currency of ['USD', 'eur', 'EU', '', null, undefined, hostile]) {
    assert.throws(
      () => resolveCurrencyPolicy(currency, 'services.haircut.currency'),
      (error) => {
        assert.match(error.message, /supported currency EUR/);
        assert.equal(error.details.supportedCurrency, 'EUR');
        return expectBookingError('INVALID_ARGUMENT', 'services.haircut.currency')(error);
      },
    );
  }
});

test('minor amounts are formatted from server policy and reject unsafe inputs', () => {
  assert.equal(formatMinorAmount(0), '0.00');
  assert.equal(formatMinorAmount(1), '0.01');
  assert.equal(formatMinorAmount(2550), '25.50');
  assert.equal(formatMinorAmount(Number.MAX_SAFE_INTEGER), '90071992547409.91');

  for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '2550']) {
    assert.throws(
      () => formatMinorAmount(invalid),
      expectBookingError('INVALID_ARGUMENT', 'priceMinor'),
    );
  }
  assert.throws(
    () => formatMinorAmount(100, 'USD'),
    expectBookingError('INVALID_ARGUMENT', 'currency'),
  );
});

test('authoritative service snapshots derive minor-unit digits and ignore stored hints', () => {
  const authoritative = resolveAuthoritativeBooking({
    shopId: 'shop-1',
    shop: shopFixture({ minorUnitDigits: 0 }),
    intent: bookingIntent(),
    actor: { uid: null, email: null, kind: 'guest' },
  });

  assert.equal(authoritative.service.currency, 'EUR');
  assert.equal(authoritative.service.minorUnitDigits, 2);
  assert.deepEqual(authoritative.service.snapshots[0], {
    id: 'haircut',
    name: 'Haircut',
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    priceMinor: 2550,
    currency: 'EUR',
    minorUnitDigits: 2,
  });
  assert.equal(Object.isFrozen(authoritative.service.snapshots[0]), true);
});

test('multi-service totals retain one server-derived currency policy', () => {
  const shop = shopFixture();
  shop.services.push(detailService());
  const intent = bookingIntent();
  intent.serviceIds.push('detail');

  const authoritative = resolveAuthoritativeBooking({
    shopId: 'shop-1',
    shop,
    intent,
    actor: { uid: null, email: null, kind: 'guest' },
  });

  assert.equal(authoritative.service.totalPriceMinor, 3500);
  assert.equal(authoritative.service.currency, 'EUR');
  assert.equal(authoritative.service.minorUnitDigits, 2);
  assert.deepEqual(
    authoritative.service.snapshots.map(({ id, currency, minorUnitDigits }) => ({
      id,
      currency,
      minorUnitDigits,
    })),
    [
      { id: 'haircut', currency: 'EUR', minorUnitDigits: 2 },
      { id: 'detail', currency: 'EUR', minorUnitDigits: 2 },
    ],
  );
});

test('hostile authoritative shop and service shapes fail closed without invoking accessors', () => {
  const cases = [];

  const shopAccessor = shopFixture();
  let shopAccessorCalls = 0;
  Object.defineProperty(shopAccessor, 'services', {
    configurable: true,
    enumerable: true,
    get() {
      shopAccessorCalls += 1;
      throw new Error('hostile raw failure');
    },
  });
  cases.push({
    shop: shopAccessor,
    code: 'SHOP_NOT_FOUND',
    status: 404,
    calls: () => shopAccessorCalls,
  });

  const arrayAccessor = shopFixture();
  let arrayAccessorCalls = 0;
  Object.defineProperty(arrayAccessor.services, '0', {
    configurable: true,
    enumerable: true,
    get() {
      arrayAccessorCalls += 1;
      throw new Error('hostile raw failure');
    },
  });
  cases.push({
    shop: arrayAccessor,
    code: 'SERVICE_NOT_FOUND',
    status: 404,
    calls: () => arrayAccessorCalls,
  });

  const currencyAccessor = shopFixture();
  let currencyAccessorCalls = 0;
  Object.defineProperty(currencyAccessor.services[0], 'currency', {
    configurable: true,
    enumerable: true,
    get() {
      currencyAccessorCalls += 1;
      throw new Error('hostile raw failure');
    },
  });
  cases.push({
    shop: currencyAccessor,
    code: 'SERVICE_NOT_FOUND',
    status: 404,
    calls: () => currencyAccessorCalls,
  });

  const proxyCatalog = shopFixture();
  proxyCatalog.services = new Proxy(proxyCatalog.services, {
    getPrototypeOf() {
      throw new Error('hostile raw failure');
    },
  });
  cases.push({ shop: proxyCatalog, code: 'SERVICE_NOT_FOUND', status: 404 });

  const sparseCatalog = shopFixture();
  sparseCatalog.services.length = 2;
  cases.push({ shop: sparseCatalog, code: 'SERVICE_NOT_FOUND', status: 404 });

  const proxyService = shopFixture();
  proxyService.services[0] = new Proxy(proxyService.services[0], {
    getPrototypeOf() {
      throw new Error('hostile raw failure');
    },
  });
  cases.push({ shop: proxyService, code: 'SERVICE_NOT_FOUND', status: 404 });

  const proxyShop = new Proxy(shopFixture(), {
    getPrototypeOf() {
      throw new Error('hostile raw failure');
    },
  });
  cases.push({ shop: proxyShop, code: 'SHOP_NOT_FOUND', status: 404 });

  for (const hostileCase of cases) {
    assert.throws(
      () => resolveAuthoritativeBooking({
        shopId: 'shop-1',
        shop: hostileCase.shop,
        intent: bookingIntent(),
        actor: { uid: null, email: null, kind: 'guest' },
      }),
      expectSafeCatalogError(hostileCase.code, hostileCase.status),
    );
    if (hostileCase.calls) {
      assert.equal(hostileCase.calls(), 0);
    }
  }
});

test('authoritative service resolution rejects unsupported persisted currencies', () => {
  assert.throws(
    () => resolveAuthoritativeBooking({
      shopId: 'shop-1',
      shop: shopFixture({ currency: 'USD' }),
      intent: bookingIntent(),
      actor: { uid: null, email: null, kind: 'guest' },
    }),
    expectBookingError('INVALID_ARGUMENT', 'services.haircut.currency'),
  );
});
