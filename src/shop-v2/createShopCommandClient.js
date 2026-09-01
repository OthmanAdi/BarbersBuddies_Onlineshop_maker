import { canonicalizeStrictPlainData } from '../booking-v2/intentRegistry';

const OPERATION = 'createShopV2';
const ENDPOINT_SUFFIX = `/${OPERATION}`;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/;
const COMMAND_ID_PATTERN = /^[a-f0-9]{64}$/;
const LOCAL_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const SAFE_SERVER_ERRORS = Object.freeze({
  SHOP_V2_DISABLED: Object.freeze({
    status: 404,
    message: 'shop creation v2 is not available',
    retryable: false,
  }),
  INVALID_REQUEST: Object.freeze({
    status: 400,
    message: 'the shop creation request is invalid',
    retryable: false,
  }),
  INVALID_IDEMPOTENCY_KEY: Object.freeze({
    status: 400,
    message: 'a valid Idempotency-Key is required',
    retryable: false,
  }),
  UNAUTHENTICATED: Object.freeze({
    status: 401,
    message: 'a valid Firebase ID token is required',
    retryable: false,
  }),
  ORIGIN_NOT_ALLOWED: Object.freeze({
    status: 403,
    message: 'the request origin is not allowed',
    retryable: false,
  }),
  METHOD_NOT_ALLOWED: Object.freeze({
    status: 405,
    message: 'only POST is supported',
    retryable: false,
  }),
  REQUEST_TOO_LARGE: Object.freeze({
    status: 413,
    message: 'the shop creation request is too large',
    retryable: false,
  }),
  UNSUPPORTED_MEDIA_TYPE: Object.freeze({
    status: 415,
    message: 'Content-Type must be application/json',
    retryable: false,
  }),
  INVALID_SHOP: Object.freeze({
    status: 400,
    message: 'the shop creation request is invalid',
    retryable: false,
  }),
  IDEMPOTENCY_KEY_REUSED: Object.freeze({
    status: 409,
    message: 'the Idempotency-Key was already used for different shop intent',
    retryable: false,
  }),
  SHOP_NAME_TAKEN: Object.freeze({
    status: 409,
    message: 'the shop name is already reserved',
    retryable: false,
  }),
  SHOP_SLUG_TAKEN: Object.freeze({
    status: 409,
    message: 'the shop slug is already reserved',
    retryable: false,
  }),
  COMMAND_STATE_INVALID: Object.freeze({
    status: 500,
    message: 'the shop creation command could not be completed',
    retryable: false,
  }),
  INTERNAL: Object.freeze({
    status: 500,
    message: 'the shop creation command could not be completed',
    retryable: true,
  }),
});

export class CreateShopCommandClientError extends Error {
  constructor(
    code,
    message,
    { status = 0, retryable = false, ambiguous = false } = {}
  ) {
    super(message);
    this.name = 'CreateShopCommandClientError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.ambiguous = ambiguous;
  }
}

function clientError(code, message, options) {
  return new CreateShopCommandClientError(code, message, options);
}

function configurationError(message) {
  return clientError('INVALID_CLIENT_CONFIGURATION', message);
}

function normalizeEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint !== endpoint.trim()) {
    throw configurationError('An exact shop v2 endpoint is required.');
  }

  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch (_error) {
    throw configurationError('The shop v2 endpoint is invalid.');
  }

  const protocolAllowed =
    parsed.protocol === 'https:' ||
    (parsed.protocol === 'http:' && LOCAL_HTTP_HOSTS.has(parsed.hostname));
  if (
    !protocolAllowed ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    !parsed.pathname.endsWith(ENDPOINT_SUFFIX) ||
    parsed.pathname.endsWith(`${ENDPOINT_SUFFIX}/`)
  ) {
    throw configurationError('The shop v2 endpoint is invalid.');
  }

  return parsed.toString();
}

function requireIdempotencyKey(value) {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw clientError(
      'INVALID_ARGUMENT',
      'A valid durable shop creation retry identity is required.'
    );
  }
  return value;
}

function requireShopBody(shop) {
  let serialized;
  try {
    serialized = canonicalizeStrictPlainData(shop);
  } catch (_error) {
    throw clientError(
      'INVALID_ARGUMENT',
      'shop must be strict plain data.'
    );
  }
  if (shop === null || typeof shop !== 'object' || Array.isArray(shop)) {
    throw clientError('INVALID_ARGUMENT', 'shop must be a plain object.');
  }
  return `{"operation":"${OPERATION}","shop":${serialized}}`;
}

function requireToken(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 8192 ||
    value !== value.trim() ||
    /[\s,]/u.test(value)
  ) {
    throw clientError(
      'AUTH_TOKEN_INVALID',
      'A valid Firebase ID token is required.'
    );
  }
  return value;
}

function hasExactKeys(value, expectedKeys) {
  const actualKeys = Reflect.ownKeys(value);
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => actualKeys.includes(key))
  );
}

function isBoundedString(value, maxLength) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function snapshotPlainData(value) {
  const serialized = canonicalizeStrictPlainData(value);
  return JSON.parse(serialized);
}

function isTrustedResponsePrototype(owner) {
  try {
    return typeof Response === 'function' && owner === Response.prototype;
  } catch (_error) {
    return false;
  }
}

function readResponseBoundaryProperty(response, property) {
  if (response === null || (typeof response !== 'object' && typeof response !== 'function')) {
    throw new Error('invalid-response-boundary');
  }

  let owner = response;
  const visited = new Set();
  for (let depth = 0; owner !== null && depth < 16; depth += 1) {
    if (visited.has(owner)) {
      throw new Error('invalid-response-boundary');
    }
    visited.add(owner);

    const descriptor = Object.getOwnPropertyDescriptor(owner, property);
    if (descriptor) {
      if (Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        return descriptor.value;
      }
      if (
        owner === response ||
        typeof descriptor.get !== 'function' ||
        !isTrustedResponsePrototype(owner)
      ) {
        throw new Error('invalid-response-boundary');
      }
      return descriptor.get.call(response);
    }
    owner = Object.getPrototypeOf(owner);
  }
  throw new Error('invalid-response-boundary');
}

function snapshotResponseBoundary(response) {
  const status = readResponseBoundaryProperty(response, 'status');
  const ok = readResponseBoundaryProperty(response, 'ok');
  const json = readResponseBoundaryProperty(response, 'json');
  if (
    !Number.isInteger(status) ||
    status < 100 ||
    status > 599 ||
    typeof ok !== 'boolean' ||
    typeof json !== 'function'
  ) {
    throw new Error('invalid-response-boundary');
  }
  return Object.freeze({ status, ok, json });
}

function validateSuccessEnvelope(envelope, status, ok) {
  const shop = envelope?.shop;
  return (
    ok === true &&
    status === 200 &&
    envelope !== null &&
    typeof envelope === 'object' &&
    !Array.isArray(envelope) &&
    hasExactKeys(envelope, ['ok', 'commandId', 'shop']) &&
    envelope.ok === true &&
    typeof envelope.commandId === 'string' &&
    COMMAND_ID_PATTERN.test(envelope.commandId) &&
    shop !== null &&
    typeof shop === 'object' &&
    !Array.isArray(shop) &&
    hasExactKeys(shop, ['shopId', 'name', 'slug', 'status']) &&
    isBoundedString(shop.shopId, 128) &&
    isBoundedString(shop.name, 100) &&
    isBoundedString(shop.slug, 80) &&
    shop.status === 'draft'
  );
}

function validateFailureEnvelope(envelope, status, ok) {
  const error = envelope?.error;
  if (
    ok !== false ||
    envelope === null ||
    typeof envelope !== 'object' ||
    Array.isArray(envelope) ||
    !hasExactKeys(envelope, ['ok', 'error']) ||
    envelope.ok !== false ||
    error === null ||
    typeof error !== 'object' ||
    Array.isArray(error) ||
    !hasExactKeys(error, ['code', 'message', 'retryable']) ||
    !Object.prototype.hasOwnProperty.call(SAFE_SERVER_ERRORS, error.code)
  ) {
    return null;
  }

  const contract = SAFE_SERVER_ERRORS[error.code];
  return (
    status === contract.status &&
    error.message === contract.message &&
    error.retryable === contract.retryable
  ) ? contract : null;
}

function abortError(kind, ambiguous) {
  if (kind === 'timeout') {
    return clientError(
      'REQUEST_TIMEOUT',
      'The shop creation request timed out. Retry with the same retry identity.',
      { retryable: true, ambiguous }
    );
  }
  return clientError(
    'REQUEST_ABORTED',
    'The shop creation request was cancelled.',
    { retryable: false, ambiguous }
  );
}

function awaitAbortable(promise, signal) {
  if (signal.aborted) {
    return Promise.reject(new Error('shop-command-aborted'));
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new Error('shop-command-aborted'));
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}
export function createShopCommandClient({
  endpoint,
  getIdToken,
  fetchImpl,
  timeoutMs = 15000,
  AbortControllerImpl = typeof window !== 'undefined'
    ? window.AbortController
    : undefined,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
}) {
  const configuredEndpoint = normalizeEndpoint(endpoint);
  if (typeof getIdToken !== 'function') {
    throw configurationError('getIdToken must be an injected function.');
  }
  if (typeof fetchImpl !== 'function') {
    throw configurationError('fetchImpl must be an injected function.');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) {
    throw configurationError('timeoutMs must be between 1 and 120000.');
  }
  if (typeof AbortControllerImpl !== 'function') {
    throw configurationError('AbortController is required.');
  }
  if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') {
    throw configurationError('Timer functions are required.');
  }

  return Object.freeze({
    async execute({ shop, idempotencyKey, signal } = {}) {
      const body = requireShopBody(shop);
      const durableKey = requireIdempotencyKey(idempotencyKey);
      if (
        signal !== undefined &&
        (signal === null ||
          typeof signal.aborted !== 'boolean' ||
          typeof signal.addEventListener !== 'function' ||
          typeof signal.removeEventListener !== 'function')
      ) {
        throw clientError('INVALID_ARGUMENT', 'signal must be an AbortSignal.');
      }

      let controller;
      try {
        controller = new AbortControllerImpl();
        if (
          controller === null ||
          typeof controller !== 'object' ||
          typeof controller.abort !== 'function' ||
          controller.signal === null ||
          typeof controller.signal !== 'object'
        ) {
          throw new Error('invalid-abort-controller');
        }
      } catch (_error) {
        throw configurationError('AbortController could not be initialized.');
      }

      let abortKind = null;
      let requestDispatched = false;
      const abort = (kind) => {
        if (abortKind === null) {
          abortKind = kind;
          controller.abort();
        }
      };
      const onExternalAbort = () => abort('external');
      if (signal?.aborted) {
        abort('external');
      } else if (signal) {
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }

      let timer;
      try {
        timer = setTimeoutImpl(() => abort('timeout'), timeoutMs);
      } catch (_error) {
        if (signal) signal.removeEventListener('abort', onExternalAbort);
        throw configurationError('The request timeout could not be initialized.');
      }

      try {
        let token;
        try {
          token = requireToken(
            await awaitAbortable(
              Promise.resolve().then(() => getIdToken()),
              controller.signal
            )
          );
        } catch (error) {
          if (error instanceof CreateShopCommandClientError) throw error;
          if (abortKind !== null) throw abortError(abortKind, false);
          throw clientError(
            'AUTH_TOKEN_FAILED',
            'The shop creation session could not be verified.',
            { retryable: true }
          );
        }

        let response;
        try {
          requestDispatched = true;
          response = await awaitAbortable(fetchImpl(configuredEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              'Idempotency-Key': durableKey,
            },
            body,
            signal: controller.signal,
          }), controller.signal);
        } catch (error) {
          if (error instanceof CreateShopCommandClientError) throw error;
          if (abortKind !== null) {
            throw abortError(abortKind, requestDispatched);
          }
          throw clientError(
            'NETWORK_ERROR',
            'The shop creation service could not be reached. Retry with the same retry identity.',
            { retryable: true, ambiguous: true }
          );
        }

        let responseBoundary;
        try {
          responseBoundary = snapshotResponseBoundary(response);
        } catch (_error) {
          throw clientError(
            'INVALID_RESPONSE',
            'The shop creation service returned an invalid response.',
            { retryable: true, ambiguous: true }
          );
        }

        const { status, ok, json } = responseBoundary;
        let envelope;
        try {
          envelope = await awaitAbortable(json.call(response), controller.signal);
        } catch (error) {
          if (error instanceof CreateShopCommandClientError) throw error;
          if (abortKind !== null) throw abortError(abortKind, true);
          throw clientError(
            'INVALID_RESPONSE',
            'The shop creation service returned an unreadable response.',
            { status, retryable: true, ambiguous: true }
          );
        }

        let snapshot;
        try {
          snapshot = snapshotPlainData(envelope);
        } catch (_error) {
          throw clientError(
            'INVALID_RESPONSE',
            'The shop creation service returned an invalid response.',
            { status, retryable: true, ambiguous: true }
          );
        }

        if (validateSuccessEnvelope(snapshot, status, ok)) {
          return snapshot;
        }

        const failure = validateFailureEnvelope(snapshot, status, ok);
        if (failure) {
          throw clientError(snapshot.error.code, failure.message, {
            status,
            retryable: failure.retryable,
            ambiguous: false,
          });
        }

        throw clientError(
          'INVALID_RESPONSE',
          'The shop creation service returned an invalid response.',
          { status, retryable: true, ambiguous: true }
        );
      } finally {
        try {
          clearTimeoutImpl(timer);
        } catch (_error) {
          // Cleanup failure must not replace the sanitized command outcome.
        }
        if (signal) {
          try {
            signal.removeEventListener('abort', onExternalAbort);
          } catch (_error) {
            // Cleanup failure must not replace the sanitized command outcome.
          }
        }
      }
    },
  });
}
