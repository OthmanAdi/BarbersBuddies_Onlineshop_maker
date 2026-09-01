'use strict';

const { validateIdempotencyKey } = require('./domain');
const { BookingError } = require('./errors');

const ALLOWED_METHODS = 'POST, OPTIONS';
const ALLOWED_HEADERS = 'Authorization, Content-Type, Idempotency-Key';
const JSON_CONTENT_TYPE_PATTERN = /^application\/json(?:\s*;|$)/i;
const BEARER_PATTERN = /^Bearer ([^\s,]+)$/i;
const MALFORMED_HEADER = Symbol('malformed-header');
const BOOKING_STATUSES = new Set([
  'pending',
  'confirmed',
  'completed',
  'rejected',
  'cancelled',
]);

function freezeErrorDefinitions(definitions) {
  return Object.freeze(Object.fromEntries(Object.entries(definitions).map(([code, definition]) => [
    code,
    Object.freeze({ ...definition }),
  ])));
}

const PUBLIC_ERROR_DEFINITIONS = freezeErrorDefinitions({
  INVALID_ARGUMENT: {
    httpStatus: 400,
    message: 'the booking command request is invalid',
    retryable: false,
  },
  INVALID_DATE: {
    httpStatus: 400,
    message: 'the booking date is invalid',
    retryable: false,
  },
  INVALID_TIME: {
    httpStatus: 400,
    message: 'the booking time is invalid',
    retryable: false,
  },
  INVALID_DURATION: {
    httpStatus: 400,
    message: 'the booking duration is invalid',
    retryable: false,
  },
  INVALID_IDEMPOTENCY_KEY: {
    httpStatus: 400,
    message: 'a valid Idempotency-Key is required',
    retryable: false,
  },
  UNAUTHENTICATED: {
    httpStatus: 401,
    message: 'a valid Firebase ID token is required',
    retryable: false,
  },
  FORBIDDEN: {
    httpStatus: 403,
    message: 'the verified caller is not allowed to perform this command',
    retryable: false,
  },
  SHOP_NOT_FOUND: {
    httpStatus: 404,
    message: 'the requested shop was not found',
    retryable: false,
  },
  BOOKING_NOT_FOUND: {
    httpStatus: 404,
    message: 'the requested booking was not found',
    retryable: false,
  },
  SERVICE_NOT_FOUND: {
    httpStatus: 404,
    message: 'a requested service was not found',
    retryable: false,
  },
  EMPLOYEE_NOT_FOUND: {
    httpStatus: 404,
    message: 'the requested employee was not found',
    retryable: false,
  },
  SLOT_CONFLICT: {
    httpStatus: 409,
    message: 'the requested booking interval is already occupied',
    retryable: false,
  },
  IDEMPOTENCY_KEY_REUSED: {
    httpStatus: 409,
    message: 'the Idempotency-Key was already used for a different command',
    retryable: false,
  },
  BOOKING_VERSION_CONFLICT: {
    httpStatus: 409,
    message: 'the booking changed since it was last read',
    retryable: false,
  },
  INVALID_STATUS_TRANSITION: {
    httpStatus: 409,
    message: 'the requested booking status transition is not allowed',
    retryable: false,
  },
  BOOKING_MIGRATION_REQUIRED: {
    httpStatus: 409,
    message: 'the booking must be reviewed before it can be changed',
    retryable: false,
  },
  SHOP_RESOURCE_CONFIG_REQUIRED: {
    httpStatus: 422,
    message: 'the shop booking resources are not configured',
    retryable: false,
  },
  OUTSIDE_AVAILABILITY: {
    httpStatus: 422,
    message: 'the requested interval is outside availability',
    retryable: false,
  },
  SHOP_TIMEZONE_REQUIRED: {
    httpStatus: 422,
    message: 'the shop timezone is not configured',
    retryable: false,
  },
  EMPLOYEE_UNAVAILABLE: {
    httpStatus: 422,
    message: 'no eligible employee is available for the requested interval',
    retryable: false,
  },
  INTERNAL: {
    httpStatus: 500,
    message: 'the booking command could not be completed',
    retryable: true,
  },
});

function containsControlCharacter(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 31 || codePoint === 127) {
      return true;
    }
  }
  return false;
}

function configurationError(message) {
  throw new TypeError(message);
}

function buildOriginAllowlist(origins) {
  if (!Array.isArray(origins) || origins.length === 0) {
    configurationError('allowedOrigins must be a non-empty array');
  }

  const allowlist = new Map();
  for (const origin of origins) {
    if (
      typeof origin !== 'string' ||
      origin.length === 0 ||
      origin !== origin.trim() ||
      origin === 'null' ||
      origin === '*' ||
      origin.includes('*') ||
      origin.includes(',') ||
      containsControlCharacter(origin)
    ) {
      configurationError('allowedOrigins must contain exact origin strings');
    }

    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      configurationError('allowedOrigins must contain exact http or https origins');
    }
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.origin !== origin ||
      parsed.origin === 'null' ||
      parsed.username !== '' ||
      parsed.password !== '' ||
      parsed.pathname !== '/' ||
      parsed.search !== '' ||
      parsed.hash !== ''
    ) {
      configurationError('allowedOrigins must contain exact http or https origins');
    }
    allowlist.set(origin, origin);
  }
  return allowlist;
}

function requireFunction(value, name) {
  if (typeof value !== 'function') {
    configurationError(`${name} must be a function`);
  }
  return value;
}

function getHeader(request, name) {
  const normalizedName = name.toLowerCase();
  const value = request.headers?.[normalizedName];
  if (Array.isArray(value)) {
    return MALFORMED_HEADER;
  }
  if (value !== undefined) {
    return value;
  }
  if (typeof request.get === 'function') {
    const fallbackValue = request.get(name);
    return Array.isArray(fallbackValue) ? MALFORMED_HEADER : fallbackValue;
  }
  return undefined;
}

function setHeader(response, name, value) {
  if (typeof response.set === 'function') {
    response.set(name, value);
    return;
  }
  if (typeof response.setHeader === 'function') {
    response.setHeader(name, value);
    return;
  }
  configurationError('response must support setting headers');
}

function sendJson(response, status, value) {
  const target = response.status(status);
  return target.json(value);
}

function publicError(code) {
  const definition = PUBLIC_ERROR_DEFINITIONS[code];
  if (!definition) {
    configurationError('public error code is not defined by ADR 001');
  }
  return new BookingError(code, definition.message, definition);
}

function normalizedPublicFailure(error) {
  const code = error instanceof BookingError && PUBLIC_ERROR_DEFINITIONS[error.code]
    ? error.code
    : 'INTERNAL';
  const definition = PUBLIC_ERROR_DEFINITIONS[code];
  return {
    httpStatus: definition.httpStatus,
    envelope: {
      ok: false,
      error: {
        code,
        message: definition.message,
        retryable: definition.retryable,
      },
    },
  };
}

function assertPlainJsonBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw publicError('INVALID_ARGUMENT');
  }
  const prototype = Object.getPrototypeOf(body);
  if (prototype !== Object.prototype && prototype !== null) {
    throw publicError('INVALID_ARGUMENT');
  }
  return body;
}

function normalizeVerifiedActor(decodedToken) {
  if (decodedToken === null || typeof decodedToken !== 'object' || Array.isArray(decodedToken)) {
    throw publicError('UNAUTHENTICATED');
  }

  const uid = decodedToken.uid;
  if (
    typeof uid !== 'string' ||
    uid.length === 0 ||
    uid.length > 128 ||
    uid !== uid.trim() ||
    uid.includes('/') ||
    containsControlCharacter(uid)
  ) {
    throw publicError('UNAUTHENTICATED');
  }

  const emailVerified = decodedToken.email_verified === true;
  let email = null;
  if (emailVerified && typeof decodedToken.email === 'string') {
    const candidate = decodedToken.email.trim().toLowerCase();
    if (
      candidate.length > 0 &&
      candidate.length <= 254 &&
      !containsControlCharacter(candidate)
    ) {
      email = candidate;
    }
  }

  return Object.freeze({ uid, email, emailVerified, kind: 'authenticated' });
}

async function authenticate(request, verifyIdToken, required) {
  const authorization = getHeader(request, 'Authorization');
  if (authorization === undefined || authorization === '') {
    if (!required) {
      return null;
    }
    throw publicError('UNAUTHENTICATED');
  }
  if (typeof authorization !== 'string') {
    throw publicError('UNAUTHENTICATED');
  }

  const match = authorization.match(BEARER_PATTERN);
  if (!match) {
    throw publicError('UNAUTHENTICATED');
  }

  let decodedToken;
  try {
    decodedToken = await verifyIdToken(match[1]);
  } catch (error) {
    throw publicError('UNAUTHENTICATED', 'a valid Firebase ID token is required', 401);
  }
  return normalizeVerifiedActor(decodedToken);
}

function configureCors(request, response, allowlist) {
  setHeader(response, 'Vary', 'Origin');
  const origin = getHeader(request, 'Origin');
  if (origin === undefined || origin === null || origin === '') {
    return false;
  }
  const allowedOrigin = typeof origin === 'string' ? allowlist.get(origin) : undefined;
  if (allowedOrigin === undefined) {
    throw publicError('FORBIDDEN');
  }
  // Use the configured value, not the request header, as the response value.
  setHeader(response, 'Access-Control-Allow-Origin', allowedOrigin);
  return true;
}

function hasExactKeys(value, expectedKeys) {
  const actualKeys = Reflect.ownKeys(value);
  return actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => actualKeys.includes(key));
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateSuccessEnvelope(result) {
  const topLevelKeys = ['ok', 'commandId', 'replayed', 'booking'];
  const bookingKeys = [
    'bookingId',
    'version',
    'status',
    'resourceId',
    'startAt',
    'endAt',
  ];
  if (
    !isPlainObject(result) ||
    !hasExactKeys(result, topLevelKeys) ||
    result.ok !== true ||
    !isNonEmptyString(result.commandId) ||
    typeof result.replayed !== 'boolean' ||
    !isPlainObject(result.booking) ||
    !hasExactKeys(result.booking, bookingKeys) ||
    !isNonEmptyString(result.booking.bookingId) ||
    !Number.isInteger(result.booking.version) ||
    result.booking.version < 1 ||
    !BOOKING_STATUSES.has(result.booking.status) ||
    !isNonEmptyString(result.booking.resourceId) ||
    !isNonEmptyString(result.booking.startAt) ||
    !isNonEmptyString(result.booking.endAt)
  ) {
    throw new TypeError('booking command returned a malformed success envelope');
  }
  return result;
}

function createHandler({
  operation,
  command,
  authRequired,
  verifyIdToken,
  allowlist,
  logger,
}) {
  return async function bookingV2HttpHandler(request, response) {
    try {
      const hasAllowedOrigin = configureCors(request, response, allowlist);

      if (request.method === 'OPTIONS') {
        if (!hasAllowedOrigin) {
          throw publicError('FORBIDDEN');
        }
        setHeader(response, 'Access-Control-Allow-Methods', ALLOWED_METHODS);
        setHeader(response, 'Access-Control-Allow-Headers', ALLOWED_HEADERS);
        return response.status(204).send('');
      }

      if (request.method !== 'POST') {
        setHeader(response, 'Allow', ALLOWED_METHODS);
        throw publicError('INVALID_ARGUMENT');
      }

      const contentType = getHeader(request, 'Content-Type');
      if (typeof contentType !== 'string' || !JSON_CONTENT_TYPE_PATTERN.test(contentType)) {
        throw publicError('INVALID_ARGUMENT');
      }

      const payload = assertPlainJsonBody(request.body);
      const idempotencyKey = validateIdempotencyKey(getHeader(request, 'Idempotency-Key'));
      const actor = await authenticate(request, verifyIdToken, authRequired);
      const result = validateSuccessEnvelope(await command({ payload, actor, idempotencyKey }));
      return sendJson(response, 200, result);
    } catch (error) {
      if (error instanceof BookingError && PUBLIC_ERROR_DEFINITIONS[error.code]) {
        const failure = normalizedPublicFailure(error);
        return sendJson(response, failure.httpStatus, failure.envelope);
      }

      try {
        logger.error('booking-v2 command failed', {
          operation,
          errorType: 'UnexpectedError',
        });
      } catch {
        // Logging must never replace the safe public error contract.
      }
      const failure = normalizedPublicFailure(error);
      return sendJson(response, failure.httpStatus, failure.envelope);
    }
  };
}

function createBookingHttpHandlers({
  allowedOrigins,
  verifyIdToken,
  commands,
  logger = console,
}) {
  const allowlist = buildOriginAllowlist(allowedOrigins);
  requireFunction(verifyIdToken, 'verifyIdToken');
  if (commands === null || typeof commands !== 'object' || Array.isArray(commands)) {
    configurationError('commands must be an object');
  }
  const create = requireFunction(commands.create, 'commands.create');
  const cancel = requireFunction(commands.cancel, 'commands.cancel');
  const reschedule = requireFunction(commands.reschedule, 'commands.reschedule');
  if (logger === null || typeof logger !== 'object' || typeof logger.error !== 'function') {
    configurationError('logger.error must be a function');
  }

  return Object.freeze({
    createBookingV2: createHandler({
      operation: 'create',
      command: create,
      authRequired: false,
      verifyIdToken,
      allowlist,
      logger,
    }),
    cancelBookingV2: createHandler({
      operation: 'cancel',
      command: cancel,
      authRequired: true,
      verifyIdToken,
      allowlist,
      logger,
    }),
    rescheduleBookingV2: createHandler({
      operation: 'reschedule',
      command: reschedule,
      authRequired: true,
      verifyIdToken,
      allowlist,
      logger,
    }),
  });
}

module.exports = {
  ALLOWED_HEADERS,
  ALLOWED_METHODS,
  PUBLIC_ERROR_DEFINITIONS,
  createBookingHttpHandlers,
};
