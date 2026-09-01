'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { BookingError } = require('../../src/booking/errors');
const {
  ALLOWED_HEADERS,
  ALLOWED_METHODS,
  PUBLIC_ERROR_DEFINITIONS,
  createBookingHttpHandlers,
} = require('../../src/booking/http');

const ALLOWED_ORIGIN = 'https://booking.example.test';
const IDEMPOTENCY_KEY = 'request-key-0001';

function fakeRequest({
  method = 'POST',
  body = { shopId: 'shop-1' },
  headers = {},
} = {}) {
  const normalizedHeaders = {};
  for (const [name, value] of Object.entries(headers)) {
    normalizedHeaders[name.toLowerCase()] = value;
  }
  return { method, body, headers: normalizedHeaders };
}

function fakeResponse() {
  return {
    headers: {},
    statusCode: null,
    jsonBody: undefined,
    sendBody: undefined,
    set(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(value) {
      this.jsonBody = value;
      return this;
    },
    send(value) {
      this.sendBody = value;
      return this;
    },
  };
}

function requestHeaders(overrides = {}) {
  return {
    Origin: ALLOWED_ORIGIN,
    'Content-Type': 'application/json; charset=utf-8',
    'Idempotency-Key': IDEMPOTENCY_KEY,
    ...overrides,
  };
}

function makeBoundary(overrides = {}) {
  const calls = [];
  const logs = [];
  const success = Object.freeze({
    ok: true,
    commandId: 'command-1',
    replayed: false,
    booking: Object.freeze({
      bookingId: 'booking-1',
      version: 1,
      status: 'pending',
      resourceId: 'employee:employee-1',
      startAt: '2026-09-02T09:00:00.000Z',
      endAt: '2026-09-02T09:30:00.000Z',
    }),
  });
  const command = async (input) => {
    calls.push(input);
    return success;
  };
  const verifyCalls = [];
  const verifyIdToken = async (token) => {
    verifyCalls.push(token);
    return { uid: 'verified-user', email: ' User@Example.Test ', email_verified: true };
  };
  const commands = {
    create: command,
    cancel: command,
    reschedule: command,
    ...overrides.commands,
  };
  const logger = overrides.logger || {
    error(message, metadata) {
      logs.push({ message, metadata });
    },
  };

  const handlers = createBookingHttpHandlers({
    allowedOrigins: overrides.allowedOrigins || [ALLOWED_ORIGIN],
    verifyIdToken: overrides.verifyIdToken || verifyIdToken,
    commands,
    logger,
  });
  return { calls, handlers, logs, success, verifyCalls };
}

function assertPublicError(response, status, code, retryable = false) {
  assert.equal(response.statusCode, status);
  assert.equal(response.jsonBody.ok, false);
  assert.deepEqual(Object.keys(response.jsonBody.error).sort(), [
    'code',
    'message',
    'retryable',
  ]);
  assert.equal(response.jsonBody.error.code, code);
  assert.equal(response.jsonBody.error.retryable, retryable);
}

test('factory rejects wildcard, empty, and malformed dependencies', () => {
  const noop = async () => {};
  const valid = {
    allowedOrigins: [ALLOWED_ORIGIN],
    verifyIdToken: noop,
    commands: { create: noop, cancel: noop, reschedule: noop },
  };
  assert.throws(
    () => createBookingHttpHandlers({ ...valid, allowedOrigins: ['*'] }),
    /exact origin strings/,
  );
  assert.throws(
    () => createBookingHttpHandlers({ ...valid, allowedOrigins: [] }),
    /non-empty array/,
  );
  assert.throws(
    () => createBookingHttpHandlers({ ...valid, verifyIdToken: null }),
    /verifyIdToken must be a function/,
  );
  assert.throws(
    () => createBookingHttpHandlers({ ...valid, commands: { create: noop } }),
    /commands.cancel must be a function/,
  );
});

test('public error registry contains exactly ADR 001 codes and canonical statuses', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(PUBLIC_ERROR_DEFINITIONS).map(
    ([code, definition]) => [code, definition.httpStatus],
  )), {
    INVALID_ARGUMENT: 400,
    INVALID_DATE: 400,
    INVALID_TIME: 400,
    INVALID_DURATION: 400,
    INVALID_IDEMPOTENCY_KEY: 400,
    UNAUTHENTICATED: 401,
    FORBIDDEN: 403,
    SHOP_NOT_FOUND: 404,
    BOOKING_NOT_FOUND: 404,
    SERVICE_NOT_FOUND: 404,
    EMPLOYEE_NOT_FOUND: 404,
    SLOT_CONFLICT: 409,
    IDEMPOTENCY_KEY_REUSED: 409,
    BOOKING_VERSION_CONFLICT: 409,
    INVALID_STATUS_TRANSITION: 409,
    BOOKING_MIGRATION_REQUIRED: 409,
    SHOP_RESOURCE_CONFIG_REQUIRED: 422,
    OUTSIDE_AVAILABILITY: 422,
    SHOP_TIMEZONE_REQUIRED: 422,
    EMPLOYEE_UNAVAILABLE: 422,
    INTERNAL: 500,
  });
  for (const [code, definition] of Object.entries(PUBLIC_ERROR_DEFINITIONS)) {
    assert.equal(typeof definition.message, 'string', code);
    assert.ok(definition.message.length > 0, code);
    assert.equal(definition.retryable, code === 'INTERNAL', code);
    assert.ok(Object.isFrozen(definition), code);
  }
  assert.ok(Object.isFrozen(PUBLIC_ERROR_DEFINITIONS));
});

test('factory rejects configured values that are not exact http or https origins', () => {
  const noop = async () => {};
  const commands = { create: noop, cancel: noop, reschedule: noop };
  const invalidOrigins = [
    'null',
    'ftp://example.test',
    'https://example.test/',
    'https://example.test/path',
    'https://example.test?query=1',
    'https://example.test#fragment',
    'https://user:password@example.test',
    'https://*.example.test',
    ' https://example.test',
    'https://example.test\u007f',
  ];
  for (const origin of invalidOrigins) {
    assert.throws(() => createBookingHttpHandlers({
      allowedOrigins: [origin],
      verifyIdToken: noop,
      commands,
    }), /allowedOrigins/, origin);
  }

  assert.doesNotThrow(() => createBookingHttpHandlers({
    allowedOrigins: ['http://localhost:3000'],
    verifyIdToken: noop,
    commands,
  }));
});

test('allowed preflight returns only the explicit CORS contract', async () => {
  const { calls, handlers } = makeBoundary();
  const request = fakeRequest({
    method: 'OPTIONS',
    headers: { Origin: ALLOWED_ORIGIN },
  });
  const response = fakeResponse();

  await handlers.createBookingV2(request, response);

  assert.equal(response.statusCode, 204);
  assert.equal(response.sendBody, '');
  assert.equal(response.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
  assert.equal(response.headers['access-control-allow-methods'], ALLOWED_METHODS);
  assert.equal(response.headers['access-control-allow-headers'], ALLOWED_HEADERS);
  assert.equal(response.headers.vary, 'Origin');
  assert.equal(calls.length, 0);
});

test('preflight without an allowed origin is denied', async () => {
  const { handlers } = makeBoundary();
  const response = fakeResponse();

  await handlers.createBookingV2(fakeRequest({ method: 'OPTIONS' }), response);

  assertPublicError(response, 403, 'FORBIDDEN');
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});

test('disallowed origin is denied without reflecting it', async () => {
  const { calls, handlers } = makeBoundary();
  const response = fakeResponse();
  const origin = 'https://attacker.example.test';

  await handlers.createBookingV2(fakeRequest({ headers: requestHeaders({ Origin: origin }) }), response);

  assertPublicError(response, 403, 'FORBIDDEN');
  assert.equal(response.headers['access-control-allow-origin'], undefined);
  assert.equal(JSON.stringify(response.jsonBody).includes(origin), false);
  assert.equal(calls.length, 0);
});

test('array or duplicate Origin values cannot downgrade a POST to a non-browser call', async () => {
  const { calls, handlers } = makeBoundary();
  for (const origin of [
    [ALLOWED_ORIGIN],
    [ALLOWED_ORIGIN, 'https://attacker.example.test'],
  ]) {
    const response = fakeResponse();
    await handlers.createBookingV2(fakeRequest({
      headers: requestHeaders({ Origin: origin }),
    }), response);

    assertPublicError(response, 403, 'FORBIDDEN');
    assert.equal(response.headers['access-control-allow-origin'], undefined);
  }
  assert.equal(calls.length, 0);
});

test('same-origin and non-browser calls without Origin remain callable', async () => {
  const { handlers } = makeBoundary();
  const response = fakeResponse();

  await handlers.createBookingV2(fakeRequest({
    headers: requestHeaders({ Origin: undefined }),
  }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});

test('methods other than POST and OPTIONS use canonical INVALID_ARGUMENT status', async () => {
  const { handlers } = makeBoundary();
  const response = fakeResponse();

  await handlers.createBookingV2(fakeRequest({
    method: 'GET',
    headers: requestHeaders(),
  }), response);

  assertPublicError(response, 400, 'INVALID_ARGUMENT');
  assert.equal(response.headers.allow, ALLOWED_METHODS);
});

test('POST requires application/json including when the body is already parsed', async () => {
  const { handlers } = makeBoundary();
  const response = fakeResponse();

  await handlers.createBookingV2(fakeRequest({
    headers: requestHeaders({ 'Content-Type': 'text/plain' }),
  }), response);

  assertPublicError(response, 400, 'INVALID_ARGUMENT');
});

test('POST rejects null, array, and non-plain JSON bodies', async () => {
  const { handlers } = makeBoundary();
  for (const body of [null, [], new Date()]) {
    const response = fakeResponse();
    await handlers.createBookingV2(fakeRequest({ body, headers: requestHeaders() }), response);
    assertPublicError(response, 400, 'INVALID_ARGUMENT');
  }
});

test('every command requires a valid Idempotency-Key header', async () => {
  const { handlers } = makeBoundary();
  for (const idempotencyKey of [undefined, 'short', 'contains whitespace 0001']) {
    const response = fakeResponse();
    await handlers.createBookingV2(fakeRequest({
      headers: requestHeaders({ 'Idempotency-Key': idempotencyKey }),
    }), response);
    assertPublicError(response, 400, 'INVALID_IDEMPOTENCY_KEY');
  }
});

test('guest create passes no actor and cannot derive authority from body fields', async () => {
  const { calls, handlers, verifyCalls } = makeBoundary();
  const payload = {
    shopId: 'shop-1',
    customerUid: 'spoofed-user',
    shopOwnerId: 'spoofed-owner',
    ownerId: 'spoofed-owner',
    role: 'admin',
    userType: 'owner',
    customer: { email: 'booking-intent@example.test' },
  };
  const response = fakeResponse();

  await handlers.createBookingV2(fakeRequest({ body: payload, headers: requestHeaders() }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.strictEqual(calls[0].payload, payload);
  assert.equal(calls[0].actor, null);
  assert.equal(calls[0].idempotencyKey, IDEMPOTENCY_KEY);
  assert.equal(verifyCalls.length, 0);
});

test('optional create token is verified and actor data is normalized', async () => {
  const { calls, handlers, verifyCalls } = makeBoundary();
  const response = fakeResponse();

  await handlers.createBookingV2(fakeRequest({
    body: { uid: 'spoofed', role: 'admin' },
    headers: requestHeaders({ Authorization: 'Bearer real-token' }),
  }), response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(verifyCalls, ['real-token']);
  assert.deepEqual(calls[0].actor, {
    uid: 'verified-user',
    email: 'user@example.test',
    emailVerified: true,
    kind: 'authenticated',
  });
  assert.equal(calls[0].actor.role, undefined);
});

test('verified token email is omitted unless its claim is verified', async () => {
  const { calls, handlers } = makeBoundary({
    verifyIdToken: async () => ({
      uid: 'verified-user',
      email: 'unverified@example.test',
      email_verified: false,
      role: 'owner',
    }),
  });
  const response = fakeResponse();

  await handlers.cancelBookingV2(fakeRequest({
    headers: requestHeaders({ Authorization: 'Bearer real-token' }),
  }), response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls[0].actor, {
    uid: 'verified-user',
    email: null,
    emailVerified: false,
    kind: 'authenticated',
  });
});

test('verified token UID rejects DEL as UNAUTHENTICATED', async () => {
  const { calls, handlers } = makeBoundary({
    verifyIdToken: async () => ({ uid: 'invalid\u007fuid' }),
  });
  const response = fakeResponse();

  await handlers.cancelBookingV2(fakeRequest({
    headers: requestHeaders({ Authorization: 'Bearer real-token' }),
  }), response);

  assertPublicError(response, 401, 'UNAUTHENTICATED');
  assert.equal(calls.length, 0);
});

test('a supplied malformed or unverifiable create token is not downgraded to guest', async () => {
  const malformedResponse = fakeResponse();
  const malformed = makeBoundary();
  await malformed.handlers.createBookingV2(fakeRequest({
    headers: requestHeaders({ Authorization: 'Basic not-a-bearer-token' }),
  }), malformedResponse);
  assertPublicError(malformedResponse, 401, 'UNAUTHENTICATED');
  assert.equal(malformed.calls.length, 0);

  const failedResponse = fakeResponse();
  const failed = makeBoundary({
    verifyIdToken: async () => {
      throw new Error('token provider rejected a secret token');
    },
  });
  await failed.handlers.createBookingV2(fakeRequest({
    headers: requestHeaders({ Authorization: 'Bearer rejected-token' }),
  }), failedResponse);
  assertPublicError(failedResponse, 401, 'UNAUTHENTICATED');
  assert.equal(JSON.stringify(failedResponse.jsonBody).includes('secret'), false);
});

test('array or duplicate Authorization values cannot downgrade optional create auth to guest', async () => {
  const { calls, handlers, verifyCalls } = makeBoundary();
  for (const authorization of [
    ['Bearer array-token'],
    ['Bearer first-token', 'Bearer second-token'],
  ]) {
    const response = fakeResponse();
    await handlers.createBookingV2(fakeRequest({
      headers: requestHeaders({ Authorization: authorization }),
    }), response);
    assertPublicError(response, 401, 'UNAUTHENTICATED');
  }
  assert.equal(calls.length, 0);
  assert.equal(verifyCalls.length, 0);
});

test('cancel and reschedule require a verified Firebase actor', async () => {
  const { calls, handlers } = makeBoundary();
  for (const handler of [handlers.cancelBookingV2, handlers.rescheduleBookingV2]) {
    const response = fakeResponse();
    await handler(fakeRequest({ headers: requestHeaders() }), response);
    assertPublicError(response, 401, 'UNAUTHENTICATED');
  }
  assert.equal(calls.length, 0);
});

test('cancel and reschedule pass only verified identity to their commands', async () => {
  const { calls, handlers } = makeBoundary();
  const body = {
    bookingId: 'booking-1',
    expectedVersion: 2,
    customerUid: 'spoofed-user',
    email: 'spoofed@example.test',
    ownerId: 'spoofed-owner',
    role: 'owner',
  };

  for (const handler of [handlers.cancelBookingV2, handlers.rescheduleBookingV2]) {
    const response = fakeResponse();
    await handler(fakeRequest({
      body,
      headers: requestHeaders({ Authorization: 'Bearer verified-token' }),
    }), response);
    assert.equal(response.statusCode, 200);
  }

  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.deepEqual(call.actor, {
      uid: 'verified-user',
      email: 'user@example.test',
      emailVerified: true,
      kind: 'authenticated',
    });
    assert.strictEqual(call.payload, body);
  }
});

test('BookingError maps to the exact public failure envelope', async () => {
  const { handlers } = makeBoundary({
    commands: {
      create: async () => {
        throw new BookingError('SLOT_CONFLICT', 'slot is already occupied', {
          httpStatus: 409,
          details: { customerEmail: 'must-not-leak@example.test' },
        });
      },
    },
  });
  const response = fakeResponse();

  await handlers.createBookingV2(fakeRequest({ headers: requestHeaders() }), response);

  assertPublicError(response, 409, 'SLOT_CONFLICT');
  assert.equal(
    response.jsonBody.error.message,
    PUBLIC_ERROR_DEFINITIONS.SLOT_CONFLICT.message,
  );
  assert.equal(JSON.stringify(response.jsonBody).includes('slot is already occupied'), false);
  assert.equal(JSON.stringify(response.jsonBody).includes('must-not-leak'), false);
});

test('known BookingError status, message, retryable, and details are canonicalized', async () => {
  const secret = 'private-message@example.test';
  const { handlers } = makeBoundary({
    commands: {
      create: async () => {
        throw new BookingError('INVALID_DATE', secret, {
          httpStatus: 599,
          retryable: true,
          details: { secret },
        });
      },
    },
  });
  const response = fakeResponse();

  await handlers.createBookingV2(fakeRequest({ headers: requestHeaders() }), response);

  assertPublicError(response, 400, 'INVALID_DATE', false);
  assert.equal(response.jsonBody.error.message, PUBLIC_ERROR_DEFINITIONS.INVALID_DATE.message);
  assert.equal(JSON.stringify(response.jsonBody).includes(secret), false);
});

test('unknown BookingError becomes redacted retryable INTERNAL', async () => {
  const secret = 'unknown-error@example.test';
  const { handlers, logs } = makeBoundary({
    commands: {
      create: async () => {
        throw new BookingError('NOT_IN_ADR', secret, {
          httpStatus: 418,
          details: { secret },
        });
      },
    },
  });
  const response = fakeResponse();

  await handlers.createBookingV2(fakeRequest({ headers: requestHeaders() }), response);

  assertPublicError(response, 500, 'INTERNAL', true);
  assert.equal(response.jsonBody.error.message, PUBLIC_ERROR_DEFINITIONS.INTERNAL.message);
  assert.equal(JSON.stringify(response.jsonBody).includes(secret), false);
  assert.equal(JSON.stringify(logs).includes(secret), false);
});

test('unexpected errors produce redacted retryable INTERNAL and metadata-only logs', async () => {
  const secret = 'private-customer@example.test';
  const { handlers, logs } = makeBoundary({
    commands: {
      create: async () => {
        const error = new Error(`provider failed for ${secret}`);
        error.name = secret;
        error.stack = `stack containing ${secret}`;
        throw error;
      },
    },
  });
  const response = fakeResponse();

  await handlers.createBookingV2(fakeRequest({
    body: { customer: { email: secret }, token: 'secret-token' },
    headers: requestHeaders(),
  }), response);

  assertPublicError(response, 500, 'INTERNAL', true);
  assert.equal(JSON.stringify(response.jsonBody).includes(secret), false);
  assert.deepEqual(logs, [{
    message: 'booking-v2 command failed',
    metadata: { operation: 'create', errorType: 'UnexpectedError' },
  }]);
  assert.equal(JSON.stringify(logs).includes(secret), false);
  assert.equal(JSON.stringify(logs).includes('secret-token'), false);
});

test('a logging failure cannot replace the safe INTERNAL response', async () => {
  const { handlers } = makeBoundary({
    commands: {
      create: async () => {
        throw new Error('command failure');
      },
    },
    logger: {
      error() {
        throw new Error('logging failure');
      },
    },
  });
  const response = fakeResponse();

  await handlers.createBookingV2(fakeRequest({ headers: requestHeaders() }), response);

  assertPublicError(response, 500, 'INTERNAL', true);
});

test('malformed command success envelopes map to INTERNAL', async () => {
  const canonicalBooking = {
    bookingId: 'booking-1',
    version: 1,
    status: 'confirmed',
    resourceId: 'employee:employee-1',
    startAt: '2026-09-02T09:00:00.000Z',
    endAt: '2026-09-02T09:30:00.000Z',
  };
  const canonical = {
    ok: true,
    commandId: 'command-1',
    replayed: false,
    booking: canonicalBooking,
  };
  const malformedResults = [
    null,
    { ...canonical, ok: false },
    { ...canonical, commandId: ' ' },
    { ...canonical, replayed: 'false' },
    { ...canonical, extra: true },
    { ...canonical, booking: null },
    { ...canonical, booking: { ...canonicalBooking, bookingId: '' } },
    { ...canonical, booking: { ...canonicalBooking, version: 0 } },
    { ...canonical, booking: { ...canonicalBooking, version: 1.5 } },
    { ...canonical, booking: { ...canonicalBooking, status: 'rescheduled' } },
    { ...canonical, booking: { ...canonicalBooking, resourceId: ' ' } },
    { ...canonical, booking: { ...canonicalBooking, startAt: '' } },
    { ...canonical, booking: { ...canonicalBooking, endAt: '' } },
    { ...canonical, booking: { ...canonicalBooking, extra: true } },
  ];

  for (const result of malformedResults) {
    const { handlers } = makeBoundary({
      commands: { create: async () => result },
    });
    const response = fakeResponse();
    await handlers.createBookingV2(fakeRequest({ headers: requestHeaders() }), response);
    assertPublicError(response, 500, 'INTERNAL', true);
  }
});

test('canonical command success is returned unchanged', async () => {
  const { handlers, success } = makeBoundary();
  const response = fakeResponse();

  await handlers.createBookingV2(fakeRequest({ headers: requestHeaders() }), response);

  assert.equal(response.statusCode, 200);
  assert.strictEqual(response.jsonBody, success);
});
