'use strict';

const {
  createOccupancyBuckets,
  normalizeEmail,
  parseLocalDate,
  parseLocalTime,
  resolveResourceCandidates,
  sumServiceDuration,
} = require('./domain');
const { BookingError } = require('./errors');
const {
  formatMinorAmount,
  resolveCurrencyPolicy,
} = require('./currency');
const {
  assertWithinAvailability,
  resolveBookingInterval,
} = require('./time');

const MAX_CUSTOMER_NAME_LENGTH = 160;
const MAX_CUSTOMER_PHONE_LENGTH = 40;
const MAX_SERVICE_COUNT = 20;
const MAX_DATA_ARRAY_LENGTH = 10_000;
const BLOCKED_DATA_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const IDENTIFIER_PATTERN = /^[^\u0000-\u001f/]{1,128}$/;

function bookingError(code, message, httpStatus, details = {}) {
  return new BookingError(code, message, {
    httpStatus,
    retryable: false,
    details,
  });
}

function readPlainDataObject(value) {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  let isArray;
  let prototype;
  let descriptors;
  try {
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    return null;
  }
  if (isArray || (prototype !== Object.prototype && prototype !== null)) {
    return null;
  }

  const copy = Object.create(null);
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key];
    if (
      typeof key !== 'string' ||
      BLOCKED_DATA_KEYS.has(key) ||
      descriptor.enumerable !== true ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      return null;
    }
    Object.defineProperty(copy, key, {
      configurable: false,
      enumerable: true,
      value: descriptor.value,
      writable: false,
    });
  }
  return Object.freeze(copy);
}

function readDenseDataArray(value) {
  let isArray;
  let prototype;
  let descriptors;
  try {
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    return null;
  }
  if (!isArray || prototype !== Array.prototype) {
    return null;
  }

  const lengthDescriptor = descriptors.length;
  if (
    !lengthDescriptor ||
    !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value') ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    lengthDescriptor.value > MAX_DATA_ARRAY_LENGTH
  ) {
    return null;
  }
  const items = new Array(lengthDescriptor.value);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (key === 'length') {
      continue;
    }
    const descriptor = descriptors[key];
    if (
      typeof key !== 'string' ||
      !/^(0|[1-9]\d*)$/.test(key) ||
      Number(key) >= items.length ||
      descriptor.enumerable !== true ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      return null;
    }
    items[Number(key)] = descriptor.value;
  }
  for (let index = 0; index < items.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(items, index)) {
      return null;
    }
  }
  return Object.freeze(items);
}

function requirePlainObject(value, field) {
  const snapshot = readPlainDataObject(value);
  if (!snapshot) {
    throw bookingError('INVALID_ARGUMENT', `${field} must be an object`, 400, { field });
  }
  return snapshot;
}

function normalizeIdentifier(value, field) {
  if (typeof value !== 'string') {
    throw bookingError('INVALID_ARGUMENT', `${field} must be a string`, 400, { field });
  }
  const normalized = value.trim();
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    throw bookingError('INVALID_ARGUMENT', `${field} is not valid`, 400, { field });
  }
  return normalized;
}

function normalizeBoundedText(value, field, maxLength) {
  if (typeof value !== 'string') {
    throw bookingError('INVALID_ARGUMENT', `${field} must be a string`, 400, { field });
  }
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw bookingError('INVALID_ARGUMENT', `${field} is not valid`, 400, { field });
  }
  return normalized;
}

function normalizeActor(actor) {
  if (actor === undefined || actor === null) {
    return Object.freeze({ uid: null, email: null, kind: 'guest' });
  }
  const actorData = requirePlainObject(actor, 'actor');
  const uid = normalizeIdentifier(actorData.uid, 'actor.uid');
  let email = null;
  if (actorData.email !== undefined && actorData.email !== null && actorData.email !== '') {
    email = normalizeEmail(actorData.email);
  }
  return Object.freeze({ uid, email, kind: 'authenticated' });
}

function normalizeServiceIds(value) {
  const serviceIds = readDenseDataArray(value);
  if (!serviceIds || serviceIds.length === 0 || serviceIds.length > MAX_SERVICE_COUNT) {
    throw bookingError(
      'INVALID_ARGUMENT',
      `serviceIds must contain 1 to ${MAX_SERVICE_COUNT} stable service identifiers`,
      400,
      { field: 'serviceIds' },
    );
  }

  const seen = new Set();
  return Object.freeze(serviceIds.map((serviceId, index) => {
    const normalized = normalizeIdentifier(serviceId, `serviceIds[${index}]`);
    if (seen.has(normalized)) {
      throw bookingError('INVALID_ARGUMENT', 'serviceIds must not contain duplicates', 400, {
        field: `serviceIds[${index}]`,
      });
    }
    seen.add(normalized);
    return normalized;
  }));
}

function normalizeCreateIntent(payload, actor) {
  const body = requirePlainObject(payload, 'payload');
  const normalizedActor = normalizeActor(actor);
  const customer = requirePlainObject(body.customer, 'customer');
  const shopId = normalizeIdentifier(body.shopId, 'shopId');
  const requestedEmployeeId = body.requestedEmployeeId === undefined ||
    body.requestedEmployeeId === null || body.requestedEmployeeId === ''
    ? null
    : normalizeIdentifier(body.requestedEmployeeId, 'requestedEmployeeId');

  const intent = Object.freeze({
    shopId,
    requestedEmployeeId,
    serviceIds: normalizeServiceIds(body.serviceIds),
    localDate: parseLocalDate(body.localDate).value,
    localStartTime: parseLocalTime(body.localStartTime).value,
    customer: Object.freeze({
      name: normalizeBoundedText(customer.name, 'customer.name', MAX_CUSTOMER_NAME_LENGTH),
      email: normalizeEmail(customer.email),
      phone: normalizeBoundedText(customer.phone, 'customer.phone', MAX_CUSTOMER_PHONE_LENGTH),
    }),
    consentVersion: normalizeIdentifier(body.consentVersion, 'consentVersion'),
  });

  return Object.freeze({ actor: normalizedActor, intent });
}

function normalizeNonNegativeSafeInteger(value, field, code = 'INVALID_ARGUMENT') {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw bookingError(code, `${field} must be a non-negative safe integer`, 400, { field });
  }
  return value;
}

function isInactive(entity) {
  const status = typeof entity?.status === 'string' ? entity.status.trim().toLowerCase() : '';
  return entity?.active === false || ['inactive', 'disabled', 'archived'].includes(status);
}

function normalizeAuthoritativeServices(shop, serviceIds) {
  const catalog = readDenseDataArray(shop.services);
  if (!catalog) {
    throw bookingError('SERVICE_NOT_FOUND', 'shop has no authoritative service catalog', 404, {
      field: 'services',
    });
  }

  const byId = new Map();
  for (let index = 0; index < catalog.length; index += 1) {
    const service = readPlainDataObject(catalog[index]);
    if (!service) {
      throw bookingError('SERVICE_NOT_FOUND', 'shop service catalog is malformed', 404, {
        field: `services[${index}]`,
      });
    }
    let id;
    try {
      id = normalizeIdentifier(service.id, `services[${index}].id`);
    } catch (error) {
      throw bookingError('SERVICE_NOT_FOUND', 'shop service catalog lacks stable identifiers', 404, {
        field: `services[${index}].id`,
      });
    }
    if (byId.has(id)) {
      throw bookingError('SERVICE_NOT_FOUND', 'shop service catalog has duplicate identifiers', 404, {
        field: `services[${index}].id`,
      });
    }
    byId.set(id, service);
  }

  const snapshots = serviceIds.map((id) => {
    const service = byId.get(id);
    if (!service || isInactive(service)) {
      throw bookingError('SERVICE_NOT_FOUND', 'requested service is not active', 404, {
        serviceId: id,
      });
    }

    const name = normalizeBoundedText(service.name, `services.${id}.name`, 160);
    const durationMinutes = service.durationMinutes;
    const priceMinor = normalizeNonNegativeSafeInteger(
      service.priceMinor,
      `services.${id}.priceMinor`,
    );
    const currencyPolicy = resolveCurrencyPolicy(
      service.currency,
      `services.${id}.currency`,
    );
    const bufferBeforeMinutes = service.bufferBeforeMinutes ?? 0;
    const bufferAfterMinutes = service.bufferAfterMinutes ?? 0;

    return Object.freeze({
      id,
      name,
      durationMinutes,
      bufferBeforeMinutes,
      bufferAfterMinutes,
      priceMinor,
      currency: currencyPolicy.currency,
      minorUnitDigits: currencyPolicy.minorUnitDigits,
    });
  });

  const currency = snapshots[0].currency;
  if (snapshots.some((service) => service.currency !== currency)) {
    throw bookingError('INVALID_ARGUMENT', 'selected services must use one currency', 400, {
      field: 'serviceIds',
    });
  }

  const durationMinutes = sumServiceDuration(snapshots);
  let bufferBeforeMinutes = 0;
  let bufferAfterMinutes = 0;
  let totalPriceMinor = 0;
  for (const service of snapshots) {
    bufferBeforeMinutes += normalizeNonNegativeSafeInteger(
      service.bufferBeforeMinutes,
      `services.${service.id}.bufferBeforeMinutes`,
      'INVALID_DURATION',
    );
    bufferAfterMinutes += normalizeNonNegativeSafeInteger(
      service.bufferAfterMinutes,
      `services.${service.id}.bufferAfterMinutes`,
      'INVALID_DURATION',
    );
    totalPriceMinor += service.priceMinor;
    if (!Number.isSafeInteger(totalPriceMinor)) {
      throw bookingError('INVALID_ARGUMENT', 'selected service price total is too large', 400, {
        field: 'serviceIds',
      });
    }
  }

  return Object.freeze({
    snapshots: Object.freeze(snapshots),
    durationMinutes,
    bufferBeforeMinutes,
    bufferAfterMinutes,
    totalPriceMinor,
    currency,
    minorUnitDigits: snapshots[0].minorUnitDigits,
  });
}

function normalizeWeeklyAvailability(value, field) {
  const availability = readPlainDataObject(value);
  if (!availability) {
    throw bookingError('OUTSIDE_AVAILABILITY', `${field} must be configured`, 422, { field });
  }
  return availability;
}

function dateExceptionFor(entity, localDate) {
  if (entity.dateExceptions === undefined || entity.dateExceptions === null) {
    return undefined;
  }
  const dateExceptions = readPlainDataObject(entity.dateExceptions);
  if (!dateExceptions) {
    throw bookingError('OUTSIDE_AVAILABILITY', 'dateExceptions must be an object', 422, {
      field: 'dateExceptions',
    });
  }
  return dateExceptions[localDate];
}

function normalizePolicy(shop, intent, actor) {
  const policy = requirePlainObject(shop.bookingPolicy, 'shop.bookingPolicy');
  const consentVersion = normalizeIdentifier(
    policy.consentVersion,
    'shop.bookingPolicy.consentVersion',
  );
  if (intent.consentVersion !== consentVersion) {
    throw bookingError('INVALID_ARGUMENT', 'consentVersion is not current', 400, {
      field: 'consentVersion',
    });
  }
  if (actor.kind === 'guest' && policy.guestBookingEnabled !== true) {
    throw bookingError('FORBIDDEN', 'guest booking is not enabled for this shop', 403);
  }

  return Object.freeze({
    consentVersion,
    guestBookingEnabled: policy.guestBookingEnabled === true,
    cancellationNoticeMinutes: normalizeNonNegativeSafeInteger(
      policy.cancellationNoticeMinutes ?? 0,
      'shop.bookingPolicy.cancellationNoticeMinutes',
    ),
  });
}

function normalizeEmployees(shop, intent) {
  const employees = readDenseDataArray(shop.employees);
  if (!employees) {
    throw bookingError(
      'SHOP_RESOURCE_CONFIG_REQUIRED',
      'shop employee roster must be an array',
      422,
      { field: 'employees' },
    );
  }

  const canonicalEmployees = employees.map((employee, index) => {
    const canonicalEmployee = readPlainDataObject(employee);
    if (!canonicalEmployee) {
      throw bookingError(
        'SHOP_RESOURCE_CONFIG_REQUIRED',
        'employee roster contains a malformed entry',
        422,
        { field: `employees[${index}]` },
      );
    }
    let employeeId;
    try {
      employeeId = normalizeIdentifier(canonicalEmployee.id, `employees[${index}].id`);
    } catch (error) {
      if (error instanceof BookingError) {
        throw bookingError(
          'SHOP_RESOURCE_CONFIG_REQUIRED',
          'employee roster contains a malformed identifier',
          422,
          { field: `employees[${index}].id` },
        );
      }
      throw error;
    }
    if (canonicalEmployee.id !== employeeId) {
      throw bookingError(
        'SHOP_RESOURCE_CONFIG_REQUIRED',
        'employee identifiers must be stored in canonical form',
        422,
        { field: `employees[${index}].id` },
      );
    }
    return Object.freeze({ ...canonicalEmployee, id: employeeId });
  });

  try {
    resolveResourceCandidates({
      shopId: intent.shopId,
      preferredEmployeeId: intent.requestedEmployeeId,
      employees: canonicalEmployees,
    });
  } catch (error) {
    if (error instanceof BookingError && error.code === 'SHOP_RESOURCE_CONFIG_REQUIRED') {
      throw bookingError(error.code, error.message, 422, error.details);
    }
    throw error;
  }

  return Object.freeze(canonicalEmployees);
}

function employeeCanServe(employee, serviceIds) {
  if (employee.bookable === false || isInactive(employee)) {
    return false;
  }
  const eligibleServiceIds = readDenseDataArray(employee.serviceIds);
  if (!eligibleServiceIds) {
    return false;
  }
  const eligible = new Set(eligibleServiceIds);
  return serviceIds.every((serviceId) => eligible.has(serviceId));
}

function resolveCandidateResources({ shop, intent, interval }) {
  const employees = normalizeEmployees(shop, intent);
  if (employees.length === 0) {
    return Object.freeze([Object.freeze({
      resourceId: `shop:${intent.shopId}:primary`,
      employeeId: null,
      employeeName: null,
    })]);
  }

  const candidateIds = resolveResourceCandidates({
    shopId: intent.shopId,
    preferredEmployeeId: intent.requestedEmployeeId,
    employees,
  });
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const eligible = [];

  for (const resourceId of candidateIds) {
    const employeeId = resourceId.slice('employee:'.length);
    const employee = byId.get(employeeId);
    if (!employeeCanServe(employee, intent.serviceIds)) {
      continue;
    }
    try {
      assertWithinAvailability({
        interval,
        weeklyAvailability: normalizeWeeklyAvailability(
          employee.weeklyAvailability,
          `employees.${employeeId}.weeklyAvailability`,
        ),
        dateException: dateExceptionFor(employee, intent.localDate),
      });
    } catch (error) {
      if (error instanceof BookingError && error.code === 'OUTSIDE_AVAILABILITY') {
        continue;
      }
      throw error;
    }

    eligible.push(Object.freeze({
      resourceId,
      employeeId,
      employeeName: normalizeBoundedText(
        employee.name,
        `employees.${employeeId}.name`,
        160,
      ),
    }));
  }

  if (eligible.length === 0) {
    throw bookingError('EMPLOYEE_UNAVAILABLE', 'no employee can serve this booking', 422, {
      requestedEmployeeId: intent.requestedEmployeeId,
    });
  }
  return Object.freeze(eligible);
}

function resolveAuthoritativeBooking({ shopId, shop, intent, actor }) {
  const authoritativeShop = readPlainDataObject(shop);
  if (!authoritativeShop || isInactive(authoritativeShop)) {
    throw bookingError('SHOP_NOT_FOUND', 'shop does not exist or is inactive', 404, { shopId });
  }

  const ownerId = normalizeIdentifier(authoritativeShop.ownerId, 'shop.ownerId');
  const shopEmail = normalizeEmail(authoritativeShop.email);
  if (
    typeof authoritativeShop.timeZone !== 'string' ||
    authoritativeShop.timeZone.trim().length === 0
  ) {
    throw bookingError(
      'SHOP_TIMEZONE_REQUIRED',
      'shop has no authoritative IANA time zone',
      422,
      { shopId },
    );
  }
  const service = normalizeAuthoritativeServices(authoritativeShop, intent.serviceIds);
  const policy = normalizePolicy(authoritativeShop, intent, actor);

  const interval = resolveBookingInterval({
    localDate: intent.localDate,
    localStartTime: intent.localStartTime,
    timeZone: authoritativeShop.timeZone,
    durationMinutes: service.durationMinutes,
    bufferBeforeMinutes: service.bufferBeforeMinutes,
    bufferAfterMinutes: service.bufferAfterMinutes,
  });
  const wallServiceMinutes = interval.endMinute - interval.startMinute;
  const wallOccupancyMinutes = interval.occupiedEndMinute - interval.occupiedStartMinute;
  const expectedOccupancyMinutes = service.durationMinutes +
    service.bufferBeforeMinutes + service.bufferAfterMinutes;
  if (
    wallServiceMinutes !== service.durationMinutes ||
    wallOccupancyMinutes !== expectedOccupancyMinutes
  ) {
    throw bookingError(
      'INVALID_TIME',
      'booking intervals may not cross a daylight-saving transition',
      400,
      { field: 'localStartTime' },
    );
  }
  assertWithinAvailability({
    interval,
    weeklyAvailability: normalizeWeeklyAvailability(
      authoritativeShop.weeklyAvailability,
      'shop.weeklyAvailability',
    ),
    dateException: dateExceptionFor(authoritativeShop, intent.localDate),
  });

  const resources = resolveCandidateResources({ shop: authoritativeShop, intent, interval });
  const buckets = createOccupancyBuckets({
    localDate: interval.localDate,
    localStartTime: interval.localStartTime,
    durationMinutes: interval.durationMinutes,
    bufferBeforeMinutes: interval.bufferBeforeMinutes,
    bufferAfterMinutes: interval.bufferAfterMinutes,
  });

  return Object.freeze({
    shop: Object.freeze({
      id: shopId,
      ownerId,
      email: shopEmail,
      name: normalizeBoundedText(authoritativeShop.name, 'shop.name', 160),
    }),
    service,
    policy,
    interval,
    resources,
    buckets,
  });
}

module.exports = {
  formatMinorAmount,
  normalizeActor,
  normalizeCreateIntent,
  resolveAuthoritativeBooking,
};
