'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { types: { isProxy } } = require('node:util');
const { sha256Canonical } = require('./domain');

const COLLECTION = 'bookingOutbox';
const ACTIVE_STATES = new Set(['pending', 'retry', 'processing']);
const TERMINAL_STATES = new Set(['accepted', 'dead', 'suppressed']);
const EVENT_CONTRACT = Object.freeze({
  'booking.created.customer-email': 'customer',
  'booking.created.shop-email': 'shop',
  'booking.cancelled.customer-email': 'customer',
  'booking.cancelled.shop-email': 'shop',
  'booking.rescheduled.customer-email': 'customer',
  'booking.rescheduled.shop-email': 'shop',
});
const BASE_FIELDS = Object.freeze([
  'schemaVersion', 'id', 'eventType', 'channel', 'audience', 'bookingId', 'shopId',
  'bookingVersion', 'commandId', 'eventId', 'state', 'attempts', 'createdAt', 'updatedAt',
]);
const STATE_FIELDS = Object.freeze({
  pending: Object.freeze(['availableAt']),
  processing: Object.freeze(['claimTokenHash', 'leaseExpiresAt', 'claimedAt']),
  retry: Object.freeze(['availableAt', 'failureCategory', 'retryable']),
  accepted: Object.freeze(['acceptedAt', 'retryable']),
  dead: Object.freeze(['deadAt', 'failureCategory', 'retryable']),
  suppressed: Object.freeze(['failureCategory', 'retryable', 'suppressedAt']),
});
const QUARANTINE_FIELDS = new Set([
  'schemaVersion', 'id', 'state', 'attempts', 'failureCategory', 'retryable',
  'quarantined', 'createdAt', 'deadAt', 'updatedAt',
]);
const SOURCE_DEAD_CATEGORIES = new Set([
  'BOOKING_NOT_FOUND',
  'RECIPIENT_MISSING',
  'SHOP_NOT_FOUND',
  'SOURCE_MALFORMED',
]);
const PROVIDER_RETRY_CATEGORIES = new Set([
  'PROVIDER_FAILURE',
  'PROVIDER_RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
]);
const DEFAULTS = Object.freeze({
  batchSize: 25,
  leaseMs: 60_000,
  maxAttempts: 5,
  baseBackoffMs: 2_000,
  maxBackoffMs: 15 * 60_000,
  jitterRatio: 0.2,
});

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function asMillis(value) {
  try {
    if (value instanceof Date) {
      return Date.prototype.getTime.call(value);
    }
    if (value && typeof value.toMillis === 'function') {
      return value.toMillis();
    }
  } catch (_error) {
    return Number.NaN;
  }
  return Number.NaN;
}

function isNonEmptyString(value, maximum = 512) {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && value.trim() === value;
}

function safeDataProperties(value) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const prototype = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const properties = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== 'string') {
        return null;
      }
      const descriptor = descriptors[key];
      if (!Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
        return null;
      }
      properties[key] = descriptor.value;
    }
    return properties;
  } catch (_error) {
    return null;
  }
}

function hasExactFields(data, expected) {
  const keys = Object.keys(data);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function validateSafeOutboxDocument(documentId, data) {
  if (data.quarantined === true) {
    return hasExactFields(data, QUARANTINE_FIELDS) &&
      data.schemaVersion === 2 &&
      data.id === documentId &&
      data.state === 'dead' &&
      data.failureCategory === 'SOURCE_MALFORMED' &&
      data.retryable === false &&
      Number.isInteger(data.attempts) && data.attempts >= 1 &&
      Number.isFinite(asMillis(data.createdAt)) &&
      Number.isFinite(asMillis(data.updatedAt)) &&
      Number.isFinite(asMillis(data.deadAt));
  }
  if (!ACTIVE_STATES.has(data.state) && !TERMINAL_STATES.has(data.state)) {
    return false;
  }
  const expected = new Set([...BASE_FIELDS, ...STATE_FIELDS[data.state]]);
  if (!hasExactFields(data, expected)) {
    return false;
  }
  if (
    data.schemaVersion !== 2 ||
    data.id !== documentId ||
    typeof data.eventType !== 'string' ||
    !Object.hasOwn(EVENT_CONTRACT, data.eventType) ||
    data.channel !== 'email' ||
    data.audience !== EVENT_CONTRACT[data.eventType] ||
    !isNonEmptyString(data.bookingId) ||
    !isNonEmptyString(data.shopId) ||
    !isNonEmptyString(data.commandId) ||
    !isNonEmptyString(data.eventId) ||
    !Number.isInteger(data.bookingVersion) ||
    data.bookingVersion < 1 ||
    !Number.isInteger(data.attempts) ||
    data.attempts < 0 ||
    !Number.isFinite(asMillis(data.createdAt)) ||
    !Number.isFinite(asMillis(data.updatedAt))
  ) {
    return false;
  }
  const eventType = data.eventType.replace(/\.(customer|shop)-email$/u, '');
  const expectedEventId = sha256Canonical({
    scope: 'booking-event:v2',
    bookingId: data.bookingId,
    version: data.bookingVersion,
    eventType,
  });
  if (data.eventId !== expectedEventId) {
    return false;
  }
  if (data.state === 'pending') {
    return Number.isFinite(asMillis(data.availableAt));
  }
  if (data.state === 'processing') {
    return data.attempts >= 1 && isNonEmptyString(data.claimTokenHash, 64) &&
      /^[a-f0-9]{64}$/.test(data.claimTokenHash) &&
      Number.isFinite(asMillis(data.leaseExpiresAt)) &&
      Number.isFinite(asMillis(data.claimedAt));
  }
  if (data.state === 'retry') {
    return data.attempts >= 1 && data.retryable === true &&
      (data.failureCategory === 'SOURCE_UNAVAILABLE' || PROVIDER_RETRY_CATEGORIES.has(data.failureCategory)) &&
      Number.isFinite(asMillis(data.availableAt));
  }
  if (data.state === 'accepted') {
    return data.attempts >= 1 && data.retryable === false && Number.isFinite(asMillis(data.acceptedAt));
  }
  if (data.state === 'dead') {
    const safeCategory = data.failureCategory === 'MAX_ATTEMPTS' ||
      SOURCE_DEAD_CATEGORIES.has(data.failureCategory) ||
      data.failureCategory === 'PROVIDER_REJECTED' ||
      PROVIDER_RETRY_CATEGORIES.has(data.failureCategory);
    return data.attempts >= 1 && data.retryable === false && safeCategory && Number.isFinite(asMillis(data.deadAt));
  }
  return data.attempts >= 1 && data.retryable === false &&
    data.failureCategory === 'RECIPIENT_SUPPRESSED' && Number.isFinite(asMillis(data.suppressedAt));
}

function validateOutboxDocument(documentId, data) {
  const properties = safeDataProperties(data);
  return properties !== null && validateSafeOutboxDocument(documentId, properties);
}

function deterministicBackoffMs({ outboxId, attempt, baseBackoffMs, maxBackoffMs, jitterRatio }) {
  if (!isNonEmptyString(outboxId) || !Number.isInteger(attempt) || attempt < 1) {
    throw new TypeError('outboxId and a positive integer attempt are required');
  }
  if (!Number.isInteger(baseBackoffMs) || baseBackoffMs < 1 ||
      !Number.isInteger(maxBackoffMs) || maxBackoffMs < baseBackoffMs ||
      typeof jitterRatio !== 'number' || jitterRatio < 0 || jitterRatio > 0.5) {
    throw new TypeError('invalid backoff configuration');
  }
  const exponent = Math.min(attempt - 1, 30);
  const exponential = Math.min(maxBackoffMs, baseBackoffMs * (2 ** exponent));
  const fraction = Number.parseInt(sha256(`${outboxId}:${attempt}`).slice(0, 8), 16) / 0xffffffff;
  const jitter = (fraction * 2 - 1) * jitterRatio;
  return Math.max(1, Math.min(maxBackoffMs, Math.round(exponential * (1 + jitter))));
}

function validatePositiveInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new TypeError(`${name} must be a positive integer no greater than ${maximum}`);
  }
}

function validateConfig(config) {
  validatePositiveInteger(config.batchSize, 'batchSize', 100);
  validatePositiveInteger(config.leaseMs, 'leaseMs');
  validatePositiveInteger(config.maxAttempts, 'maxAttempts', 100);
  validatePositiveInteger(config.baseBackoffMs, 'baseBackoffMs');
  validatePositiveInteger(config.maxBackoffMs, 'maxBackoffMs');
  if (config.maxBackoffMs < config.baseBackoffMs) {
    throw new TypeError('maxBackoffMs must be at least baseBackoffMs');
  }
  if (typeof config.jitterRatio !== 'number' || config.jitterRatio < 0 || config.jitterRatio > 0.5) {
    throw new TypeError('jitterRatio must be between 0 and 0.5');
  }
}

function normalizeClock(clock) {
  const value = clock();
  const millis = asMillis(value);
  if (!Number.isFinite(millis)) {
    throw new TypeError('clock must return a valid Date or Timestamp-like value');
  }
  return new Date(millis);
}

function safeLog(logger, level, message, metadata) {
  try {
    const properties = safeDataProperties(logger);
    if (properties && typeof properties[level] === 'function') {
      properties[level](message, metadata);
    }
  } catch (_error) {
    // Logging must never change durable delivery state or expose the rejected input.
  }
}

function buildResolverEnvelope(data) {
  return Object.freeze({
    outboxId: data.id,
    eventType: data.eventType,
    channel: data.channel,
    audience: data.audience,
    bookingId: data.bookingId,
    bookingVersion: data.bookingVersion,
    shopId: data.shopId,
    commandId: data.commandId,
    eventId: data.eventId,
  });
}

function cloneSafeTransient(value, depth = 0, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (!value || typeof value !== 'object' || depth >= 8 || seen.has(value)) {
    return undefined;
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const keys = Reflect.ownKeys(descriptors);
      if (keys.some((key) => typeof key !== 'string' || (key !== 'length' && !/^(0|[1-9]\d*)$/.test(key)))) {
        return undefined;
      }
      const lengthDescriptor = descriptors.length;
      if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, 'value')) {
        return undefined;
      }
      const copy = [];
      for (let index = 0; index < lengthDescriptor.value; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
          return undefined;
        }
        const entry = cloneSafeTransient(descriptor.value, depth + 1, seen);
        if (entry === undefined) {
          return undefined;
        }
        copy.push(entry);
      }
      return Object.freeze(copy);
    }
    const properties = safeDataProperties(value);
    if (!properties) {
      return undefined;
    }
    const copy = {};
    for (const [key, entryValue] of Object.entries(properties)) {
      const entry = cloneSafeTransient(entryValue, depth + 1, seen);
      if (entry === undefined) {
        return undefined;
      }
      copy[key] = entry;
    }
    return Object.freeze(copy);
  } catch (_error) {
    return undefined;
  } finally {
    seen.delete(value);
  }
}

function normalizeResolution(value) {
  const properties = safeDataProperties(value);
  if (!properties) {
    return { kind: 'dead', category: 'SOURCE_MALFORMED' };
  }
  if (properties.kind === 'deliver' && Object.hasOwn(properties, 'delivery')) {
    const delivery = cloneSafeTransient(properties.delivery);
    return delivery === undefined
      ? { kind: 'dead', category: 'SOURCE_MALFORMED' }
      : { kind: 'deliver', delivery };
  }
  if (properties.kind === 'retry' && properties.category === 'SOURCE_UNAVAILABLE') {
    return { kind: 'retry', category: properties.category };
  }
  if (properties.kind === 'dead' && SOURCE_DEAD_CATEGORIES.has(properties.category)) {
    return { kind: 'dead', category: properties.category };
  }
  if (properties.kind === 'suppressed' && properties.category === 'RECIPIENT_SUPPRESSED') {
    return { kind: 'suppressed', category: properties.category };
  }
  return { kind: 'dead', category: 'SOURCE_MALFORMED' };
}

function normalizeProviderResult(value) {
  const properties = safeDataProperties(value);
  if (properties?.accepted === true) {
    return { kind: 'accepted' };
  }
  if (properties?.accepted === false && PROVIDER_RETRY_CATEGORIES.has(properties.category)) {
    return { kind: 'retry', category: properties.category };
  }
  if (properties?.accepted === false && properties.category === 'PROVIDER_REJECTED') {
    return { kind: 'dead', category: properties.category };
  }
  return { kind: 'retry', category: 'PROVIDER_FAILURE' };
}

function readOwnProviderFailureMetadata(error) {
  try {
    if (error === null || (typeof error !== 'object' && typeof error !== 'function') || isProxy(error)) {
      return null;
    }
    const metadata = Object.create(null);
    for (const property of ['category', 'retryable']) {
      const descriptor = Object.getOwnPropertyDescriptor(error, property);
      if (descriptor !== undefined) {
        if (!Object.hasOwn(descriptor, 'value')) {
          return null;
        }
        metadata[property] = descriptor.value;
      }
    }
    return metadata;
  } catch (_error) {
    return null;
  }
}

function normalizeProviderError(error) {
  const metadata = readOwnProviderFailureMetadata(error);
  if (metadata?.retryable === false) {
    return { kind: 'dead', category: 'PROVIDER_REJECTED' };
  }
  if (metadata?.retryable === true) {
    if (PROVIDER_RETRY_CATEGORIES.has(metadata.category)) {
      return { kind: 'retry', category: metadata.category };
    }
    if (metadata.category === 'rate-limited') {
      return { kind: 'retry', category: 'PROVIDER_RATE_LIMITED' };
    }
    if (metadata.category === 'provider-unavailable') {
      return { kind: 'retry', category: 'PROVIDER_UNAVAILABLE' };
    }
  }
  return { kind: 'retry', category: 'PROVIDER_FAILURE' };
}

function normalizeFinalOutcome(value) {
  const properties = safeDataProperties(value);
  if (!properties) {
    return null;
  }
  if (properties.kind === 'accepted') {
    return { kind: 'accepted' };
  }
  if (properties.kind === 'suppressed' && properties.category === 'RECIPIENT_SUPPRESSED') {
    return { kind: 'suppressed', category: properties.category };
  }
  if (properties.kind === 'retry' &&
      (properties.category === 'SOURCE_UNAVAILABLE' || PROVIDER_RETRY_CATEGORIES.has(properties.category))) {
    return { kind: 'retry', category: properties.category };
  }
  const safeDeadCategory = SOURCE_DEAD_CATEGORIES.has(properties.category) ||
    properties.category === 'PROVIDER_REJECTED' || PROVIDER_RETRY_CATEGORIES.has(properties.category);
  return properties.kind === 'dead' && safeDeadCategory
    ? { kind: 'dead', category: properties.category }
    : null;
}

function createBookingOutboxWorker(options) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('worker options are required');
  }
  const {
    db,
    clock = () => new Date(),
    tokenSource = randomUUID,
    tokenHash = sha256,
    deliveryResolver,
    deliveryProvider,
    logger = null,
  } = options;
  const deleteField = options.deleteField ?? require('firebase-admin').firestore.FieldValue.delete();
  const config = {
    batchSize: options.batchSize ?? DEFAULTS.batchSize,
    leaseMs: options.leaseMs ?? DEFAULTS.leaseMs,
    maxAttempts: options.maxAttempts ?? DEFAULTS.maxAttempts,
    baseBackoffMs: options.baseBackoffMs ?? DEFAULTS.baseBackoffMs,
    maxBackoffMs: options.maxBackoffMs ?? DEFAULTS.maxBackoffMs,
    jitterRatio: options.jitterRatio ?? DEFAULTS.jitterRatio,
  };
  validateConfig(config);
  if (!db || typeof db.collection !== 'function' || typeof db.runTransaction !== 'function') {
    throw new TypeError('a Firestore-compatible db is required');
  }
  if (typeof clock !== 'function' || typeof tokenSource !== 'function' || typeof tokenHash !== 'function') {
    throw new TypeError('clock, tokenSource, and tokenHash must be functions');
  }
  if (typeof deliveryResolver !== 'function' || typeof deliveryProvider !== 'function') {
    throw new TypeError('deliveryResolver and deliveryProvider must be functions');
  }
  if (deleteField === undefined || deleteField === null) {
    throw new TypeError('deleteField must be a Firestore delete sentinel');
  }

  function deletions(...fields) {
    return Object.fromEntries(fields.map((field) => [field, deleteField]));
  }

  function markMalformed(transaction, ref, now) {
    const attempts = 1;
    transaction.set(ref, {
      schemaVersion: 2,
      id: ref.id,
      state: 'dead',
      attempts,
      failureCategory: 'SOURCE_MALFORMED',
      retryable: false,
      quarantined: true,
      createdAt: now,
      deadAt: now,
      updatedAt: now,
    });
    return { kind: 'dead', attempt: attempts, category: 'SOURCE_MALFORMED' };
  }

  async function claim(ref) {
    const rawToken = await tokenSource();
    if (!isNonEmptyString(rawToken, 1024)) {
      throw new TypeError('tokenSource must return a non-empty string');
    }
    const hash = await tokenHash(rawToken);
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) {
      throw new TypeError('tokenHash must return a lowercase SHA-256-shaped digest');
    }
    const now = normalizeClock(clock);
    const leaseExpiresAt = new Date(now.getTime() + config.leaseMs);

    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        return { kind: 'skipped' };
      }
      let data;
      try {
        data = safeDataProperties(snapshot.data());
      } catch (_error) {
        data = null;
      }
      if (!data || !validateSafeOutboxDocument(ref.id, data)) {
        return markMalformed(transaction, ref, now);
      }
      if (TERMINAL_STATES.has(data.state)) {
        return { kind: 'skipped' };
      }
      const due = data.state === 'processing'
        ? asMillis(data.leaseExpiresAt) <= now.getTime()
        : asMillis(data.availableAt) <= now.getTime();
      if (!due) {
        return { kind: 'skipped' };
      }
      if (data.attempts >= config.maxAttempts) {
        transaction.update(ref, {
          ...deletions(
            'availableAt', 'claimTokenHash', 'leaseExpiresAt', 'claimedAt',
            'acceptedAt', 'suppressedAt',
          ),
          state: 'dead',
          failureCategory: 'MAX_ATTEMPTS',
          retryable: false,
          deadAt: now,
          updatedAt: now,
        });
        return { kind: 'dead', attempt: data.attempts, category: 'MAX_ATTEMPTS' };
      }

      // attempts is deliberately a claim-attempt counter. A crash after this commit may
      // consume an attempt without reaching the provider, which bounds poison/crash loops.
      const attempt = data.attempts + 1;
      transaction.update(ref, {
        ...deletions(
          'availableAt', 'failureCategory', 'retryable', 'acceptedAt', 'deadAt', 'suppressedAt',
        ),
        state: 'processing',
        attempts: attempt,
        claimTokenHash: hash,
        claimedAt: now,
        leaseExpiresAt,
        updatedAt: now,
      });
      return {
        kind: 'claimed',
        attempt,
        token: rawToken,
        outbox: buildResolverEnvelope(data),
      };
    });
    return result;
  }

  async function finalize(claimed, outcome) {
    const claimProperties = safeDataProperties(claimed);
    const outboxProperties = claimProperties && safeDataProperties(claimProperties.outbox);
    const normalizedOutcome = normalizeFinalOutcome(outcome);
    if (
      !claimProperties || claimProperties.kind !== 'claimed' ||
      !Number.isInteger(claimProperties.attempt) || claimProperties.attempt < 1 ||
      !isNonEmptyString(claimProperties.token, 1024) ||
      !outboxProperties || !isNonEmptyString(outboxProperties.outboxId) ||
      !normalizedOutcome
    ) {
      throw new TypeError('a successful claim is required');
    }
    const hash = await tokenHash(claimProperties.token);
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) {
      throw new TypeError('tokenHash must return a lowercase SHA-256-shaped digest');
    }
    const now = normalizeClock(clock);
    const ref = db.collection(COLLECTION).doc(outboxProperties.outboxId);

    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        return { finalized: false, reason: 'stale-claim' };
      }
      let data;
      try {
        data = safeDataProperties(snapshot.data());
      } catch (_error) {
        data = null;
      }
      if (!data || !validateSafeOutboxDocument(ref.id, data)) {
        const dead = markMalformed(transaction, ref, now);
        return { finalized: true, state: dead.kind, attempt: dead.attempt };
      }
      if (data.state !== 'processing' || data.claimTokenHash !== hash || data.attempts !== claimProperties.attempt) {
        return { finalized: false, reason: 'stale-claim' };
      }

      let finalOutcome = normalizedOutcome;
      if (normalizedOutcome.kind === 'retry' && claimProperties.attempt >= config.maxAttempts) {
        finalOutcome = { kind: 'dead', category: normalizedOutcome.category };
      }
      const common = {
        updatedAt: now,
        ...deletions('claimTokenHash', 'leaseExpiresAt', 'claimedAt'),
      };
      if (finalOutcome.kind === 'accepted') {
        transaction.update(ref, {
          ...common,
          ...deletions('availableAt', 'failureCategory', 'deadAt', 'suppressedAt'),
          state: 'accepted',
          acceptedAt: now,
          retryable: false,
        });
      } else if (finalOutcome.kind === 'suppressed') {
        transaction.update(ref, {
          ...common,
          ...deletions('availableAt', 'acceptedAt', 'deadAt'),
          state: 'suppressed',
          failureCategory: finalOutcome.category,
          retryable: false,
          suppressedAt: now,
        });
      } else if (finalOutcome.kind === 'dead') {
        transaction.update(ref, {
          ...common,
          ...deletions('availableAt', 'acceptedAt', 'suppressedAt'),
          state: 'dead',
          failureCategory: finalOutcome.category,
          retryable: false,
          deadAt: now,
        });
      } else if (finalOutcome.kind === 'retry') {
        const delay = deterministicBackoffMs({
          outboxId: outboxProperties.outboxId,
          attempt: claimProperties.attempt,
          ...config,
        });
        transaction.update(ref, {
          ...common,
          ...deletions('acceptedAt', 'deadAt', 'suppressedAt'),
          state: 'retry',
          failureCategory: finalOutcome.category,
          retryable: true,
          availableAt: new Date(now.getTime() + delay),
        });
      } else {
        throw new TypeError('unsupported final outcome');
      }
      return { finalized: true, state: finalOutcome.kind, attempt: claimProperties.attempt };
    });
  }

  async function processOne(ref) {
    const claimed = await claim(ref);
    if (claimed.kind !== 'claimed') {
      return claimed;
    }

    let resolution;
    try {
      resolution = normalizeResolution(await deliveryResolver(claimed.outbox));
    } catch (_error) {
      resolution = { kind: 'retry', category: 'SOURCE_UNAVAILABLE' };
    }

    let outcome = resolution;
    if (resolution.kind === 'deliver') {
      try {
        // This stable key enables provider-side conditional deduplication/correlation.
        // The worker remains honestly at-least-once because a lease can expire after acceptance.
        outcome = normalizeProviderResult(await deliveryProvider({
          idempotencyKey: `booking-v2-email:${claimed.outbox.outboxId}`,
          delivery: resolution.delivery,
        }));
      } catch (error) {
        outcome = normalizeProviderError(error);
      }
    }

    const finalization = await finalize(claimed, outcome);
    if (finalization.finalized) {
      const level = finalization.state === 'accepted' || finalization.state === 'suppressed' ? 'info' : 'warn';
      safeLog(logger, level, 'booking outbox attempt finalized', {
        outboxId: claimed.outbox.outboxId,
        state: finalization.state,
        attempt: claimed.attempt,
        category: outcome.category,
      });
    }
    return finalization.finalized ? { kind: finalization.state, attempt: claimed.attempt } : { kind: 'stale' };
  }

  async function queryDue(state, field, now, limit) {
    const snapshot = await db.collection(COLLECTION)
      .where('state', '==', state)
      .where(field, '<=', now)
      .limit(limit)
      .get();
    return snapshot.docs;
  }

  async function drain({ limit = config.batchSize } = {}) {
    validatePositiveInteger(limit, 'limit', config.batchSize);
    const now = normalizeClock(clock);
    const groups = await Promise.all([
      queryDue('pending', 'availableAt', now, limit),
      queryDue('retry', 'availableAt', now, limit),
      queryDue('processing', 'leaseExpiresAt', now, limit),
    ]);
    const candidates = [...new Map(groups.flat().map((snapshot) => [snapshot.ref.path, snapshot])).values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, limit);
    const results = await Promise.all(candidates.map((snapshot) => processOne(snapshot.ref)));
    const counts = { accepted: 0, retry: 0, dead: 0, suppressed: 0, skipped: 0, stale: 0 };
    for (const result of results) {
      const key = Object.hasOwn(counts, result.kind) ? result.kind : 'skipped';
      counts[key] += 1;
    }
    return Object.freeze({ scanned: candidates.length, ...counts });
  }

  return Object.freeze({ claim, finalize, processOne, drain });
}

module.exports = {
  DEFAULTS,
  EVENT_CONTRACT,
  createBookingOutboxWorker,
  deterministicBackoffMs,
  validateOutboxDocument,
};
