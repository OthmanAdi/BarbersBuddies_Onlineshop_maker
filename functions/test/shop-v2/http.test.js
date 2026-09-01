'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { ShopV2CommandError } = require('../../src/shop-v2/create-command');
const {
  ALLOWED_HEADERS,
  ALLOWED_METHODS,
  MAX_BODY_BYTES,
  OPERATION,
  createShopV2HttpHandler,
} = require('../../src/shop-v2/http');

const COMMAND_ID = 'a'.repeat(64);
const IDEMPOTENCY_KEY = 'shop-http-key-00000001';
const ORIGIN = 'http://localhost:3100';

function success(overrides = {}) {
  return {
    ok: true,
    commandId: COMMAND_ID,
    shop: {
      shopId: 'shop-1',
      name: 'Barber Buddies Mitte',
      slug: 'barber-buddies-mitte',
      status: 'draft',
      ...overrides,
    },
  };
}

function body(shop = { schemaVersion: 2 }) {
  return { operation: OPERATION, shop };
}

function headers(overrides = {}) {
  return {
    'content-type': 'application/json',
    'idempotency-key': IDEMPOTENCY_KEY,
    authorization: 'Bearer valid-token',
    ...overrides,
  };
}

function request(overrides = {}) {
  return {
    method: 'POST',
    headers: headers(),
    body: body(),
    ...overrides,
  };
}

function response() {
  return {
    statusCode: null,
    headers: {},
    payload: undefined,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.payload = value;
      return this;
    },
    send(value) {
      this.payload = value;
      return this;
    },
  };
}

function makeHandler(overrides = {}) {
  const logs = [];
  const options = {
    db: { marker: 'db' },
    admin: { marker: 'admin' },
    verifyIdToken: async (token) => token === 'valid-token' ? { uid: 'owner-uid-1' } : Promise.reject(new Error('bad token secret')),
    allowedOrigins: [ORIGIN],
    env: {
      SHOP_V2_ENABLED: 'true',
      FUNCTIONS_EMULATOR: 'true',
      GCLOUD_PROJECT: 'demo-barbersbuddies',
    },
    command: async () => success(),
    logger: {
      error(message, metadata) {
        logs.push({ message, metadata });
      },
    },
    ...overrides,
  };
  return { handler: createShopV2HttpHandler(options), logs };
}

async function invoke(handler, req = request()) {
  const res = response();
  await handler(req, res);
  return res;
}

function assertError(res, status, code, retryable = false) {
  assert.equal(res.statusCode, status);
  assert.deepEqual(res.payload, {
    ok: false,
    error: {
      code,
      message: res.payload.error.message,
      retryable,
    },
  });
  assert.equal(typeof res.payload.error.message, 'string');
}

test('factory rejects unsafe origin and dependency configuration', () => {
  for (const allowedOrigins of [undefined, [], ['*'], ['null'], ['https://example.com/path'], ['https://user@example.com']]) {
    assert.throws(() => makeHandler({ allowedOrigins }), /allowedOrigins/);
  }
  assert.throws(() => makeHandler({ verifyIdToken: null }), /verifyIdToken/);
  assert.throws(() => makeHandler({ command: null }), /command/);
  assert.throws(() => makeHandler({ logger: {} }), /logger\.error/);
});

test('disabled runtime is 404-dark and invokes neither verifier nor command', async () => {
  let verifierCalls = 0;
  let commandCalls = 0;
  const { handler } = makeHandler({
    env: {},
    verifyIdToken: async () => {
      verifierCalls += 1;
      return { uid: 'owner' };
    },
    command: async () => {
      commandCalls += 1;
      return success();
    },
  });
  const res = await invoke(handler, request({
    headers: headers({ origin: 'https://hostile.example', authorization: 'Bearer secret-token' }),
    body: body({ secret: 'must-not-leak' }),
  }));
  assertError(res, 404, 'SHOP_V2_DISABLED');
  assert.equal(verifierCalls, 0);
  assert.equal(commandCalls, 0);
  assert.doesNotMatch(JSON.stringify(res.payload), /hostile|secret-token|must-not-leak/);
});

test('allowed preflight returns only the fixed CORS contract', async () => {
  const { handler } = makeHandler();
  const res = await invoke(handler, request({
    method: 'OPTIONS',
    headers: { origin: ORIGIN },
    body: undefined,
  }));
  assert.equal(res.statusCode, 204);
  assert.equal(res.payload, '');
  assert.equal(res.headers['Access-Control-Allow-Origin'], ORIGIN);
  assert.equal(res.headers['Access-Control-Allow-Methods'], ALLOWED_METHODS);
  assert.equal(res.headers['Access-Control-Allow-Headers'], ALLOWED_HEADERS);
  assert.equal(res.headers.Vary, 'Origin');
});

test('preflight without an allowed exact origin is denied without reflection', async () => {
  const { handler } = makeHandler();
  for (const origin of [undefined, 'https://hostile.example', [ORIGIN, 'https://hostile.example']]) {
    const originHeaders = origin === undefined ? {} : { origin };
    const res = await invoke(handler, request({ method: 'OPTIONS', headers: originHeaders, body: undefined }));
    assertError(res, 403, 'ORIGIN_NOT_ALLOWED');
    assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
    assert.doesNotMatch(JSON.stringify(res.payload), /hostile/);
  }
});

test('allowed POST reflects only the configured origin while absent origin remains callable', async () => {
  const { handler } = makeHandler();
  const cors = await invoke(handler, request({ headers: headers({ origin: ORIGIN }) }));
  assert.equal(cors.statusCode, 200);
  assert.equal(cors.headers['Access-Control-Allow-Origin'], ORIGIN);
  const server = await invoke(handler);
  assert.equal(server.statusCode, 200);
  assert.equal(server.headers['Access-Control-Allow-Origin'], undefined);
});

test('method, exact content type, and content length constraints use fixed errors', async () => {
  const { handler } = makeHandler();
  const wrongMethod = await invoke(handler, request({ method: 'PUT' }));
  assertError(wrongMethod, 405, 'METHOD_NOT_ALLOWED');
  assert.equal(wrongMethod.headers.Allow, ALLOWED_METHODS);

  for (const contentType of [undefined, 'application/json; charset=utf-8', 'Application/JSON', 'text/json']) {
    const nextHeaders = headers();
    if (contentType === undefined) delete nextHeaders['content-type'];
    else nextHeaders['content-type'] = contentType;
    assertError(await invoke(handler, request({ headers: nextHeaders })), 415, 'UNSUPPORTED_MEDIA_TYPE');
  }

  assertError(await invoke(handler, request({
    headers: headers({ 'content-length': String(MAX_BODY_BYTES + 1) }),
  })), 413, 'REQUEST_TOO_LARGE');
  for (const contentLength of ['-1', '+10', '1e3', '10, 20', ['10', '20']]) {
    assertError(await invoke(handler, request({
      headers: headers({ 'content-length': contentLength }),
    })), 400, 'INVALID_REQUEST');
  }
});

test('actual parsed JSON size is bounded even without Content-Length', async () => {
  const { handler } = makeHandler();
  const res = await invoke(handler, request({
    body: body({ text: 'x'.repeat(MAX_BODY_BYTES) }),
  }));
  assertError(res, 413, 'REQUEST_TOO_LARGE');
});

test('body requires the exact operation wrapper and rejects non-JSON structures', async () => {
  const { handler } = makeHandler();
  for (const candidate of [
    null,
    [],
    { shop: {} },
    { operation: 'create', shop: {} },
    { operation: OPERATION, shop: {}, extra: true },
    { operation: OPERATION, shop: [] },
    { operation: OPERATION, shop: { value: undefined } },
  ]) {
    assertError(await invoke(handler, request({ body: candidate })), 400, 'INVALID_REQUEST');
  }
});

test('hostile body accessors and proxies are rejected without execution', async () => {
  const { handler } = makeHandler();
  let calls = 0;
  const hostileShop = {};
  Object.defineProperty(hostileShop, 'secret', {
    enumerable: true,
    get() {
      calls += 1;
      throw new Error('getter secret');
    },
  });
  assertError(await invoke(handler, request({ body: body(hostileShop) })), 400, 'INVALID_REQUEST');
  assert.equal(calls, 0);

  const hostileProxy = new Proxy({ schemaVersion: 2 }, {
    ownKeys() {
      calls += 1;
      throw new Error('proxy secret');
    },
  });
  assertError(await invoke(handler, request({ body: body(hostileProxy) })), 400, 'INVALID_REQUEST');
  assert.equal(calls, 0);
});

test('JSON __proto__ keys stay inert and are passed as owned data for schema rejection', async () => {
  let receivedPayload;
  const { handler } = makeHandler({
    command: async ({ payload }) => {
      receivedPayload = payload;
      throw new ShopV2CommandError('INVALID_SHOP');
    },
  });
  const parsed = JSON.parse('{"operation":"createShopV2","shop":{"schemaVersion":2,"__proto__":{"polluted":true}}}');
  const res = await invoke(handler, request({ body: parsed }));
  assertError(res, 400, 'INVALID_SHOP');
  assert.equal(Object.getPrototypeOf(receivedPayload), null);
  assert.equal(Object.hasOwn(receivedPayload, '__proto__'), true);
  assert.equal(Object.prototype.polluted, undefined);
});

test('hostile or duplicate headers fail closed without invoking traps', async () => {
  let trapCalls = 0;
  const hostileHeaders = new Proxy(headers(), {
    ownKeys() {
      trapCalls += 1;
      throw new Error('header secret');
    },
  });
  const { handler } = makeHandler();
  const hostile = await invoke(handler, request({ headers: hostileHeaders }));
  assertError(hostile, 403, 'ORIGIN_NOT_ALLOWED');
  assert.equal(trapCalls, 0);

  const duplicate = headers({ 'Idempotency-Key': IDEMPOTENCY_KEY });
  assertError(await invoke(handler, request({ headers: duplicate })), 400, 'INVALID_IDEMPOTENCY_KEY');
});

test('Idempotency-Key is required and accepts only 16-128 URL-safe opaque characters', async () => {
  const { handler } = makeHandler();
  for (const key of [undefined, '', 'short', 'contains spaces 0001', 'x'.repeat(129), ['valid-key-0000001']]) {
    const nextHeaders = headers();
    if (key === undefined) delete nextHeaders['idempotency-key'];
    else nextHeaders['idempotency-key'] = key;
    assertError(await invoke(handler, request({ headers: nextHeaders })), 400, 'INVALID_IDEMPOTENCY_KEY');
  }
});

test('authentication is mandatory and malformed or unverifiable tokens are fixed 401 responses', async () => {
  const { handler } = makeHandler();
  for (const authorization of [undefined, '', 'Basic token', 'Bearer', 'Bearer two tokens', 'Bearer one,two', ['Bearer valid-token']]) {
    const nextHeaders = headers();
    if (authorization === undefined) delete nextHeaders.authorization;
    else nextHeaders.authorization = authorization;
    assertError(await invoke(handler, request({ headers: nextHeaders })), 401, 'UNAUTHENTICATED');
  }
  const bad = await invoke(handler, request({ headers: headers({ authorization: 'Bearer invalid-secret-token' }) }));
  assertError(bad, 401, 'UNAUTHENTICATED');
  assert.doesNotMatch(JSON.stringify(bad.payload), /invalid|secret-token/);
});

test('verified actor authority comes only from token uid', async () => {
  let received;
  const { handler } = makeHandler({
    verifyIdToken: async () => ({ uid: 'verified-owner', email: 'private@example.com', admin: true }),
    command: async (args) => {
      received = args;
      return success();
    },
  });
  const shop = { schemaVersion: 2, ownerId: 'attacker-owner', token: 'body-secret' };
  const res = await invoke(handler, request({ body: body(shop) }));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(received.actor, { uid: 'verified-owner' });
  assert.equal(received.payload.ownerId, 'attacker-owner');
  assert.equal(received.idempotencyKey, IDEMPOTENCY_KEY);
  assert.deepEqual(received.db, { marker: 'db' });
  assert.deepEqual(received.admin, { marker: 'admin' });
});

test('hostile or invalid decoded token claims are rejected without getter execution', async () => {
  let getterCalls = 0;
  const token = {};
  Object.defineProperty(token, 'uid', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 'owner';
    },
  });
  for (const decoded of [token, { uid: '' }, { uid: ' owner ' }, { uid: 'owner/path' }, new Proxy({ uid: 'owner' }, {})]) {
    const { handler } = makeHandler({ verifyIdToken: async () => decoded });
    assertError(await invoke(handler), 401, 'UNAUTHENTICATED');
  }
  assert.equal(getterCalls, 0);
});

test('same request replay returns the same fixed result and changed intent maps to reuse conflict', async () => {
  const seen = new Map();
  const command = async ({ payload, actor, idempotencyKey }) => {
    const fingerprint = JSON.stringify({ payload, uid: actor.uid });
    if (seen.has(idempotencyKey) && seen.get(idempotencyKey).fingerprint !== fingerprint) {
      throw new ShopV2CommandError('IDEMPOTENCY_KEY_REUSED');
    }
    if (!seen.has(idempotencyKey)) seen.set(idempotencyKey, { fingerprint, result: success() });
    return seen.get(idempotencyKey).result;
  };
  const { handler } = makeHandler({ command });
  const first = await invoke(handler);
  const replay = await invoke(handler);
  assert.equal(first.statusCode, 200);
  assert.deepEqual(replay.payload, first.payload);
  assert.equal(seen.size, 1);

  const changed = await invoke(handler, request({ body: body({ schemaVersion: 2, name: 'changed' }) }));
  assertError(changed, 409, 'IDEMPOTENCY_KEY_REUSED');
});

test('every command error is canonicalized to its fixed public status and code', async () => {
  for (const [code, status] of [
    ['UNAUTHENTICATED', 401],
    ['INVALID_IDEMPOTENCY_KEY', 400],
    ['INVALID_SHOP', 400],
    ['IDEMPOTENCY_KEY_REUSED', 409],
    ['SHOP_NAME_TAKEN', 409],
    ['SHOP_SLUG_TAKEN', 409],
    ['COMMAND_STATE_INVALID', 500],
    ['INTERNAL', 500],
  ]) {
    const { handler } = makeHandler({ command: async () => { throw new ShopV2CommandError(code); } });
    const res = await invoke(handler);
    assertError(res, status, code, code === 'INTERNAL');
  }
});

test('unexpected verifier and command failures never leak and logs contain metadata only', async () => {
  const verifier = makeHandler({
    verifyIdToken: async () => { throw new Error('verification raw secret'); },
  });
  const authRes = await invoke(verifier.handler);
  assertError(authRes, 401, 'UNAUTHENTICATED');
  assert.equal(verifier.logs.length, 0);

  const unexpected = makeHandler({
    command: async () => { throw new Error('raw db path and private payload secret'); },
  });
  const res = await invoke(unexpected.handler);
  assertError(res, 500, 'INTERNAL', true);
  assert.deepEqual(unexpected.logs, [{
    message: 'shop-v2 command failed',
    metadata: { operation: OPERATION, errorType: 'UnexpectedError' },
  }]);
  assert.doesNotMatch(JSON.stringify({ payload: res.payload, logs: unexpected.logs }), /raw db|private payload|secret/);
});

test('malformed command success and logger failures still return fixed INTERNAL', async () => {
  const hostileResult = new Proxy(success(), {
    ownKeys() {
      throw new Error('result secret');
    },
  });
  for (const malformed of [
    null,
    {},
    { ...success(), extra: true },
    success({ status: 'active' }),
    success({ shopId: '' }),
    hostileResult,
  ]) {
    const { handler } = makeHandler({ command: async () => malformed });
    assertError(await invoke(handler), 500, 'INTERNAL', true);
  }
  const { handler } = makeHandler({
    command: async () => { throw new Error('private'); },
    logger: { error() { throw new Error('logging secret'); } },
  });
  assertError(await invoke(handler), 500, 'INTERNAL', true);
});

test('successful response is reconstructed from the exact command envelope', async () => {
  const result = success();
  const { handler } = makeHandler({ command: async () => result });
  const res = await invoke(handler);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, result);
  assert.notEqual(res.payload, result);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
});
