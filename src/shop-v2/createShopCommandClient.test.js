import {
  CreateShopCommandClientError,
  createShopCommandClient,
} from './createShopCommandClient';

const ENDPOINT = 'http://localhost:5001/demo-barbersbuddies/us-central1/createShopV2';
const KEY = 'shop-create-key-0001';
const COMMAND_ID = 'a'.repeat(64);

function shop(overrides = {}) {
  return {
    schemaVersion: 2,
    name: 'Barber Buddies Mitte',
    slug: 'barber-buddies-mitte',
    ...overrides,
  };
}

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

function failure(
  code = 'SHOP_NAME_TAKEN',
  message = 'the shop name is already reserved',
  retryable = false
) {
  return { ok: false, error: { code, message, retryable } };
}

function response(envelope, { status = 200, ok = true, json } = {}) {
  return {
    status,
    ok,
    json: json || jest.fn().mockResolvedValue(envelope),
  };
}

function setup(overrides = {}) {
  const options = {
    endpoint: ENDPOINT,
    getIdToken: jest.fn().mockResolvedValue('firebase-id-token'),
    fetchImpl: jest.fn().mockResolvedValue(response(success())),
    AbortControllerImpl: AbortController,
    ...overrides,
  };
  const client = createShopCommandClient(options);
  return {
    client,
    getIdToken: options.getIdToken,
    fetchImpl: options.fetchImpl,
  };
}

function expectClientError(error, expected) {
  expect(error).toBeInstanceOf(CreateShopCommandClientError);
  expect(error).toMatchObject({
    status: 0,
    retryable: false,
    ambiguous: false,
    ...expected,
  });
  return true;
}

async function captureClientError(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected CreateShopCommandClientError');
}

async function flushUntil(predicate, turns = 20) {
  for (let turn = 0; turn < turns; turn += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('condition was not reached');
}

describe('createShopCommandClient configuration', () => {
  test('requires an injected exact createShopV2 endpoint and never invents a default', () => {
    const options = {
      getIdToken: jest.fn(),
      fetchImpl: jest.fn(),
      AbortControllerImpl: AbortController,
    };
    for (const endpoint of [
      undefined,
      '',
      ' createShopV2 ',
      '/createShopV2',
      'ftp://example.com/createShopV2',
      'http://example.com/createShopV2',
      'https://user@example.com/createShopV2',
      'https://example.com/createShopV2?secret=1',
      'https://example.com/createShopV2#fragment',
      'https://example.com/createShopV2/',
      'https://example.com/notCreateShopV2',
    ]) {
      expect(() => createShopCommandClient({ ...options, endpoint })).toThrow(
        expect.objectContaining({ code: 'INVALID_CLIENT_CONFIGURATION' })
      );
    }

    expect(() => createShopCommandClient({
      ...options,
      endpoint: 'https://functions.example.com/createShopV2',
    })).not.toThrow();
    expect(() => createShopCommandClient({
      ...options,
      endpoint: 'http://127.0.0.1:5001/demo/us-central1/createShopV2',
    })).not.toThrow();
  });

  test('rejects missing dependencies and unbounded timeout configuration', () => {
    const valid = {
      endpoint: ENDPOINT,
      getIdToken: jest.fn(),
      fetchImpl: jest.fn(),
      AbortControllerImpl: AbortController,
    };
    for (const overrides of [
      { getIdToken: null },
      { fetchImpl: null },
      { AbortControllerImpl: null },
      { timeoutMs: 0 },
      { timeoutMs: 120001 },
      { timeoutMs: 1.5 },
      { setTimeoutImpl: null },
      { clearTimeoutImpl: null },
    ]) {
      expect(() => createShopCommandClient({ ...valid, ...overrides })).toThrow(
        expect.objectContaining({ code: 'INVALID_CLIENT_CONFIGURATION' })
      );
    }
  });
});

describe('createShopCommandClient request boundary', () => {
  test('sends the exact authenticated POST contract and returns a detached success', async () => {
    const envelope = success();
    const { client, getIdToken, fetchImpl } = setup({
      fetchImpl: jest.fn().mockResolvedValue(response(envelope)),
    });

    const result = await client.execute({ shop: shop(), idempotencyKey: KEY });

    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer firebase-id-token',
        'Idempotency-Key': KEY,
      },
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({
      operation: 'createShopV2',
      shop: shop(),
    });
    expect(result).toEqual(envelope);
    expect(result).not.toBe(envelope);
    expect(result.shop).not.toBe(envelope.shop);
  });

  test('snapshots the shop before waiting for authentication', async () => {
    let releaseToken;
    const token = new Promise((resolve) => {
      releaseToken = resolve;
    });
    const fetchImpl = jest.fn().mockResolvedValue(response(success()));
    const client = createShopCommandClient({
      endpoint: ENDPOINT,
      getIdToken: () => token,
      fetchImpl,
      AbortControllerImpl: AbortController,
    });
    const mutableShop = shop({ nested: { city: 'Berlin' } });
    const pending = client.execute({ shop: mutableShop, idempotencyKey: KEY });
    mutableShop.name = 'Changed later';
    mutableShop.nested.city = 'Hamburg';
    releaseToken('firebase-id-token');
    await pending;

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).shop).toEqual(
      shop({ nested: { city: 'Berlin' } })
    );
  });

  test('rejects malformed keys and shop data before authentication or fetch', async () => {
    const { client, getIdToken, fetchImpl } = setup();
    const accessorShop = {};
    let getterCalls = 0;
    Object.defineProperty(accessorShop, 'secret', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'private';
      },
    });
    const cyclic = {};
    cyclic.self = cyclic;

    for (const command of [
      { shop: shop(), idempotencyKey: 'short' },
      { shop: shop(), idempotencyKey: 'contains spaces 01' },
      { shop: shop(), idempotencyKey: 'x'.repeat(129) },
      { shop: null, idempotencyKey: KEY },
      { shop: [], idempotencyKey: KEY },
      { shop: { value: undefined }, idempotencyKey: KEY },
      { shop: accessorShop, idempotencyKey: KEY },
      { shop: cyclic, idempotencyKey: KEY },
    ]) {
      await expect(client.execute(command)).rejects.toBeInstanceOf(
        CreateShopCommandClientError
      );
    }
    expect(getterCalls).toBe(0);
    expect(getIdToken).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('accepts only the backend idempotency alphabet at exact boundaries', async () => {
    const { client, fetchImpl } = setup();
    await client.execute({ shop: shop(), idempotencyKey: 'A._~-0123456789x' });
    await client.execute({ shop: shop(), idempotencyKey: 'z'.repeat(128) });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('auth failure or malformed token never dispatches a request or leaks raw errors', async () => {
    const fetchImpl = jest.fn();
    const failed = createShopCommandClient({
      endpoint: ENDPOINT,
      getIdToken: () => Promise.reject(new Error('raw token provider secret')),
      fetchImpl,
      AbortControllerImpl: AbortController,
    });
    const authError = await captureClientError(
      failed.execute({ shop: shop(), idempotencyKey: KEY })
    );
    expectClientError(authError, { code: 'AUTH_TOKEN_FAILED', retryable: true });
    expect(authError.message).not.toMatch(/raw|secret/);

    const malformed = createShopCommandClient({
      endpoint: ENDPOINT,
      getIdToken: async () => ' token with spaces ',
      fetchImpl,
      AbortControllerImpl: AbortController,
    });
    await expect(malformed.execute({ shop: shop(), idempotencyKey: KEY })).rejects.toMatchObject({
      code: 'AUTH_TOKEN_INVALID',
      retryable: false,
      ambiguous: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('createShopCommandClient response boundary', () => {
  test('rejects own and untrusted inherited response getters without executing them', async () => {
    let getterCalls = 0;
    const ownGetter = {
      ok: true,
      json: jest.fn(),
    };
    Object.defineProperty(ownGetter, 'status', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 200;
      },
    });
    const inheritedGetter = Object.create({
      get status() {
        getterCalls += 1;
        return 200;
      },
    });
    inheritedGetter.ok = true;
    inheritedGetter.json = jest.fn();

    for (const hostileResponse of [ownGetter, inheritedGetter]) {
      const { client } = setup({
        fetchImpl: jest.fn().mockResolvedValue(hostileResponse),
      });
      await expect(client.execute({ shop: shop(), idempotencyKey: KEY })).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
        retryable: true,
        ambiguous: true,
      });
    }
    expect(getterCalls).toBe(0);
  });

  test('rejects hostile envelope getters without executing them', async () => {
    let getterCalls = 0;
    const envelope = { ok: true, commandId: COMMAND_ID };
    Object.defineProperty(envelope, 'shop', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return success().shop;
      },
    });
    const { client } = setup({
      fetchImpl: jest.fn().mockResolvedValue(response(envelope)),
    });
    await expect(client.execute({ shop: shop(), idempotencyKey: KEY })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      retryable: true,
      ambiguous: true,
    });
    expect(getterCalls).toBe(0);
  });

  test('accepts only the exact success envelope and matching HTTP status', async () => {
    const malformed = [
      response({ ...success(), extra: true }),
      response({ ...success(), commandId: 'not-a-command-id' }),
      response(success({ status: 'active' })),
      response(success({ shopId: '' })),
      response(success(), { status: 201, ok: true }),
      response(success(), { status: 200, ok: false }),
      response({ OK: true, commandId: COMMAND_ID, shop: success().shop }),
    ];
    for (const candidate of malformed) {
      const { client } = setup({ fetchImpl: jest.fn().mockResolvedValue(candidate) });
      await expect(client.execute({ shop: shop(), idempotencyKey: KEY })).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
        retryable: true,
        ambiguous: true,
      });
    }
  });

  test('accepts exact safe server failures and ignores no server-controlled prose', async () => {
    const cases = [
      ['INVALID_SHOP', 400, 'the shop creation request is invalid', false],
      ['UNAUTHENTICATED', 401, 'a valid Firebase ID token is required', false],
      ['SHOP_NAME_TAKEN', 409, 'the shop name is already reserved', false],
      ['INTERNAL', 500, 'the shop creation command could not be completed', true],
    ];
    for (const [code, status, message, retryable] of cases) {
      const { client } = setup({
        fetchImpl: jest.fn().mockResolvedValue(response(
          failure(code, message, retryable),
          { status, ok: false }
        )),
      });
      await expect(client.execute({ shop: shop(), idempotencyKey: KEY })).rejects.toMatchObject({
        code,
        status,
        retryable,
        ambiguous: false,
        message,
      });
    }
  });

  test('malformed, duplicated, or contradictory error fields are ambiguous invalid responses', async () => {
    const malformed = [
      failure('UNKNOWN', 'raw server secret', false),
      failure('SHOP_NAME_TAKEN', 'raw server secret', false),
      failure('SHOP_NAME_TAKEN', 'the shop name is already reserved', true),
      { ...failure(), extra: true },
      { ok: false, error: { ...failure().error, extra: true } },
      { ok: false, error: { ...failure().error, Code: 'SHOP_NAME_TAKEN' } },
    ];
    for (const envelope of malformed) {
      const { client } = setup({
        fetchImpl: jest.fn().mockResolvedValue(response(envelope, { status: 409, ok: false })),
      });
      const error = await captureClientError(
        client.execute({ shop: shop(), idempotencyKey: KEY })
      );
      expectClientError(error, {
        code: 'INVALID_RESPONSE',
        status: 409,
        retryable: true,
        ambiguous: true,
      });
      expect(error.message).not.toMatch(/raw|secret/);
    }
  });

  test('unreadable JSON is sanitized and classified as ambiguous', async () => {
    const { client } = setup({
      fetchImpl: jest.fn().mockResolvedValue(response(null, {
        json: () => Promise.reject(new Error('raw response secret')),
      })),
    });
    const error = await captureClientError(
      client.execute({ shop: shop(), idempotencyKey: KEY })
    );
    expectClientError(error, {
      code: 'INVALID_RESPONSE',
      status: 200,
      retryable: true,
      ambiguous: true,
    });
    expect(error.message).not.toMatch(/raw|secret/);
  });
});

describe('createShopCommandClient retry and ambiguity classification', () => {
  test('network failure after dispatch is retryable and ambiguous without raw leakage', async () => {
    const { client } = setup({
      fetchImpl: () => {
        throw new Error('raw network secret');
      },
    });
    const error = await captureClientError(
      client.execute({ shop: shop(), idempotencyKey: KEY })
    );
    expectClientError(error, {
      code: 'NETWORK_ERROR',
      retryable: true,
      ambiguous: true,
    });
    expect(error.message).not.toMatch(/raw|secret/);
  });

  test('timeout before dispatch is retryable but unambiguous', async () => {
    let fireTimeout;
    const getIdToken = jest.fn(() => new Promise(() => {}));
    const fetchImpl = jest.fn();
    const client = createShopCommandClient({
      endpoint: ENDPOINT,
      getIdToken,
      fetchImpl,
      timeoutMs: 10,
      AbortControllerImpl: AbortController,
      setTimeoutImpl: (callback) => {
        fireTimeout = callback;
        return 1;
      },
      clearTimeoutImpl: jest.fn(),
    });
    const pending = client.execute({ shop: shop(), idempotencyKey: KEY });
    await flushUntil(() => getIdToken.mock.calls.length === 1);
    fireTimeout();
    await expect(pending).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
      retryable: true,
      ambiguous: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('timeout after dispatch is retryable and ambiguous', async () => {
    let fireTimeout;
    const fetchImpl = jest.fn(() => new Promise(() => {}));
    const client = createShopCommandClient({
      endpoint: ENDPOINT,
      getIdToken: async () => 'firebase-id-token',
      fetchImpl,
      timeoutMs: 10,
      AbortControllerImpl: AbortController,
      setTimeoutImpl: (callback) => {
        fireTimeout = callback;
        return 1;
      },
      clearTimeoutImpl: jest.fn(),
    });
    const pending = client.execute({ shop: shop(), idempotencyKey: KEY });
    await flushUntil(() => fetchImpl.mock.calls.length === 1);
    fireTimeout();
    await expect(pending).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
      retryable: true,
      ambiguous: true,
    });
  });

  test('external abort distinguishes pre-dispatch from post-dispatch ambiguity', async () => {
    const beforeController = new AbortController();
    beforeController.abort();
    const before = setup();
    await expect(before.client.execute({
      shop: shop(),
      idempotencyKey: KEY,
      signal: beforeController.signal,
    })).rejects.toMatchObject({
      code: 'REQUEST_ABORTED',
      retryable: false,
      ambiguous: false,
    });
    expect(before.fetchImpl).not.toHaveBeenCalled();

    const afterController = new AbortController();
    const fetchImpl = jest.fn(() => new Promise(() => {}));
    const after = setup({ fetchImpl });
    const pending = after.client.execute({
      shop: shop(),
      idempotencyKey: KEY,
      signal: afterController.signal,
    });
    await flushUntil(() => fetchImpl.mock.calls.length === 1);
    afterController.abort();
    await expect(pending).rejects.toMatchObject({
      code: 'REQUEST_ABORTED',
      retryable: false,
      ambiguous: true,
    });
  });

  test('abort while reading a dispatched response stays ambiguous', async () => {
    const external = new AbortController();
    const json = jest.fn(() => new Promise(() => {}));
    const { client } = setup({
      fetchImpl: jest.fn().mockResolvedValue(response(null, { json })),
    });
    const pending = client.execute({
      shop: shop(),
      idempotencyKey: KEY,
      signal: external.signal,
    });
    await flushUntil(() => json.mock.calls.length === 1);
    external.abort();
    await expect(pending).rejects.toMatchObject({
      code: 'REQUEST_ABORTED',
      retryable: false,
      ambiguous: true,
    });
  });
});
