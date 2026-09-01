import { assertStrictPlainData } from './intentRegistry';

const OPERATION_ENDPOINT_NAMES = Object.freeze({
  create: 'createBookingV2',
  cancel: 'cancelBookingV2',
  reschedule: 'rescheduleBookingV2',
});
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/;
const BOOKING_STATUSES = new Set([
  'pending',
  'confirmed',
  'completed',
  'rejected',
  'cancelled',
]);
const SAFE_SERVER_MESSAGES = Object.freeze({
  INVALID_ARGUMENT: 'The booking request is invalid.',
  INVALID_DATE: 'The selected date is invalid.',
  INVALID_TIME: 'The selected time is invalid.',
  INVALID_DURATION: 'The selected duration is invalid.',
  INVALID_IDEMPOTENCY_KEY: 'The booking retry identity is invalid.',
  UNAUTHENTICATED: 'Please sign in again before changing this booking.',
  FORBIDDEN: 'You are not allowed to change this booking.',
  SHOP_NOT_FOUND: 'This shop is not available.',
  BOOKING_NOT_FOUND: 'This booking could not be found.',
  SERVICE_NOT_FOUND: 'A selected service is no longer available.',
  EMPLOYEE_NOT_FOUND: 'The selected employee is no longer available.',
  SLOT_CONFLICT: 'That appointment time is no longer available.',
  IDEMPOTENCY_KEY_REUSED: 'This retry identity belongs to a different booking request.',
  BOOKING_VERSION_CONFLICT: 'This booking changed. Refresh it before trying again.',
  INVALID_STATUS_TRANSITION: 'This booking can no longer be changed that way.',
  BOOKING_MIGRATION_REQUIRED: 'This booking needs support before it can be changed.',
  SHOP_RESOURCE_CONFIG_REQUIRED: 'This shop is not ready for online booking.',
  OUTSIDE_AVAILABILITY: 'That appointment is outside availability.',
  SHOP_TIMEZONE_REQUIRED: 'This shop is not ready for online booking.',
  EMPLOYEE_UNAVAILABLE: 'The selected employee is unavailable at that time.',
  INTERNAL: 'The booking service could not complete the request.',
});

export class BookingCommandClientError extends Error {
  constructor(
    code,
    message,
    { status = 0, retryable = false, ambiguous = false } = {}
  ) {
    super(message);
    this.name = 'BookingCommandClientError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.ambiguous = ambiguous;
  }
}

function clientError(code, message, options) {
  return new BookingCommandClientError(code, message, options);
}

function configurationError(message) {
  return clientError('INVALID_CLIENT_CONFIGURATION', message);
}

function requirePlainRecord(value, field) {
  try {
    assertStrictPlainData(value);
  } catch (_error) {
    throw clientError('INVALID_ARGUMENT', `${field} must be strict plain data.`);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw clientError('INVALID_ARGUMENT', `${field} must be a plain object.`);
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

function isNonEmptyString(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim()
  );
}

function requireEndpoint(operation, endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length === 0) {
    throw configurationError(`A ${operation} booking endpoint is required.`);
  }

  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch (_error) {
    throw configurationError(`The ${operation} booking endpoint is invalid.`);
  }

  const localHttpHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  const protocolAllowed =
    parsed.protocol === 'https:' ||
    (parsed.protocol === 'http:' && localHttpHosts.has(parsed.hostname));
  const expectedSuffix = `/${OPERATION_ENDPOINT_NAMES[operation]}`;
  if (
    !protocolAllowed ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    !parsed.pathname.endsWith(expectedSuffix) ||
    parsed.pathname.endsWith(`${expectedSuffix}/`)
  ) {
    throw configurationError(`The ${operation} booking endpoint is invalid.`);
  }
  return parsed.toString();
}

function normalizeEndpoints(endpoints) {
  let endpointRecord;
  try {
    endpointRecord = requirePlainRecord(endpoints, 'endpoints');
  } catch (_error) {
    throw configurationError('Exact booking v2 endpoints are required.');
  }
  const operations = Object.keys(OPERATION_ENDPOINT_NAMES);
  if (!hasExactKeys(endpointRecord, operations)) {
    throw configurationError('Exact booking v2 endpoints are required.');
  }
  return Object.freeze(Object.fromEntries(
    operations.map((operation) => [
      operation,
      requireEndpoint(operation, endpointRecord[operation]),
    ])
  ));
}

function requireIdempotencyKey(value) {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw clientError(
      'INVALID_ARGUMENT',
      'A valid durable booking retry identity is required.'
    );
  }
  return value;
}

function requireToken(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 16384 ||
    value !== value.trim() ||
    /\s/.test(value)
  ) {
    throw clientError(
      'AUTH_TOKEN_INVALID',
      'A valid Firebase ID token is required.'
    );
  }
  return value;
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
      // Fetch Response uses inherited platform accessors for status and ok.
      // Reject own accessors without invoking them; an inherited accessor is
      // invoked only to support the platform object and remains inside the
      // sanitized response boundary.
      if (owner === response || typeof descriptor.get !== 'function') {
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
    status < 0 ||
    status > 599 ||
    typeof ok !== 'boolean' ||
    typeof json !== 'function'
  ) {
    throw new Error('invalid-response-boundary');
  }
  return Object.freeze({ status, ok, json });
}

function validateSuccessEnvelope(envelope) {
  const booking = envelope?.booking;
  return (
    envelope !== null &&
    typeof envelope === 'object' &&
    !Array.isArray(envelope) &&
    hasExactKeys(envelope, ['ok', 'commandId', 'replayed', 'booking']) &&
    envelope.ok === true &&
    isNonEmptyString(envelope.commandId) &&
    typeof envelope.replayed === 'boolean' &&
    booking !== null &&
    typeof booking === 'object' &&
    !Array.isArray(booking) &&
    hasExactKeys(booking, [
      'bookingId',
      'version',
      'status',
      'resourceId',
      'startAt',
      'endAt',
    ]) &&
    isNonEmptyString(booking.bookingId) &&
    Number.isInteger(booking.version) &&
    booking.version >= 1 &&
    BOOKING_STATUSES.has(booking.status) &&
    isNonEmptyString(booking.resourceId) &&
    isNonEmptyString(booking.startAt) &&
    isNonEmptyString(booking.endAt)
  );
}

function validateFailureEnvelope(envelope) {
  const error = envelope?.error;
  return (
    envelope !== null &&
    typeof envelope === 'object' &&
    !Array.isArray(envelope) &&
    hasExactKeys(envelope, ['ok', 'error']) &&
    envelope.ok === false &&
    error !== null &&
    typeof error === 'object' &&
    !Array.isArray(error) &&
    hasExactKeys(error, ['code', 'message', 'retryable']) &&
    Object.prototype.hasOwnProperty.call(SAFE_SERVER_MESSAGES, error.code) &&
    isNonEmptyString(error.message) &&
    typeof error.retryable === 'boolean'
  );
}

function abortError(kind, ambiguous) {
  if (kind === 'timeout') {
    return clientError(
      'REQUEST_TIMEOUT',
      'The booking request timed out. Retry with the same booking retry identity.',
      { retryable: true, ambiguous }
    );
  }
  return clientError(
    'REQUEST_ABORTED',
    'The booking request was cancelled.',
    { retryable: false, ambiguous }
  );
}

function awaitAbortable(promise, signal) {
  if (signal.aborted) {
    return Promise.reject(new Error('booking-command-aborted'));
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new Error('booking-command-aborted'));
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

export function createBookingCommandClient({
  endpoints,
  getIdToken,
  fetchImpl,
  createAuthMode = 'required',
  timeoutMs = 15000,
  AbortControllerImpl = typeof window !== 'undefined'
    ? window.AbortController
    : undefined,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
}) {
  const configuredEndpoints = normalizeEndpoints(endpoints);
  if (typeof getIdToken !== 'function') {
    throw configurationError('getIdToken must be an injected function.');
  }
  if (typeof fetchImpl !== 'function') {
    throw configurationError('fetchImpl must be an injected function.');
  }
  if (createAuthMode !== 'required' && createAuthMode !== 'guest') {
    throw configurationError("createAuthMode must be 'required' or 'guest'.");
  }
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 120000
  ) {
    throw configurationError('timeoutMs must be between 1 and 120000.');
  }
  if (typeof AbortControllerImpl !== 'function') {
    throw configurationError('AbortController is required.');
  }

  return Object.freeze({
    async execute({ operation, payload, idempotencyKey, signal } = {}) {
      if (!Object.prototype.hasOwnProperty.call(configuredEndpoints, operation)) {
        throw clientError('INVALID_ARGUMENT', 'The booking operation is invalid.');
      }
      const requestPayload = requirePlainRecord(payload, 'payload');
      const durableKey = requireIdempotencyKey(idempotencyKey);
      // Snapshot before the first async boundary so caller mutation cannot change
      // the canonical request after validation or while token acquisition waits.
      const body = JSON.stringify(requestPayload);
      if (
        signal !== undefined &&
        (signal === null ||
          typeof signal.aborted !== 'boolean' ||
          typeof signal.addEventListener !== 'function' ||
          typeof signal.removeEventListener !== 'function')
      ) {
        throw clientError('INVALID_ARGUMENT', 'signal must be an AbortSignal.');
      }

      const controller = new AbortControllerImpl();
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
      const timer = setTimeoutImpl(() => abort('timeout'), timeoutMs);

      try {
        let token;
        const authRequired = operation !== 'create' || createAuthMode === 'required';
        if (authRequired) {
          try {
            token = requireToken(
              await awaitAbortable(Promise.resolve().then(() => getIdToken()), controller.signal)
            );
          } catch (_error) {
            if (abortKind !== null) {
              throw abortError(abortKind, false);
            }
            throw clientError(
              'AUTH_TOKEN_FAILED',
              'The booking session could not be verified.',
              { retryable: true }
            );
          }
        }
        const headers = {
          'Content-Type': 'application/json',
          'Idempotency-Key': durableKey,
          ...(authRequired ? { Authorization: `Bearer ${token}` } : {}),
        };
        let response;
        try {
          requestDispatched = true;
          response = await awaitAbortable(fetchImpl(configuredEndpoints[operation], {
            method: 'POST',
            headers,
            body,
            signal: controller.signal,
          }), controller.signal);
        } catch (_error) {
          if (abortKind !== null) {
            throw abortError(abortKind, requestDispatched);
          }
          throw clientError(
            'NETWORK_ERROR',
            'The booking service could not be reached. Retry with the same booking retry identity.',
            { retryable: true, ambiguous: true }
          );
        }

        let responseBoundary;
        try {
          responseBoundary = snapshotResponseBoundary(response);
        } catch (_error) {
          throw clientError(
            'INVALID_RESPONSE',
            'The booking service returned an invalid response.',
            { retryable: true, ambiguous: true }
          );
        }
        const { status, ok, json } = responseBoundary;
        let envelope;
        try {
          envelope = await awaitAbortable(json.call(response), controller.signal);
        } catch (_error) {
          if (abortKind !== null) {
            throw abortError(abortKind, true);
          }
          throw clientError(
            'INVALID_RESPONSE',
            'The booking service returned an unreadable response.',
            { status, retryable: true, ambiguous: true }
          );
        }

        try {
          assertStrictPlainData(envelope);
        } catch (_error) {
          throw clientError(
            'INVALID_RESPONSE',
            'The booking service returned an invalid response.',
            { status, retryable: true, ambiguous: true }
          );
        }

        if (ok === true && validateSuccessEnvelope(envelope)) {
          return envelope;
        }
        if (ok === false && validateFailureEnvelope(envelope)) {
          const serverError = envelope.error;
          throw clientError(
            serverError.code,
            SAFE_SERVER_MESSAGES[serverError.code],
            {
              status,
              retryable: serverError.retryable,
              ambiguous: false,
            }
          );
        }
        throw clientError(
          'INVALID_RESPONSE',
          'The booking service returned an invalid response.',
          { status, retryable: true, ambiguous: true }
        );
      } finally {
        clearTimeoutImpl(timer);
        if (signal) {
          signal.removeEventListener('abort', onExternalAbort);
        }
      }
    },
  });
}
