import { createHash } from 'crypto';
import { TextEncoder as NodeTextEncoder } from 'util';
import {
  BOOKING_INTENT_STORAGE_KEY,
  acquireBookingIntentKey,
  canonicalizeStrictPlainData,
  markBookingIntentSucceeded,
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

describe('durable booking intent identity', () => {
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

  test('materially changed intent gets a different key', async () => {
    const shared = options();
    const first = await acquireBookingIntentKey(shared);
    const changed = {
      ...privateIntent,
      localStartTime: '10:00',
    };

    await expect(acquireBookingIntentKey({ ...shared, intent: changed }))
      .resolves.not.toBe(first);
  });

  test('explicit success clears the intent and rotates the next key', async () => {
    const shared = options();
    const first = await acquireBookingIntentKey(shared);

    await expect(markBookingIntentSucceeded(shared)).resolves.toBe(true);
    await expect(acquireBookingIntentKey(shared)).resolves.not.toBe(first);
  });

  test('stores only a fingerprint and random key, never raw PII', async () => {
    const shared = options();
    await acquireBookingIntentKey(shared);

    const serialized = shared.storage.snapshot()[BOOKING_INTENT_STORAGE_KEY];
    const parsed = JSON.parse(serialized);
    const [[fingerprint, key]] = Object.entries(parsed.entries);

    expect(parsed.version).toBe(1);
    expect(fingerprint).toMatch(/^sha256:v1:[a-f0-9]{64}$/);
    expect(key).toMatch(/^[A-Za-z0-9._~-]{16,128}$/);
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

  test('replaces corrupt storage without retaining its contents', async () => {
    const storage = createStorage({
      [BOOKING_INTENT_STORAGE_KEY]: '{"rawPii":"private@example.test"}',
    });
    const shared = options({ storage });

    await acquireBookingIntentKey(shared);

    const serialized = storage.snapshot()[BOOKING_INTENT_STORAGE_KEY];
    expect(serialized).not.toContain('private@example.test');
    expect(JSON.parse(serialized).version).toBe(1);
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
      expect(error).toMatchObject({
        code: 'BOOKING_INTENT_STORAGE_UNAVAILABLE',
      });
      expect(JSON.stringify(error)).not.toContain('private@example.test');
    }
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
});
