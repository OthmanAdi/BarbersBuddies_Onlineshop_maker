'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EXPLICIT_ORIGINS_ENV,
  resolveBookingAllowedOrigins,
} = require('../../src/booking/origins');
const { createBookingHttpHandlers } = require('../../src/booking/http');

function explicit(origins, extra = {}) {
  return {
    ...extra,
    [EXPLICIT_ORIGINS_ENV]: JSON.stringify(origins),
  };
}

test('production includes the known HTTPS origins and no loopback origins', () => {
  assert.deepEqual(resolveBookingAllowedOrigins({}), [
    'https://barbersbuddies.com',
    'https://www.barbersbuddies.com',
  ]);
});

test('the exact Firebase emulator runtime allows preflight from localhost port 3100', async () => {
  const origins = resolveBookingAllowedOrigins({ FUNCTIONS_EMULATOR: 'true' });

  assert.equal(origins.includes('http://localhost:3000'), true);
  assert.equal(origins.includes('http://localhost:3100'), true);
  assert.equal(Object.isFrozen(origins), true);

  const handlers = createBookingHttpHandlers({
    allowedOrigins: origins,
    verifyIdToken: async () => ({ uid: 'unused' }),
    commands: {
      create: async () => {},
      cancel: async () => {},
      reschedule: async () => {},
    },
  });
  const response = {
    headers: {},
    set(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };

  await handlers.createBookingV2({
    method: 'OPTIONS',
    headers: { origin: 'http://localhost:3100' },
  }, response);

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:3100');
});

test('misleading emulator values do not enable loopback origins', () => {
  for (const value of [true, 'TRUE', ' true', 'true ', '1']) {
    const origins = resolveBookingAllowedOrigins({ FUNCTIONS_EMULATOR: value });
    assert.equal(origins.some((origin) => origin.startsWith('http://')), false);
  }
});

test('production accepts additional exact HTTPS origins and removes duplicates', () => {
  assert.deepEqual(resolveBookingAllowedOrigins(explicit([
    'https://booking.barbersbuddies.com',
    'https://barbersbuddies.com',
  ])), [
    'https://barbersbuddies.com',
    'https://www.barbersbuddies.com',
    'https://booking.barbersbuddies.com',
  ]);
});

test('production rejects loopback, non-loopback HTTP, and wildcard configuration', () => {
  for (const origin of [
    'http://localhost:3100',
    'http://127.0.0.1:3100',
    'http://example.com',
    'https://*.barbersbuddies.com',
    '*',
  ]) {
    assert.throws(
      () => resolveBookingAllowedOrigins(explicit([origin])),
      new RegExp(EXPLICIT_ORIGINS_ENV),
      origin,
    );
  }
});

test('emulator explicit HTTP configuration remains limited to exact loopback origins', () => {
  assert.equal(resolveBookingAllowedOrigins(explicit(
    ['http://127.0.0.1:3200', 'http://[::1]:3200'],
    { FUNCTIONS_EMULATOR: 'true' },
  )).includes('http://127.0.0.1:3200'), true);

  for (const origin of ['http://localhost.example:3200', 'http://192.168.1.5:3200']) {
    assert.throws(
      () => resolveBookingAllowedOrigins(explicit(
        [origin],
        { FUNCTIONS_EMULATOR: 'true' },
      )),
      /loopback/,
      origin,
    );
  }
});

test('malformed explicit configuration fails closed', () => {
  for (const rawValue of [
    '',
    'not-json',
    '{}',
    '["https://example.com/path"]',
    '[" https://example.com"]',
    '["https://user@example.com"]',
    '[null]',
  ]) {
    assert.throws(
      () => resolveBookingAllowedOrigins({ [EXPLICIT_ORIGINS_ENV]: rawValue }),
      new RegExp(EXPLICIT_ORIGINS_ENV),
      rawValue,
    );
  }
});

test('inherited and accessor configuration cannot silently change the boundary', () => {
  const inherited = Object.create({
    FUNCTIONS_EMULATOR: 'true',
    [EXPLICIT_ORIGINS_ENV]: '["http://localhost:3200"]',
  });
  assert.deepEqual(resolveBookingAllowedOrigins(inherited), [
    'https://barbersbuddies.com',
    'https://www.barbersbuddies.com',
  ]);

  const accessor = {};
  Object.defineProperty(accessor, EXPLICIT_ORIGINS_ENV, {
    get() {
      return '["https://attacker.example"]';
    },
  });
  assert.throws(() => resolveBookingAllowedOrigins(accessor), /data property/);
});
