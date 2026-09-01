'use strict';

const { createHash } = require('node:crypto');
const { types: utilTypes } = require('node:util');

const {
  ShopV2SchemaError,
  buildShopV2CreateProjection,
} = require('./schema');

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_MESSAGES = Object.freeze({
  UNAUTHENTICATED: 'an authenticated shop owner is required',
  INVALID_IDEMPOTENCY_KEY: 'the idempotency key is invalid',
  INVALID_SHOP: 'the shop creation request is invalid',
  IDEMPOTENCY_KEY_REUSED: 'the idempotency key was already used for different shop intent',
  SHOP_NAME_TAKEN: 'the shop name is already reserved',
  SHOP_SLUG_TAKEN: 'the shop slug is already reserved',
  COMMAND_STATE_INVALID: 'the stored shop creation command is invalid',
  INTERNAL: 'the shop creation command could not be completed',
});
const HTTP_STATUS = Object.freeze({
  UNAUTHENTICATED: 401,
  INVALID_IDEMPOTENCY_KEY: 400,
  INVALID_SHOP: 400,
  IDEMPOTENCY_KEY_REUSED: 409,
  SHOP_NAME_TAKEN: 409,
  SHOP_SLUG_TAKEN: 409,
  COMMAND_STATE_INVALID: 500,
  INTERNAL: 500,
});

class ShopV2CommandError extends Error {
  constructor(code) {
    super(SAFE_MESSAGES[code] || SAFE_MESSAGES.INTERNAL);
    this.name = 'ShopV2CommandError';
    this.code = Object.prototype.hasOwnProperty.call(SAFE_MESSAGES, code) ? code : 'INTERNAL';
    this.httpStatus = HTTP_STATUS[this.code];
    this.retryable = false;
  }
}

function commandError(code) {
  return new ShopV2CommandError(code);
}

function requireDependencies(db, admin) {
  if (!db || typeof db.collection !== 'function' || typeof db.runTransaction !== 'function') {
    throw new TypeError('createShopV2 requires an Admin Firestore db');
  }
  if (!admin?.firestore?.FieldValue ||
      typeof admin.firestore.FieldValue.serverTimestamp !== 'function') {
    throw new TypeError('createShopV2 requires the Firebase Admin SDK');
  }
}

function isProxy(value) {
  try {
    return utilTypes.isProxy(value);
  } catch (error) {
    return true;
  }
}

function requireActorUid(actor) {
  if (actor === null || typeof actor !== 'object' || isProxy(actor)) {
    throw commandError('UNAUTHENTICATED');
  }
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(actor, 'uid');
  } catch (error) {
    throw commandError('UNAUTHENTICATED');
  }
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    throw commandError('UNAUTHENTICATED');
  }
  const uid = descriptor.value;
  if (typeof uid !== 'string' || uid.length < 1 || uid.length > 128 ||
      /[\u0000-\u001f\u007f-\u009f]/u.test(uid)) {
    throw commandError('UNAUTHENTICATED');
  }
  return uid;
}

function requireIdempotencyKey(value) {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw commandError('INVALID_IDEMPOTENCY_KEY');
  }
  return value;
}

function sha256(...parts) {
  const hash = createHash('sha256');
  for (const part of parts) {
    hash.update(part, 'utf8');
    hash.update('\0', 'utf8');
  }
  return hash.digest('hex');
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function readExactRecord(value, allowedKeys) {
  if (value === null || typeof value !== 'object' || isProxy(value)) return null;
  let prototype;
  let descriptors;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    return null;
  }
  if (prototype !== Object.prototype && prototype !== null) return null;
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key];
    if (typeof key !== 'string' || !allowedKeys.has(key) ||
        descriptor.enumerable !== true ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      return null;
    }
    result[key] = descriptor.value;
  }
  if (Object.keys(result).length !== allowedKeys.size) return null;
  return result;
}

function validateStoredResult(value, { commandId, shopId, name, slug }) {
  const result = readExactRecord(value, new Set(['ok', 'commandId', 'shop']));
  const shop = result && readExactRecord(
    result.shop,
    new Set(['shopId', 'name', 'slug', 'status']),
  );
  if (!shop || result.ok !== true || result.commandId !== commandId ||
      shop.shopId !== shopId || shop.name !== name || shop.slug !== slug ||
      shop.status !== 'draft') {
    throw commandError('COMMAND_STATE_INVALID');
  }
  return deepFreeze({
    ok: true,
    commandId,
    shop: {
      shopId,
      name,
      slug,
      status: 'draft',
    },
  });
}

function validateStoredCommand(value, expected) {
  const command = readExactRecord(value, new Set([
    'schemaVersion',
    'commandId',
    'operation',
    'actorScopeHash',
    'requestHash',
    'state',
    'shopId',
    'result',
    'createdAt',
    'updatedAt',
  ]));
  if (!command || command.schemaVersion !== 2 || command.commandId !== expected.commandId ||
      command.operation !== 'create' || !SHA256_PATTERN.test(command.actorScopeHash || '') ||
      command.actorScopeHash !== expected.actorScopeHash ||
      !SHA256_PATTERN.test(command.requestHash || '') || command.state !== 'succeeded' ||
      typeof command.shopId !== 'string' || command.shopId.length < 1 || command.shopId.length > 128) {
    throw commandError('COMMAND_STATE_INVALID');
  }
  if (command.requestHash !== expected.requestHash) {
    throw commandError('IDEMPOTENCY_KEY_REUSED');
  }
  return validateStoredResult(command.result, {
    commandId: expected.commandId,
    shopId: command.shopId,
    name: expected.name,
    slug: expected.slug,
  });
}

function createResult({ commandId, shopId, publicShop }) {
  return deepFreeze({
    ok: true,
    commandId,
    shop: {
      shopId,
      name: publicShop.name,
      slug: publicShop.slug,
      status: 'draft',
    },
  });
}

async function createShopV2({ db, admin, payload, actor, idempotencyKey }) {
  requireDependencies(db, admin);
  const ownerId = requireActorUid(actor);
  const validatedKey = requireIdempotencyKey(idempotencyKey);

  let projection;
  try {
    projection = buildShopV2CreateProjection(payload);
  } catch (error) {
    if (error instanceof ShopV2SchemaError) throw commandError('INVALID_SHOP');
    throw commandError('INTERNAL');
  }

  const { publicShop, privateShop } = projection;
  const actorScopeHash = sha256('shop-create-actor:v2', ownerId);
  const commandId = sha256('shop-create-command:v2', ownerId, validatedKey);
  const requestHash = sha256('shop-create-request:v2', privateShop.requestMaterial);
  try {
    const shopRef = db.collection('barberShops').doc();
    const privateRef = db.collection('shopPrivate').doc(shopRef.id);
    const commandRef = db.collection('shopCreateCommands').doc(commandId);
    const nameReservationRef = db.collection('shopNameReservations')
      .doc(privateShop.reservationKeys.nameKey);
    const slugReservationRef = db.collection('shopSlugReservations')
      .doc(privateShop.reservationKeys.slugKey);
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

    return await db.runTransaction(async (transaction) => {
      const commandSnapshot = await transaction.get(commandRef);
      if (commandSnapshot.exists) {
        return validateStoredCommand(commandSnapshot.data(), {
          commandId,
          actorScopeHash,
          requestHash,
          name: publicShop.name,
          slug: publicShop.slug,
        });
      }

      const [nameReservation, slugReservation] = await Promise.all([
        transaction.get(nameReservationRef),
        transaction.get(slugReservationRef),
      ]);
      if (nameReservation.exists) throw commandError('SHOP_NAME_TAKEN');
      if (slugReservation.exists) throw commandError('SHOP_SLUG_TAKEN');

      const result = createResult({ commandId, shopId: shopRef.id, publicShop });
      transaction.create(shopRef, {
        ...publicShop,
        shopId: shopRef.id,
        ownerId,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      });
      transaction.create(privateRef, {
        ...privateShop,
        // These remain unverified staging descriptors. This command neither
        // reads Storage nor promotes an object into a live shop namespace.
        consent: {
          ...privateShop.consent,
          acceptedAt: serverTimestamp,
        },
        shopId: shopRef.id,
        ownerId,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      });
      transaction.create(nameReservationRef, {
        schemaVersion: 2,
        reservationType: 'name',
        reservationKey: privateShop.reservationKeys.nameKey,
        normalizedValue: privateShop.reservationKeys.normalizedName,
        shopId: shopRef.id,
        ownerId,
        createdAt: serverTimestamp,
      });
      transaction.create(slugReservationRef, {
        schemaVersion: 2,
        reservationType: 'slug',
        reservationKey: privateShop.reservationKeys.slugKey,
        normalizedValue: privateShop.reservationKeys.canonicalSlug,
        shopId: shopRef.id,
        ownerId,
        createdAt: serverTimestamp,
      });
      transaction.create(commandRef, {
        schemaVersion: 2,
        commandId,
        operation: 'create',
        actorScopeHash,
        requestHash,
        state: 'succeeded',
        shopId: shopRef.id,
        result,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      });
      return result;
    }, { maxAttempts: 20 });
  } catch (error) {
    if (error instanceof ShopV2CommandError) throw error;
    throw commandError('INTERNAL');
  }
}

module.exports = {
  ShopV2CommandError,
  createShopV2,
};
