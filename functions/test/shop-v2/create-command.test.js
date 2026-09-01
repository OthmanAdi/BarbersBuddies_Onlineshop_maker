'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { WEEKDAYS, buildShopV2CreateProjection } = require('../../src/shop-v2/schema');
const {
  ShopV2CommandError,
  createShopV2,
} = require('../../src/shop-v2/create-command');

const OWNER = Object.freeze({ uid: 'owner-uid-1' });
const KEY = 'shop-create-key-00000001';
const SERVER_TIMESTAMP = Object.freeze({ __serverTimestamp: true });

function emptyWeek(intervals = []) {
  return Object.fromEntries(WEEKDAYS.map((day) => [
    day,
    day === 'monday' ? intervals.map((interval) => ({ ...interval })) : [],
  ]));
}

function validDraft(overrides = {}) {
  return {
    schemaVersion: 2,
    name: ' Barber Buddies Mitte ',
    slug: 'barber-buddies-mitte',
    presentation: {
      headline: 'Cuts with care',
      description: 'A calm neighborhood barbershop.',
      logoAssetId: null,
      heroAssetId: null,
      galleryAssetIds: [],
    },
    contact: {
      publicEmail: 'hello@example.com',
      publicPhone: '+493012345678',
      websiteUrl: 'https://example.com',
      street: 'Musterstrasse 1',
      postalCode: '10115',
      city: 'Berlin',
      countryCode: 'DE',
    },
    timeZone: 'Europe/Berlin',
    currency: 'EUR',
    minorUnitDigits: 2,
    bookingPolicy: {
      guestBookingEnabled: true,
      cancellationNoticeMinutes: 1440,
      leadTimeMinutes: 60,
      bookingWindowDays: 90,
    },
    consent: {
      version: 'terms-2026-09',
      termsAccepted: true,
      privacyAccepted: true,
    },
    weeklyAvailability: emptyWeek([
      { startLocalTime: '09:00', endLocalTime: '18:00' },
    ]),
    services: [{
      id: 'haircut',
      name: 'Haircut',
      description: '',
      active: true,
      priceMinor: 3500,
      durationMinutes: 30,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 10,
    }],
    employees: [{
      id: 'resource-a',
      active: true,
      serviceIds: ['haircut'],
      weeklyAvailability: emptyWeek([
        { startLocalTime: '09:00', endLocalTime: '18:00' },
      ]),
    }],
    stagedAssets: [],
    ...overrides,
  };
}

class FakeRef {
  constructor(db, collection, id) {
    this.db = db;
    this.collectionName = collection;
    this.id = id;
    this.path = `${collection}/${id}`;
  }
}

class FakeSnapshot {
  constructor(ref, value) {
    this.ref = ref;
    this.exists = value !== undefined;
    this.value = value;
  }

  data() {
    return this.value;
  }
}

class FakeTransaction {
  constructor(db) {
    this.db = db;
    this.reads = [];
    this.creates = [];
    this.writePhase = false;
  }

  async get(ref) {
    if (this.writePhase) throw new Error('read after write');
    this.reads.push(ref.path);
    return new FakeSnapshot(ref, this.db.documents.get(ref.path));
  }

  create(ref, data) {
    this.writePhase = true;
    this.creates.push({ ref, data });
  }

  commit() {
    for (const { ref } of this.creates) {
      if (this.db.documents.has(ref.path)) throw new Error('create precondition failed');
    }
    for (const { ref, data } of this.creates) this.db.documents.set(ref.path, data);
  }
}

class FakeFirestore {
  constructor({ generatedId = 'generated-shop-1', forcedRetries = 0 } = {}) {
    this.documents = new Map();
    this.generatedId = generatedId;
    this.generatedRefCount = 0;
    this.forcedRetries = forcedRetries;
    this.transactionAttempts = [];
  }

  collection(name) {
    return {
      doc: (id) => {
        let resolvedId = id;
        if (resolvedId === undefined) {
          this.generatedRefCount += 1;
          resolvedId = this.generatedId;
        }
        return new FakeRef(this, name, resolvedId);
      },
    };
  }

  async runTransaction(callback) {
    const maximumAttempts = this.forcedRetries + 1;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      const transaction = new FakeTransaction(this);
      const result = await callback(transaction);
      this.transactionAttempts.push(transaction);
      if (attempt <= this.forcedRetries) continue;
      transaction.commit();
      return result;
    }
    throw new Error('unreachable');
  }

  put(path, value) {
    this.documents.set(path, value);
  }
}

const admin = Object.freeze({
  firestore: Object.freeze({
    FieldValue: Object.freeze({
      serverTimestamp: () => SERVER_TIMESTAMP,
    }),
  }),
});

function args(db, overrides = {}) {
  return {
    db,
    admin,
    payload: validDraft(),
    actor: OWNER,
    idempotencyKey: KEY,
    ...overrides,
  };
}

function expectCode(code, status) {
  return (error) => {
    assert.ok(error instanceof ShopV2CommandError);
    assert.equal(error.code, code);
    assert.equal(error.httpStatus, status);
    return true;
  };
}

test('atomically creates public, private, command, and deterministic reservation documents', async () => {
  const db = new FakeFirestore();
  const result = await createShopV2(args(db));

  assert.equal(result.ok, true);
  assert.equal(result.shop.shopId, 'generated-shop-1');
  assert.equal(result.shop.name, 'Barber Buddies Mitte');
  assert.match(result.commandId, /^[a-f0-9]{64}$/);
  assert.equal(db.documents.size, 5);

  const projection = buildShopV2CreateProjection(validDraft());
  const publicDocument = db.documents.get('barberShops/generated-shop-1');
  const privateDocument = db.documents.get('shopPrivate/generated-shop-1');
  const commandDocument = db.documents.get(`shopCreateCommands/${result.commandId}`);
  assert.equal(publicDocument.ownerId, OWNER.uid);
  assert.equal(privateDocument.ownerId, OWNER.uid);
  assert.equal(privateDocument.consent.acceptedAt, SERVER_TIMESTAMP);
  assert.equal(publicDocument.createdAt, SERVER_TIMESTAMP);
  assert.equal(commandDocument.updatedAt, SERVER_TIMESTAMP);
  assert.equal(commandDocument.result, result);
  assert.equal(Object.hasOwn(commandDocument, 'idempotencyKey'), false);
  assert.equal(JSON.stringify([...db.documents.values()]).includes(KEY), false);
  assert.equal(
    db.documents.get(`shopNameReservations/${projection.privateShop.reservationKeys.nameKey}`).shopId,
    result.shop.shopId,
  );
  assert.equal(
    db.documents.get(`shopSlugReservations/${projection.privateShop.reservationKeys.slugKey}`).shopId,
    result.shop.shopId,
  );
  assert.equal(db.transactionAttempts[0].reads.length, 3);
  assert.deepEqual(db.transactionAttempts[0].creates.map(({ ref }) => ref.path), [
    'barberShops/generated-shop-1',
    'shopPrivate/generated-shop-1',
    `shopNameReservations/${projection.privateShop.reservationKeys.nameKey}`,
    `shopSlugReservations/${projection.privateShop.reservationKeys.slugKey}`,
    `shopCreateCommands/${result.commandId}`,
  ]);
});

test('same actor, key, and canonical request replays the exact stored result', async () => {
  const db = new FakeFirestore();
  const first = await createShopV2(args(db));
  const reordered = validDraft();
  reordered.name = '  Barber   Buddies   Mitte  ';
  reordered.contact.publicEmail = ' HELLO@EXAMPLE.COM ';
  reordered.services.reverse();
  reordered.employees.reverse();
  reordered.stagedAssets.reverse();
  const replay = await createShopV2(args(db, { payload: reordered }));

  assert.deepEqual(replay, first);
  assert.equal(db.documents.size, 5);
  assert.equal(db.transactionAttempts[1].reads.length, 1);
  assert.equal(db.transactionAttempts[1].creates.length, 0);
});

test('same actor and key with changed validated request is rejected', async () => {
  const db = new FakeFirestore();
  await createShopV2(args(db));
  const changed = validDraft();
  changed.services[0].priceMinor = 3600;

  await assert.rejects(
    createShopV2(args(db, { payload: changed })),
    expectCode('IDEMPOTENCY_KEY_REUSED', 409),
  );
  assert.equal(db.documents.size, 5);
});

test('requires a safe server-derived actor and rejects caller-owned identity through schema', async () => {
  for (const actor of [null, {}, { uid: '' }, { uid: 'x'.repeat(129) }]) {
    await assert.rejects(
      createShopV2(args(new FakeFirestore(), { actor })),
      expectCode('UNAUTHENTICATED', 401),
    );
  }

  let getterCalls = 0;
  const hostileActor = {};
  Object.defineProperty(hostileActor, 'uid', {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error('must not run');
    },
  });
  await assert.rejects(
    createShopV2(args(new FakeFirestore(), { actor: hostileActor })),
    expectCode('UNAUTHENTICATED', 401),
  );
  assert.equal(getterCalls, 0);

  const hostileProxy = new Proxy({ uid: OWNER.uid }, {
    getOwnPropertyDescriptor() {
      getterCalls += 1;
      throw new Error('must not run');
    },
  });
  await assert.rejects(
    createShopV2(args(new FakeFirestore(), { actor: hostileProxy })),
    expectCode('UNAUTHENTICATED', 401),
  );
  assert.equal(getterCalls, 0);

  const spoofed = validDraft();
  spoofed.ownerId = 'attacker-controlled-owner';
  const db = new FakeFirestore();
  await assert.rejects(
    createShopV2(args(db, { payload: spoofed })),
    expectCode('INVALID_SHOP', 400),
  );
  assert.equal(db.documents.size, 0);
});

test('accepts only bounded opaque URL-safe idempotency keys', async () => {
  for (const idempotencyKey of [undefined, '', 'short', 'contains spaces 0001', 'x'.repeat(129)]) {
    await assert.rejects(
      createShopV2(args(new FakeFirestore(), { idempotencyKey })),
      expectCode('INVALID_IDEMPOTENCY_KEY', 400),
    );
  }
});

test('name and slug reservations return stable collision categories without partial writes', async () => {
  const projection = buildShopV2CreateProjection(validDraft());
  for (const [collection, key, code] of [
    ['shopNameReservations', projection.privateShop.reservationKeys.nameKey, 'SHOP_NAME_TAKEN'],
    ['shopSlugReservations', projection.privateShop.reservationKeys.slugKey, 'SHOP_SLUG_TAKEN'],
  ]) {
    const db = new FakeFirestore();
    db.put(`${collection}/${key}`, { preexisting: true });
    await assert.rejects(createShopV2(args(db)), expectCode(code, 409));
    assert.deepEqual([...db.documents.keys()], [`${collection}/${key}`]);
  }
});

test('malformed or incomplete stored commands fail closed', async () => {
  const db = new FakeFirestore();
  const created = await createShopV2(args(db));
  db.put(`shopCreateCommands/${created.commandId}`, {
    schemaVersion: 2,
    commandId: created.commandId,
    operation: 'create',
    state: 'succeeded',
  });

  await assert.rejects(
    createShopV2(args(db)),
    expectCode('COMMAND_STATE_INVALID', 500),
  );
  assert.equal(db.documents.size, 5);
});

test('one preallocated shop reference is reused across transaction callback retries', async () => {
  const db = new FakeFirestore({ generatedId: 'retry-stable-shop', forcedRetries: 2 });
  const result = await createShopV2(args(db));

  assert.equal(db.generatedRefCount, 1);
  assert.equal(db.transactionAttempts.length, 3);
  for (const attempt of db.transactionAttempts) {
    assert.equal(attempt.creates[0].ref.path, 'barberShops/retry-stable-shop');
    assert.equal(attempt.creates[1].ref.path, 'shopPrivate/retry-stable-shop');
  }
  assert.equal(result.shop.shopId, 'retry-stable-shop');
  assert.equal(db.documents.size, 5);
});

test('transaction create precondition failures are atomic and become a safe fixed error', async () => {
  const db = new FakeFirestore({ generatedId: 'already-present' });
  db.put('barberShops/already-present', { existing: true });

  await assert.rejects(createShopV2(args(db)), (error) => {
    assert.ok(expectCode('INTERNAL', 500)(error));
    assert.doesNotMatch(error.message, /precondition|already-present/);
    return true;
  });
  assert.deepEqual([...db.documents.keys()], ['barberShops/already-present']);
});
