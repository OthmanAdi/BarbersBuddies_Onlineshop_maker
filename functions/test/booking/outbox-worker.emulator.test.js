'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { after, test } = require('node:test');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Outbox worker tests require FIRESTORE_EMULATOR_HOST and refuse live Firestore.');
}
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== 'demo-barbersbuddies') {
  throw new Error('Outbox worker tests only permit the demo-barbersbuddies project.');
}
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor !== 20 && nodeMajor !== 22) {
  throw new Error(`Outbox worker tests require Node 20 or 22, current runtime is ${process.version}.`);
}

const admin = require('firebase-admin');
const { sha256Canonical } = require('../../src/booking/domain');
const {
  createBookingOutboxWorker,
  deterministicBackoffMs,
  validateOutboxDocument,
} = require('../../src/booking/outbox-worker');
const {
  MailgunConfigurationError,
  MailgunDeliveryError,
} = require('../../src/booking/mailgun-provider');

const PROJECT_ID = 'demo-barbersbuddies';
const APP_NAME = `booking-outbox-worker-${process.pid}`;
const app = admin.initializeApp({ projectId: PROJECT_ID }, APP_NAME);
const db = app.firestore();
const createdRefs = [];

function uniqueId(prefix) {
  return `${prefix}-${randomUUID().replaceAll('-', '')}`;
}

function outboxFixture(id, now, overrides = {}) {
  const fixture = {
    schemaVersion: 2,
    id,
    eventType: 'booking.created.customer-email',
    channel: 'email',
    audience: 'customer',
    bookingId: uniqueId('booking'),
    shopId: uniqueId('shop'),
    bookingVersion: 1,
    commandId: uniqueId('command'),
    eventId: null,
    state: 'pending',
    attempts: 0,
    availableAt: admin.firestore.Timestamp.fromDate(now),
    createdAt: admin.firestore.Timestamp.fromDate(now),
    updatedAt: admin.firestore.Timestamp.fromDate(now),
    ...overrides,
  };
  if (!Object.hasOwn(overrides, 'eventId')) {
    fixture.eventId = sha256Canonical({
      scope: 'booking-event:v2',
      bookingId: fixture.bookingId,
      version: fixture.bookingVersion,
      eventType: fixture.eventType.replace(/\.(customer|shop)-email$/u, ''),
    });
  }
  return fixture;
}

async function seedOutbox(now, overrides = {}) {
  const id = uniqueId('outbox');
  const ref = db.collection('bookingOutbox').doc(id);
  createdRefs.push(ref);
  await ref.set(outboxFixture(id, now, overrides));
  return ref;
}

function mutableClock(initial) {
  let current = new Date(initial);
  return {
    now: () => new Date(current),
    advance(milliseconds) {
      current = new Date(current.getTime() + milliseconds);
    },
  };
}

function workerOptions(clock, overrides = {}) {
  return {
    db,
    clock: clock.now,
    leaseMs: 1_000,
    maxAttempts: 3,
    baseBackoffMs: 1_000,
    maxBackoffMs: 10_000,
    jitterRatio: 0.2,
    deliveryResolver: async () => ({
      kind: 'deliver',
      delivery: { recipient: 'transient@example.test', body: 'transient body' },
    }),
    deliveryProvider: async () => ({ accepted: true }),
    ...overrides,
  };
}

test('accepted provider response records accepted, never delivered, with only a token hash', async () => {
  const clock = mutableClock('2026-09-01T10:00:00.000Z');
  const ref = await seedOutbox(clock.now());
  const providerCalls = [];
  const resolverCalls = [];
  const logs = [];
  let transactionDepth = 0;
  const trackedDb = {
    collection: (...args) => db.collection(...args),
    runTransaction: (callback) => db.runTransaction(async (transaction) => {
      transactionDepth += 1;
      try {
        return await callback(transaction);
      } finally {
        transactionDepth -= 1;
      }
    }),
  };
  const worker = createBookingOutboxWorker(workerOptions(clock, {
    db: trackedDb,
    deliveryResolver: async (outbox) => {
      assert.equal(transactionDepth, 0, 'resolver must execute outside a transaction');
      resolverCalls.push(outbox);
      return { kind: 'deliver', delivery: { recipient: 'transient@example.test', body: 'secret body' } };
    },
    deliveryProvider: async (request) => {
      assert.equal(transactionDepth, 0, 'provider must execute outside a transaction');
      providerCalls.push(request);
      return { accepted: true, delivered: true };
    },
    logger: { info: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
  }));

  assert.deepEqual(await worker.processOne(ref), { kind: 'accepted', attempt: 1 });
  assert.equal(providerCalls.length, 1);
  assert.equal(resolverCalls.length, 1);
  const source = (await ref.get()).data();
  assert.equal(resolverCalls[0].eventId, source.eventId);
  assert.equal(resolverCalls[0].bookingId, source.bookingId);
  assert.equal(resolverCalls[0].bookingVersion, source.bookingVersion);
  assert.equal(resolverCalls[0].commandId, source.commandId);
  assert.equal(providerCalls[0].idempotencyKey, `booking-v2-email:${ref.id}`);
  const stored = (await ref.get()).data();
  assert.equal(stored.state, 'accepted');
  assert.equal(Object.hasOwn(stored, 'deliveredAt'), false);
  assert.equal(Object.hasOwn(stored, 'claimTokenHash'), false);
  assert.equal(Object.hasOwn(stored, 'leaseExpiresAt'), false);
  assert.equal(Object.hasOwn(stored, 'claimedAt'), false);
  assert.equal(Object.hasOwn(stored, 'availableAt'), false);
  assert.equal(Object.hasOwn(stored, 'failureCategory'), false);
  assert.equal(validateOutboxDocument(ref.id, stored), true);
  const serialized = JSON.stringify(stored);
  assert.equal(serialized.includes('transient@example.test'), false);
  assert.equal(serialized.includes('secret body'), false);
  assert.equal(JSON.stringify(logs).includes('transient@example.test'), false);
  assert.equal(JSON.stringify(logs).includes('secret body'), false);
});

test('twenty concurrent claims produce one provider call while the lease is live', async () => {
  const clock = mutableClock('2026-09-01T11:00:00.000Z');
  const ref = await seedOutbox(clock.now());
  let calls = 0;
  const worker = createBookingOutboxWorker(workerOptions(clock, {
    deliveryProvider: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 25));
      return { accepted: true };
    },
  }));

  const results = await Promise.all(Array.from({ length: 20 }, () => worker.processOne(ref)));
  assert.equal(calls, 1);
  assert.equal(results.filter((result) => result.kind === 'accepted').length, 1);
  assert.equal(results.filter((result) => result.kind === 'skipped').length, 19);
  assert.equal((await ref.get()).data().attempts, 1);
});

test('claim attempts count lease claims, including a crash-style reclaim without a provider call', async () => {
  const clock = mutableClock('2026-09-01T12:00:00.000Z');
  const ref = await seedOutbox(clock.now());
  let tokenNumber = 0;
  const worker = createBookingOutboxWorker(workerOptions(clock, {
    tokenSource: async () => `claim-token-${++tokenNumber}`,
  }));

  const first = await worker.claim(ref);
  assert.equal(first.kind, 'claimed');
  const afterFirst = (await ref.get()).data();
  assert.match(afterFirst.claimTokenHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(afterFirst).includes(first.token), false);
  assert.equal(Object.hasOwn(afterFirst, 'availableAt'), false);
  assert.equal(validateOutboxDocument(ref.id, afterFirst), true);

  clock.advance(1_001);
  const second = await worker.claim(ref);
  assert.equal(second.kind, 'claimed');
  assert.equal(second.attempt, 2);
  assert.deepEqual(await worker.finalize(first, { kind: 'accepted' }), {
    finalized: false,
    reason: 'stale-claim',
  });
  assert.deepEqual(await worker.finalize(second, { kind: 'accepted' }), {
    finalized: true,
    state: 'accepted',
    attempt: 2,
  });
});

test('retry uses deterministic backoff and a non-retryable provider result becomes dead', async () => {
  const clock = mutableClock('2026-09-01T13:00:00.000Z');
  const ref = await seedOutbox(clock.now());
  const outcomes = [
    { accepted: false, retryable: false, category: 'PROVIDER_UNAVAILABLE' },
    { accepted: false, retryable: true, category: 'PROVIDER_REJECTED' },
  ];
  const worker = createBookingOutboxWorker(workerOptions(clock, {
    deliveryProvider: async () => outcomes.shift(),
  }));

  assert.deepEqual(await worker.processOne(ref), { kind: 'retry', attempt: 1 });
  const retry = (await ref.get()).data();
  assert.equal(retry.state, 'retry');
  assert.equal(retry.failureCategory, 'PROVIDER_UNAVAILABLE');
  assert.equal(Object.hasOwn(retry, 'claimTokenHash'), false);
  assert.equal(Object.hasOwn(retry, 'leaseExpiresAt'), false);
  assert.equal(Object.hasOwn(retry, 'claimedAt'), false);
  assert.equal(validateOutboxDocument(ref.id, retry), true);
  const delay = deterministicBackoffMs({
    outboxId: ref.id,
    attempt: 1,
    baseBackoffMs: 1_000,
    maxBackoffMs: 10_000,
    jitterRatio: 0.2,
  });
  assert.equal(retry.availableAt.toMillis(), clock.now().getTime() + delay);

  clock.advance(delay);
  assert.deepEqual(await worker.processOne(ref), { kind: 'dead', attempt: 2 });
  const dead = (await ref.get()).data();
  assert.equal(dead.state, 'dead');
  assert.equal(dead.failureCategory, 'PROVIDER_REJECTED');
  assert.equal(dead.retryable, false);
  assert.equal(Object.hasOwn(dead, 'availableAt'), false);
  assert.equal(Object.hasOwn(dead, 'claimedAt'), false);
  assert.equal(validateOutboxDocument(ref.id, dead), true);
});

test('retryable failures become dead on the configured maximum attempt', async () => {
  const clock = mutableClock('2026-09-01T14:00:00.000Z');
  const ref = await seedOutbox(clock.now(), { attempts: 1 });
  const worker = createBookingOutboxWorker(workerOptions(clock, {
    maxAttempts: 2,
    deliveryProvider: async () => {
      const error = new Error('raw secret provider failure');
      error.retryable = true;
      throw error;
    },
  }));

  assert.deepEqual(await worker.processOne(ref), { kind: 'dead', attempt: 2 });
  const dead = (await ref.get()).data();
  assert.equal(dead.state, 'dead');
  assert.equal(dead.failureCategory, 'PROVIDER_FAILURE');
  assert.equal(JSON.stringify(dead).includes('raw secret provider failure'), false);
  assert.equal(validateOutboxDocument(ref.id, dead), true);
});

test('suppressed and malformed sources never call the provider', async () => {
  const clock = mutableClock('2026-09-01T15:00:00.000Z');
  const suppressedRef = await seedOutbox(clock.now());
  const malformedResolutionRef = await seedOutbox(clock.now());
  const malformedSchemaRef = await seedOutbox(clock.now(), {
    eventType: 'booking.created',
  });
  let calls = 0;
  const resolutions = new Map([
    [suppressedRef.id, { kind: 'suppressed', category: 'RECIPIENT_SUPPRESSED' }],
    [malformedResolutionRef.id, { kind: 'deliver' }],
  ]);
  let resolverCalls = 0;
  const worker = createBookingOutboxWorker(workerOptions(clock, {
    deliveryResolver: async (outbox) => {
      resolverCalls += 1;
      return resolutions.get(outbox.outboxId);
    },
    deliveryProvider: async () => {
      calls += 1;
      return { accepted: true };
    },
  }));

  assert.deepEqual(await worker.processOne(suppressedRef), { kind: 'suppressed', attempt: 1 });
  assert.deepEqual(await worker.processOne(malformedResolutionRef), { kind: 'dead', attempt: 1 });
  assert.deepEqual(await worker.processOne(malformedSchemaRef), {
    kind: 'dead', attempt: 1, category: 'SOURCE_MALFORMED',
  });
  assert.equal(calls, 0);
  assert.equal(resolverCalls, 2, 'the malformed outbox document must be quarantined before resolution');
  const suppressed = (await suppressedRef.get()).data();
  const malformedResolution = (await malformedResolutionRef.get()).data();
  assert.equal(suppressed.state, 'suppressed');
  assert.equal(validateOutboxDocument(suppressedRef.id, suppressed), true);
  assert.equal(malformedResolution.failureCategory, 'SOURCE_MALFORMED');
  assert.equal(validateOutboxDocument(malformedResolutionRef.id, malformedResolution), true);
  const malformedSchema = (await malformedSchemaRef.get()).data();
  assert.equal(malformedSchema.failureCategory, 'SOURCE_MALFORMED');
  assert.equal(malformedSchema.quarantined, true);
  assert.equal(validateOutboxDocument(malformedSchemaRef.id, malformedSchema), true);
  assert.deepEqual(Object.keys(malformedSchema).sort(), [
    'attempts', 'createdAt', 'deadAt', 'failureCategory', 'id', 'quarantined',
    'retryable', 'schemaVersion', 'state', 'updatedAt',
  ]);
});

test('hostile resolver objects and nested accessors fail dead without provider or attacker leakage', async () => {
  const clock = mutableClock('2026-09-01T15:30:00.000Z');
  const proxyRef = await seedOutbox(clock.now());
  const accessorRef = await seedOutbox(clock.now());
  const marker = 'ATTACKER_PRIVATE_RESOLVER_TEXT';
  const logs = [];
  let providerCalls = 0;
  const worker = createBookingOutboxWorker(workerOptions(clock, {
    deliveryResolver: async (outbox) => {
      if (outbox.outboxId === proxyRef.id) {
        return new Proxy({}, {
          ownKeys() {
            throw new Error(marker);
          },
        });
      }
      const delivery = {};
      Object.defineProperty(delivery, 'recipient', {
        enumerable: true,
        get() {
          throw new Error(marker);
        },
      });
      return { kind: 'deliver', delivery };
    },
    deliveryProvider: async () => {
      providerCalls += 1;
      return { accepted: true };
    },
    logger: { info: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
  }));

  assert.deepEqual(await worker.processOne(proxyRef), { kind: 'dead', attempt: 1 });
  assert.deepEqual(await worker.processOne(accessorRef), { kind: 'dead', attempt: 1 });
  assert.equal(providerCalls, 0);
  for (const ref of [proxyRef, accessorRef]) {
    const stored = (await ref.get()).data();
    assert.equal(stored.state, 'dead');
    assert.equal(stored.failureCategory, 'SOURCE_MALFORMED');
    assert.equal(validateOutboxDocument(ref.id, stored), true);
    assert.equal(JSON.stringify(stored).includes(marker), false);
  }
  assert.equal(JSON.stringify(logs).includes(marker), false);
});

test('real Mailgun Error subclasses persist only fixed worker categories', async () => {
  const clock = mutableClock('2026-09-01T15:45:00.000Z');
  const retryRef = await seedOutbox(clock.now());
  const deadRef = await seedOutbox(clock.now());
  const marker = 'PRIVATE_MAILGUN_CONFIGURATION_TEXT';
  const logs = [];
  const worker = createBookingOutboxWorker(workerOptions(clock, {
    deliveryProvider: async ({ idempotencyKey }) => {
      if (idempotencyKey.endsWith(retryRef.id)) {
        throw new MailgunDeliveryError({
          code: 'MAILGUN_RATE_LIMITED',
          retryable: true,
          category: 'rate-limited',
        });
      }
      throw new MailgunConfigurationError(marker);
    },
    logger: { info: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
  }));

  assert.deepEqual(await worker.processOne(retryRef), { kind: 'retry', attempt: 1 });
  assert.deepEqual(await worker.processOne(deadRef), { kind: 'dead', attempt: 1 });
  const retry = (await retryRef.get()).data();
  const dead = (await deadRef.get()).data();
  assert.equal(retry.failureCategory, 'PROVIDER_RATE_LIMITED');
  assert.equal(dead.failureCategory, 'PROVIDER_REJECTED');
  assert.equal(validateOutboxDocument(retryRef.id, retry), true);
  assert.equal(validateOutboxDocument(deadRef.id, dead), true);
  assert.equal(JSON.stringify(retry).includes(marker), false);
  assert.equal(JSON.stringify(dead).includes(marker), false);
  assert.equal(JSON.stringify(logs).includes(marker), false);
});

test('drain respects its batch bound and leaves excess due records pending', async () => {
  const clock = mutableClock('2026-09-01T15:40:00.000Z');
  const refs = await Promise.all(Array.from({ length: 5 }, () => seedOutbox(clock.now())));
  let calls = 0;
  const worker = createBookingOutboxWorker(workerOptions(clock, {
    batchSize: 3,
    deliveryProvider: async () => {
      calls += 1;
      return { accepted: true };
    },
  }));

  const result = await worker.drain({ limit: 2 });
  assert.equal(result.scanned, 2);
  assert.equal(result.accepted, 2);
  assert.equal(calls, 2);
  const states = await Promise.all(refs.map(async (ref) => (await ref.get()).data().state));
  assert.equal(states.filter((state) => state === 'accepted').length, 2);
  assert.equal(states.filter((state) => state === 'pending').length, 3);
  await assert.rejects(worker.drain({ limit: 4 }), /limit/);
});

after(async () => {
  for (let offset = 0; offset < createdRefs.length; offset += 400) {
    const batch = db.batch();
    for (const ref of createdRefs.slice(offset, offset + 400)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
  await app.delete();
});
