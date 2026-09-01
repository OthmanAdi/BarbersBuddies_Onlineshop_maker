import { createBookingCommandClient } from './bookingCommandClient';
import { parseCivilDate, parseCivilTime } from './civilTime';
import {
  acquireBookingIntentKey,
  assertStrictPlainData,
  settleBookingIntent,
} from './intentRegistry';
import { resolveBookingV2Endpoints } from './bookingRuntime';

const CUSTOMER_LIMITS = Object.freeze({ name: 160, email: 320, phone: 40 });

export class CreateBookingAdapterError extends Error {
  constructor(code, message, field) {
    super(message);
    this.name = 'CreateBookingAdapterError';
    this.code = code;
    this.field = field;
  }
}

function adapterError(code, message, field) {
  throw new CreateBookingAdapterError(code, message, field);
}

function requireRecord(value, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    adapterError('INVALID_BOOKING_FORM_STATE', `${field} is required.`, field);
  }
  return value;
}

function requireIdentifier(value, field, code = 'INVALID_BOOKING_IDENTIFIER') {
  if (typeof value !== 'string') {
    adapterError(code, `${field} must be a stable identifier.`, field);
  }
  const normalized = value.trim();
  const containsForbiddenCharacter = Array.from(normalized).some((character) => (
    character === '/' || character.charCodeAt(0) < 32
  ));
  if (
    normalized.length === 0 ||
    normalized.length > 128 ||
    containsForbiddenCharacter
  ) {
    adapterError(code, `${field} must be a stable identifier.`, field);
  }
  return normalized;
}

function requireCustomerText(value, field) {
  const key = field.slice('customer.'.length);
  const maxLength = CUSTOMER_LIMITS[key];
  if (typeof value !== 'string') {
    adapterError('INVALID_CUSTOMER_DETAILS', `${field} is required.`, field);
  }
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    adapterError('INVALID_CUSTOMER_DETAILS', `${field} is invalid.`, field);
  }
  return normalized;
}

function serviceIdsFromSelection(selectedServices) {
  if (!Array.isArray(selectedServices) || selectedServices.length === 0) {
    adapterError(
      'STABLE_SERVICE_ID_REQUIRED',
      'At least one service with a stable identifier is required.',
      'selectedServices'
    );
  }
  const seen = new Set();
  return Object.freeze(selectedServices.map((service, index) => {
    const id = requireIdentifier(
      requireRecord(service, `selectedServices[${index}]`).id,
      `selectedServices[${index}].id`,
      'STABLE_SERVICE_ID_REQUIRED'
    );
    if (seen.has(id)) {
      adapterError(
        'DUPLICATE_SERVICE_ID',
        'Selected services must have unique stable identifiers.',
        `selectedServices[${index}].id`
      );
    }
    seen.add(id);
    return id;
  }));
}

function requestedEmployeeId(selectedEmployee) {
  if (selectedEmployee === undefined || selectedEmployee === null) return null;
  return requireIdentifier(
    requireRecord(selectedEmployee, 'selectedEmployee').id,
    'selectedEmployee.id',
    'STABLE_EMPLOYEE_ID_REQUIRED'
  );
}

export function buildCreateBookingV2Payload({
  shop,
  selectedServices,
  selectedDate,
  selectedTime,
  userName,
  userEmail,
  userPhone,
  selectedEmployee = null,
} = {}) {
  const shopRecord = requireRecord(shop, 'shop');
  if (
    shopRecord.bookingPolicy === null ||
    typeof shopRecord.bookingPolicy !== 'object' ||
    Array.isArray(shopRecord.bookingPolicy)
  ) {
    adapterError(
      'BOOKING_POLICY_REQUIRED',
      'The shop does not publish a booking consent policy.',
      'shop.bookingPolicy'
    );
  }
  const bookingPolicy = shopRecord.bookingPolicy;
  const consentVersion = requireIdentifier(
    bookingPolicy.consentVersion,
    'shop.bookingPolicy.consentVersion',
    'BOOKING_POLICY_REQUIRED'
  );

  try {
    parseCivilDate(selectedDate);
  } catch (_error) {
    adapterError('INVALID_CIVIL_DATE', 'selectedDate must use YYYY-MM-DD.', 'selectedDate');
  }
  try {
    parseCivilTime(selectedTime);
  } catch (_error) {
    adapterError('INVALID_CIVIL_TIME', 'selectedTime must use HH:mm.', 'selectedTime');
  }

  const payload = {
    shopId: requireIdentifier(shopRecord.id, 'shop.id'),
    requestedEmployeeId: requestedEmployeeId(selectedEmployee),
    serviceIds: serviceIdsFromSelection(selectedServices),
    localDate: selectedDate,
    localStartTime: selectedTime,
    customer: Object.freeze({
      name: requireCustomerText(userName, 'customer.name'),
      email: requireCustomerText(userEmail, 'customer.email').toLowerCase(),
      phone: requireCustomerText(userPhone, 'customer.phone'),
    }),
    consentVersion,
  };

  assertStrictPlainData(payload);
  return Object.freeze(payload);
}

function outcomeForError(error) {
  if (error?.ambiguous === true) return 'ambiguous';
  if (error?.retryable === true) return 'retryable-failure';
  return 'terminal-failure';
}

export function createPublicBookingV2Adapter({
  runtime,
  environment = {},
  getIdToken = async () => {
    throw new Error('No authenticated booking session is available.');
  },
  fetchImpl,
  storage,
  cryptoImpl,
  TextEncoderImpl,
  createAuthMode = 'guest',
  ...clientOptions
} = {}) {
  const client = createBookingCommandClient({
    ...clientOptions,
    endpoints: resolveBookingV2Endpoints({ runtime, environment }),
    getIdToken,
    fetchImpl,
    createAuthMode,
  });

  return Object.freeze({
    async create(formState, { signal } = {}) {
      const payload = buildCreateBookingV2Payload(formState);
      const intentOptions = {
        operation: 'create',
        intent: payload,
        storage,
        cryptoImpl,
        TextEncoderImpl,
      };
      const idempotencyKey = await acquireBookingIntentKey(intentOptions);
      let result;
      try {
        result = await client.execute({
          operation: 'create',
          payload,
          idempotencyKey,
          signal,
        });
      } catch (error) {
        try {
          await settleBookingIntent({
            ...intentOptions,
            outcome: outcomeForError(error),
          });
        } catch (_settlementError) {
          // The command result remains authoritative. A cleanup failure must
          // not hide its safe error or encourage a retry under a new identity.
        }
        throw error;
      }

      try {
        await settleBookingIntent({ ...intentOptions, outcome: 'success' });
      } catch (_settlementError) {
        // Returning the committed server result is safer than making a
        // successful command look ambiguous. A retained key replays safely.
      }
      return result;
    },
  });
}
