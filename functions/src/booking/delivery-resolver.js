'use strict';

const { types: { isProxy } } = require('node:util');

const { sha256Canonical } = require('./domain');
const {
  normalizeBookingEmailSnapshot,
  renderBookingEmail,
} = require('./email-templates');

const EVENT_CONTRACT = Object.freeze({
  'booking.created.customer-email': Object.freeze({
    audience: 'customer',
    operation: 'booking.created',
  }),
  'booking.created.shop-email': Object.freeze({
    audience: 'shop',
    operation: 'booking.created',
  }),
  'booking.cancelled.customer-email': Object.freeze({
    audience: 'customer',
    operation: 'booking.cancelled',
  }),
  'booking.cancelled.shop-email': Object.freeze({
    audience: 'shop',
    operation: 'booking.cancelled',
  }),
  'booking.rescheduled.customer-email': Object.freeze({
    audience: 'customer',
    operation: 'booking.rescheduled',
  }),
  'booking.rescheduled.shop-email': Object.freeze({
    audience: 'shop',
    operation: 'booking.rescheduled',
  }),
});

const ENVELOPE_FIELDS = Object.freeze([
  'outboxId',
  'eventType',
  'channel',
  'audience',
  'bookingId',
  'bookingVersion',
  'shopId',
  'commandId',
  'eventId',
]);
const CREATE_EVENT_FIELDS = Object.freeze([
  'schemaVersion',
  'eventId',
  'eventType',
  'bookingId',
  'bookingVersion',
  'shopId',
  'actor',
  'commandId',
  'notificationSnapshot',
  'occurredAt',
]);
const MUTATION_EVENT_FIELDS = Object.freeze([
  'schemaVersion',
  'eventId',
  'eventType',
  'bookingId',
  'bookingVersion',
  'previousVersion',
  'shopId',
  'actor',
  'commandId',
  'notificationSnapshot',
  'occurredAt',
]);
const ACTOR_FIELDS = Object.freeze(['kind', 'uid']);
const FOUND_RESULT_FIELDS = Object.freeze(['exists', 'data']);
const MISSING_RESULT_FIELDS = Object.freeze(['exists']);
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const IDENTIFIER_PATTERN = /^[^\u0000-\u001f\u007f/]{1,128}$/u;
const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/u;

const SOURCE_MALFORMED = Object.freeze({ kind: 'dead', category: 'SOURCE_MALFORMED' });
const SOURCE_UNAVAILABLE = Object.freeze({ kind: 'retry', category: 'SOURCE_UNAVAILABLE' });
const BOOKING_NOT_FOUND = Object.freeze({ kind: 'dead', category: 'BOOKING_NOT_FOUND' });
const SHOP_NOT_FOUND = Object.freeze({ kind: 'dead', category: 'SHOP_NOT_FOUND' });
const RECIPIENT_MISSING = Object.freeze({ kind: 'dead', category: 'RECIPIENT_MISSING' });

function readDataObject(value, { exactFields = null } = {}) {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      isProxy(value)
    ) {
      return null;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string')) {
      return null;
    }
    if (
      exactFields !== null &&
      (
        keys.length !== exactFields.length ||
        keys.some((key) => !exactFields.includes(key)) ||
        exactFields.some((key) => !keys.includes(key))
      )
    ) {
      return null;
    }
    const result = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        return null;
      }
      result[key] = descriptor.value;
    }
    return result;
  } catch (_error) {
    return null;
  }
}

function isIdentifier(value) {
  return typeof value === 'string' && value === value.trim() && IDENTIFIER_PATTERN.test(value);
}

function isHash(value) {
  return typeof value === 'string' && HASH_PATTERN.test(value);
}

function isStrictEmail(value) {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 254 ||
    value !== value.trim() ||
    !EMAIL_PATTERN.test(value)
  ) {
    return false;
  }
  const separator = value.lastIndexOf('@');
  const localPart = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  return localPart.length <= 64 &&
    domain.length <= 253 &&
    !localPart.startsWith('.') &&
    !localPart.endsWith('.') &&
    !localPart.includes('..');
}

function hasValidOperationVersion(operation, bookingVersion) {
  return operation === 'booking.created'
    ? bookingVersion === 1
    : bookingVersion >= 2;
}

function normalizeEnvelope(value) {
  const envelope = readDataObject(value, { exactFields: ENVELOPE_FIELDS });
  if (!envelope) {
    return null;
  }
  const contract = typeof envelope.eventType === 'string' &&
    Object.hasOwn(EVENT_CONTRACT, envelope.eventType)
    ? EVENT_CONTRACT[envelope.eventType]
    : undefined;
  if (
    !contract ||
    envelope.channel !== 'email' ||
    envelope.audience !== contract.audience ||
    !isHash(envelope.outboxId) ||
    !isIdentifier(envelope.bookingId) ||
    !Number.isSafeInteger(envelope.bookingVersion) ||
    envelope.bookingVersion < 1 ||
    !hasValidOperationVersion(contract.operation, envelope.bookingVersion) ||
    !isIdentifier(envelope.shopId) ||
    !isHash(envelope.commandId) ||
    !isHash(envelope.eventId)
  ) {
    return null;
  }
  const expectedOutboxId = sha256Canonical({
    scope: 'booking-outbox:v2',
    bookingId: envelope.bookingId,
    version: envelope.bookingVersion,
    eventType: envelope.eventType,
  });
  const expectedEventId = sha256Canonical({
    scope: 'booking-event:v2',
    bookingId: envelope.bookingId,
    version: envelope.bookingVersion,
    eventType: contract.operation,
  });
  return envelope.outboxId === expectedOutboxId && envelope.eventId === expectedEventId
    ? Object.freeze({ ...envelope, contract })
    : null;
}

function normalizeReadResult(value) {
  const possible = readDataObject(value);
  if (!possible || typeof possible.exists !== 'boolean') {
    return null;
  }
  const exactFields = possible.exists ? FOUND_RESULT_FIELDS : MISSING_RESULT_FIELDS;
  const result = readDataObject(value, { exactFields });
  if (!result) {
    return null;
  }
  if (!result.exists) {
    return Object.freeze({ exists: false });
  }
  const data = readDataObject(result.data);
  return data ? Object.freeze({ exists: true, data }) : null;
}

async function readSource(readDocument, path, notFoundOutcome) {
  let result;
  try {
    result = normalizeReadResult(await readDocument(path));
  } catch (_error) {
    return Object.freeze({ outcome: SOURCE_UNAVAILABLE });
  }
  if (!result) {
    return Object.freeze({ outcome: SOURCE_MALFORMED });
  }
  if (!result.exists) {
    return Object.freeze({ outcome: notFoundOutcome });
  }
  return Object.freeze({ data: result.data });
}

function validateBooking(booking, envelope) {
  if (
    booking.schemaVersion !== 2 ||
    booking.bookingId !== envelope.bookingId ||
    booking.shopId !== envelope.shopId ||
    !Number.isSafeInteger(booking.version) ||
    booking.version < envelope.bookingVersion
  ) {
    return false;
  }
  if (
    booking.version === envelope.bookingVersion &&
    booking.commandId !== envelope.commandId
  ) {
    return false;
  }
  return readDataObject(booking.customer) !== null;
}

function validateActor(actor) {
  const values = readDataObject(actor, { exactFields: ACTOR_FIELDS });
  return values !== null &&
    isIdentifier(values.kind) &&
    (values.uid === null || isIdentifier(values.uid));
}

function validateOccurredAt(value) {
  try {
    if (value === null || typeof value !== 'object' || isProxy(value)) {
      return false;
    }
    if (Object.getPrototypeOf(value) === Date.prototype) {
      return Number.isFinite(Date.prototype.getTime.call(value));
    }
    const keys = Reflect.ownKeys(value);
    const publicShape = keys.length === 2 && keys.includes('seconds') && keys.includes('nanoseconds');
    const adminShape = keys.length === 2 && keys.includes('_seconds') && keys.includes('_nanoseconds');
    if (!publicShape && !adminShape) {
      return false;
    }
    const secondsDescriptor = Object.getOwnPropertyDescriptor(
      value,
      publicShape ? 'seconds' : '_seconds',
    );
    const nanosecondsDescriptor = Object.getOwnPropertyDescriptor(
      value,
      publicShape ? 'nanoseconds' : '_nanoseconds',
    );
    return Boolean(
      secondsDescriptor &&
      nanosecondsDescriptor &&
      Object.prototype.hasOwnProperty.call(secondsDescriptor, 'value') &&
      Object.prototype.hasOwnProperty.call(nanosecondsDescriptor, 'value') &&
      Number.isSafeInteger(secondsDescriptor.value) &&
      Number.isSafeInteger(nanosecondsDescriptor.value) &&
      nanosecondsDescriptor.value >= 0 &&
      nanosecondsDescriptor.value <= 999999999,
    );
  } catch (_error) {
    return false;
  }
}

function validateEvent(event, envelope) {
  const exactFields = envelope.contract.operation === 'booking.created'
    ? CREATE_EVENT_FIELDS
    : MUTATION_EVENT_FIELDS;
  const values = readDataObject(event, { exactFields });
  if (
    !values ||
    values.schemaVersion !== 2 ||
    values.eventId !== envelope.eventId ||
    values.eventType !== envelope.contract.operation ||
    values.bookingId !== envelope.bookingId ||
    values.bookingVersion !== envelope.bookingVersion ||
    values.shopId !== envelope.shopId ||
    values.commandId !== envelope.commandId ||
    !hasValidOperationVersion(values.eventType, values.bookingVersion) ||
    !validateActor(values.actor) ||
    !validateOccurredAt(values.occurredAt)
  ) {
    return null;
  }
  if (
    envelope.contract.operation !== 'booking.created' &&
    values.previousVersion !== envelope.bookingVersion - 1
  ) {
    return null;
  }
  try {
    return normalizeBookingEmailSnapshot(values.notificationSnapshot);
  } catch (_error) {
    return null;
  }
}

function recipientFromBooking(booking) {
  const customer = readDataObject(booking.customer);
  return customer && isStrictEmail(customer.email) ? customer.email : null;
}

function recipientFromShop(shop) {
  return isStrictEmail(shop.email) ? shop.email : null;
}

/**
 * Creates the pure source resolver consumed by createBookingOutboxWorker.
 *
 * readDocument(path) must resolve to exactly `{ exists: false }` or
 * `{ exists: true, data: <plain data object> }`. Adapter/network failures may
 * throw and are converted to the worker's retryable SOURCE_UNAVAILABLE result.
 */
function createBookingDeliveryResolver({ readDocument } = {}) {
  if (typeof readDocument !== 'function' || isProxy(readDocument)) {
    throw new TypeError('a trusted document reader is required');
  }

  return async function resolveBookingDelivery(envelopeInput) {
    const envelope = normalizeEnvelope(envelopeInput);
    if (!envelope) {
      return SOURCE_MALFORMED;
    }

    const bookingSource = await readSource(
      readDocument,
      `bookings/${envelope.bookingId}`,
      BOOKING_NOT_FOUND,
    );
    if (bookingSource.outcome) {
      return bookingSource.outcome;
    }
    if (!validateBooking(bookingSource.data, envelope)) {
      return SOURCE_MALFORMED;
    }

    const eventSource = await readSource(
      readDocument,
      `bookings/${envelope.bookingId}/events/${envelope.eventId}`,
      SOURCE_MALFORMED,
    );
    if (eventSource.outcome) {
      return eventSource.outcome;
    }
    const snapshot = validateEvent(eventSource.data, envelope);
    if (!snapshot) {
      return SOURCE_MALFORMED;
    }

    const shopSource = await readSource(
      readDocument,
      `barberShops/${envelope.shopId}`,
      SHOP_NOT_FOUND,
    );
    if (shopSource.outcome) {
      return shopSource.outcome;
    }

    const recipient = envelope.audience === 'customer'
      ? recipientFromBooking(bookingSource.data)
      : recipientFromShop(shopSource.data);
    if (recipient === null) {
      return RECIPIENT_MISSING;
    }

    try {
      const delivery = renderBookingEmail(
        { eventType: envelope.eventType, snapshot },
        { recipientEmail: recipient },
      );
      return Object.freeze({ kind: 'deliver', delivery });
    } catch (_error) {
      return SOURCE_MALFORMED;
    }
  };
}

module.exports = {
  EVENT_CONTRACT,
  createBookingDeliveryResolver,
};
