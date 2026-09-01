import { createHash } from 'crypto';
import { TextEncoder as NodeTextEncoder } from 'util';
import {
  BOOKING_INTENT_STORAGE_KEY,
  acquireBookingIntentKey,
  canonicalizeStrictPlainData,
  getBookingIntentKey,
  markBookingIntentSucceeded,
  settleBookingIntent,
} from './intentRegistry';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: jest.fn((key) => (values.has(key) ? values.get(key) : null)),
    setItem: jest.fn((key, value) => values.set(key, value)),
    removeItem: jest.fn((key) => values.delete(key)),
    snapshot: () => Object.fromEntries(values),
  };
}

function createCrypto() {
  let sequence = 0;
  return {
    randomUUID: jest.fn(() => {
      sequence += 1;
      return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
    }),
    subtle: {
      digest: jest.fn(async (_algorithm, bytes) => {
        const digest = createHash('sha256').update(Buffer.from(bytes)).digest();
        return digest.buffer.slice(
          digest.byteOffset,
          digest.byteOffset + digest.byteLength
        );
      }),
    },
  };
}

const privateIntent = {
  shopId: 'shop-123',
  localDate: '2026-09-03',
  localStartTime: '09:30',
  customer: {
    name: 'Private Person',
    email: 'private@example.test',
    phone: '+49 111 222333',
  },
  serviceIds: ['service-1'],
};

function options(overrides = {}) {
  return {
    operation: 'create',
    intent: privateIntent,
    storage: createStorage(),
    cryptoImpl: createCrypto(),
    TextEncoderImpl: NodeTextEncoder,
    ...overrides,
  };
}

function storedRegistry(storage) {
  return JSON.parse(storage.snapshot()[BOOKING_INTENT_STORAGE_KEY]);
}

describe('durable booking intent identity', () => {
  test('exposes get as the canonical acquire alias', () => {
    expect(getBookingIntentKey).toBe(acquireBookingIntentKey);
  });

  test('survives retry and a new registry call for the same canonical intent', async () => {
    const shared = options();
    const first = await acquireBookingIntentKey(shared);
    const reordered = {
      serviceIds: ['service-1'],
      customer: {
        phone: '+49 111 222333',
        email: 'private@example.test',
        name: 'Private Person',
      },
      localStartTime: '09:30',
      localDate: '2026-09-03',
      shopId: 'shop-123',
    };

    await expect(acquireBookingIntentKey({ ...shared, intent: reordered }))
      .resolves.toBe(first);
    expect(shared.cryptoImpl.randomUUID).toHaveBeenCalledTimes(1);
  });

  test('reuses a persisted key after a module-independent registry call', async () => {
    const storage = createStorage();
    const firstCrypto = createCrypto();
    const first = await acquireBookingIntentKey(options({ storage, cryptoImpl: firstCrypto }));
    const reloadCrypto = createCrypto();

    await expect(acquireBookingIntentKey(options({
      storage,
      cryptoImpl: reloadCrypto,
    }))).resolves.toBe(first);
    expect(reloadCrypto.randomUUID).not.toHaveBeenCalled();
  });

  test('materially changed intent gets a different key', async () => {
    const shared = options();
    const first = await acquireBookingIntentKey(shared);
    const changed = { ...privateIntent, localStartTime: '10:00' };

    await expect(acquireBookingIntentKey({ ...shared, intent: changed }))
      .resolves.not.toBe(first);
  });

  test('scopes identical intent data by operation', async () => {
    const shared = options();
    const createKey = await acquireBookingIntentKey(shared);

    await expect(acquireBookingIntentKey({ ...shared, operation: 'cancel' }))
      .resolves.not.toBe(createKey);
  });

  test.each(['rescheduel', ' create', 'create '])(
    'rejects unknown or whitespace-padded operation %p before storage access',
    async (operation) => {
      const shared = options({ operation });

      await expect(acquireBookingIntentKey(shared)).rejects.toMatchObject({
        code: 'INVALID_BOOKING_INTENT',
      });
      expect(shared.storage.getItem).not.toHaveBeenCalled();
      expect(shared.storage.setItem).not.toHaveBeenCalled();
      expect(shared.cryptoImpl.randomUUID).not.toHaveBeenCalled();
    }
  );

  test('stores only an exact versioned fingerprint envelope and UUID-v4', async () => {
    const shared = options();
    await acquireBookingIntentKey(shared);

    const serialized = shared.storage.snapshot()[BOOKING_INTENT_STORAGE_KEY];
    const parsed = JSON.parse(serialized);
    const [[fingerprint, key]] = Object.entries(parsed.entries);

    expect(Object.keys(parsed)).toEqual(['version', 'entries']);
    expect(parsed.version).toBe(1);
    expect(fingerprint).toMatch(/^sha256:v1:[a-f0-9]{64}$/);
    expect(key).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
    );
    for (const privateValue of [
      privateIntent.customer.name,
      privateIntent.customer.email,
      privateIntent.customer.phone,
      privateIntent.shopId,
      privateIntent.localDate,
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  test('accepts backend-compatible persisted keys with colon', async () => {
    const shared = options();
    await acquireBookingIntentKey(shared);
    const registry = storedRegistry(shared.storage);
    const [fingerprint] = Object.keys(registry.entries);
    const backendCompatibleKey = 'request:key.0000001';
    registry.entries[fingerprint] = backendCompatibleKey;
    shared.storage.setItem(BOOKING_INTENT_STORAGE_KEY, JSON.stringify(registry));

    await expect(acquireBookingIntentKey(shared)).resolves.toBe(backendCompatibleKey);
  });

  test('rejects a persisted tilde key that the backend would reject', async () => {
    const shared = options();
    await acquireBookingIntentKey(shared);
    const registry = storedRegistry(shared.storage);
    const [fingerprint] = Object.keys(registry.entries);
    registry.entries[fingerprint] = 'request~key.0000001';
    shared.storage.setItem(BOOKING_INTENT_STORAGE_KEY, JSON.stringify(registry));

    const replacement = await acquireBookingIntentKey(shared);

    expect(replacement).toMatch(/-4000-8000-/);
    expect(replacement).not.toContain('~');
    expect(JSON.stringify(storedRegistry(shared.storage))).not.toContain('~');
  });

  test.each([
    ['corrupt JSON', '{"rawPii":"private@example.test"'],
    ['extra root fields', JSON.stringify({ version: 1, entries: {}, extra: true })],
  ])('replaces %s without retaining its contents', async (_name, serialized) => {
    const storage = createStorage({ [BOOKING_INTENT_STORAGE_KEY]: serialized });
    const shared = options({ storage });

    await acquireBookingIntentKey(shared);

    const persisted = storage.snapshot()[BOOKING_INTENT_STORAGE_KEY];
    expect(persisted).not.toContain('private@example.test');
    expect(Object.keys(JSON.parse(persisted))).toEqual(['version', 'entries']);
  });

  test('verifies the generated key was durably read back', async () => {
    const storage = createStorage();
    storage.setItem.mockImplementation(() => undefined);

    await expect(acquireBookingIntentKey(options({ storage })))
      .rejects.toMatchObject({ code: 'BOOKING_INTENT_STORAGE_UNAVAILABLE' });
  });

  test('fails closed and sanitizes localStorage read and write failures', async () => {
    const readFailure = {
      getItem: () => { throw new Error('private@example.test'); },
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    const writeFailure = createStorage();
    writeFailure.setItem.mockImplementation(() => {
      throw new Error('private@example.test');
    });

    for (const storage of [readFailure, writeFailure]) {
      let error;
      try {
        await acquireBookingIntentKey(options({ storage }));
      } catch (caught) {
        error = caught;
      }
      expect(error).toMatchObject({ code: 'BOOKING_INTENT_STORAGE_UNAVAILABLE' });
      expect(JSON.stringify(error)).not.toContain('private@example.test');
    }
  });

  test('fails closed when durable storage is unavailable', async () => {
    await expect(acquireBookingIntentKey(options({ storage: null })))
      .rejects.toMatchObject({ code: 'BOOKING_INTENT_STORAGE_UNAVAILABLE' });
  });
});

describe('booking intent lifecycle', () => {
  test.each(['success', 'terminal-failure'])(
    'clears the intent after a %s outcome',
    async (outcome) => {
      const shared = options();
      const first = await acquireBookingIntentKey(shared);

      await expect(settleBookingIntent({ ...shared, outcome })).resolves.toBe(true);
      await expect(settleBookingIntent({ ...shared, outcome })).resolves.toBe(false);
      await expect(acquireBookingIntentKey(shared)).resolves.not.toBe(first);
      expect(shared.storage.removeItem).toHaveBeenCalledWith(
        BOOKING_INTENT_STORAGE_KEY
      );
    }
  );

  test.each(['retryable-failure', 'ambiguous'])(
    'retains the intent after an %s outcome without touching storage',
    async (outcome) => {
      const shared = options();
      const key = await acquireBookingIntentKey(shared);
      shared.storage.getItem.mockClear();
      shared.storage.setItem.mockClear();
      shared.storage.removeItem.mockClear();

      await expect(settleBookingIntent({
        ...shared,
        outcome,
        retryable: false,
      })).resolves.toBe(false);

      expect(shared.storage.getItem).not.toHaveBeenCalled();
      expect(shared.storage.setItem).not.toHaveBeenCalled();
      expect(shared.storage.removeItem).not.toHaveBeenCalled();
      await expect(acquireBookingIntentKey(shared)).resolves.toBe(key);
    }
  );

  test('gives ambiguity retention precedence over a non-retryable hint', async () => {
    const shared = options();
    const key = await acquireBookingIntentKey(shared);

    await expect(settleBookingIntent({
      ...shared,
      outcome: 'ambiguous',
      retryable: false,
    })).resolves.toBe(false);
    await expect(acquireBookingIntentKey(shared)).resolves.toBe(key);
  });

  test('rejects unknown outcomes and invalid operations before storage access', async () => {
    for (const input of [
      { outcome: 'failed', operation: 'create' },
      { outcome: 'ambiguous', operation: ' create' },
    ]) {
      const shared = options(input);

      await expect(settleBookingIntent({ ...shared, ...input }))
        .rejects.toMatchObject({
          code: input.outcome === 'failed'
            ? 'INVALID_BOOKING_INTENT_OUTCOME'
            : 'INVALID_BOOKING_INTENT',
        });
      expect(shared.storage.getItem).not.toHaveBeenCalled();
      expect(shared.storage.setItem).not.toHaveBeenCalled();
      expect(shared.storage.removeItem).not.toHaveBeenCalled();
    }
  });

  test('terminal settlement removes malformed registry data', async () => {
    const storage = createStorage({
      [BOOKING_INTENT_STORAGE_KEY]: '{"rawPayload":"must-be-removed"',
    });
    const shared = options({ storage });

    await expect(settleBookingIntent({ ...shared, outcome: 'success' }))
      .resolves.toBe(false);
    expect(storage.snapshot()).not.toHaveProperty(BOOKING_INTENT_STORAGE_KEY);
  });

  test('the success convenience function uses canonical settlement', async () => {
    const shared = options();
    await acquireBookingIntentKey(shared);

    await expect(markBookingIntentSucceeded(shared)).resolves.toBe(true);
    await expect(markBookingIntentSucceeded(shared)).resolves.toBe(false);
  });
});

describe('secure UUID generation', () => {
  test('sanitizes randomUUID failures', async () => {
    const cryptoImpl = createCrypto();
    cryptoImpl.randomUUID.mockImplementation(() => {
      throw new Error('private random source detail');
    });

    let error;
    try {
      await acquireBookingIntentKey(options({ cryptoImpl }));
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: 'BOOKING_INTENT_CRYPTO_FAILURE' });
    expect(JSON.stringify(error)).not.toContain('private random source detail');
  });

  test('sanitizes a hostile randomUUID accessor without invoking it twice', async () => {
    const base = createCrypto();
    const getter = jest.fn(() => {
      throw new Error('private randomUUID getter detail');
    });
    const cryptoImpl = { subtle: base.subtle };
    Object.defineProperty(cryptoImpl, 'randomUUID', { get: getter });

    let error;
    try {
      await acquireBookingIntentKey(options({ cryptoImpl }));
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: 'BOOKING_INTENT_CRYPTO_FAILURE' });
    expect(getter).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(error)).not.toContain('private randomUUID getter detail');
  });

  test.each(['request:key.0000001', '00000000-0000-1000-8000-000000000001'])(
    'rejects non-UUID-v4 randomUUID output %p',
    async (generated) => {
      const cryptoImpl = createCrypto();
      cryptoImpl.randomUUID.mockReturnValue(generated);

      await expect(acquireBookingIntentKey(options({ cryptoImpl })))
        .rejects.toMatchObject({ code: 'BOOKING_INTENT_CRYPTO_FAILURE' });
    }
  );

  test('falls back to getRandomValues and sets UUID-v4 version and variant bits', async () => {
    const base = createCrypto();
    const cryptoImpl = {
      subtle: base.subtle,
      getRandomValues: jest.fn((bytes) => {
        bytes.fill(0);
        return bytes;
      }),
    };

    await expect(acquireBookingIntentKey(options({ cryptoImpl }))).resolves.toBe(
      '00000000-0000-4000-8000-000000000000'
    );
  });

  test('distinguishes unavailable crypto from a failing crypto primitive', async () => {
    await expect(acquireBookingIntentKey(options({ cryptoImpl: {} })))
      .rejects.toMatchObject({ code: 'BOOKING_INTENT_CRYPTO_UNAVAILABLE' });

    const cryptoImpl = createCrypto();
    delete cryptoImpl.randomUUID;
    cryptoImpl.getRandomValues = jest.fn(() => {
      throw new Error('private entropy failure');
    });
    await expect(acquireBookingIntentKey(options({ cryptoImpl })))
      .rejects.toMatchObject({ code: 'BOOKING_INTENT_CRYPTO_FAILURE' });
  });
});

describe('strict canonical plain data', () => {
  test('normalizes key order and negative zero', () => {
    expect(canonicalizeStrictPlainData({ z: -0, a: true })).toBe(
      '{"a":true,"z":0}'
    );
  });

  test.each([
    ['undefined', { value: undefined }],
    ['function', { value: () => true }],
    ['date', { value: new Date('2026-09-03T09:30:00Z') }],
    ['sparse array', { value: Array(1) }],
    ['non-finite number', { value: Number.POSITIVE_INFINITY }],
  ])('rejects %s values before storage is touched', async (_name, intent) => {
    const shared = options({ intent });

    await expect(acquireBookingIntentKey(shared)).rejects.toMatchObject({
      code: 'INVALID_BOOKING_INTENT',
    });
    expect(shared.storage.getItem).not.toHaveBeenCalled();
  });

  test('rejects cycles and accessors without invoking the getter', async () => {
    const cyclic = {};
    cyclic.self = cyclic;
    const getter = jest.fn(() => 'private@example.test');
    const accessor = {};
    Object.defineProperty(accessor, 'email', { enumerable: true, get: getter });

    for (const intent of [cyclic, accessor]) {
      await expect(acquireBookingIntentKey(options({ intent })))
        .rejects.toMatchObject({ code: 'INVALID_BOOKING_INTENT' });
    }
    expect(getter).not.toHaveBeenCalled();
  });

  test('enforces depth and node limits before storage access', async () => {
    let tooDeep = null;
    for (let depth = 0; depth < 34; depth += 1) {
      tooDeep = { nested: tooDeep };
    }
    const tooManyNodes = Array.from({ length: 10001 }, () => null);

    for (const intent of [tooDeep, tooManyNodes]) {
      const shared = options({ intent });
      await expect(acquireBookingIntentKey(shared)).rejects.toMatchObject({
        code: 'INVALID_BOOKING_INTENT',
      });
      expect(shared.storage.getItem).not.toHaveBeenCalled();
    }
  });
});
