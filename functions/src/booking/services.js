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
  assertWithinAvailability,
  resolveBookingInterval,
} = require('./time');

const MAX_CUSTOMER_NAME_LENGTH = 160;
const MAX_CUSTOMER_PHONE_LENGTH = 40;
const MAX_SERVICE_COUNT = 20;
const ISO_CURRENCY_PATTERN = /^[A-Z]{3}$/;
const IDENTIFIER_PATTERN = /^[^\u0000-\u001f/]{1,128}$/;

function bookingError(code, message, httpStatus, details = {}) {
  return new BookingError(code, message, {
    httpStatus,
    retryable: false,
    details,
  });
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requirePlainObject(value, field) {
  if (!isPlainObject(value)) {
    throw bookingError('INVALID_ARGUMENT', `${field} must be an object`, 400, { field });
  }
  return value;
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
  requirePlainObject(actor, 'actor');
  const uid = normalizeIdentifier(actor.uid, 'actor.uid');
  let email = null;
  if (actor.email !== undefined && actor.email !== null && actor.email !== '') {
    email = normalizeEmail(actor.email);
  }
  return Object.freeze({ uid, email, kind: 'authenticated' });
}

function normalizeServiceIds(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SERVICE_COUNT) {
    throw bookingError(
      'INVALID_ARGUMENT',
      `serviceIds must contain 1 to ${MAX_SERVICE_COUNT} stable service identifiers`,
      400,
      { field: 'serviceIds' },
    );
  }

  const seen = new Set();
  return Object.freeze(value.map((serviceId, index) => {
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

function normalizeCurrency(value, field) {
  if (typeof value !== 'string' || !ISO_CURRENCY_PATTERN.test(value)) {
    throw bookingError('INVALID_ARGUMENT', `${field} must be an uppercase ISO currency code`, 400, {
      field,
    });
  }
  return value;
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
  if (!Array.isArray(shop.services)) {
    throw bookingError('SERVICE_NOT_FOUND', 'shop has no authoritative service catalog', 404, {
      field: 'services',
    });
  }

  const byId = new Map();
  for (let index = 0; index < shop.services.length; index += 1) {
    const service = shop.services[index];
    if (!isPlainObject(service)) {
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
    const currency = normalizeCurrency(service.currency, `services.${id}.currency`);
    const bufferBeforeMinutes = service.bufferBeforeMinutes ?? 0;
    const bufferAfterMinutes = service.bufferAfterMinutes ?? 0;

    return Object.freeze({
      id,
      name,
      durationMinutes,
      bufferBeforeMinutes,
      bufferAfterMinutes,
      priceMinor,
      currency,
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
  });
}

function normalizeWeeklyAvailability(value, field) {
  if (!isPlainObject(value)) {
    throw bookingError('OUTSIDE_AVAILABILITY', `${field} must be configured`, 422, { field });
  }
  return value;
}

function dateExceptionFor(entity, localDate) {
  if (entity.dateExceptions === undefined || entity.dateExceptions === null) {
    return undefined;
  }
  if (!isPlainObject(entity.dateExceptions)) {
    throw bookingError('OUTSIDE_AVAILABILITY', 'dateExceptions must be an object', 422, {
      field: 'dateExceptions',
    });
  }
  return entity.dateExceptions[localDate];
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
  if (!Array.isArray(shop.employees)) {
    throw bookingError(
      'SHOP_RESOURCE_CONFIG_REQUIRED',
      'shop employee roster must be an array',
      422,
      { field: 'employees' },
    );
  }

  const canonicalEmployees = shop.employees.map((employee, index) => {
    if (!isPlainObject(employee)) {
      throw bookingError(
        'SHOP_RESOURCE_CONFIG_REQUIRED',
        'employee roster contains a malformed entry',
        422,
        { field: `employees[${index}]` },
      );
    }
    let employeeId;
    try {
      employeeId = normalizeIdentifier(employee.id, `employees[${index}].id`);
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
    if (employee.id !== employeeId) {
      throw bookingError(
        'SHOP_RESOURCE_CONFIG_REQUIRED',
        'employee identifiers must be stored in canonical form',
        422,
        { field: `employees[${index}].id` },
      );
    }
    return Object.freeze({ ...employee, id: employeeId });
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
  if (!Array.isArray(employee.serviceIds)) {
    return false;
  }
  const eligible = new Set(employee.serviceIds);
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
  if (!isPlainObject(shop) || isInactive(shop)) {
    throw bookingError('SHOP_NOT_FOUND', 'shop does not exist or is inactive', 404, { shopId });
  }

  const ownerId = normalizeIdentifier(shop.ownerId, 'shop.ownerId');
  const shopEmail = normalizeEmail(shop.email);
  if (typeof shop.timeZone !== 'string' || shop.timeZone.trim().length === 0) {
    throw bookingError(
      'SHOP_TIMEZONE_REQUIRED',
      'shop has no authoritative IANA time zone',
      422,
      { shopId },
    );
  }
  const service = normalizeAuthoritativeServices(shop, intent.serviceIds);
  const policy = normalizePolicy(shop, intent, actor);

  const interval = resolveBookingInterval({
    localDate: intent.localDate,
    localStartTime: intent.localStartTime,
    timeZone: shop.timeZone,
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
      shop.weeklyAvailability,
      'shop.weeklyAvailability',
    ),
    dateException: dateExceptionFor(shop, intent.localDate),
  });

  const resources = resolveCandidateResources({ shop, intent, interval });
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
      name: normalizeBoundedText(shop.name, 'shop.name', 160),
    }),
    service,
    policy,
    interval,
    resources,
    buckets,
  });
}

function formatMinorAmount(priceMinor) {
  const whole = Math.floor(priceMinor / 100);
  const fraction = String(priceMinor % 100).padStart(2, '0');
  return `${whole}.${fraction}`;
}

module.exports = {
  formatMinorAmount,
  normalizeActor,
  normalizeCreateIntent,
  resolveAuthoritativeBooking,
};
