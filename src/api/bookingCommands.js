const ENDPOINTS = Object.freeze({
  create: 'createBookingV2',
  cancel: 'cancelBookingV2',
  reschedule: 'rescheduleBookingV2',
});

const CANONICAL_BOOKING_STATUSES = Object.freeze([
  'pending',
  'confirmed',
  'completed',
  'rejected',
  'cancelled',
]);

const SAFE_ERROR_MESSAGES = Object.freeze({
  INVALID_ARGUMENT: 'The booking request is invalid.',
  INVALID_DATE: 'The selected date is invalid.',
  INVALID_TIME: 'The selected time is invalid.',
  INVALID_DURATION: 'The selected services have an invalid duration.',
  INVALID_IDEMPOTENCY_KEY: 'The booking request could not be identified safely.',
  UNAUTHENTICATED: 'Please sign in to change this booking.',
  FORBIDDEN: 'You are not allowed to change this booking.',
  SHOP_NOT_FOUND: 'This shop is not available.',
  BOOKING_NOT_FOUND: 'This booking could not be found.',
  SERVICE_NOT_FOUND: 'A selected service is no longer available.',
  EMPLOYEE_NOT_FOUND: 'The selected employee is no longer available.',
  SLOT_CONFLICT: 'That appointment time is no longer available.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already used for a different booking change.',
  BOOKING_VERSION_CONFLICT: 'This booking changed. Refresh it before trying again.',
  INVALID_STATUS_TRANSITION: 'This booking can no longer be changed that way.',
  BOOKING_MIGRATION_REQUIRED: 'This booking needs support before it can be changed.',
  SHOP_RESOURCE_CONFIG_REQUIRED: 'This shop is not ready to accept that booking.',
  OUTSIDE_AVAILABILITY: 'That appointment is outside the shop’s availability.',
  SHOP_TIMEZONE_REQUIRED: 'This shop is not ready to accept online bookings.',
  EMPLOYEE_UNAVAILABLE: 'The selected employee is not available at that time.',
  INTERNAL: 'The booking service could not complete the request.',
});

const STATUS_ERROR_CODES = Object.freeze({
  400: 'INVALID_ARGUMENT',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'BOOKING_NOT_FOUND',
  409: 'BOOKING_VERSION_CONFLICT',
  422: 'INVALID_ARGUMENT',
});

export class BookingCommandError extends Error {
  constructor(code, message, { status = 0, retryable = false } = {}) {
    super(message);
    this.name = 'BookingCommandError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function inputError(message) {
  return new BookingCommandError('INVALID_ARGUMENT', message);
}

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw inputError(`${field} is required.`);
  }
  return value.trim();
}

function requirePayload(payload) {
  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    throw inputError('payload must be an object.');
  }
  return payload;
}

function requireExpectedVersion(payload) {
  if (!Number.isInteger(payload.expectedVersion) || payload.expectedVersion < 1) {
    throw inputError('payload.expectedVersion must be a positive integer.');
  }
}

function resolveCrypto(cryptoImpl) {
  if (cryptoImpl !== undefined) {
    return cryptoImpl;
  }
  return typeof window !== 'undefined' ? window.crypto : undefined;
}

export function createIdempotencyKey(cryptoImpl) {
  const secureCrypto = resolveCrypto(cryptoImpl);

  if (typeof secureCrypto?.randomUUID === 'function') {
    return secureCrypto.randomUUID();
  }

  if (typeof secureCrypto?.getRandomValues !== 'function') {
    throw new BookingCommandError(
      'CRYPTO_UNAVAILABLE',
      'Secure request identifiers are not available in this browser.',
    );
  }

  const bytes = new Uint8Array(16);
  secureCrypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0'));

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10).join(''),
  ].join('-');
}

function safeStatus(response) {
  return Number.isInteger(response?.status) ? response.status : 0;
}

function fallbackCodeForStatus(status) {
  if (status >= 500) {
    return 'INTERNAL';
  }
  return STATUS_ERROR_CODES[status] || 'INVALID_ARGUMENT';
}

function fallbackMessageForCode(code) {
  return SAFE_ERROR_MESSAGES[code] || 'The booking request could not be completed.';
}

function mapServerError(envelope, status) {
  const serverError = envelope?.error;
  const suppliedCode = typeof serverError?.code === 'string' ? serverError.code : '';
  const code = Object.prototype.hasOwnProperty.call(SAFE_ERROR_MESSAGES, suppliedCode)
    ? suppliedCode
    : fallbackCodeForStatus(status);
  const retryable = typeof serverError?.retryable === 'boolean'
    ? serverError.retryable
    : status >= 500;

  return new BookingCommandError(code, fallbackMessageForCode(code), {
    status,
    retryable,
  });
}

function isSuccessEnvelope(envelope) {
  const booking = envelope?.booking;
  return (
    envelope !== null &&
    typeof envelope === 'object' &&
    !Array.isArray(envelope) &&
    envelope.ok === true &&
    typeof envelope.commandId === 'string' &&
    envelope.commandId.length > 0 &&
    typeof envelope.replayed === 'boolean' &&
    booking !== null &&
    typeof booking === 'object' &&
    !Array.isArray(booking) &&
    typeof booking.bookingId === 'string' &&
    booking.bookingId.trim().length > 0 &&
    Number.isInteger(booking.version) &&
    booking.version >= 1 &&
    CANONICAL_BOOKING_STATUSES.includes(booking.status) &&
    typeof booking.resourceId === 'string' &&
    booking.resourceId.trim().length > 0 &&
    typeof booking.startAt === 'string' &&
    booking.startAt.trim().length > 0 &&
    typeof booking.endAt === 'string' &&
    booking.endAt.trim().length > 0
  );
}

export async function postBookingCommand({
  baseUrl,
  endpoint,
  payload,
  idempotencyKey,
  idToken,
  fetchImpl = typeof window !== 'undefined' ? window.fetch : undefined,
  signal,
}) {
  const normalizedBaseUrl = requireNonEmptyString(baseUrl, 'baseUrl').replace(/\/+$/, '');
  const normalizedEndpoint = requireNonEmptyString(endpoint, 'endpoint');
  const normalizedKey = requireNonEmptyString(idempotencyKey, 'idempotencyKey');
  const requestPayload = requirePayload(payload);

  if (typeof fetchImpl !== 'function') {
    throw inputError('fetchImpl must be a function.');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Idempotency-Key': normalizedKey,
  };
  if (idToken !== undefined && idToken !== null) {
    headers.Authorization = `Bearer ${requireNonEmptyString(idToken, 'idToken')}`;
  }

  let body;
  try {
    body = JSON.stringify(requestPayload);
  } catch (_error) {
    throw inputError('payload must be JSON serializable.');
  }

  let response;
  try {
    response = await fetchImpl(`${normalizedBaseUrl}/${normalizedEndpoint}`, {
      method: 'POST',
      headers,
      body,
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new BookingCommandError('REQUEST_ABORTED', 'The booking request was cancelled.');
    }
    throw new BookingCommandError(
      'NETWORK_ERROR',
      'The booking service could not be reached. Check your connection and try again.',
      { retryable: true },
    );
  }

  const status = safeStatus(response);
  let envelope;
  try {
    envelope = await response.json();
  } catch (_error) {
    throw new BookingCommandError(
      'INVALID_RESPONSE',
      'The booking service returned an invalid response.',
      { status, retryable: status >= 500 },
    );
  }

  if (envelope?.ok === false) {
    throw mapServerError(envelope, status);
  }

  if (response.ok !== true || !isSuccessEnvelope(envelope)) {
    const code = response.ok === true ? 'INVALID_RESPONSE' : fallbackCodeForStatus(status);
    throw new BookingCommandError(code, fallbackMessageForCode(code), {
      status,
      retryable: status >= 500,
    });
  }

  return envelope;
}

export function createBooking(options) {
  return postBookingCommand({ ...options, endpoint: ENDPOINTS.create });
}

export async function cancelBooking(options) {
  const payload = requirePayload(options?.payload);
  requireNonEmptyString(options?.idToken, 'idToken');
  requireExpectedVersion(payload);
  return postBookingCommand({ ...options, payload, endpoint: ENDPOINTS.cancel });
}

export async function rescheduleBooking(options) {
  const payload = requirePayload(options?.payload);
  requireNonEmptyString(options?.idToken, 'idToken');
  requireExpectedVersion(payload);
  return postBookingCommand({ ...options, payload, endpoint: ENDPOINTS.reschedule });
}

export const createBookingV2 = createBooking;
export const cancelBookingV2 = cancelBooking;
export const rescheduleBookingV2 = rescheduleBooking;
