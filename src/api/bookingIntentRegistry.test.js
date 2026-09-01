import { createHash } from 'crypto';
import { TextEncoder as NodeTextEncoder } from 'util';
import {
  BOOKING_INTENT_STORAGE_KEY as canonicalStorageKey,
  BookingIntentRegistryError as CanonicalRegistryError,
  acquireBookingIntentKey,
  settleBookingIntent as canonicalSettleBookingIntent,
} from '../booking-v2/intentRegistry';
import {
  BOOKING_INTENT_STORAGE_KEY,
  BookingIntentRegistryError,
  getBookingIntentKey,
  settleBookingIntent,
} from './bookingIntentRegistry';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function createCrypto() {
  return {
    randomUUID: () => '00000000-0000-4000-8000-000000000001',
    subtle: {
      digest: async (_algorithm, bytes) => {
        const digest = createHash('sha256').update(Buffer.from(bytes)).digest();
        return digest.buffer.slice(
          digest.byteOffset,
          digest.byteOffset + digest.byteLength
        );
      },
    },
  };
}

describe('legacy booking intent registry compatibility facade', () => {
  test('shares the canonical exports, storage protocol, and error identity', () => {
    expect(getBookingIntentKey).toBe(acquireBookingIntentKey);
    expect(settleBookingIntent).toBe(canonicalSettleBookingIntent);
    expect(BookingIntentRegistryError).toBe(CanonicalRegistryError);
    expect(BOOKING_INTENT_STORAGE_KEY).toBe(canonicalStorageKey);
    expect(BOOKING_INTENT_STORAGE_KEY).toBe(
      'barbersbuddies.booking-v2.intents.v1'
    );
  });

  test('reuses and settles a key through the legacy import path', async () => {
    const input = {
      operation: 'create',
      intent: { shopId: 'shop-1', localDate: '2026-09-03' },
      storage: createStorage(),
      cryptoImpl: createCrypto(),
      TextEncoderImpl: NodeTextEncoder,
    };

    const first = await getBookingIntentKey(input);
    await expect(getBookingIntentKey(input)).resolves.toBe(first);
    await expect(settleBookingIntent({ ...input, outcome: 'success' }))
      .resolves.toBe(true);
  });

  test('throws the canonical error class through the legacy path', async () => {
    let error;
    try {
      await getBookingIntentKey({
        operation: 'create',
        intent: { shopId: undefined },
        storage: createStorage(),
        cryptoImpl: createCrypto(),
        TextEncoderImpl: NodeTextEncoder,
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(CanonicalRegistryError);
    expect(error).toBeInstanceOf(BookingIntentRegistryError);
    expect(error).toMatchObject({ code: 'INVALID_BOOKING_INTENT' });
  });
});
