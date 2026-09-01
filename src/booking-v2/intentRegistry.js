const REGISTRY_VERSION = 1;
const REGISTRY_STORAGE_KEY = 'barbersbuddies.booking-v2.intents.v1';
const FINGERPRINT_PREFIX = 'sha256:v1:';
const FINGERPRINT_PATTERN = /^sha256:v1:[a-f0-9]{64}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/;
const ALLOWED_OPERATIONS = new Set(['create', 'cancel', 'reschedule']);
const MAX_PLAIN_DATA_DEPTH = 32;
const MAX_PLAIN_DATA_NODES = 10000;

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
    'The booking intent cannot be identified safely.'
  );
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function serializePlainData(value, state, depth) {
  state.nodes += 1;
  if (state.nodes > MAX_PLAIN_DATA_NODES || depth > MAX_PLAIN_DATA_DEPTH) {
    throw invalidIntent();
  }

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

  if (typeof value !== 'object' || state.ancestors.has(value)) {
    throw invalidIntent();
  }

  state.ancestors.add(value);
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

      const items = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (
          !descriptor ||
          descriptor.enumerable !== true ||
          !Object.prototype.hasOwnProperty.call(descriptor, 'value')
        ) {
          throw invalidIntent();
        }
        items.push(serializePlainData(descriptor.value, state, depth + 1));
      }
      return `[${items.join(',')}]`;
    }

    if (!isPlainObject(value)) {
      throw invalidIntent();
    }

    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== 'string')) {
      throw invalidIntent();
    }

    const keys = ownKeys.sort();
    const properties = keys.map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        descriptor.enumerable !== true ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        throw invalidIntent();
      }
      return `${JSON.stringify(key)}:${serializePlainData(
        descriptor.value,
        state,
        depth + 1
      )}`;
    });
    return `{${properties.join(',')}}`;
  } finally {
    state.ancestors.delete(value);
  }
}

export function canonicalizeStrictPlainData(value) {
  try {
    return serializePlainData(
      value,
      { ancestors: new Set(), nodes: 0 },
      0
    );
  } catch (error) {
    if (error instanceof BookingIntentRegistryError) {
      throw error;
    }
    throw invalidIntent();
  }
}

export function assertStrictPlainData(value) {
  canonicalizeStrictPlainData(value);
  return value;
}

function requireOperation(operation) {
  if (typeof operation !== 'string' || !ALLOWED_OPERATIONS.has(operation)) {
    throw invalidIntent();
  }
  return operation;
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

function requireStorage(storage) {
  let resolved = storage;
  if (resolved === undefined) {
    try {
      resolved = typeof window !== 'undefined'
        ? window.localStorage
        : undefined;
    } catch (_error) {
      resolved = undefined;
    }
  }

  if (
    resolved === null ||
    typeof resolved?.getItem !== 'function' ||
    typeof resolved?.setItem !== 'function' ||
    typeof resolved?.removeItem !== 'function'
  ) {
    throw registryError(
      'BOOKING_INTENT_STORAGE_UNAVAILABLE',
      'Durable booking retry storage is unavailable.'
    );
  }
  return resolved;
}

function emptyRegistry() {
  return { version: REGISTRY_VERSION, entries: Object.create(null) };
}

function hasExactKeys(value, expected) {
  const keys = Reflect.ownKeys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => keys.includes(key))
  );
}

function parseRegistry(serialized) {
  if (serialized === null) {
    return { registry: emptyRegistry(), valid: true };
  }

  try {
    const parsed = JSON.parse(serialized);
    if (
      !isPlainObject(parsed) ||
      !hasExactKeys(parsed, ['version', 'entries']) ||
      parsed.version !== REGISTRY_VERSION ||
      !isPlainObject(parsed.entries)
    ) {
      return { registry: emptyRegistry(), valid: false };
    }

    const entries = Object.create(null);
    for (const [fingerprint, idempotencyKey] of Object.entries(parsed.entries)) {
      if (
        !FINGERPRINT_PATTERN.test(fingerprint) ||
        !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)
      ) {
        return { registry: emptyRegistry(), valid: false };
      }
      entries[fingerprint] = idempotencyKey;
    }
    return {
      registry: { version: REGISTRY_VERSION, entries },
      valid: true,
    };
  } catch (_error) {
    return { registry: emptyRegistry(), valid: false };
  }
}

function readRegistry(storage) {
  try {
    return parseRegistry(storage.getItem(REGISTRY_STORAGE_KEY));
  } catch (_error) {
    throw registryError(
      'BOOKING_INTENT_STORAGE_UNAVAILABLE',
      'Durable booking retry storage is unavailable.'
    );
  }
}

function writeRegistry(storage, registry) {
  try {
    storage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));
  } catch (_error) {
    throw registryError(
      'BOOKING_INTENT_STORAGE_UNAVAILABLE',
      'The booking retry identity could not be persisted.'
    );
  }
}

function removeRegistry(storage) {
  try {
    storage.removeItem(REGISTRY_STORAGE_KEY);
  } catch (_error) {
    throw registryError(
      'BOOKING_INTENT_STORAGE_UNAVAILABLE',
      'The booking retry identity could not be cleared.'
    );
  }
}

async function fingerprintIntent({
  operation,
  intent,
  cryptoImpl,
  TextEncoderImpl,
}) {
  const secureCrypto = resolveCrypto(cryptoImpl);
  const Encoder = resolveTextEncoder(TextEncoderImpl);
  if (
    typeof secureCrypto?.subtle?.digest !== 'function' ||
    typeof Encoder !== 'function'
  ) {
    throw registryError(
      'BOOKING_INTENT_CRYPTO_UNAVAILABLE',
      'Secure booking intent hashing is unavailable.'
    );
  }

  const canonical = canonicalizeStrictPlainData({
    scope: 'booking-v2-command-intent',
    operation: requireOperation(operation),
    intent,
  });

  let digest;
  try {
    digest = await secureCrypto.subtle.digest(
      'SHA-256',
      new Encoder().encode(canonical)
    );
  } catch (_error) {
    throw registryError(
      'BOOKING_INTENT_CRYPTO_FAILURE',
      'The booking intent could not be identified securely.'
    );
  }

  const bytes = new Uint8Array(digest);
  if (bytes.length !== 32) {
    throw registryError(
      'BOOKING_INTENT_CRYPTO_FAILURE',
      'The booking intent could not be identified securely.'
    );
  }

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${FINGERPRINT_PREFIX}${hex}`;
}

function createIdempotencyKey(cryptoImpl) {
  const secureCrypto = resolveCrypto(cryptoImpl);
  if (typeof secureCrypto?.randomUUID === 'function') {
    const key = secureCrypto.randomUUID();
    if (IDEMPOTENCY_KEY_PATTERN.test(key)) {
      return key;
    }
  }

  if (typeof secureCrypto?.getRandomValues !== 'function') {
    throw registryError(
      'BOOKING_INTENT_CRYPTO_UNAVAILABLE',
      'Secure booking request identifiers are unavailable.'
    );
  }

  const bytes = new Uint8Array(16);
  try {
    secureCrypto.getRandomValues(bytes);
  } catch (_error) {
    throw registryError(
      'BOOKING_INTENT_CRYPTO_FAILURE',
      'The booking request could not be identified securely.'
    );
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10).join(''),
  ].join('-');
}

export async function acquireBookingIntentKey({
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
  const durableStorage = requireStorage(storage);
  const { registry } = readRegistry(durableStorage);
  const existingKey = registry.entries[fingerprint];
  if (existingKey) {
    return existingKey;
  }

  const idempotencyKey = createIdempotencyKey(cryptoImpl);
  registry.entries[fingerprint] = idempotencyKey;
  writeRegistry(durableStorage, registry);

  const persisted = readRegistry(durableStorage);
  if (
    !persisted.valid ||
    persisted.registry.entries[fingerprint] !== idempotencyKey
  ) {
    throw registryError(
      'BOOKING_INTENT_STORAGE_UNAVAILABLE',
      'The booking retry identity could not be verified after persistence.'
    );
  }
  return idempotencyKey;
}

export async function markBookingIntentSucceeded({
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
  const durableStorage = requireStorage(storage);
  const { registry, valid } = readRegistry(durableStorage);

  if (!valid) {
    removeRegistry(durableStorage);
    return false;
  }
  if (!registry.entries[fingerprint]) {
    return false;
  }

  delete registry.entries[fingerprint];
  if (Object.keys(registry.entries).length === 0) {
    removeRegistry(durableStorage);
  } else {
    writeRegistry(durableStorage, registry);
  }
  return true;
}

export const BOOKING_INTENT_STORAGE_KEY = REGISTRY_STORAGE_KEY;
