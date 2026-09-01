'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { after, test } = require('node:test');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'Shop create integration tests require FIRESTORE_EMULATOR_HOST and refuse live Firestore.',
  );
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor !== 20 && nodeMajor !== 22) {
  throw new Error(
    `Shop create integration tests require Node 20 or Node 22, current runtime is ${process.version}.`,
  );
}

const admin = require('firebase-admin');
const { WEEKDAYS } = require('../../src/shop-v2/schema');
const { ShopV2CommandError, createShopV2 } = require('../../src/shop-v2/create-command');

const APP_NAME = `shop-create-emulator-${process.pid}`;
const PROJECT_ID = 'demo-barbersbuddies';
const app = admin.initializeApp({ projectId: PROJECT_ID }, APP_NAME);
const db = app.firestore();

function token(prefix) {
  return `${prefix}-${randomUUID().replaceAll('-', '')}`;
}

function emptyWeek(intervals = []) {
  return Object.fromEntries(WEEKDAYS.map((day) => [
    day,
    day === 'monday' ? intervals.map((interval) => ({ ...interval })) : [],
  ]));
}

function draft(nonce) {
  return {
    schemaVersion: 2,
    name: `Emulator Shop ${nonce}`,
    slug: `emulator-shop-${nonce}`,
    presentation: {
      headline: 'Emulator shop',
      description: 'Disposable local integration fixture.',
      logoAssetId: null,
      heroAssetId: null,
      galleryAssetIds: [],
    },
    contact: {
      publicEmail: 'shop@example.test',
      publicPhone: '+493012345678',
      websiteUrl: 'https://example.test',
      street: null,
      postalCode: null,
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
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
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
  };
}

async function queryByShop(collection, shopId) {
  return db.collection(collection).where('shopId', '==', shopId).get();
}

async function cleanupShop(shopId) {
  const [commands, names, slugs] = await Promise.all([
    queryByShop('shopCreateCommands', shopId),
    queryByShop('shopNameReservations', shopId),
    queryByShop('shopSlugReservations', shopId),
  ]);
  const refs = [
    db.collection('barberShops').doc(shopId),
    db.collection('shopPrivate').doc(shopId),
    ...commands.docs.map((snapshot) => snapshot.ref),
    ...names.docs.map((snapshot) => snapshot.ref),
    ...slugs.docs.map((snapshot) => snapshot.ref),
  ];
  const batch = db.batch();
  refs.forEach((ref) => batch.delete(ref));
  await batch.commit();
}

function commandArgs(nonce, idempotencyKey) {
  return {
    db,
    admin,
    payload: draft(nonce),
    actor: { uid: `owner-${nonce}` },
    idempotencyKey,
  };
}

after(async () => {
  await app.delete();
});

test('persists one complete five-document aggregate and replays it', async (t) => {
  const nonce = randomUUID().replaceAll('-', '').slice(0, 16);
  const idempotencyKey = token('emulator-replay');
  const first = await createShopV2(commandArgs(nonce, idempotencyKey));
  t.after(() => cleanupShop(first.shop.shopId));
  const replay = await createShopV2(commandArgs(nonce, idempotencyKey));

  assert.deepEqual(replay, first);
  assert.equal((await queryByShop('shopCreateCommands', first.shop.shopId)).size, 1);
  assert.equal((await queryByShop('shopNameReservations', first.shop.shopId)).size, 1);
  assert.equal((await queryByShop('shopSlugReservations', first.shop.shopId)).size, 1);
  assert.equal((await db.collection('shopPrivate').doc(first.shop.shopId).get()).exists, true);
  assert.equal((await db.collection('barberShops').doc(first.shop.shopId).get()).exists, true);
});

test('same-key concurrency converges on one stored result and one aggregate', async (t) => {
  const nonce = randomUUID().replaceAll('-', '').slice(0, 16);
  const idempotencyKey = token('same-key');
  const results = await Promise.all(Array.from(
    { length: 12 },
    () => createShopV2(commandArgs(nonce, idempotencyKey)),
  ));
  const shopIds = new Set(results.map((result) => result.shop.shopId));
  assert.equal(shopIds.size, 1);
  const [shopId] = shopIds;
  t.after(() => cleanupShop(shopId));

  assert.equal((await queryByShop('shopCreateCommands', shopId)).size, 1);
  assert.equal((await queryByShop('shopNameReservations', shopId)).size, 1);
  assert.equal((await queryByShop('shopSlugReservations', shopId)).size, 1);
  assert.equal((await db.collection('shopPrivate').doc(shopId).get()).exists, true);
  assert.equal((await db.collection('barberShops').doc(shopId).get()).exists, true);
});

test('different-key concurrency permits one winner and reports fixed name collisions', async (t) => {
  const nonce = randomUUID().replaceAll('-', '').slice(0, 16);
  const outcomes = await Promise.allSettled(Array.from(
    { length: 12 },
    (_, index) => createShopV2(commandArgs(nonce, token(`race-${index}`))),
  ));
  const winners = outcomes.filter(({ status }) => status === 'fulfilled');
  const losers = outcomes.filter(({ status }) => status === 'rejected');
  assert.equal(winners.length, 1);
  assert.equal(losers.length, 11);
  for (const loser of losers) {
    assert.ok(loser.reason instanceof ShopV2CommandError);
    assert.equal(loser.reason.code, 'SHOP_NAME_TAKEN');
  }
  t.after(() => cleanupShop(winners[0].value.shop.shopId));
});
