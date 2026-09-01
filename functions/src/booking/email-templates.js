'use strict';

const { Temporal } = require('@js-temporal/polyfill');
const { types: { isProxy } } = require('node:util');

const BOOKING_EMAIL_EVENT_TYPES = Object.freeze([
  'booking.created.customer-email',
  'booking.created.shop-email',
  'booking.cancelled.customer-email',
  'booking.cancelled.shop-email',
  'booking.rescheduled.customer-email',
  'booking.rescheduled.shop-email',
]);

const EVENT_CONTRACT = Object.freeze({
  'booking.created.customer-email': Object.freeze({
    audience: 'customer',
    subject: 'Booking received',
    heading: 'Your booking was received',
    introduction: 'The shop has received your booking request.',
    closing: 'The shop will contact you if anything changes.',
  }),
  'booking.created.shop-email': Object.freeze({
    audience: 'shop',
    subject: 'New booking received',
    heading: 'A new booking was received',
    introduction: 'A customer submitted a new booking request.',
    closing: 'Open the booking system to review the booking.',
  }),
  'booking.cancelled.customer-email': Object.freeze({
    audience: 'customer',
    subject: 'Booking cancelled',
    heading: 'Your booking was cancelled',
    introduction: 'This booking is no longer scheduled.',
    closing: 'Keep this email for your records.',
  }),
  'booking.cancelled.shop-email': Object.freeze({
    audience: 'shop',
    subject: 'Booking cancelled',
    heading: 'A booking was cancelled',
    introduction: 'This booking is no longer scheduled.',
    closing: 'Open the booking system to review the current booking record.',
  }),
  'booking.rescheduled.customer-email': Object.freeze({
    audience: 'customer',
    subject: 'Booking rescheduled',
    heading: 'Your booking was rescheduled',
    introduction: 'The current booking details are shown below.',
    closing: 'The shop will contact you if anything changes.',
  }),
  'booking.rescheduled.shop-email': Object.freeze({
    audience: 'shop',
    subject: 'Booking rescheduled',
    heading: 'A booking was rescheduled',
    introduction: 'The current booking details are shown below.',
    closing: 'Open the booking system to review the current booking record.',
  }),
});

const ERROR_DEFINITIONS = Object.freeze({
  UNSUPPORTED_EVENT_TYPE: Object.freeze({
    category: 'event-type',
    message: 'Unsupported booking email event type.',
  }),
  INVALID_NOTIFICATION: Object.freeze({
    category: 'notification',
    message: 'Invalid booking email notification.',
  }),
  INVALID_SNAPSHOT: Object.freeze({
    category: 'snapshot',
    message: 'Invalid booking email snapshot.',
  }),
  INVALID_DELIVERY: Object.freeze({
    category: 'delivery',
    message: 'Invalid booking email delivery data.',
  }),
});

const SNAPSHOT_KEYS = Object.freeze([
  'schemaVersion',
  'shopName',
  'services',
  'totalPriceMinor',
  'currency',
  'minorUnitDigits',
  'localDate',
  'localStartTime',
  'timeZone',
  'startAt',
]);
const SERVICE_KEYS = Object.freeze([
  'id',
  'name',
  'durationMinutes',
  'priceMinor',
  'currency',
  'minorUnitDigits',
]);
const NOTIFICATION_KEYS = Object.freeze(['eventType', 'snapshot']);
const DELIVERY_KEYS = Object.freeze(['recipientEmail', 'customerDisplayName']);

const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/u;
const UNPAIRED_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

class BookingEmailTemplateError extends Error {
  constructor(code) {
    const definition = ERROR_DEFINITIONS[code] || ERROR_DEFINITIONS.INVALID_NOTIFICATION;
    super(definition.message);
    this.name = 'BookingEmailTemplateError';
    this.code = ERROR_DEFINITIONS[code] ? code : 'INVALID_NOTIFICATION';
    this.category = definition.category;
    Object.freeze(this);
  }
}

function fail(code) {
  throw new BookingEmailTemplateError(code);
}

function withinBoundary(code, operation) {
  try {
    return operation();
  } catch (error) {
    if (error instanceof BookingEmailTemplateError && error.code === code) {
      throw error;
    }
    fail(code);
  }
}

function readExactDataObject(value, allowedKeys, requiredKeys, errorCode) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value)) {
    fail(errorCode);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(errorCode);
  }
  const ownKeys = Reflect.ownKeys(value);
  const allowed = new Set(allowedKeys);
  if (
    ownKeys.some((key) => typeof key !== 'string' || !allowed.has(key)) ||
    requiredKeys.some((key) => !ownKeys.includes(key))
  ) {
    fail(errorCode);
  }
  const result = Object.create(null);
  for (const key of ownKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
      descriptor.enumerable !== true
    ) {
      fail(errorCode);
    }
    result[key] = descriptor.value;
  }
  return result;
}

function readExactDataArray(value, { min, max }, errorCode) {
  if (!Array.isArray(value) || isProxy(value)) {
    fail(errorCode);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== 'string')) {
    fail(errorCode);
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (
    !lengthDescriptor ||
    !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value') ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < min ||
    lengthDescriptor.value > max
  ) {
    fail(errorCode);
  }
  const expectedKeys = Array.from(
    { length: lengthDescriptor.value },
    (_unused, index) => String(index),
  );
  if (
    ownKeys.length !== expectedKeys.length + 1 ||
    ownKeys[ownKeys.length - 1] !== 'length' ||
    expectedKeys.some((key, index) => ownKeys[index] !== key)
  ) {
    fail(errorCode);
  }
  return expectedKeys.map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
      descriptor.enumerable !== true
    ) {
      fail(errorCode);
    }
    return descriptor.value;
  });
}

function normalizeBoundedText(value, { min, max, pattern = null }, errorCode) {
  if (typeof value !== 'string' || UNSAFE_TEXT.test(value) || UNPAIRED_SURROGATE.test(value)) {
    fail(errorCode);
  }
  const normalized = value.normalize('NFC');
  const length = Array.from(normalized).length;
  if (
    normalized !== normalized.trim() ||
    length < min ||
    length > max ||
    (pattern && !pattern.test(normalized))
  ) {
    fail(errorCode);
  }
  return normalized;
}

function normalizeSafeInteger(value, { min, max }, errorCode) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    fail(errorCode);
  }
  return value;
}

function normalizeCurrency(value, errorCode) {
  return normalizeBoundedText(value, { min: 3, max: 3, pattern: /^[A-Z]{3}$/u }, errorCode);
}

function normalizeLocalDate(value, errorCode) {
  const normalized = normalizeBoundedText(
    value,
    { min: 10, max: 10, pattern: /^\d{4}-\d{2}-\d{2}$/u },
    errorCode,
  );
  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    fail(errorCode);
  }
  return normalized;
}

function normalizeLocalStartTime(value, errorCode) {
  const normalized = normalizeBoundedText(
    value,
    { min: 5, max: 5, pattern: /^(?:[01]\d|2[0-3]):[0-5]\d$/u },
    errorCode,
  );
  if (Number(normalized.slice(3, 5)) % 5 !== 0) {
    fail(errorCode);
  }
  return normalized;
}

function normalizeTimeZone(value, errorCode) {
  const normalized = normalizeBoundedText(
    value,
    { min: 1, max: 64, pattern: /^[A-Za-z0-9_+\-/]+$/u },
    errorCode,
  );
  let canonical;
  try {
    canonical = new Intl.DateTimeFormat('en-US', { timeZone: normalized })
      .resolvedOptions()
      .timeZone;
  } catch (_error) {
    fail(errorCode);
  }
  if (canonical !== normalized) {
    fail(errorCode);
  }
  return normalized;
}

function normalizeStartAt(value, errorCode) {
  const normalized = normalizeBoundedText(
    value,
    {
      min: 24,
      max: 24,
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u,
    },
    errorCode,
  );
  let instant;
  try {
    instant = Temporal.Instant.from(normalized);
  } catch (_error) {
    fail(errorCode);
  }
  if (instant.toString({ smallestUnit: 'millisecond' }) !== normalized) {
    fail(errorCode);
  }
  return Object.freeze({ normalized, instant });
}

function validateCivilInstant({ localDate, localStartTime, timeZone, instant }, errorCode) {
  let zonedDateTime;
  try {
    const plainDateTime = Temporal.PlainDateTime.from(`${localDate}T${localStartTime}:00`);
    zonedDateTime = plainDateTime.toZonedDateTime(timeZone, { disambiguation: 'reject' });
  } catch (_error) {
    fail(errorCode);
  }
  if (!zonedDateTime.toInstant().equals(instant)) {
    fail(errorCode);
  }
}

function normalizeService(service) {
  const values = readExactDataObject(
    service,
    SERVICE_KEYS,
    SERVICE_KEYS,
    'INVALID_SNAPSHOT',
  );
  return Object.freeze({
    id: normalizeBoundedText(
      values.id,
      { min: 1, max: 100, pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u },
      'INVALID_SNAPSHOT',
    ),
    name: normalizeBoundedText(values.name, { min: 1, max: 160 }, 'INVALID_SNAPSHOT'),
    durationMinutes: normalizeSafeInteger(
      values.durationMinutes,
      { min: 1, max: 1440 },
      'INVALID_SNAPSHOT',
    ),
    priceMinor: normalizeSafeInteger(
      values.priceMinor,
      { min: 0, max: 999999999 },
      'INVALID_SNAPSHOT',
    ),
    currency: normalizeCurrency(values.currency, 'INVALID_SNAPSHOT'),
    minorUnitDigits: normalizeSafeInteger(
      values.minorUnitDigits,
      { min: 0, max: 3 },
      'INVALID_SNAPSHOT',
    ),
  });
}

function normalizeBookingEmailSnapshotInternal(snapshot) {
  const values = readExactDataObject(
    snapshot,
    SNAPSHOT_KEYS,
    SNAPSHOT_KEYS,
    'INVALID_SNAPSHOT',
  );
  if (values.schemaVersion !== 1) {
    fail('INVALID_SNAPSHOT');
  }
  const services = Object.freeze(
    readExactDataArray(values.services, { min: 1, max: 20 }, 'INVALID_SNAPSHOT')
      .map(normalizeService),
  );
  const serviceIds = new Set(services.map((service) => service.id));
  const currency = normalizeCurrency(values.currency, 'INVALID_SNAPSHOT');
  const minorUnitDigits = normalizeSafeInteger(
    values.minorUnitDigits,
    { min: 0, max: 3 },
    'INVALID_SNAPSHOT',
  );
  const calculatedTotal = services.reduce((sum, service) => sum + service.priceMinor, 0);
  if (
    serviceIds.size !== services.length ||
    services.some(
      (service) => service.currency !== currency || service.minorUnitDigits !== minorUnitDigits,
    ) ||
    !Number.isSafeInteger(calculatedTotal)
  ) {
    fail('INVALID_SNAPSHOT');
  }
  const totalPriceMinor = normalizeSafeInteger(
    values.totalPriceMinor,
    { min: 0, max: 999999999 },
    'INVALID_SNAPSHOT',
  );
  if (totalPriceMinor !== calculatedTotal) {
    fail('INVALID_SNAPSHOT');
  }

  const localDate = normalizeLocalDate(values.localDate, 'INVALID_SNAPSHOT');
  const localStartTime = normalizeLocalStartTime(values.localStartTime, 'INVALID_SNAPSHOT');
  const timeZone = normalizeTimeZone(values.timeZone, 'INVALID_SNAPSHOT');
  const startAt = normalizeStartAt(values.startAt, 'INVALID_SNAPSHOT');
  validateCivilInstant({
    localDate,
    localStartTime,
    timeZone,
    instant: startAt.instant,
  }, 'INVALID_SNAPSHOT');

  return Object.freeze({
    schemaVersion: 1,
    shopName: normalizeBoundedText(values.shopName, { min: 1, max: 120 }, 'INVALID_SNAPSHOT'),
    services,
    totalPriceMinor,
    currency,
    minorUnitDigits,
    localDate,
    localStartTime,
    timeZone,
    startAt: startAt.normalized,
  });
}

function normalizeBookingEmailSnapshot(snapshot) {
  return withinBoundary(
    'INVALID_SNAPSHOT',
    () => normalizeBookingEmailSnapshotInternal(snapshot),
  );
}

function normalizeRecipientEmail(value) {
  const normalized = normalizeBoundedText(
    value,
    {
      min: 3,
      max: 254,
      pattern: /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/u,
    },
    'INVALID_DELIVERY',
  );
  const [localPart, domain] = normalized.split('@');
  if (
    localPart.length > 64 ||
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    domain.length > 253
  ) {
    fail('INVALID_DELIVERY');
  }
  return normalized;
}

function normalizeDeliveryInternal(delivery) {
  const values = readExactDataObject(
    delivery,
    DELIVERY_KEYS,
    ['recipientEmail'],
    'INVALID_DELIVERY',
  );
  const normalized = {
    recipientEmail: normalizeRecipientEmail(values.recipientEmail),
    customerDisplayName: null,
  };
  if (values.customerDisplayName !== undefined) {
    normalized.customerDisplayName = normalizeBoundedText(
      values.customerDisplayName,
      { min: 1, max: 100 },
      'INVALID_DELIVERY',
    );
  }
  return Object.freeze(normalized);
}

function normalizeDelivery(delivery) {
  return withinBoundary('INVALID_DELIVERY', () => normalizeDeliveryInternal(delivery));
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatMinorAmount(priceMinor, currency, minorUnitDigits) {
  const divisor = 10 ** minorUnitDigits;
  const whole = Math.floor(priceMinor / divisor);
  if (minorUnitDigits === 0) {
    return `${currency} ${whole}`;
  }
  const fraction = String(priceMinor % divisor).padStart(minorUnitDigits, '0');
  return `${currency} ${whole}.${fraction}`;
}

function renderText(contract, snapshot, delivery) {
  const greeting = delivery.customerDisplayName
    ? `Hello ${delivery.customerDisplayName},\n\n`
    : '';
  const services = snapshot.services
    .map((service) => (
      `- ${service.name} | ${service.durationMinutes} min | ${formatMinorAmount(service.priceMinor, service.currency, service.minorUnitDigits)}`
    ))
    .join('\n');
  return [
    `${greeting}${contract.heading}`,
    contract.introduction,
    `Shop: ${snapshot.shopName}`,
    `Date: ${snapshot.localDate}`,
    `Time: ${snapshot.localStartTime} (${snapshot.timeZone})`,
    `Services:\n${services}`,
    `Total: ${formatMinorAmount(snapshot.totalPriceMinor, snapshot.currency, snapshot.minorUnitDigits)}`,
    contract.closing,
  ].join('\n\n');
}

function renderHtml(contract, snapshot, delivery) {
  const greeting = delivery.customerDisplayName
    ? `<p>Hello ${escapeHtml(delivery.customerDisplayName)},</p>`
    : '';
  const services = snapshot.services
    .map((service) => (
      `<li>${escapeHtml(service.name)} | ${service.durationMinutes} min | ${escapeHtml(formatMinorAmount(service.priceMinor, service.currency, service.minorUnitDigits))}</li>`
    ))
    .join('');
  return [
    '<!doctype html><html><body>',
    greeting,
    `<h1>${escapeHtml(contract.heading)}</h1>`,
    `<p>${escapeHtml(contract.introduction)}</p>`,
    '<dl>',
    `<dt>Shop</dt><dd>${escapeHtml(snapshot.shopName)}</dd>`,
    `<dt>Date</dt><dd>${escapeHtml(snapshot.localDate)}</dd>`,
    `<dt>Time</dt><dd>${escapeHtml(snapshot.localStartTime)} (${escapeHtml(snapshot.timeZone)})</dd>`,
    '</dl>',
    `<h2>Services</h2><ul>${services}</ul>`,
    `<p><strong>Total:</strong> ${escapeHtml(formatMinorAmount(snapshot.totalPriceMinor, snapshot.currency, snapshot.minorUnitDigits))}</p>`,
    `<p>${escapeHtml(contract.closing)}</p>`,
    '</body></html>',
  ].join('');
}

function normalizeNotification(notification) {
  return withinBoundary('INVALID_NOTIFICATION', () => readExactDataObject(
    notification,
    NOTIFICATION_KEYS,
    NOTIFICATION_KEYS,
    'INVALID_NOTIFICATION',
  ));
}

function renderBookingEmail(notificationInput, deliveryInput) {
  const notification = normalizeNotification(notificationInput);
  if (
    typeof notification.eventType !== 'string' ||
    !Object.prototype.hasOwnProperty.call(EVENT_CONTRACT, notification.eventType)
  ) {
    fail('UNSUPPORTED_EVENT_TYPE');
  }
  const contract = EVENT_CONTRACT[notification.eventType];
  const snapshot = normalizeBookingEmailSnapshot(notification.snapshot);
  const delivery = normalizeDelivery(deliveryInput);
  return withinBoundary('INVALID_NOTIFICATION', () => Object.freeze({
    to: delivery.recipientEmail,
    subject: contract.subject,
    text: renderText(contract, snapshot, delivery),
    html: renderHtml(contract, snapshot, delivery),
  }));
}

module.exports = {
  BOOKING_EMAIL_EVENT_TYPES,
  BookingEmailTemplateError,
  normalizeBookingEmailSnapshot,
  renderBookingEmail,
};
