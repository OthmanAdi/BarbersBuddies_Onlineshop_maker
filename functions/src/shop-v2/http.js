'use strict';

const { types: utilTypes } = require('node:util');

const { ShopV2CommandError, createShopV2 } = require('./create-command');
const { ShopV2RuntimeError, assertShopV2Enabled } = require('./runtime');

const ALLOWED_HEADERS = 'Authorization, Content-Type, Idempotency-Key';
const ALLOWED_METHODS = 'POST, OPTIONS';
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_JSON_DEPTH = 24;
const MAX_JSON_NODES = 10000;
const OPERATION = 'createShopV2';
const MALFORMED_HEADER = Symbol('malformed-header');

const PUBLIC_ERRORS = Object.freeze({
  SHOP_V2_DISABLED: Object.freeze({ status: 404, message: 'shop creation v2 is not available', retryable: false }),
  INVALID_REQUEST: Object.freeze({ status: 400, message: 'the shop creation request is invalid', retryable: false }),
  INVALID_IDEMPOTENCY_KEY: Object.freeze({ status: 400, message: 'a valid Idempotency-Key is required', retryable: false }),
  UNAUTHENTICATED: Object.freeze({ status: 401, message: 'a valid Firebase ID token is required', retryable: false }),
  ORIGIN_NOT_ALLOWED: Object.freeze({ status: 403, message: 'the request origin is not allowed', retryable: false }),
  METHOD_NOT_ALLOWED: Object.freeze({ status: 405, message: 'only POST is supported', retryable: false }),
  REQUEST_TOO_LARGE: Object.freeze({ status: 413, message: 'the shop creation request is too large', retryable: false }),
  UNSUPPORTED_MEDIA_TYPE: Object.freeze({ status: 415, message: 'Content-Type must be application/json', retryable: false }),
  INVALID_SHOP: Object.freeze({ status: 400, message: 'the shop creation request is invalid', retryable: false }),
  IDEMPOTENCY_KEY_REUSED: Object.freeze({ status: 409, message: 'the Idempotency-Key was already used for different shop intent', retryable: false }),
  SHOP_NAME_TAKEN: Object.freeze({ status: 409, message: 'the shop name is already reserved', retryable: false }),
  SHOP_SLUG_TAKEN: Object.freeze({ status: 409, message: 'the shop slug is already reserved', retryable: false }),
  COMMAND_STATE_INVALID: Object.freeze({ status: 500, message: 'the shop creation command could not be completed', retryable: false }),
  INTERNAL: Object.freeze({ status: 500, message: 'the shop creation command could not be completed', retryable: true }),
});

class ShopV2HttpError extends Error {
  constructor(code) {
    super(PUBLIC_ERRORS[code]?.message || PUBLIC_ERRORS.INTERNAL.message);
    this.name = 'ShopV2HttpError';
    this.code = Object.prototype.hasOwnProperty.call(PUBLIC_ERRORS, code) ? code : 'INTERNAL';
  }
}

function isProxy(value) {
  try {
    return utilTypes.isProxy(value);
  } catch {
    return true;
  }
}

function configurationError(message) {
  throw new TypeError(message);
}

function requireFunction(value, name) {
  if (typeof value !== 'function') configurationError(`${name} must be a function`);
  return value;
}

function ownDataValue(record, name) {
  if (record === null || typeof record !== 'object' || isProxy(record)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, name);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function containsControlCharacter(value) {
  return /[\u0000-\u001f\u007f-\u009f]/u.test(value);
}

function buildOriginAllowlist(origins) {
  if (!Array.isArray(origins) || origins.length === 0 || isProxy(origins)) {
    configurationError('allowedOrigins must be a non-empty array');
  }
  const allowlist = new Map();
  for (const origin of origins) {
    if (typeof origin !== 'string' || origin === '' || origin !== origin.trim() ||
        origin === '*' || origin === 'null' || origin.includes('*') || origin.includes(',') ||
        containsControlCharacter(origin)) {
      configurationError('allowedOrigins must contain exact origins');
    }
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      configurationError('allowedOrigins must contain exact http or https origins');
    }
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
        parsed.origin !== origin || parsed.username !== '' || parsed.password !== '' ||
        parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
      configurationError('allowedOrigins must contain exact http or https origins');
    }
    allowlist.set(origin, origin);
  }
  return allowlist;
}

function requestField(request, name) {
  const value = ownDataValue(request, name);
  return value === undefined ? null : value;
}

function getHeader(request, targetName) {
  const headers = requestField(request, 'headers');
  if (headers === null || typeof headers !== 'object' || Array.isArray(headers) || isProxy(headers)) {
    return MALFORMED_HEADER;
  }
  let descriptors;
  try {
    descriptors = Object.getOwnPropertyDescriptors(headers);
  } catch {
    return MALFORMED_HEADER;
  }
  const normalizedTarget = targetName.toLowerCase();
  let found = false;
  let value;
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string' || key.toLowerCase() !== normalizedTarget) continue;
    if (found) return MALFORMED_HEADER;
    const descriptor = descriptors[key];
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) return MALFORMED_HEADER;
    found = true;
    value = descriptor.value;
  }
  return found && !Array.isArray(value) ? value : (found ? MALFORMED_HEADER : undefined);
}

function setHeader(response, name, value) {
  if (typeof response?.set === 'function') return response.set(name, value);
  if (typeof response?.setHeader === 'function') return response.setHeader(name, value);
  configurationError('response must support setting headers');
}

function sendJson(response, status, envelope) {
  return response.status(status).json(envelope);
}

function publicFailure(code) {
  const definition = PUBLIC_ERRORS[code] || PUBLIC_ERRORS.INTERNAL;
  return {
    status: definition.status,
    envelope: {
      ok: false,
      error: {
        code: Object.prototype.hasOwnProperty.call(PUBLIC_ERRORS, code) ? code : 'INTERNAL',
        message: definition.message,
        retryable: definition.retryable,
      },
    },
  };
}

function throwHttp(code) {
  throw new ShopV2HttpError(code);
}

function configureCors(request, response, allowlist) {
  setHeader(response, 'Vary', 'Origin');
  const origin = getHeader(request, 'Origin');
  if (origin === undefined || origin === '') return false;
  if (typeof origin !== 'string' || !allowlist.has(origin)) throwHttp('ORIGIN_NOT_ALLOWED');
  setHeader(response, 'Access-Control-Allow-Origin', allowlist.get(origin));
  return true;
}

function validateDeclaredLength(request) {
  const value = getHeader(request, 'Content-Length');
  if (value === undefined) return;
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]{0,6})$/.test(value)) {
    throwHttp('INVALID_REQUEST');
  }
  if (Number(value) > MAX_BODY_BYTES) throwHttp('REQUEST_TOO_LARGE');
}

function snapshotJson(value, state, depth = 0) {
  state.nodes += 1;
  if (state.nodes > MAX_JSON_NODES || depth > MAX_JSON_DEPTH) throwHttp('INVALID_REQUEST');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throwHttp('INVALID_REQUEST');
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'object' || isProxy(value)) throwHttp('INVALID_REQUEST');
  if (state.seen.has(value)) throwHttp('INVALID_REQUEST');
  state.seen.add(value);

  let descriptors;
  let prototype;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
    prototype = Object.getPrototypeOf(value);
  } catch {
    throwHttp('INVALID_REQUEST');
  }

  let snapshot;
  if (Array.isArray(value)) {
    snapshot = [];
    const keys = Reflect.ownKeys(descriptors);
    if (keys.some((key) => typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9][0-9]*)$/.test(key)))) {
      throwHttp('INVALID_REQUEST');
    }
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || descriptor.enumerable !== true ||
          !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throwHttp('INVALID_REQUEST');
      }
      snapshot.push(snapshotJson(descriptor.value, state, depth + 1));
    }
    if (keys.length !== value.length + 1) throwHttp('INVALID_REQUEST');
  } else {
    if (prototype !== Object.prototype && prototype !== null) throwHttp('INVALID_REQUEST');
    snapshot = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      const descriptor = descriptors[key];
      if (typeof key !== 'string' || descriptor.enumerable !== true ||
          !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throwHttp('INVALID_REQUEST');
      }
      snapshot[key] = snapshotJson(descriptor.value, state, depth + 1);
    }
  }
  state.seen.delete(value);
  return snapshot;
}

function parseBody(request) {
  validateDeclaredLength(request);
  const body = requestField(request, 'body');
  const snapshot = snapshotJson(body, { nodes: 0, seen: new WeakSet() });
  if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > MAX_BODY_BYTES) {
    throwHttp('REQUEST_TOO_LARGE');
  }
  if (snapshot === null || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throwHttp('INVALID_REQUEST');
  }
  const keys = Reflect.ownKeys(snapshot);
  if (keys.length !== 2 || !keys.includes('operation') || !keys.includes('shop') ||
      snapshot.operation !== OPERATION || snapshot.shop === null ||
      typeof snapshot.shop !== 'object' || Array.isArray(snapshot.shop)) {
    throwHttp('INVALID_REQUEST');
  }
  return snapshot.shop;
}

function requireIdempotencyKey(request) {
  const value = getHeader(request, 'Idempotency-Key');
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throwHttp('INVALID_IDEMPOTENCY_KEY');
  }
  return value;
}

function normalizeActor(decodedToken) {
  if (decodedToken === null || typeof decodedToken !== 'object' || Array.isArray(decodedToken) ||
      isProxy(decodedToken)) {
    throwHttp('UNAUTHENTICATED');
  }
  const uid = ownDataValue(decodedToken, 'uid');
  if (typeof uid !== 'string' || uid.length === 0 || uid.length > 128 || uid !== uid.trim() ||
      uid.includes('/') || containsControlCharacter(uid)) {
    throwHttp('UNAUTHENTICATED');
  }
  return Object.freeze({ uid });
}

async function authenticate(request, verifyIdToken) {
  const authorization = getHeader(request, 'Authorization');
  if (typeof authorization !== 'string' || authorization.length > 8192) {
    throwHttp('UNAUTHENTICATED');
  }
  const match = authorization.match(/^Bearer ([^\s,]+)$/i);
  if (!match) throwHttp('UNAUTHENTICATED');
  try {
    return normalizeActor(await verifyIdToken(match[1]));
  } catch (error) {
    if (error instanceof ShopV2HttpError) throw error;
    throwHttp('UNAUTHENTICATED');
  }
}

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Reflect.ownKeys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function validateSuccess(result) {
  let snapshot;
  try {
    snapshot = snapshotJson(result, { nodes: 0, seen: new WeakSet() });
  } catch {
    throw new TypeError('createShopV2 returned a malformed success envelope');
  }
  if (!exactKeys(snapshot, ['ok', 'commandId', 'shop']) || snapshot.ok !== true ||
      typeof snapshot.commandId !== 'string' || !/^[a-f0-9]{64}$/.test(snapshot.commandId) ||
      !exactKeys(snapshot.shop, ['shopId', 'name', 'slug', 'status']) ||
      typeof snapshot.shop.shopId !== 'string' || snapshot.shop.shopId.length === 0 ||
      snapshot.shop.shopId.length > 128 || typeof snapshot.shop.name !== 'string' ||
      snapshot.shop.name.length === 0 || snapshot.shop.name.length > 100 ||
      typeof snapshot.shop.slug !== 'string' || snapshot.shop.slug.length === 0 ||
      snapshot.shop.slug.length > 80 || snapshot.shop.status !== 'draft') {
    throw new TypeError('createShopV2 returned a malformed success envelope');
  }
  return {
    ok: true,
    commandId: snapshot.commandId,
    shop: {
      shopId: snapshot.shop.shopId,
      name: snapshot.shop.name,
      slug: snapshot.shop.slug,
      status: 'draft',
    },
  };
}

function commandErrorCode(error) {
  if (!(error instanceof ShopV2CommandError)) return null;
  return Object.prototype.hasOwnProperty.call(PUBLIC_ERRORS, error.code) ? error.code : 'INTERNAL';
}

function createShopV2HttpHandler({
  db,
  admin,
  verifyIdToken,
  allowedOrigins,
  env = process.env,
  demoProjectId,
  expectedProductionActivationToken,
  command = createShopV2,
  logger = console,
}) {
  const allowlist = buildOriginAllowlist(allowedOrigins);
  requireFunction(verifyIdToken, 'verifyIdToken');
  requireFunction(command, 'command');
  if (logger === null || typeof logger !== 'object' || typeof logger.error !== 'function') {
    configurationError('logger.error must be a function');
  }
  const runtimeOptions = Object.freeze({ demoProjectId, expectedProductionActivationToken });

  return async function shopV2HttpHandler(request, response) {
    try {
      setHeader(response, 'Cache-Control', 'no-store');
      setHeader(response, 'X-Content-Type-Options', 'nosniff');
      assertShopV2Enabled(env, runtimeOptions);
      const hasAllowedOrigin = configureCors(request, response, allowlist);
      const method = requestField(request, 'method');

      if (method === 'OPTIONS') {
        if (!hasAllowedOrigin) throwHttp('ORIGIN_NOT_ALLOWED');
        setHeader(response, 'Access-Control-Allow-Methods', ALLOWED_METHODS);
        setHeader(response, 'Access-Control-Allow-Headers', ALLOWED_HEADERS);
        return response.status(204).send('');
      }
      if (method !== 'POST') {
        setHeader(response, 'Allow', ALLOWED_METHODS);
        throwHttp('METHOD_NOT_ALLOWED');
      }
      if (getHeader(request, 'Content-Type') !== 'application/json') {
        throwHttp('UNSUPPORTED_MEDIA_TYPE');
      }

      const payload = parseBody(request);
      const idempotencyKey = requireIdempotencyKey(request);
      const actor = await authenticate(request, verifyIdToken);
      const result = validateSuccess(await command({ db, admin, payload, actor, idempotencyKey }));
      return sendJson(response, 200, result);
    } catch (error) {
      let code;
      if (error instanceof ShopV2HttpError || error instanceof ShopV2RuntimeError) {
        code = error.code;
      } else {
        code = commandErrorCode(error);
      }
      if (!code) {
        code = 'INTERNAL';
        try {
          logger.error('shop-v2 command failed', {
            operation: OPERATION,
            errorType: 'UnexpectedError',
          });
        } catch {
          // Logging must never replace the fixed public failure contract.
        }
      }
      const failure = publicFailure(code);
      return sendJson(response, failure.status, failure.envelope);
    }
  };
}

module.exports = {
  ALLOWED_HEADERS,
  ALLOWED_METHODS,
  MAX_BODY_BYTES,
  OPERATION,
  PUBLIC_ERRORS,
  createShopV2HttpHandler,
};
