import { createHash } from 'crypto';
import { TextEncoder as NodeTextEncoder } from 'util';
import {
  BOOKING_INTENT_STORAGE_KEY,
  getBookingIntentKey,
  settleBookingIntent,
} from './bookingIntentRegistry';

function createMemoryStorage(initialEntries = {}) {
  const entries = new Map(Object.entries(initialEntries));
  return {
    getItem: jest.fn((key) => (entries.has(key) ? entries.get(key) : null)),
    setItem: jest.fn((key, value) => entries.set(key, value)),
    removeItem: jest.fn((key) => entries.delete(key)),
    snapshot: () => Object.fromEntries(entries),
  };
}

function createCrypto() {
  let nextUuid = 1;
  return {
    randomUUID: jest.fn(() => (
      `00000000-0000-4000-8000-${String(nextUuid++).padStart(12, '0')}`
    )),
    subtle: {
      digest: jest.fn(async (_algorithm, bytes) => {
        const hash = createHash('sha256').update(Buffer.from(bytes)).digest();
        return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
      }),
    },
  };
}

const intent = {
  shopId: 'shop-1',
  localDate: '2026-09-02',
  localStartTime: '09:30',
  customer: {
    name: 'Private Customer',
    email: 'private@example.test',
    phone: '+49 111 222333',
  },
  serviceIds: ['service-1', 'service-2'],
};

function registryOptions(overrides = {}) {
  return {
    operation: 'create',
    intent,
    storage: createMemoryStorage(),
    cryptoImpl: createCrypto(),
    TextEncoderImpl: NodeTextEncoder,
    ...overrides,
  };
}

describe('booking intent registry', () => {
  test('reuses one key for the same intent regardless of object key order', async () => {
    const options = registryOptions();
    const reorderedIntent = {
      serviceIds: ['service-1', 'service-2'],
      customer: {
        phone: '+49 111 222333',
        email: 'private@example.test',
        name: 'Private Customer',
      },
      localStartTime: '09:30',
      localDate: '2026-09-02',
      shopId: 'shop-1',
    };

    const first = await getBookingIntentKey(options);
    const second = await getBookingIntentKey({ ...options, intent: reorderedIntent });

    expect(second).toBe(first);
    expect(options.cryptoImpl.randomUUID).toHaveBeenCalledTimes(1);
  });

  test('creates a new key when an immutable intent field changes', async () => {
    const options = registryOptions();

    const first = await getBookingIntentKey(options);
    const second = await getBookingIntentKey({
      ...options,
      intent: { ...intent, localStartTime: '10:00' },
    });

    expect(second).not.toBe(first);
  });

  test('scopes identical intent data by operation', async () => {
    const options = registryOptions();

    const createKey = await getBookingIntentKey(options);
    const cancelKey = await getBookingIntentKey({ ...options, operation: 'cancel' });

    expect(cancelKey).not.toBe(createKey);
  });

  test.each(['rescheduel', ' create', 'create '])(
    'rejects unknown or whitespace-padded operation %p before storage access',
    async (operation) => {
      const options = registryOptions({ operation });

      await expect(getBookingIntentKey(options))
        .rejects.toMatchObject({ code: 'INVALID_BOOKING_INTENT' });

      expect(options.storage.getItem).not.toHaveBeenCalled();
      expect(options.storage.setItem).not.toHaveBeenCalled();
      expect(options.storage.removeItem).not.toHaveBeenCalled();
      expect(options.cryptoImpl.randomUUID).not.toHaveBeenCalled();
    },
  );

  test('reuses a stored key after a module-independent reload', async () => {
    const storage = createMemoryStorage();
    const firstCrypto = createCrypto();
    const first = await getBookingIntentKey(registryOptions({ storage, cryptoImpl: firstCrypto }));
    const reloadCrypto = createCrypto();

    const afterReload = await getBookingIntentKey(registryOptions({
      storage,
      cryptoImpl: reloadCrypto,
    }));

    expect(afterReload).toBe(first);
    expect(reloadCrypto.randomUUID).not.toHaveBeenCalled();
  });

  test.each(['success', 'terminal-failure'])(
    'clears the intent after a %s outcome',
    async (outcome) => {
      const options = registryOptions();
      const first = await getBookingIntentKey(options);

      await expect(settleBookingIntent({ ...options, outcome })).resolves.toBe(true);
      await expect(settleBookingIntent({ ...options, outcome })).resolves.toBe(false);
      const afterClear = await getBookingIntentKey(options);

      expect(afterClear).not.toBe(first);
      expect(options.storage.removeItem).toHaveBeenCalledWith(BOOKING_INTENT_STORAGE_KEY);
    },
  );

  test.each(['retryable-failure', 'ambiguous'])(
    'retains the intent after an %s outcome without touching storage',
    async (outcome) => {
      const options = registryOptions();
      const key = await getBookingIntentKey(options);
      options.storage.getItem.mockClear();
      options.storage.setItem.mockClear();
      options.storage.removeItem.mockClear();

      await expect(settleBookingIntent({ ...options, outcome })).resolves.toBe(false);

      expect(options.storage.getItem).not.toHaveBeenCalled();
      expect(options.storage.setItem).not.toHaveBeenCalled();
      expect(options.storage.removeItem).not.toHaveBeenCalled();
      await expect(getBookingIntentKey(options)).resolves.toBe(key);
    },
  );

  test('rejects an unknown settlement outcome without touching storage', async () => {
    const options = registryOptions();

    await expect(settleBookingIntent({ ...options, outcome: 'failed' }))
      .rejects.toMatchObject({ code: 'INVALID_BOOKING_INTENT_OUTCOME' });

    expect(options.storage.getItem).not.toHaveBeenCalled();
    expect(options.storage.setItem).not.toHaveBeenCalled();
    expect(options.storage.removeItem).not.toHaveBeenCalled();
  });

  test.each([
    ['corrupt', '{"rawPayload":"must-be-removed"'],
    ['unsupported', JSON.stringify({ v: 99, entries: {} })],
  ])('terminal settlement removes %s registry data', async (_name, serialized) => {
    const storage = createMemoryStorage({
      [BOOKING_INTENT_STORAGE_KEY]: serialized,
    });
    const options = registryOptions({ storage });

    await expect(settleBookingIntent({ ...options, outcome: 'success' }))
      .resolves.toBe(false);

    expect(storage.removeItem).toHaveBeenCalledWith(BOOKING_INTENT_STORAGE_KEY);
    expect(storage.snapshot()).not.toHaveProperty(BOOKING_INTENT_STORAGE_KEY);
  });

  test('replaces corrupt storage without retaining its contents', async () => {
    const storage = createMemoryStorage({
      [BOOKING_INTENT_STORAGE_KEY]: '{"rawPayload":"must-not-survive"',
    });
    const options = registryOptions({ storage });

    await expect(getBookingIntentKey(options)).resolves.toMatch(
      /^00000000-0000-4000-8000-/,
    );

    const serialized = storage.snapshot()[BOOKING_INTENT_STORAGE_KEY];
    expect(serialized).not.toContain('rawPayload');
    expect(serialized).not.toContain('must-not-survive');
  });

  test('fails safely when secure crypto or storage is unavailable', async () => {
    await expect(getBookingIntentKey(registryOptions({ cryptoImpl: {} })))
      .rejects.toMatchObject({ code: 'BOOKING_INTENT_CRYPTO_UNAVAILABLE' });

    await expect(getBookingIntentKey(registryOptions({ storage: null })))
      .rejects.toMatchObject({ code: 'BOOKING_INTENT_STORAGE_UNAVAILABLE' });

    const throwingStorage = {
      getItem: () => { throw new Error('private storage details'); },
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    let error;
    try {
      await getBookingIntentKey(registryOptions({ storage: throwingStorage }));
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: 'BOOKING_INTENT_STORAGE_UNAVAILABLE' });
    expect(JSON.stringify(error)).not.toContain('private storage details');
  });

  test('stores only a versioned SHA-256 fingerprint and UUID, never raw PII', async () => {
    const options = registryOptions();

    await getBookingIntentKey(options);

    const serialized = options.storage.snapshot()[BOOKING_INTENT_STORAGE_KEY];
    const parsed = JSON.parse(serialized);
    const [[fingerprint, key]] = Object.entries(parsed.entries);

    expect(parsed.v).toBe(1);
    expect(fingerprint).toMatch(/^sha256:v1:[a-f0-9]{64}$/);
    expect(key).toMatch(/^[a-f0-9-]{36}$/);
    expect(serialized).not.toContain(intent.customer.email);
    expect(serialized).not.toContain(intent.customer.name);
    expect(serialized).not.toContain(intent.customer.phone);
    expect(serialized).not.toContain(intent.shopId);
    expect(serialized).not.toContain(intent.localDate);
  });

  test.each([
    ['undefined', { value: undefined }],
    ['function', { value: () => true }],
    ['non-plain object', { value: new Date('2026-09-02T09:30:00Z') }],
  ])('fails closed for %s values', async (_name, invalidValue) => {
    await expect(getBookingIntentKey(registryOptions({ intent: invalidValue })))
      .rejects.toMatchObject({ code: 'INVALID_BOOKING_INTENT' });
  });

  test('fails closed for cyclic values', async () => {
    const cyclic = {};
    cyclic.self = cyclic;

    await expect(getBookingIntentKey(registryOptions({ intent: cyclic })))
      .rejects.toMatchObject({ code: 'INVALID_BOOKING_INTENT' });
  });
});
