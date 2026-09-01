'use strict';

const { types: { isProxy } } = require('node:util');

const {
  SUPPORTED_CURRENCY,
  SUPPORTED_MINOR_UNIT_DIGITS,
  resolveCurrencyPolicy,
} = require('./currency');
const { normalizeBookingEmailSnapshot } = require('./email-templates');

const SNAPSHOT_SCHEMA_VERSION = 1;
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
const TIMESTAMP_KEYS = Object.freeze(['seconds', 'nanoseconds']);

class NotificationSnapshotError extends Error {
  constructor() {
    super('Invalid booking notification snapshot source.');
    this.name = 'NotificationSnapshotError';
    this.code = 'INVALID_NOTIFICATION_SNAPSHOT_SOURCE';
    Object.freeze(this);
  }
}

function fail() {
  throw new NotificationSnapshotError();
}

function withinBoundary(operation) {
  try {
    return operation();
  } catch (error) {
    if (error instanceof NotificationSnapshotError) {
      throw error;
    }
    fail();
  }
}

function readExactDataObject(value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value)) {
    fail();
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail();
  }
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== keys.length ||
    ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key)) ||
    keys.some((key) => !ownKeys.includes(key))
  ) {
    fail();
  }
  const result = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
      descriptor.enumerable !== true
    ) {
      fail();
    }
    result[key] = descriptor.value;
  }
  return result;
}

function readExactDataArray(value, { min, max }) {
  if (!Array.isArray(value) || isProxy(value)) {
    fail();
  }
  const ownKeys = Reflect.ownKeys(value);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (
    !lengthDescriptor ||
    !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value') ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < min ||
    lengthDescriptor.value > max
  ) {
    fail();
  }
  const expectedKeys = Array.from(
    { length: lengthDescriptor.value },
    (_unused, index) => String(index),
  );
  if (
    ownKeys.some((key) => typeof key !== 'string') ||
    ownKeys.length !== expectedKeys.length + 1 ||
    ownKeys[ownKeys.length - 1] !== 'length' ||
    expectedKeys.some((key, index) => ownKeys[index] !== key)
  ) {
    fail();
  }
  return expectedKeys.map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
      descriptor.enumerable !== true
    ) {
      fail();
    }
    return descriptor.value;
  });
}

function normalizeStartAtSource(value) {
  if (typeof value === 'string') {
    return value;
  }
  const timestamp = readExactDataObject(value, TIMESTAMP_KEYS);
  if (
    !Number.isSafeInteger(timestamp.seconds) ||
    !Number.isSafeInteger(timestamp.nanoseconds) ||
    timestamp.nanoseconds < 0 ||
    timestamp.nanoseconds > 999999999 ||
    timestamp.nanoseconds % 1000000 !== 0
  ) {
    fail();
  }
  const epochMilliseconds = (
    (BigInt(timestamp.seconds) * 1000n) + BigInt(timestamp.nanoseconds / 1000000)
  );
  if (
    epochMilliseconds < BigInt(Number.MIN_SAFE_INTEGER) ||
    epochMilliseconds > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    fail();
  }
  const instant = new Date(Number(epochMilliseconds));
  if (!Number.isFinite(instant.getTime())) {
    fail();
  }
  return instant.toISOString();
}

function cloneService(value) {
  const service = readExactDataObject(value, SERVICE_KEYS);
  const currencyPolicy = resolveCurrencyPolicy(service.currency, 'service.currency');
  if (service.minorUnitDigits !== currencyPolicy.minorUnitDigits) {
    fail();
  }
  return {
    id: service.id,
    name: service.name,
    durationMinutes: service.durationMinutes,
    priceMinor: service.priceMinor,
    currency: currencyPolicy.currency,
    minorUnitDigits: currencyPolicy.minorUnitDigits,
  };
}

function buildBookingNotificationSnapshotInternal(source) {
  const values = readExactDataObject(source, SNAPSHOT_KEYS);
  const currencyPolicy = resolveCurrencyPolicy(values.currency, 'currency');
  if (
    currencyPolicy.currency !== SUPPORTED_CURRENCY ||
    currencyPolicy.minorUnitDigits !== SUPPORTED_MINOR_UNIT_DIGITS ||
    values.minorUnitDigits !== currencyPolicy.minorUnitDigits
  ) {
    fail();
  }
  const services = readExactDataArray(values.services, { min: 1, max: 20 })
    .map(cloneService);
  return normalizeBookingEmailSnapshot({
    schemaVersion: values.schemaVersion,
    shopName: values.shopName,
    services,
    totalPriceMinor: values.totalPriceMinor,
    currency: currencyPolicy.currency,
    minorUnitDigits: currencyPolicy.minorUnitDigits,
    localDate: values.localDate,
    localStartTime: values.localStartTime,
    timeZone: values.timeZone,
    startAt: normalizeStartAtSource(values.startAt),
  });
}

/**
 * Build the immutable, PII-free email snapshot from a strict projection of
 * authoritative booking data. Callers must omit scheduling-only service fields
 * such as buffers and convert interval.startAtEpochMs to canonical ISO before
 * crossing this boundary. Only inert { seconds, nanoseconds } timestamp data is
 * accepted as an alternative; executable Firebase Timestamp instances are not.
 */
function buildBookingNotificationSnapshot(source) {
  return withinBoundary(() => buildBookingNotificationSnapshotInternal(source));
}

module.exports = {
  NotificationSnapshotError,
  SNAPSHOT_SCHEMA_VERSION,
  buildBookingNotificationSnapshot,
};
