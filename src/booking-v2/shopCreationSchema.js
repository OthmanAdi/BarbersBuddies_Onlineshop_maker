const WEEKDAYS = Object.freeze([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

const ENGLISH_WEEKDAY_KEYS = Object.freeze({
  Monday: 'monday',
  Tuesday: 'tuesday',
  Wednesday: 'wednesday',
  Thursday: 'thursday',
  Friday: 'friday',
  Saturday: 'saturday',
  Sunday: 'sunday',
  monday: 'monday',
  tuesday: 'tuesday',
  wednesday: 'wednesday',
  thursday: 'thursday',
  friday: 'friday',
  saturday: 'saturday',
  sunday: 'sunday',
});

const MAX_IDENTIFIER_LENGTH = 128;
const MAX_SERVICE_DURATION_MINUTES = 12 * 60;
const MAX_BUFFER_MINUTES = 4 * 60;
const RESERVED_IDENTIFIERS = new Set(['__proto__', 'constructor', 'prototype']);
const SHOP_KEYS = new Set([
  'availability',
  'bookingPolicy',
  'currency',
  'employees',
  'services',
  'timeZone',
  'weeklyAvailability',
]);
const POLICY_KEYS = new Set([
  'cancellationNoticeMinutes',
  'consentVersion',
  'guestBookingEnabled',
]);
const SERVICE_KEYS = new Set([
  'active',
  'bufferAfterMinutes',
  'bufferBeforeMinutes',
  'currency',
  'description',
  'duration',
  'durationMinutes',
  'id',
  'imageUrls',
  'name',
  'price',
  'priceMinor',
]);
const EMPLOYEE_KEYS = new Set([
  'active',
  'bookable',
  'expertise',
  'id',
  'name',
  'photo',
  'schedule',
  'serviceIds',
  'weeklyAvailability',
]);
const CANONICAL_INTERVAL_KEYS = new Set(['endLocalTime', 'startLocalTime']);
const LEGACY_INTERVAL_KEYS = new Set(['close', 'open', 'slotDuration']);

export class ShopCreationSchemaError extends Error {
  constructor(code, message, field, details = {}) {
    super(message);
    this.name = 'ShopCreationSchemaError';
    this.code = code;
    this.field = field;
    this.details = Object.freeze({ field, ...details });
  }
}

function schemaError(code, message, field, details) {
  return new ShopCreationSchemaError(code, message, field, details);
}

function strictDataError(field, code = 'INVALID_ARGUMENT') {
  return schemaError(code, `${field} must contain only declared plain data fields`, field);
}

function ownDescriptors(value, field, code = 'INVALID_ARGUMENT') {
  try {
    return Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    throw strictDataError(field, code);
  }
}

function requirePlainObject(value, field, allowedKeys, code = 'INVALID_ARGUMENT') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw strictDataError(field, code);
  }

  let prototype;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch (error) {
    throw strictDataError(field, code);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw strictDataError(field, code);
  }

  const descriptors = ownDescriptors(value, field, code);
  const copy = Object.create(null);
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key];
    if (
      typeof key !== 'string' ||
      key === '__proto__' ||
      descriptor.enumerable !== true ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
      (allowedKeys && !allowedKeys.has(key))
    ) {
      throw strictDataError(field, code);
    }
    Object.defineProperty(copy, key, {
      configurable: false,
      enumerable: true,
      value: descriptor.value,
      writable: false,
    });
  }
  return copy;
}

function requireDenseArray(value, field, { allowEmpty = true, code = 'INVALID_ARGUMENT' } = {}) {
  if (!Array.isArray(value)) {
    throw schemaError(code, `${field} must be a dense data-only array`, field);
  }

  let prototype;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch (error) {
    throw schemaError(code, `${field} must be a dense data-only array`, field);
  }
  if (prototype !== Array.prototype) {
    throw schemaError(code, `${field} must be a dense data-only array`, field);
  }

  const descriptors = ownDescriptors(value, field, code);
  const lengthDescriptor = descriptors.length;
  if (
    !lengthDescriptor ||
    !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value') ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    (!allowEmpty && lengthDescriptor.value === 0)
  ) {
    throw schemaError(code, `${field} must be a dense data-only array`, field);
  }

  const length = lengthDescriptor.value;
  const elements = new Array(length);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (key === 'length') {
      continue;
    }
    const descriptor = descriptors[key];
    if (
      typeof key !== 'string' ||
      !/^(0|[1-9]\d*)$/.test(key) ||
      Number(key) >= length ||
      descriptor.enumerable !== true ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      throw schemaError(code, `${field} must be a dense data-only array`, field);
    }
    elements[Number(key)] = descriptor.value;
  }
  for (let index = 0; index < length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(elements, index)) {
      throw schemaError(code, `${field} must be a dense data-only array`, field);
    }
  }
  return elements;
}

function canonicalIdentifier(value, field) {
  const containsControlCharacter = typeof value === 'string' &&
    Array.from(value).some((character) => character.charCodeAt(0) <= 31);
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_IDENTIFIER_LENGTH ||
    value !== value.trim() ||
    containsControlCharacter ||
    value.includes('/') ||
    RESERVED_IDENTIFIERS.has(value)
  ) {
    throw schemaError('INVALID_ARGUMENT', `${field} must be a canonical identifier`, field);
  }
  return value;
}

function boundedText(value, field, maxLength = 160) {
  if (typeof value !== 'string') {
    throw schemaError('INVALID_ARGUMENT', `${field} must be a string`, field);
  }
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw schemaError(
      'INVALID_ARGUMENT',
      `${field} must contain 1 to ${maxLength} characters`,
      field,
      { maxLength },
    );
  }
  return normalized;
}

function safeInteger(value, field, { min, max = Number.MAX_SAFE_INTEGER, code }) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw schemaError(
      code,
      `${field} must be a safe integer from ${min} to ${max}`,
      field,
      { min, max },
    );
  }
  return value;
}

function decimalString(value, field) {
  if (typeof value !== 'string' || value !== value.trim()) {
    throw schemaError(
      'INVALID_ARGUMENT',
      `${field} must be an unformatted decimal string`,
      field,
    );
  }
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) {
    throw schemaError(
      'INVALID_ARGUMENT',
      `${field} must use a nonnegative decimal with at most two fraction digits`,
      field,
    );
  }
  return match;
}

export function priceToMinorUnits(value, field = 'price') {
  const match = decimalString(value, field);
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const minorDigits = `${match[1]}${fraction || '00'}`.replace(/^0+(?=\d)/, '');
  const maxSafeDigits = String(Number.MAX_SAFE_INTEGER);
  if (
    minorDigits.length > maxSafeDigits.length ||
    (minorDigits.length === maxSafeDigits.length && minorDigits > maxSafeDigits)
  ) {
    throw schemaError(
      'INVALID_ARGUMENT',
      `${field} is too large to store safely`,
      field,
      { maxMinor: Number.MAX_SAFE_INTEGER },
    );
  }
  return Number(minorDigits);
}

function canonicalCurrency(value, field) {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) {
    throw schemaError(
      'INVALID_ARGUMENT',
      `${field} must be an explicit uppercase three-letter currency code`,
      field,
    );
  }
  return value;
}

function canonicalTimeZone(value, field) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value !== value.trim() ||
    /^[+-]\d{2}(?::?\d{2})?$/.test(value)
  ) {
    throw schemaError(
      'SHOP_TIMEZONE_REQUIRED',
      `${field} must be an explicit valid IANA time zone`,
      field,
    );
  }

  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value })
      .resolvedOptions()
      .timeZone;
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) {
      throw schemaError(
        'SHOP_TIMEZONE_REQUIRED',
        `${field} must be an explicit valid IANA time zone`,
        field,
      );
    }
    throw error;
  }
}

function parseLocalTime(value, field) {
  if (typeof value !== 'string') {
    throw schemaError('INVALID_ARGUMENT', `${field} must use HH:mm`, field);
  }
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw schemaError('INVALID_ARGUMENT', `${field} must use HH:mm`, field);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw schemaError('INVALID_ARGUMENT', `${field} must be a valid local time`, field);
  }
  return Object.freeze({ value, minuteOfDay: (hour * 60) + minute });
}

function normalizeInterval(value, field) {
  const shape = requirePlainObject(value, field);
  const shapeKeys = Object.keys(shape);
  const usesCanonicalShape =
    Object.prototype.hasOwnProperty.call(shape, 'startLocalTime') ||
    Object.prototype.hasOwnProperty.call(shape, 'endLocalTime');
  const usesLegacyShopShape =
    Object.prototype.hasOwnProperty.call(shape, 'open') ||
    Object.prototype.hasOwnProperty.call(shape, 'close');

  if (usesCanonicalShape === usesLegacyShopShape) {
    throw schemaError(
      'INVALID_ARGUMENT',
      `${field} must contain exactly startLocalTime/endLocalTime or open/close`,
      field,
    );
  }

  const allowedKeys = usesCanonicalShape ? CANONICAL_INTERVAL_KEYS : LEGACY_INTERVAL_KEYS;
  if (shapeKeys.some((key) => !allowedKeys.has(key))) {
    throw strictDataError(field);
  }
  const interval = requirePlainObject(value, field, allowedKeys);

  const startField = usesCanonicalShape ? 'startLocalTime' : 'open';
  const endField = usesCanonicalShape ? 'endLocalTime' : 'close';
  const start = parseLocalTime(interval[startField], `${field}.${startField}`);
  const end = parseLocalTime(interval[endField], `${field}.${endField}`);
  if (start.minuteOfDay >= end.minuteOfDay) {
    throw schemaError(
      'OUTSIDE_AVAILABILITY',
      `${field} must be a non-overnight half-open interval`,
      field,
    );
  }

  return Object.freeze({
    startLocalTime: start.value,
    endLocalTime: end.value,
  });
}

function normalizeDay(value, field) {
  if (value === null || value === undefined) {
    return Object.freeze([]);
  }

  const source = Array.isArray(value) ? requireDenseArray(value, field) : [value];
  const intervals = source.map((interval, index) => {
    if (typeof interval === 'number') {
      throw schemaError(
        'OUTSIDE_AVAILABILITY',
        `${field} uses ambiguous inclusive integer hours; explicit half-open ranges are required`,
        `${field}[${index}]`,
      );
    }
    return normalizeInterval(interval, `${field}[${index}]`);
  });

  intervals.sort((left, right) =>
    left.startLocalTime.localeCompare(right.startLocalTime) ||
    left.endLocalTime.localeCompare(right.endLocalTime));

  for (let index = 1; index < intervals.length; index += 1) {
    if (intervals[index].startLocalTime < intervals[index - 1].endLocalTime) {
      throw schemaError(
        'OUTSIDE_AVAILABILITY',
        `${field} contains overlapping intervals`,
        `${field}[${index}]`,
      );
    }
  }
  return Object.freeze(intervals);
}

export function normalizeWeeklyAvailability(value, field = 'weeklyAvailability') {
  const source = requirePlainObject(value, field);
  const normalized = Object.fromEntries(WEEKDAYS.map((day) => [day, Object.freeze([])]));
  const seen = new Set();

  for (const key of Object.keys(source)) {
    const canonicalDay = ENGLISH_WEEKDAY_KEYS[key];
    if (!canonicalDay) {
      throw schemaError(
        'OUTSIDE_AVAILABILITY',
        `${field} contains a non-canonical or localized weekday`,
        `${field}.${key}`,
      );
    }
    if (seen.has(canonicalDay)) {
      throw schemaError(
        'OUTSIDE_AVAILABILITY',
        `${field} contains the same weekday more than once`,
        `${field}.${key}`,
      );
    }
    seen.add(canonicalDay);
    normalized[canonicalDay] = normalizeDay(source[key], `${field}.${key}`);
  }

  return Object.freeze(normalized);
}

function normalizePolicy(value, field) {
  const policy = requirePlainObject(value, field, POLICY_KEYS);
  if (typeof policy.guestBookingEnabled !== 'boolean') {
    throw schemaError(
      'INVALID_ARGUMENT',
      `${field}.guestBookingEnabled must be an explicit boolean`,
      `${field}.guestBookingEnabled`,
    );
  }
  const cancellationNoticeMinutes = safeInteger(
    policy.cancellationNoticeMinutes,
    `${field}.cancellationNoticeMinutes`,
    { min: 0, code: 'INVALID_ARGUMENT' },
  );
  const consentVersion = canonicalIdentifier(
    policy.consentVersion,
    `${field}.consentVersion`,
  );

  return Object.freeze({
    guestBookingEnabled: policy.guestBookingEnabled,
    cancellationNoticeMinutes,
    consentVersion,
  });
}

function serviceId(service, index, idFactory) {
  const field = `services[${index}].id`;
  if (service.id !== undefined && service.id !== null) {
    return canonicalIdentifier(service.id, field);
  }
  if (typeof idFactory !== 'function') {
    throw schemaError('INVALID_ARGUMENT', `${field} is required`, field);
  }

  let generated;
  try {
    generated = idFactory({ kind: 'service', index, service });
  } catch (error) {
    throw schemaError('INVALID_ARGUMENT', `${field} could not be generated`, field);
  }
  return canonicalIdentifier(generated, field);
}

function durationFromService(service, index) {
  const field = `services[${index}].durationMinutes`;
  let value = service.durationMinutes;
  let legacyDuration;
  if (service.duration !== undefined) {
    if (typeof service.duration !== 'string' || !/^\d+$/.test(service.duration)) {
      throw schemaError(
        'INVALID_DURATION',
        `services[${index}].duration must be an integer-minute display string`,
        `services[${index}].duration`,
      );
    }
    legacyDuration = Number(service.duration);
  }
  if (value === undefined) {
    value = legacyDuration;
  }
  const normalized = safeInteger(value, field, {
    min: 1,
    max: MAX_SERVICE_DURATION_MINUTES,
    code: 'INVALID_DURATION',
  });
  if (legacyDuration !== undefined && legacyDuration !== normalized) {
    throw schemaError(
      'INVALID_DURATION',
      `services[${index}] contains conflicting duration fields`,
      `services[${index}].duration`,
    );
  }
  return normalized;
}

function optionalBoolean(value, field, fallback) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'boolean') {
    throw schemaError('INVALID_ARGUMENT', `${field} must be a boolean`, field);
  }
  return value;
}

function optionalText(value, field, maxLength) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.length > maxLength) {
    throw schemaError(
      'INVALID_ARGUMENT',
      `${field} must be a string no longer than ${maxLength} characters`,
      field,
      { maxLength },
    );
  }
  return value;
}

function optionalStringArray(value, field) {
  if (value === undefined) {
    return undefined;
  }
  const items = requireDenseArray(value, field);
  return Object.freeze(items.map((item, index) => {
    if (typeof item !== 'string') {
      throw schemaError(
        'INVALID_ARGUMENT',
        `${field} must contain only strings`,
        `${field}[${index}]`,
      );
    }
    return item;
  }));
}

function normalizeServices(services, currency, idFactory) {
  const serviceItems = requireDenseArray(services, 'services', { allowEmpty: false });

  const seenIds = new Set();
  return Object.freeze(serviceItems.map((rawService, index) => {
    const service = requirePlainObject(rawService, `services[${index}]`, SERVICE_KEYS);
    const id = serviceId(service, index, idFactory);
    if (seenIds.has(id)) {
      throw schemaError(
        'INVALID_ARGUMENT',
        'service identifiers must be unique',
        `services[${index}].id`,
        { duplicateId: id },
      );
    }
    seenIds.add(id);

    const name = boundedText(service.name, `services[${index}].name`);
    const durationMinutes = durationFromService(service, index);
    const bufferBeforeMinutes = safeInteger(
      service.bufferBeforeMinutes ?? 0,
      `services[${index}].bufferBeforeMinutes`,
      { min: 0, max: MAX_BUFFER_MINUTES, code: 'INVALID_DURATION' },
    );
    const bufferAfterMinutes = safeInteger(
      service.bufferAfterMinutes ?? 0,
      `services[${index}].bufferAfterMinutes`,
      { min: 0, max: MAX_BUFFER_MINUTES, code: 'INVALID_DURATION' },
    );
    const priceMinor = priceToMinorUnits(service.price, `services[${index}].price`);
    if (service.priceMinor !== undefined && service.priceMinor !== priceMinor) {
      throw schemaError(
        'INVALID_ARGUMENT',
        `services[${index}] contains conflicting price fields`,
        `services[${index}].priceMinor`,
      );
    }
    if (
      service.currency !== undefined &&
      canonicalCurrency(service.currency, `services[${index}].currency`) !== currency
    ) {
      throw schemaError(
        'INVALID_ARGUMENT',
        `services[${index}].currency must match the shop currency`,
        `services[${index}].currency`,
      );
    }
    const description = optionalText(service.description, `services[${index}].description`, 4000);
    const imageUrls = optionalStringArray(service.imageUrls, `services[${index}].imageUrls`);

    return Object.freeze({
      id,
      name,
      active: optionalBoolean(service.active, `services[${index}].active`, true),
      durationMinutes,
      bufferBeforeMinutes,
      bufferAfterMinutes,
      priceMinor,
      currency,
      // Retain display fields while adding the authoritative booking fields.
      price: service.price,
      duration: String(durationMinutes),
      ...(description !== undefined ? { description } : {}),
      ...(imageUrls !== undefined ? { imageUrls } : {}),
    });
  }));
}

function canonicalServiceIds(value, field, knownServiceIds) {
  const serviceIds = requireDenseArray(value, field, {
    allowEmpty: false,
    code: 'SHOP_RESOURCE_CONFIG_REQUIRED',
  });
  const seen = new Set();
  return Object.freeze(serviceIds.map((rawId, index) => {
    let id;
    try {
      id = canonicalIdentifier(rawId, `${field}[${index}]`);
    } catch (error) {
      if (error instanceof ShopCreationSchemaError) {
        throw schemaError(
          'SHOP_RESOURCE_CONFIG_REQUIRED',
          `${field} contains a malformed service identifier`,
          error.field,
        );
      }
      throw error;
    }
    if (seen.has(id)) {
      throw schemaError(
        'SHOP_RESOURCE_CONFIG_REQUIRED',
        `${field} contains a duplicate service identifier`,
        `${field}[${index}]`,
        { duplicateId: id },
      );
    }
    if (!knownServiceIds.has(id)) {
      throw schemaError(
        'SHOP_RESOURCE_CONFIG_REQUIRED',
        `${field} references an unknown service`,
        `${field}[${index}]`,
        { serviceId: id },
      );
    }
    seen.add(id);
    return id;
  }));
}

function normalizeEmployees(employees, services) {
  const employeeItems = requireDenseArray(employees, 'employees', {
    code: 'SHOP_RESOURCE_CONFIG_REQUIRED',
  });
  const knownServiceIds = new Set(services.map((service) => service.id));
  const seenEmployeeIds = new Set();

  return Object.freeze(employeeItems.map((rawEmployee, index) => {
    const field = `employees[${index}]`;
    const employee = requirePlainObject(
      rawEmployee,
      field,
      EMPLOYEE_KEYS,
      'SHOP_RESOURCE_CONFIG_REQUIRED',
    );
    let id;
    try {
      id = canonicalIdentifier(employee.id, `${field}.id`);
    } catch (error) {
      if (error instanceof ShopCreationSchemaError) {
        throw schemaError(
          'SHOP_RESOURCE_CONFIG_REQUIRED',
          `${field}.id must be a canonical stable identifier`,
          `${field}.id`,
        );
      }
      throw error;
    }
    if (seenEmployeeIds.has(id)) {
      throw schemaError(
        'SHOP_RESOURCE_CONFIG_REQUIRED',
        'employee identifiers must be unique',
        `${field}.id`,
        { duplicateId: id },
      );
    }
    seenEmployeeIds.add(id);

    const scheduleSource = employee.weeklyAvailability ?? employee.schedule;
    if (scheduleSource === undefined) {
      throw schemaError(
        'SHOP_RESOURCE_CONFIG_REQUIRED',
        `${field}.weeklyAvailability is required`,
        `${field}.weeklyAvailability`,
      );
    }
    const scheduleField = employee.weeklyAvailability === undefined
      ? `${field}.schedule`
      : `${field}.weeklyAvailability`;
    const weeklyAvailability = normalizeWeeklyAvailability(scheduleSource, scheduleField);

    // If both exist, validate the legacy field too rather than carrying an
    // ambiguous or localized schedule alongside an authoritative one.
    let legacySchedule;
    if (employee.schedule !== undefined) {
      legacySchedule = normalizeWeeklyAvailability(employee.schedule, `${field}.schedule`);
      if (
        employee.weeklyAvailability !== undefined &&
        JSON.stringify(legacySchedule) !== JSON.stringify(weeklyAvailability)
      ) {
        throw schemaError(
          'SHOP_RESOURCE_CONFIG_REQUIRED',
          `${field} contains conflicting schedule fields`,
          `${field}.schedule`,
        );
      }
    }

    const expertise = optionalStringArray(employee.expertise, `${field}.expertise`);
    const photo = optionalText(employee.photo, `${field}.photo`, 2048);
    return Object.freeze({
      id,
      name: boundedText(employee.name, `${field}.name`),
      active: optionalBoolean(employee.active, `${field}.active`, true),
      bookable: optionalBoolean(employee.bookable, `${field}.bookable`, true),
      serviceIds: canonicalServiceIds(employee.serviceIds, `${field}.serviceIds`, knownServiceIds),
      weeklyAvailability,
      ...(legacySchedule !== undefined ? { schedule: legacySchedule } : {}),
      ...(expertise !== undefined ? { expertise } : {}),
      ...(photo !== undefined ? { photo } : {}),
    });
  }));
}

function copyLegacyShopAvailability(value) {
  if (value === undefined) {
    return undefined;
  }
  const source = requirePlainObject(value, 'availability');
  return Object.freeze(Object.fromEntries(Object.entries(source).map(([day, hours]) => {
    if (hours === null) {
      return [day, null];
    }
    const interval = requirePlainObject(
      hours,
      `availability.${day}`,
      LEGACY_INTERVAL_KEYS,
    );
    const normalized = normalizeInterval(interval, `availability.${day}`);
    let slotDuration;
    if (interval.slotDuration !== undefined) {
      slotDuration = safeInteger(
        interval.slotDuration,
        `availability.${day}.slotDuration`,
        { min: 1, max: MAX_SERVICE_DURATION_MINUTES, code: 'INVALID_DURATION' },
      );
    }
    return [day, Object.freeze({
      open: normalized.startLocalTime,
      close: normalized.endLocalTime,
      ...(slotDuration !== undefined ? { slotDuration } : {}),
    })];
  })));
}

/**
 * Returns an additive booking-v2 patch only. The caller must merge it into a
 * separately validated shop document containing ownerId, name, email and all
 * other non-booking fields. This patch is not a complete writable shop record.
 */
export function serializeBookingV2ShopCreation(draft, options = {}) {
  const normalizedOptions = requirePlainObject(options, 'options', new Set(['idFactory']));
  const idFactory = normalizedOptions.idFactory;
  const source = requirePlainObject(draft, 'shop', SHOP_KEYS);
  const currency = canonicalCurrency(source.currency, 'currency');
  const services = normalizeServices(source.services, currency, idFactory);
  const hasWeeklyAvailability = Object.prototype.hasOwnProperty.call(
    source,
    'weeklyAvailability',
  );
  const availabilitySource = hasWeeklyAvailability
    ? source.weeklyAvailability
    : source.availability;
  if (availabilitySource === undefined) {
    throw schemaError(
      'OUTSIDE_AVAILABILITY',
      'weeklyAvailability or availability is required',
      'weeklyAvailability',
    );
  }

  const legacyAvailability = copyLegacyShopAvailability(source.availability);
  const weeklyAvailability = normalizeWeeklyAvailability(
    availabilitySource,
      hasWeeklyAvailability ? 'weeklyAvailability' : 'availability',
  );
  if (hasWeeklyAvailability && source.availability !== undefined) {
    const normalizedLegacyAvailability = normalizeWeeklyAvailability(
      source.availability,
      'availability',
    );
    if (JSON.stringify(normalizedLegacyAvailability) !== JSON.stringify(weeklyAvailability)) {
      throw schemaError(
        'OUTSIDE_AVAILABILITY',
        'availability conflicts with weeklyAvailability',
        'availability',
      );
    }
  }
  return Object.freeze({
    schemaVersion: 2,
    timeZone: canonicalTimeZone(source.timeZone, 'timeZone'),
    currency,
    bookingPolicy: normalizePolicy(source.bookingPolicy, 'bookingPolicy'),
    weeklyAvailability,
    services,
    employees: normalizeEmployees(
      source.employees === undefined ? [] : source.employees,
      services,
    ),
    ...(legacyAvailability !== undefined ? { availability: legacyAvailability } : {}),
  });
}

export { WEEKDAYS };
