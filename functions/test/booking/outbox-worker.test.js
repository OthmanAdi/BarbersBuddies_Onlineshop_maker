'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { sha256Canonical } = require('../../src/booking/domain');

const {
  EVENT_CONTRACT,
  createBookingOutboxWorker,
  deterministicBackoffMs,
  validateOutboxDocument,
} = require('../../src/booking/outbox-worker');
const {
  MailgunConfigurationError,
  MailgunDeliveryError,
} = require('../../src/booking/mailgun-provider');

function validDocument(overrides = {}) {
  const document = {
    schemaVersion: 2,
    id: 'outbox-1',
    eventType: 'booking.created.customer-email',
    channel: 'email',
    audience: 'customer',
    bookingId: 'booking-1',
    shopId: 'shop-1',
    bookingVersion: 1,
    commandId: 'command-1',
    eventId: null,
    state: 'pending',
    attempts: 0,
    availableAt: new Date('2026-09-01T10:00:00.000Z'),
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    ...overrides,
  };
  if (Object.hasOwn(overrides, 'state') && overrides.state !== 'pending' && overrides.state !== 'retry') {
    delete document.availableAt;
  }
  if (!Object.hasOwn(overrides, 'eventId')) {
    const linkedEventType = typeof document.eventType === 'string'
      ? document.eventType.replace(/\.(customer|shop)-email$/u, '')
      : 'booking.created';
    document.eventId = sha256Canonical({
      scope: 'booking-event:v2',
      bookingId: document.bookingId,
      version: document.bookingVersion,
      eventType: linkedEventType,
    });
  }
  return document;
}

function constructorOptions(overrides = {}) {
  return {
    db: {
      collection() {},
      runTransaction() {},
    },
    deliveryResolver: async () => ({ kind: 'dead', category: 'SOURCE_MALFORMED' }),
    deliveryProvider: async () => ({ accepted: true }),
    ...overrides,
  };
}

async function processThrownProviderError(error) {
  const deleteField = Symbol('delete-field');
  const ref = { id: 'outbox-1' };
  let stored = validDocument();
  const apply = (values) => {
    for (const [key, value] of Object.entries(values)) {
      if (value === deleteField) {
        delete stored[key];
      } else {
        stored[key] = value;
      }
    }
  };
  const db = {
    collection: () => ({ doc: () => ref }),
    runTransaction: async (callback) => callback({
      get: async () => ({ exists: true, data: () => stored }),
      set: (_ref, value) => { stored = { ...value }; },
      update: (_ref, values) => { apply(values); },
    }),
  };
  const logs = [];
  const worker = createBookingOutboxWorker({
    db,
    clock: () => new Date('2026-09-01T10:00:00.000Z'),
    deleteField,
    deliveryResolver: async () => ({ kind: 'deliver', delivery: { to: 'transient@example.test' } }),
    deliveryProvider: async () => { throw error; },
    logger: { info: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
  });
  const result = await worker.processOne(ref);
  return { result, stored, logs };
}

test('the exact event, channel, and audience matrix is accepted', () => {
  for (const [eventType, audience] of Object.entries(EVENT_CONTRACT)) {
    assert.equal(validateOutboxDocument('outbox-1', validDocument({ eventType, audience })), true);
  }
});

test('unknown events, mismatched audiences, channels, and extra payload fields fail closed', () => {
  assert.equal(validateOutboxDocument('outbox-1', validDocument({ eventType: 'booking.created' })), false);
  assert.equal(validateOutboxDocument('outbox-1', validDocument({ audience: 'shop' })), false);
  assert.equal(validateOutboxDocument('outbox-1', validDocument({ channel: 'push' })), false);
  assert.equal(validateOutboxDocument('outbox-1', validDocument({ recipient: 'private@example.test' })), false);
  assert.equal(validateOutboxDocument('different-id', validDocument()), false);
  assert.equal(validateOutboxDocument('outbox-1', validDocument({ eventId: 'wrong-event' })), false);
  assert.equal(validateOutboxDocument('outbox-1', validDocument({ bookingVersion: 2, eventId: 'stale-event' })), false);
});

test('state-specific timestamps and processing claim hashes are validated', () => {
  assert.equal(validateOutboxDocument('outbox-1', validDocument({ availableAt: null })), false);
  assert.equal(validateOutboxDocument('outbox-1', validDocument({
    state: 'processing',
    attempts: 1,
    claimTokenHash: 'a'.repeat(64),
    claimedAt: new Date('2026-09-01T10:00:00.000Z'),
    leaseExpiresAt: new Date('2026-09-01T10:01:00.000Z'),
  })), true);
  assert.equal(validateOutboxDocument('outbox-1', validDocument({
    state: 'processing',
    attempts: 1,
    claimTokenHash: 'raw-token',
    claimedAt: new Date('2026-09-01T10:00:00.000Z'),
    leaseExpiresAt: new Date('2026-09-01T10:01:00.000Z'),
  })), false);
});

test('hostile proxies and accessors fail closed without invoking attacker text', () => {
  const marker = 'ATTACKER_MARKER_MUST_NOT_ESCAPE';
  const proxy = new Proxy({}, {
    ownKeys() {
      throw new Error(marker);
    },
  });
  const accessor = {};
  Object.defineProperty(accessor, 'state', {
    enumerable: true,
    get() {
      throw new Error(marker);
    },
  });

  assert.doesNotThrow(() => validateOutboxDocument('outbox-1', proxy));
  assert.equal(validateOutboxDocument('outbox-1', proxy), false);
  assert.doesNotThrow(() => validateOutboxDocument('outbox-1', accessor));
  assert.equal(validateOutboxDocument('outbox-1', accessor), false);
  const hostileEvent = validDocument({
    eventType: { [Symbol.toPrimitive]: () => { throw new Error(marker); } },
  });
  assert.doesNotThrow(() => validateOutboxDocument('outbox-1', hostileEvent));
  assert.equal(validateOutboxDocument('outbox-1', hostileEvent), false);
});

test('a hostile injected document is quarantined without calling resolver or provider', async () => {
  const marker = 'HOSTILE_DOCUMENT_PRIVATE_TEXT';
  const hostile = new Proxy({}, {
    ownKeys() {
      throw new Error(marker);
    },
  });
  let stored;
  let resolverCalls = 0;
  let providerCalls = 0;
  const ref = { id: 'outbox-hostile' };
  const db = {
    collection() {
      return { doc: () => ref };
    },
    async runTransaction(callback) {
      return callback({
        get: async () => ({ exists: true, data: () => hostile }),
        set: (_ref, value) => { stored = value; },
        update: () => { throw new Error('update was not expected'); },
      });
    },
  };
  const worker = createBookingOutboxWorker({
    db,
    clock: () => new Date('2026-09-01T10:00:00.000Z'),
    deleteField: Symbol('delete'),
    deliveryResolver: async () => { resolverCalls += 1; },
    deliveryProvider: async () => { providerCalls += 1; },
  });

  assert.deepEqual(await worker.processOne(ref), {
    kind: 'dead', attempt: 1, category: 'SOURCE_MALFORMED',
  });
  assert.equal(resolverCalls, 0);
  assert.equal(providerCalls, 0);
  assert.equal(stored.quarantined, true);
  assert.equal(stored.failureCategory, 'SOURCE_MALFORMED');
  assert.equal(JSON.stringify(stored).includes(marker), false);
  assert.equal(validateOutboxDocument(ref.id, stored), true);
});

test('own Mailgun Error metadata maps to the fixed worker retry and terminal categories', async () => {
  const cases = [
    [new MailgunConfigurationError('private config text'), 'dead', 'PROVIDER_REJECTED'],
    [new MailgunDeliveryError({ code: 'RATE', retryable: true, category: 'rate-limited' }),
      'retry', 'PROVIDER_RATE_LIMITED'],
    [new MailgunDeliveryError({ code: 'DOWN', retryable: true, category: 'provider-unavailable' }),
      'retry', 'PROVIDER_UNAVAILABLE'],
    [new MailgunDeliveryError({ code: 'TIMEOUT', retryable: true, category: 'timeout' }),
      'retry', 'PROVIDER_FAILURE'],
    [new MailgunDeliveryError({ code: 'CONFIG', retryable: false, category: 'configuration' }),
      'dead', 'PROVIDER_REJECTED'],
  ];

  for (const [error, state, category] of cases) {
    const outcome = await processThrownProviderError(error);
    assert.equal(outcome.result.kind, state);
    assert.equal(outcome.stored.state, state);
    assert.equal(outcome.stored.failureCategory, category);
    assert.equal(validateOutboxDocument('outbox-1', outcome.stored), true);
    assert.equal(JSON.stringify(outcome.stored).includes('private config text'), false);
    assert.equal(JSON.stringify(outcome.logs).includes('private config text'), false);
  }
});

test('hostile Error accessors and proxies are never invoked and fall back to safe retry', async () => {
  const marker = 'HOSTILE_PROVIDER_ERROR_PRIVATE_TEXT';
  let accessorReads = 0;
  const accessorError = new Error(marker);
  Object.defineProperty(accessorError, 'retryable', {
    enumerable: true,
    get() {
      accessorReads += 1;
      throw new Error(marker);
    },
  });
  Object.defineProperty(accessorError, 'category', {
    enumerable: true,
    get() {
      accessorReads += 1;
      throw new Error(marker);
    },
  });
  let proxyReads = 0;
  const proxyError = new Proxy(new Error(marker), {
    get() {
      proxyReads += 1;
      throw new Error(marker);
    },
    getOwnPropertyDescriptor() {
      proxyReads += 1;
      throw new Error(marker);
    },
  });

  for (const error of [accessorError, proxyError]) {
    const outcome = await processThrownProviderError(error);
    assert.equal(outcome.result.kind, 'retry');
    assert.equal(outcome.stored.failureCategory, 'PROVIDER_FAILURE');
    assert.equal(JSON.stringify(outcome.stored).includes(marker), false);
    assert.equal(JSON.stringify(outcome.logs).includes(marker), false);
  }
  assert.equal(accessorReads, 0);
  assert.equal(proxyReads, 0);
});

test('backoff is deterministic, bounded, exponential, and capped', () => {
  const config = {
    outboxId: 'outbox-1',
    baseBackoffMs: 1_000,
    maxBackoffMs: 5_000,
    jitterRatio: 0.2,
  };
  const first = deterministicBackoffMs({ ...config, attempt: 1 });
  assert.equal(first, deterministicBackoffMs({ ...config, attempt: 1 }));
  assert.ok(first >= 800 && first <= 1_200);
  const second = deterministicBackoffMs({ ...config, attempt: 2 });
  assert.ok(second >= 1_600 && second <= 2_400);
  const capped = deterministicBackoffMs({ ...config, attempt: 30 });
  assert.ok(capped >= 4_000 && capped <= 5_000);
});

test('worker configuration rejects unsafe batch, lease, attempt, and jitter values', () => {
  assert.throws(() => createBookingOutboxWorker(constructorOptions({ batchSize: 101 })), /batchSize/);
  assert.throws(() => createBookingOutboxWorker(constructorOptions({ leaseMs: 0 })), /leaseMs/);
  assert.throws(() => createBookingOutboxWorker(constructorOptions({ maxAttempts: 0 })), /maxAttempts/);
  assert.throws(() => createBookingOutboxWorker(constructorOptions({ jitterRatio: 0.75 })), /jitterRatio/);
});

test('the injected boundary requires Firestore, resolver, and provider implementations', () => {
  assert.throws(() => createBookingOutboxWorker({}), /Firestore/);
  assert.throws(() => createBookingOutboxWorker({
    db: constructorOptions().db,
    deliveryResolver: async () => ({ kind: 'deliver', delivery: {} }),
  }), /deliveryResolver and deliveryProvider/);
});
