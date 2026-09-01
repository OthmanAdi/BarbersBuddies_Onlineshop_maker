import { createIdempotencyKey } from './bookingCommands';

const REGISTRY_VERSION = 1;
const FINGERPRINT_PREFIX = 'sha256:v1:';
const STORAGE_KEY = 'barbersbuddies.booking-intents.v1';
const ALLOWED_OPERATIONS = new Set(['create', 'cancel', 'reschedule']);
const CLEARING_OUTCOMES = new Set(['success', 'terminal-failure']);
const RETAINING_OUTCOMES = new Set(['retryable-failure', 'ambiguous']);
const SHA256_HEX_PATTERN = /^sha256:v1:[a-f0-9]{64}$/;
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export class BookingIntentRegistryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BookingIntentRegistryError';
    this.code = code;
  }
}

function registryError(code, message) {
  return new BookingIntentRegistryError(code, message);
}

function invalidIntent() {
  return registryError(
    'INVALID_BOOKING_INTENT',
    'The booking intent cannot be identified safely.',
  );
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalSerialize(value, ancestors = new Set()) {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw invalidIntent();
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }

  if (typeof value !== 'object') {
    throw invalidIntent();
  }

  if (ancestors.has(value)) {
    throw invalidIntent();
  }
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const ownKeys = Reflect.ownKeys(value);
      const expectedKeys = new Set([
        'length',
        ...Array.from({ length: value.length }, (_, index) => String(index)),
      ]);

      if (
        ownKeys.length !== expectedKeys.size ||
        ownKeys.some((key) => typeof key !== 'string' || !expectedKeys.has(key))
      ) {
        throw invalidIntent();
      }

      const parts = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
          throw invalidIntent();
        }
        parts.push(canonicalSerialize(descriptor.value, ancestors));
      }
      return `[${parts.join(',')}]`;
    }

    if (!isPlainObject(value)) {
      throw invalidIntent();
    }

    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== 'string')) {
      throw invalidIntent();
    }

    const keys = ownKeys.sort();
    const parts = keys.map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        descriptor.enumerable !== true ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        throw invalidIntent();
      }
      return `${JSON.stringify(key)}:${canonicalSerialize(descriptor.value, ancestors)}`;
    });
    return `{${parts.join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
}

function resolveCrypto(cryptoImpl) {
  if (cryptoImpl !== undefined) {
    return cryptoImpl;
  }
  return typeof window !== 'undefined' ? window.crypto : undefined;
}

function resolveTextEncoder(TextEncoderImpl) {
  if (TextEncoderImpl !== undefined) {
    return TextEncoderImpl;
  }
  return typeof window !== 'undefined' ? window.TextEncoder : undefined;
}

function resolveStorage(storage) {
  if (storage !== undefined) {
    return storage;
  }

  try {
    return typeof window !== 'undefined' ? window.sessionStorage : undefined;
  } catch (_error) {
    throw registryError(
      'BOOKING_INTENT_STORAGE_UNAVAILABLE',
      'Secure booking retry storage is not available in this browser.',
    );
  }
}

function requireOperation(operation) {
  if (typeof operation !== 'string' || !ALLOWED_OPERATIONS.has(operation)) {
    throw invalidIntent();
  }
  return operation;
}

function requireOutcome(outcome) {
  if (CLEARING_OUTCOMES.has(outcome)) {
    return 'clear';
  }
  if (RETAINING_OUTCOMES.has(outcome)) {
    return 'retain';
  }
  throw registryError(
    'INVALID_BOOKING_INTENT_OUTCOME',
    'The booking command outcome is invalid.',
  );
}

async function fingerprintIntent({ operation, intent, cryptoImpl, TextEncoderImpl }) {
  const secureCrypto = resolveCrypto(cryptoImpl);
  const Encoder = resolveTextEncoder(TextEncoderImpl);

  if (
    typeof secureCrypto?.subtle?.digest !== 'function' ||
    typeof Encoder !== 'function'
  ) {
    throw registryError(
      'BOOKING_INTENT_CRYPTO_UNAVAILABLE',
      'Secure booking intent hashing is not available in this browser.',
    );
  }

  let canonical;
  try {
    canonical = canonicalSerialize({
      operation: requireOperation(operation),
      intent,
    });
  } catch (error) {
    if (error instanceof BookingIntentRegistryError) {
      throw error;
    }
    throw invalidIntent();
  }

  let digest;
  try {
    digest = await secureCrypto.subtle.digest(
      'SHA-256',
      new Encoder().encode(canonical),
    );
  } catch (_error) {
    throw registryError(
      'BOOKING_INTENT_CRYPTO_FAILURE',
      'The booking intent could not be identified securely.',
    );
  }

  const bytes = new Uint8Array(digest);
  if (bytes.length !== 32) {
    throw registryError(
      'BOOKING_INTENT_CRYPTO_FAILURE',
      'The booking intent could not be identified securely.',
    );
  }

  return `${FINGERPRINT_PREFIX}${Array.from(bytes, (byte) => (
    byte.toString(16).padStart(2, '0')
  )).join('')}`;
}

function emptyRegistry() {
  return { v: REGISTRY_VERSION, entries: {} };
}

function parseRegistry(serialized) {
  if (serialized === null) {
    return { registry: emptyRegistry(), isValid: true };
  }

  try {
    const parsed = JSON.parse(serialized);
    if (
      !isPlainObject(parsed) ||
      parsed.v !== REGISTRY_VERSION ||
      !isPlainObject(parsed.entries)
    ) {
      return { registry: emptyRegistry(), isValid: false };
    }

    const entries = Object.entries(parsed.entries);
    if (entries.some(([fingerprint, key]) => (
      !SHA256_HEX_PATTERN.test(fingerprint) || !UUID_PATTERN.test(key)
    ))) {
      return { registry: emptyRegistry(), isValid: false };
    }

    return {
      registry: {
        v: REGISTRY_VERSION,
        entries: Object.fromEntries(entries),
      },
      isValid: true,
    };
  } catch (_error) {
    return { registry: emptyRegistry(), isValid: false };
  }
}

function requireStorage(storage) {
  const resolved = resolveStorage(storage);
  if (
    typeof resolved?.getItem !== 'function' ||
    typeof resolved?.setItem !== 'function' ||
    typeof resolved?.removeItem !== 'function'
  ) {
    throw registryError(
      'BOOKING_INTENT_STORAGE_UNAVAILABLE',
      'Secure booking retry storage is not available in this browser.',
    );
  }
  return resolved;
}

function readRegistry(storage) {
  try {
    return parseRegistry(storage.getItem(STORAGE_KEY));
  } catch (_error) {
    throw registryError(
      'BOOKING_INTENT_STORAGE_UNAVAILABLE',
      'Secure booking retry storage is not available in this browser.',
    );
  }
}

function writeRegistry(storage, registry) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(registry));
  } catch (_error) {
    throw registryError(
      'BOOKING_INTENT_STORAGE_UNAVAILABLE',
      'Secure booking retry storage is not available in this browser.',
    );
  }
}

function removeRegistry(storage) {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch (_error) {
    throw registryError(
      'BOOKING_INTENT_STORAGE_UNAVAILABLE',
      'Secure booking retry storage is not available in this browser.',
    );
  }
}

export async function getBookingIntentKey({
  operation,
  intent,
  storage,
  cryptoImpl,
  TextEncoderImpl,
}) {
  const fingerprint = await fingerprintIntent({
    operation,
    intent,
    cryptoImpl,
    TextEncoderImpl,
  });
  const sessionStorage = requireStorage(storage);
  const { registry } = readRegistry(sessionStorage);
  const existingKey = registry.entries[fingerprint];

  if (existingKey) {
    return existingKey;
  }

  let idempotencyKey;
  try {
    idempotencyKey = createIdempotencyKey(resolveCrypto(cryptoImpl));
  } catch (_error) {
    throw registryError(
      'BOOKING_INTENT_CRYPTO_UNAVAILABLE',
      'Secure booking request identifiers are not available in this browser.',
    );
  }

  if (!UUID_PATTERN.test(idempotencyKey)) {
    throw registryError(
      'BOOKING_INTENT_CRYPTO_FAILURE',
      'The booking request could not be identified securely.',
    );
  }

  registry.entries[fingerprint] = idempotencyKey;
  writeRegistry(sessionStorage, registry);
  return idempotencyKey;
}

export async function settleBookingIntent({
  outcome,
  operation,
  intent,
  storage,
  cryptoImpl,
  TextEncoderImpl,
}) {
  const disposition = requireOutcome(outcome);
  requireOperation(operation);

  if (disposition === 'retain') {
    return false;
  }

  const fingerprint = await fingerprintIntent({
    operation,
    intent,
    cryptoImpl,
    TextEncoderImpl,
  });
  const sessionStorage = requireStorage(storage);
  const { registry, isValid } = readRegistry(sessionStorage);

  if (!isValid) {
    removeRegistry(sessionStorage);
    return false;
  }

  if (!registry.entries[fingerprint]) {
    return false;
  }

  delete registry.entries[fingerprint];
  if (Object.keys(registry.entries).length === 0) {
    removeRegistry(sessionStorage);
  } else {
    writeRegistry(sessionStorage, registry);
  }
  return true;
}

export const BOOKING_INTENT_STORAGE_KEY = STORAGE_KEY;
