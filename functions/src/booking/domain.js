'use strict';

const { createHash } = require('node:crypto');
const { BookingError } = require('./errors');

const MINUTES_PER_DAY = 24 * 60;
const OCCUPANCY_BUCKET_MINUTES = 5;
const MAX_SERVICE_DURATION_MINUTES = 12 * 60;
const MAX_BUFFER_MINUTES = 4 * 60;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;

const BOOKING_STATUSES = Object.freeze([
  'pending',
  'confirmed',
  'completed',
  'rejected',
  'cancelled',
]);

const BOOKING_OPERATIONS = Object.freeze(['create', 'cancel', 'reschedule']);

const ALLOWED_STATUS_TRANSITIONS = Object.freeze({
  pending: Object.freeze(['confirmed', 'rejected', 'cancelled']),
  confirmed: Object.freeze(['completed', 'cancelled']),
  completed: Object.freeze([]),
  rejected: Object.freeze([]),
  cancelled: Object.freeze([]),
});

function domainError(code, message, details = {}, httpStatus = 400) {
  return new BookingError(code, message, { details, httpStatus, retryable: false });
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseLocalDate(value) {
  if (typeof value !== 'string') {
    throw domainError('INVALID_DATE', 'localDate must use YYYY-MM-DD', {
      field: 'localDate',
    });
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw domainError('INVALID_DATE', 'localDate must use YYYY-MM-DD', {
      field: 'localDate',
    });
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    throw domainError('INVALID_DATE', 'localDate is not a valid civil date', {
      field: 'localDate',
    });
  }

  return Object.freeze({ value, year, month, day });
}

function parseLocalTime(value) {
  if (typeof value !== 'string') {
    throw domainError('INVALID_TIME', 'localStartTime must use HH:mm', {
      field: 'localStartTime',
    });
  }

  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw domainError('INVALID_TIME', 'localStartTime must use HH:mm', {
      field: 'localStartTime',
    });
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw domainError('INVALID_TIME', 'localStartTime is not a valid civil time', {
      field: 'localStartTime',
    });
  }

  return Object.freeze({
    value,
    hour,
    minute,
    totalMinutes: (hour * 60) + minute,
  });
}

function normalizeEmail(value) {
  if (typeof value !== 'string') {
    throw domainError('INVALID_ARGUMENT', 'email must be a string', { field: 'email' });
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized.length === 0 ||
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+$/.test(normalized)
  ) {
    throw domainError('INVALID_ARGUMENT', 'email is not valid', { field: 'email' });
  }
  return normalized;
}

function boundedInteger(value, { field, min, max, code }) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw domainError(code, `${field} must be an integer from ${min} to ${max}`, {
      field,
      min,
      max,
    });
  }
  return value;
}

function normalizeDurationMinutes(value, field = 'durationMinutes') {
  return boundedInteger(value, {
    field,
    min: 1,
    max: MAX_SERVICE_DURATION_MINUTES,
    code: 'INVALID_DURATION',
  });
}

function normalizeBufferMinutes(value, field = 'bufferMinutes') {
  return boundedInteger(value, {
    field,
    min: 0,
    max: MAX_BUFFER_MINUTES,
    code: 'INVALID_DURATION',
  });
}

function sumServiceDuration(services) {
  if (!Array.isArray(services) || services.length === 0) {
    throw domainError('INVALID_ARGUMENT', 'services must be a non-empty array', {
      field: 'services',
    });
  }

  let total = 0;
  for (let index = 0; index < services.length; index += 1) {
    const service = services[index];
    const value = typeof service === 'number' ? service : service?.durationMinutes;
    total += normalizeDurationMinutes(value, `services[${index}].durationMinutes`);
    if (total > MAX_SERVICE_DURATION_MINUTES) {
      throw domainError(
        'INVALID_DURATION',
        `combined service duration must not exceed ${MAX_SERVICE_DURATION_MINUTES}`,
        { field: 'services', max: MAX_SERVICE_DURATION_MINUTES },
      );
    }
  }
  return total;
}

function assertMinute(value, field) {
  if (!Number.isInteger(value) || value < 0 || value > MINUTES_PER_DAY) {
    throw domainError('INVALID_ARGUMENT', `${field} must be a civil-day minute`, {
      field,
    });
  }
  return value;
}

function intervalsOverlap(startA, endA, startB, endB) {
  assertMinute(startA, 'startA');
  assertMinute(endA, 'endA');
  assertMinute(startB, 'startB');
  assertMinute(endB, 'endB');
  if (startA >= endA || startB >= endB) {
    throw domainError('INVALID_ARGUMENT', 'intervals must have positive duration');
  }
  return startA < endB && startB < endA;
}

function buildOccupancyWindow({
  localDate,
  localStartTime,
  durationMinutes,
  bufferBeforeMinutes = 0,
  bufferAfterMinutes = 0,
}) {
  const date = parseLocalDate(localDate);
  const time = parseLocalTime(localStartTime);
  if (time.totalMinutes % OCCUPANCY_BUCKET_MINUTES !== 0) {
    throw domainError(
      'INVALID_TIME',
      `localStartTime must align to ${OCCUPANCY_BUCKET_MINUTES} minutes`,
      { field: 'localStartTime', incrementMinutes: OCCUPANCY_BUCKET_MINUTES },
    );
  }
  const duration = normalizeDurationMinutes(durationMinutes);
  const bufferBefore = normalizeBufferMinutes(bufferBeforeMinutes, 'bufferBeforeMinutes');
  const bufferAfter = normalizeBufferMinutes(bufferAfterMinutes, 'bufferAfterMinutes');
  const serviceEndMinute = time.totalMinutes + duration;
  const occupiedStartMinute = time.totalMinutes - bufferBefore;
  const occupiedEndMinute = serviceEndMinute + bufferAfter;

  if (serviceEndMinute > MINUTES_PER_DAY) {
    throw domainError(
      'INVALID_DURATION',
      'service duration must end within the selected local date',
      { field: 'durationMinutes', localDate: date.value },
    );
  }

  if (occupiedStartMinute < 0 || occupiedEndMinute > MINUTES_PER_DAY) {
    throw domainError(
      'OUTSIDE_AVAILABILITY',
      'booking occupancy must remain within one local date',
      { localDate: date.value },
      422,
    );
  }

  return Object.freeze({
    localDate: date.value,
    localStartTime: time.value,
    startMinute: time.totalMinutes,
    endMinute: serviceEndMinute,
    occupiedStartMinute,
    occupiedEndMinute,
    durationMinutes: duration,
    bufferBeforeMinutes: bufferBefore,
    bufferAfterMinutes: bufferAfter,
  });
}

function formatMinute(value) {
  assertMinute(value, 'minute');
  if (value === MINUTES_PER_DAY) {
    return '24:00';
  }
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function createOccupancyBuckets(input) {
  const window = buildOccupancyWindow(input);
  const firstBucket = Math.floor(window.occupiedStartMinute / OCCUPANCY_BUCKET_MINUTES)
    * OCCUPANCY_BUCKET_MINUTES;
  const bucketLimit = Math.ceil(window.occupiedEndMinute / OCCUPANCY_BUCKET_MINUTES)
    * OCCUPANCY_BUCKET_MINUTES;
  const buckets = [];

  for (
    let startMinute = firstBucket;
    startMinute < bucketLimit;
    startMinute += OCCUPANCY_BUCKET_MINUTES
  ) {
    const endMinute = startMinute + OCCUPANCY_BUCKET_MINUTES;
    buckets.push(Object.freeze({
      localDate: window.localDate,
      startMinute,
      endMinute,
      startTime: formatMinute(startMinute),
      endTime: formatMinute(endMinute),
    }));
  }

  return Object.freeze(buckets);
}

function canonicalSerialize(value) {
  const seen = new WeakSet();

  function serialize(entry) {
    if (entry === null || typeof entry === 'boolean' || typeof entry === 'string') {
      return JSON.stringify(entry);
    }

    if (typeof entry === 'number') {
      if (!Number.isFinite(entry)) {
        throw domainError('INVALID_ARGUMENT', 'canonical values require finite numbers');
      }
      return JSON.stringify(Object.is(entry, -0) ? 0 : entry);
    }

    if (typeof entry !== 'object') {
      throw domainError('INVALID_ARGUMENT', 'value is not canonically serializable');
    }

    if (seen.has(entry)) {
      throw domainError('INVALID_ARGUMENT', 'canonical values must not contain cycles');
    }
    seen.add(entry);

    let result;
    if (Array.isArray(entry)) {
      for (let index = 0; index < entry.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(entry, index)) {
          throw domainError('INVALID_ARGUMENT', 'canonical arrays must not be sparse');
        }
      }
      result = `[${entry.map(serialize).join(',')}]`;
    } else {
      const prototype = Object.getPrototypeOf(entry);
      if (prototype !== Object.prototype && prototype !== null) {
        throw domainError('INVALID_ARGUMENT', 'canonical values require plain objects');
      }
      const keys = Object.keys(entry).sort();
      result = `{${keys.map((key) => `${JSON.stringify(key)}:${serialize(entry[key])}`).join(',')}}`;
    }

    seen.delete(entry);
    return result;
  }

  return serialize(value);
}

function sha256Canonical(value) {
  return createHash('sha256').update(canonicalSerialize(value), 'utf8').digest('hex');
}

function validateIdempotencyKey(value) {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw domainError(
      'INVALID_IDEMPOTENCY_KEY',
      'idempotencyKey must be 16 to 128 URL-safe characters',
      { field: 'idempotencyKey', minLength: 16, maxLength: 128 },
    );
  }
  return value;
}

function normalizeIdentifier(value, field) {
  if (typeof value !== 'string') {
    throw domainError('INVALID_ARGUMENT', `${field} must be a string`, { field });
  }
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 128 || /[\u0000-\u001f/]/.test(normalized)) {
    throw domainError('INVALID_ARGUMENT', `${field} is not valid`, { field });
  }
  return normalized;
}

function createCommandId({ operation, actorId, idempotencyKey }) {
  if (!BOOKING_OPERATIONS.includes(operation)) {
    throw domainError('INVALID_ARGUMENT', 'operation is not part of booking v2', {
      field: 'operation',
    });
  }
  return sha256Canonical({
    scope: 'booking-command:v2',
    operation,
    actorId: normalizeIdentifier(actorId, 'actorId'),
    idempotencyKey: validateIdempotencyKey(idempotencyKey),
  });
}

function createRequestHash(request) {
  return sha256Canonical({ scope: 'booking-request:v2', request });
}

function createOccupancyId({ shopId, resourceId, localDate, bucketStartMinute }) {
  const date = parseLocalDate(localDate);
  const bucket = assertMinute(bucketStartMinute, 'bucketStartMinute');
  if (bucket === MINUTES_PER_DAY || bucket % OCCUPANCY_BUCKET_MINUTES !== 0) {
    throw domainError(
      'INVALID_ARGUMENT',
      `bucketStartMinute must align to ${OCCUPANCY_BUCKET_MINUTES} minutes`,
      { field: 'bucketStartMinute' },
    );
  }

  return sha256Canonical({
    scope: 'booking-occupancy:v2',
    shopId: normalizeIdentifier(shopId, 'shopId'),
    resourceId: normalizeIdentifier(resourceId, 'resourceId'),
    localDate: date.value,
    bucketStartMinute: bucket,
  });
}

function resolveResourceCandidates({ shopId, preferredEmployeeId, employees }) {
  const normalizedShopId = normalizeIdentifier(shopId, 'shopId');
  if (!Array.isArray(employees)) {
    throw domainError(
      'SHOP_RESOURCE_CONFIG_REQUIRED',
      'employee roster must be an array',
      { field: 'employees' },
      422,
    );
  }

  const seenIds = new Set();
  const activeIds = [];
  for (let index = 0; index < employees.length; index += 1) {
    const employee = employees[index];
    if (
      employee === null ||
      typeof employee !== 'object' ||
      Array.isArray(employee)
    ) {
      throw domainError(
        'SHOP_RESOURCE_CONFIG_REQUIRED',
        'employee roster contains a malformed entry',
        { field: `employees[${index}]` },
        422,
      );
    }

    const hasActiveFlag = Object.prototype.hasOwnProperty.call(employee, 'active');
    const hasStatus = Object.prototype.hasOwnProperty.call(employee, 'status');
    if (
      (hasActiveFlag && typeof employee.active !== 'boolean') ||
      (hasStatus && typeof employee.status !== 'string')
    ) {
      throw domainError(
        'SHOP_RESOURCE_CONFIG_REQUIRED',
        'employee roster contains a malformed activity flag',
        { field: `employees[${index}]` },
        422,
      );
    }

    let employeeId;
    try {
      employeeId = normalizeIdentifier(employee.id, `employees[${index}].id`);
    } catch (error) {
      if (error instanceof BookingError) {
        throw domainError(
          'SHOP_RESOURCE_CONFIG_REQUIRED',
          'employee roster contains a malformed identifier',
          { field: `employees[${index}].id` },
          422,
        );
      }
      throw error;
    }

    if (seenIds.has(employeeId)) {
      throw domainError(
        'SHOP_RESOURCE_CONFIG_REQUIRED',
        'employee roster contains duplicate identifiers',
        { field: `employees[${index}].id` },
        422,
      );
    }
    seenIds.add(employeeId);
    const normalizedStatus = hasStatus ? employee.status.trim().toLowerCase() : '';
    const isInactive = employee.active === false ||
      normalizedStatus === 'inactive' ||
      normalizedStatus === 'disabled';
    if (!isInactive) {
      activeIds.push(employeeId);
    }
  }

  if (preferredEmployeeId !== undefined && preferredEmployeeId !== null) {
    const preferred = normalizeIdentifier(preferredEmployeeId, 'preferredEmployeeId');
    if (!seenIds.has(preferred)) {
      throw domainError(
        'EMPLOYEE_NOT_FOUND',
        'preferred employee does not exist',
        { field: 'preferredEmployeeId' },
        404,
      );
    }
    if (!activeIds.includes(preferred)) {
      throw domainError(
        'EMPLOYEE_UNAVAILABLE',
        'preferred employee is not active',
        { field: 'preferredEmployeeId' },
        422,
      );
    }
    return Object.freeze([`employee:${preferred}`]);
  }

  if (employees.length === 0) {
    return Object.freeze([`shop:${normalizedShopId}:primary`]);
  }

  if (activeIds.length === 0) {
    throw domainError(
      'EMPLOYEE_UNAVAILABLE',
      'employee roster has no active resource',
      { field: 'employees' },
      422,
    );
  }

  activeIds.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return Object.freeze(activeIds.map((employeeId) => `employee:${employeeId}`));
}

function normalizeBookingStatus(status) {
  if (typeof status !== 'string' || !BOOKING_STATUSES.includes(status)) {
    throw domainError('INVALID_ARGUMENT', 'booking status is not part of v2', {
      field: 'status',
    });
  }
  return status;
}

function assertStatusTransition(currentStatus, nextStatus) {
  const current = normalizeBookingStatus(currentStatus);
  const next = normalizeBookingStatus(nextStatus);
  if (!ALLOWED_STATUS_TRANSITIONS[current].includes(next)) {
    throw domainError(
      'INVALID_STATUS_TRANSITION',
      `booking cannot transition from ${current} to ${next}`,
      { currentStatus: current, nextStatus: next },
      409,
    );
  }
  return next;
}

function statusAfterReschedule(status) {
  const normalized = normalizeBookingStatus(status);
  if (normalized !== 'pending' && normalized !== 'confirmed') {
    throw domainError(
      'INVALID_STATUS_TRANSITION',
      `booking cannot be rescheduled from ${normalized}`,
      { currentStatus: normalized, operation: 'reschedule' },
      409,
    );
  }
  return normalized;
}

function isCapacityBlockingStatus(status) {
  if (status === undefined || status === null || status === '') {
    return true;
  }
  if (typeof status !== 'string') {
    return true;
  }
  const normalized = status.trim().toLowerCase();
  return normalized !== 'cancelled' &&
    normalized !== 'rejected' &&
    normalized !== 'completed';
}

module.exports = {
  ALLOWED_STATUS_TRANSITIONS,
  BOOKING_OPERATIONS,
  BOOKING_STATUSES,
  MAX_BUFFER_MINUTES,
  MAX_SERVICE_DURATION_MINUTES,
  MINUTES_PER_DAY,
  OCCUPANCY_BUCKET_MINUTES,
  assertStatusTransition,
  buildOccupancyWindow,
  canonicalSerialize,
  createCommandId,
  createOccupancyBuckets,
  createOccupancyId,
  createRequestHash,
  intervalsOverlap,
  isCapacityBlockingStatus,
  normalizeBufferMinutes,
  normalizeDurationMinutes,
  normalizeEmail,
  parseLocalDate,
  parseLocalTime,
  resolveResourceCandidates,
  sha256Canonical,
  statusAfterReschedule,
  sumServiceDuration,
  validateIdempotencyKey,
};
