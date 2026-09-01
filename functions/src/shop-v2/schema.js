'use strict';

const { createHash } = require('node:crypto');
const { types: utilTypes } = require('node:util');
const { Temporal } = require('@js-temporal/polyfill');

const WEEKDAYS = Object.freeze([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);
const ROOT_KEYS = new Set([
  'schemaVersion',
  'name',
  'slug',
  'presentation',
  'contact',
  'timeZone',
  'currency',
  'minorUnitDigits',
  'bookingPolicy',
  'consent',
  'weeklyAvailability',
  'services',
  'employees',
  'stagedAssets',
]);
const PRESENTATION_KEYS = new Set([
  'headline',
  'description',
  'logoAssetId',
  'heroAssetId',
  'galleryAssetIds',
]);
const CONTACT_KEYS = new Set([
  'publicEmail',
  'publicPhone',
  'websiteUrl',
  'street',
  'postalCode',
  'city',
  'countryCode',
]);
const POLICY_KEYS = new Set([
  'guestBookingEnabled',
  'cancellationNoticeMinutes',
  'leadTimeMinutes',
  'bookingWindowDays',
]);
const CONSENT_KEYS = new Set(['version', 'termsAccepted', 'privacyAccepted']);
const INTERVAL_KEYS = new Set(['startLocalTime', 'endLocalTime']);
const SERVICE_KEYS = new Set([
  'id',
  'name',
  'description',
  'active',
  'priceMinor',
  'durationMinutes',
  'bufferBeforeMinutes',
  'bufferAfterMinutes',
]);
const EMPLOYEE_KEYS = new Set(['id', 'active', 'serviceIds', 'weeklyAvailability']);
const ASSET_KEYS = new Set(['id', 'kind', 'storagePath', 'contentType', 'sizeBytes', 'sha256']);
const ASSET_KINDS = new Set(['logo', 'hero', 'gallery']);
const ASSET_CONTENT_TYPES = new Set(['image/avif', 'image/jpeg', 'image/png', 'image/webp']);
const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SERVICES = 100;
const MAX_EMPLOYEES = 100;
const MAX_STAGED_ASSETS = 12;
const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ASSET_BYTES = 50 * 1024 * 1024;

class ShopV2SchemaError extends Error {
  constructor(code, message, field) {
    super(message);
    this.name = 'ShopV2SchemaError';
    this.code = code;
    this.field = field;
  }
}

function fail(message, field, code = 'INVALID_ARGUMENT') {
  throw new ShopV2SchemaError(code, message, field);
}

function isProxy(value) {
  try {
    return utilTypes.isProxy(value);
  } catch (error) {
    return true;
  }
}

function descriptorsOf(value, field) {
  if (value === null || typeof value !== 'object' || isProxy(value)) {
    fail(`${field} must be a plain data object`, field);
  }
  let prototype;
  let descriptors;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    fail(`${field} must be a plain data object`, field);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    fail(`${field} must be a plain data object`, field);
  }
  return descriptors;
}

function exactObject(value, field, allowedKeys) {
  const descriptors = descriptorsOf(value, field);
  const output = Object.create(null);
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key];
    if (
      typeof key !== 'string' ||
      !allowedKeys.has(key) ||
      descriptor.enumerable !== true ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      fail(`${field} must contain only declared plain data fields`, field);
    }
    Object.defineProperty(output, key, {
      enumerable: true,
      configurable: false,
      writable: false,
      value: descriptor.value,
    });
  }
  return output;
}

function denseArray(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === null || typeof value !== 'object' || isProxy(value)) {
    fail(`${field} must be a dense plain-data array`, field);
  }
  let isArray;
  let prototype;
  let descriptors;
  try {
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    fail(`${field} must be a dense plain-data array`, field);
  }
  if (!isArray || prototype !== Array.prototype) {
    fail(`${field} must be a dense plain-data array`, field);
  }
  const lengthDescriptor = descriptors.length;
  const length = lengthDescriptor && lengthDescriptor.value;
  if (!Number.isSafeInteger(length) || length < min || length > max) {
    fail(`${field} must contain ${min} to ${max} items`, field);
  }
  const output = new Array(length);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (key === 'length') continue;
    const descriptor = descriptors[key];
    if (
      typeof key !== 'string' ||
      !/^(0|[1-9]\d*)$/.test(key) ||
      Number(key) >= length ||
      descriptor.enumerable !== true ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      fail(`${field} must be a dense plain-data array`, field);
    }
    output[Number(key)] = descriptor.value;
  }
  for (let index = 0; index < length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(output, index)) {
      fail(`${field} must be a dense plain-data array`, field);
    }
  }
  return output;
}

function requiredOwn(object, key, field) {
  if (!Object.prototype.hasOwnProperty.call(object, key)) {
    fail(`${field} is required`, field);
  }
  return object[key];
}

function boundedString(value, field, { min = 1, max, normalize = false } = {}) {
  if (typeof value !== 'string') fail(`${field} must be a string`, field);
  let result = value;
  if (normalize) {
    try {
      result = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
    } catch (error) {
      fail(`${field} must be valid Unicode text`, field);
    }
  }
  if (result.length < min || result.length > max || /[\u0000-\u001f\u007f-\u009f]/u.test(result)) {
    fail(`${field} must contain ${min} to ${max} safe characters`, field);
  }
  return result;
}

function nullableString(value, field, max) {
  if (value === null) return null;
  return boundedString(value, field, { max, normalize: true });
}

function safeInteger(value, field, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    fail(`${field} must be a safe integer from ${min} to ${max}`, field);
  }
  return value;
}

function explicitBoolean(value, field) {
  if (typeof value !== 'boolean') fail(`${field} must be a boolean`, field);
  return value;
}

function identifier(value, field) {
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
    fail(`${field} must be a stable lowercase identifier`, field);
  }
  return value;
}

function canonicalSlug(value) {
  if (typeof value !== 'string' || value.length > 80 || !SLUG_PATTERN.test(value)) {
    fail('slug must be an explicit canonical lowercase ASCII slug', 'slug');
  }
  return value;
}

function canonicalTimeZone(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value !== value.trim() ||
    /^[+-]\d{2}(?::?\d{2})?$/.test(value)
  ) {
    fail('timeZone must be a valid IANA time zone', 'timeZone', 'SHOP_TIMEZONE_REQUIRED');
  }
  try {
    return Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(value).timeZoneId;
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) {
      fail('timeZone must be a valid IANA time zone', 'timeZone', 'SHOP_TIMEZONE_REQUIRED');
    }
    throw error;
  }
}

function localTime(value, field) {
  if (typeof value !== 'string') fail(`${field} must use HH:mm`, field);
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) fail(`${field} must use HH:mm`, field);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59 || minute % 5 !== 0) {
    fail(`${field} must be a valid five-minute-aligned local time`, field);
  }
  return { value, minuteOfDay: (hour * 60) + minute };
}

function normalizeIntervals(value, field) {
  const intervals = denseArray(value, field, { max: 12 }).map((raw, index) => {
    const intervalField = `${field}[${index}]`;
    const source = exactObject(raw, intervalField, INTERVAL_KEYS);
    const start = localTime(requiredOwn(source, 'startLocalTime', `${intervalField}.startLocalTime`), `${intervalField}.startLocalTime`);
    const end = localTime(requiredOwn(source, 'endLocalTime', `${intervalField}.endLocalTime`), `${intervalField}.endLocalTime`);
    if (start.minuteOfDay >= end.minuteOfDay) {
      fail(`${intervalField} must be a non-overnight half-open interval`, intervalField, 'OUTSIDE_AVAILABILITY');
    }
    return { startLocalTime: start.value, endLocalTime: end.value };
  });
  intervals.sort((left, right) => left.startLocalTime.localeCompare(right.startLocalTime));
  for (let index = 1; index < intervals.length; index += 1) {
    if (intervals[index].startLocalTime < intervals[index - 1].endLocalTime) {
      fail(`${field} must not overlap`, `${field}[${index}]`, 'OUTSIDE_AVAILABILITY');
    }
  }
  return intervals;
}

function normalizeWeek(value, field) {
  const source = exactObject(value, field, new Set(WEEKDAYS));
  const output = {};
  for (const day of WEEKDAYS) {
    output[day] = normalizeIntervals(requiredOwn(source, day, `${field}.${day}`), `${field}.${day}`);
  }
  return output;
}

function normalizePresentation(value) {
  const source = exactObject(value, 'presentation', PRESENTATION_KEYS);
  return {
    headline: boundedString(requiredOwn(source, 'headline', 'presentation.headline'), 'presentation.headline', { max: 120, normalize: true }),
    description: boundedString(requiredOwn(source, 'description', 'presentation.description'), 'presentation.description', { max: 2000, normalize: true }),
    logoAssetId: nullableAssetId(requiredOwn(source, 'logoAssetId', 'presentation.logoAssetId'), 'presentation.logoAssetId'),
    heroAssetId: nullableAssetId(requiredOwn(source, 'heroAssetId', 'presentation.heroAssetId'), 'presentation.heroAssetId'),
    galleryAssetIds: denseArray(requiredOwn(source, 'galleryAssetIds', 'presentation.galleryAssetIds'), 'presentation.galleryAssetIds', { max: 10 })
      .map((item, index) => identifier(item, `presentation.galleryAssetIds[${index}]`)),
  };
}

function nullableAssetId(value, field) {
  return value === null ? null : identifier(value, field);
}

function publicEmail(value) {
  if (value === null) return null;
  const normalized = boundedString(value, 'contact.publicEmail', { max: 254, normalize: true }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    fail('contact.publicEmail must be a valid public email address', 'contact.publicEmail');
  }
  return normalized;
}

function publicPhone(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\+[1-9]\d{7,14}$/.test(value)) {
    fail('contact.publicPhone must use canonical E.164 form', 'contact.publicPhone');
  }
  return value;
}

function websiteUrl(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 2048 || value !== value.trim()) {
    fail('contact.websiteUrl must be an HTTPS URL', 'contact.websiteUrl');
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) {
      fail('contact.websiteUrl must be an HTTPS URL', 'contact.websiteUrl');
    }
    return parsed.href;
  } catch (error) {
    if (error instanceof ShopV2SchemaError) throw error;
    fail('contact.websiteUrl must be an HTTPS URL', 'contact.websiteUrl');
  }
}

function normalizeContact(value) {
  const source = exactObject(value, 'contact', CONTACT_KEYS);
  const countryCode = requiredOwn(source, 'countryCode', 'contact.countryCode');
  if (typeof countryCode !== 'string' || !/^[A-Z]{2}$/.test(countryCode)) {
    fail('contact.countryCode must be an uppercase ISO-style country code', 'contact.countryCode');
  }
  return {
    publicEmail: publicEmail(requiredOwn(source, 'publicEmail', 'contact.publicEmail')),
    publicPhone: publicPhone(requiredOwn(source, 'publicPhone', 'contact.publicPhone')),
    websiteUrl: websiteUrl(requiredOwn(source, 'websiteUrl', 'contact.websiteUrl')),
    street: nullableString(requiredOwn(source, 'street', 'contact.street'), 'contact.street', 160),
    postalCode: nullableString(requiredOwn(source, 'postalCode', 'contact.postalCode'), 'contact.postalCode', 32),
    city: nullableString(requiredOwn(source, 'city', 'contact.city'), 'contact.city', 100),
    countryCode,
  };
}

function normalizePolicy(value) {
  const source = exactObject(value, 'bookingPolicy', POLICY_KEYS);
  return {
    guestBookingEnabled: explicitBoolean(requiredOwn(source, 'guestBookingEnabled', 'bookingPolicy.guestBookingEnabled'), 'bookingPolicy.guestBookingEnabled'),
    cancellationNoticeMinutes: safeInteger(requiredOwn(source, 'cancellationNoticeMinutes', 'bookingPolicy.cancellationNoticeMinutes'), 'bookingPolicy.cancellationNoticeMinutes', 0, 60 * 24 * 30),
    leadTimeMinutes: safeInteger(requiredOwn(source, 'leadTimeMinutes', 'bookingPolicy.leadTimeMinutes'), 'bookingPolicy.leadTimeMinutes', 0, 60 * 24 * 30),
    bookingWindowDays: safeInteger(requiredOwn(source, 'bookingWindowDays', 'bookingPolicy.bookingWindowDays'), 'bookingPolicy.bookingWindowDays', 1, 730),
  };
}

function normalizeConsent(value) {
  const source = exactObject(value, 'consent', CONSENT_KEYS);
  const version = identifier(requiredOwn(source, 'version', 'consent.version'), 'consent.version');
  if (requiredOwn(source, 'termsAccepted', 'consent.termsAccepted') !== true) {
    fail('consent.termsAccepted must be explicitly true', 'consent.termsAccepted');
  }
  if (requiredOwn(source, 'privacyAccepted', 'consent.privacyAccepted') !== true) {
    fail('consent.privacyAccepted must be explicitly true', 'consent.privacyAccepted');
  }
  return { version, termsAccepted: true, privacyAccepted: true };
}

function normalizeServices(value) {
  const source = denseArray(value, 'services', { min: 1, max: MAX_SERVICES });
  const ids = new Set();
  const services = source.map((raw, index) => {
    const field = `services[${index}]`;
    const service = exactObject(raw, field, SERVICE_KEYS);
    const id = identifier(requiredOwn(service, 'id', `${field}.id`), `${field}.id`);
    if (ids.has(id)) fail('service IDs must be unique', `${field}.id`);
    ids.add(id);
    return {
      id,
      name: boundedString(requiredOwn(service, 'name', `${field}.name`), `${field}.name`, { max: 120, normalize: true }),
      description: boundedString(requiredOwn(service, 'description', `${field}.description`), `${field}.description`, { min: 0, max: 1000, normalize: true }),
      active: explicitBoolean(requiredOwn(service, 'active', `${field}.active`), `${field}.active`),
      priceMinor: safeInteger(requiredOwn(service, 'priceMinor', `${field}.priceMinor`), `${field}.priceMinor`, 0, Number.MAX_SAFE_INTEGER),
      durationMinutes: safeInteger(requiredOwn(service, 'durationMinutes', `${field}.durationMinutes`), `${field}.durationMinutes`, 1, 12 * 60),
      bufferBeforeMinutes: safeInteger(requiredOwn(service, 'bufferBeforeMinutes', `${field}.bufferBeforeMinutes`), `${field}.bufferBeforeMinutes`, 0, 4 * 60),
      bufferAfterMinutes: safeInteger(requiredOwn(service, 'bufferAfterMinutes', `${field}.bufferAfterMinutes`), `${field}.bufferAfterMinutes`, 0, 4 * 60),
    };
  });
  services.sort((left, right) => left.id.localeCompare(right.id));
  return { services, ids };
}

function normalizeEmployees(value, serviceIds) {
  const source = denseArray(value, 'employees', { min: 1, max: MAX_EMPLOYEES });
  const ids = new Set();
  const employees = source.map((raw, index) => {
    const field = `employees[${index}]`;
    const employee = exactObject(raw, field, EMPLOYEE_KEYS);
    const id = identifier(requiredOwn(employee, 'id', `${field}.id`), `${field}.id`);
    if (ids.has(id)) fail('employee IDs must be unique', `${field}.id`);
    ids.add(id);
    const assigned = denseArray(requiredOwn(employee, 'serviceIds', `${field}.serviceIds`), `${field}.serviceIds`, { min: 1, max: MAX_SERVICES })
      .map((item, itemIndex) => identifier(item, `${field}.serviceIds[${itemIndex}]`));
    const uniqueAssigned = new Set(assigned);
    if (uniqueAssigned.size !== assigned.length) fail(`${field}.serviceIds must be unique`, `${field}.serviceIds`);
    for (const serviceId of uniqueAssigned) {
      if (!serviceIds.has(serviceId)) fail(`${field}.serviceIds references an unknown service`, `${field}.serviceIds`);
    }
    return {
      id,
      active: explicitBoolean(requiredOwn(employee, 'active', `${field}.active`), `${field}.active`),
      serviceIds: assigned.sort(),
      weeklyAvailability: normalizeWeek(requiredOwn(employee, 'weeklyAvailability', `${field}.weeklyAvailability`), `${field}.weeklyAvailability`),
    };
  });
  employees.sort((left, right) => left.id.localeCompare(right.id));
  return employees;
}

function assertEmployeeAvailabilityWithinShop(employees, shopAvailability) {
  for (let employeeIndex = 0; employeeIndex < employees.length; employeeIndex += 1) {
    const employee = employees[employeeIndex];
    if (!employee.active) continue;
    for (const day of WEEKDAYS) {
      const shopIntervals = shopAvailability[day];
      const employeeIntervals = employee.weeklyAvailability[day];
      for (let intervalIndex = 0; intervalIndex < employeeIntervals.length; intervalIndex += 1) {
        const employeeInterval = employeeIntervals[intervalIndex];
        const contained = shopIntervals.some((shopInterval) =>
          employeeInterval.startLocalTime >= shopInterval.startLocalTime &&
          employeeInterval.endLocalTime <= shopInterval.endLocalTime);
        if (!contained) {
          fail(
            'active employee availability must be contained within one shop interval',
            `employees[${employeeIndex}].weeklyAvailability.${day}[${intervalIndex}]`,
            'OUTSIDE_AVAILABILITY',
          );
        }
      }
    }
  }
}

function normalizeAssets(value) {
  const source = denseArray(value, 'stagedAssets', { max: MAX_STAGED_ASSETS });
  const ids = new Set();
  let totalBytes = 0;
  const assets = source.map((raw, index) => {
    const field = `stagedAssets[${index}]`;
    const asset = exactObject(raw, field, ASSET_KEYS);
    const id = identifier(requiredOwn(asset, 'id', `${field}.id`), `${field}.id`);
    if (ids.has(id)) fail('staged asset IDs must be unique', `${field}.id`);
    ids.add(id);
    const kind = requiredOwn(asset, 'kind', `${field}.kind`);
    if (!ASSET_KINDS.has(kind)) fail(`${field}.kind is not supported`, `${field}.kind`);
    const storagePath = requiredOwn(asset, 'storagePath', `${field}.storagePath`);
    if (
      typeof storagePath !== 'string' ||
      storagePath.length > 512 ||
      !storagePath.startsWith('shop-staging/') ||
      storagePath.includes('..') ||
      storagePath.includes('\\') ||
      /[\u0000-\u001f]/u.test(storagePath)
    ) {
      fail(`${field}.storagePath must use the bounded shop-staging bridge`, `${field}.storagePath`);
    }
    const contentType = requiredOwn(asset, 'contentType', `${field}.contentType`);
    if (!ASSET_CONTENT_TYPES.has(contentType)) fail(`${field}.contentType is not supported`, `${field}.contentType`);
    const sizeBytes = safeInteger(requiredOwn(asset, 'sizeBytes', `${field}.sizeBytes`), `${field}.sizeBytes`, 1, MAX_ASSET_BYTES);
    totalBytes += sizeBytes;
    if (totalBytes > MAX_TOTAL_ASSET_BYTES) fail('stagedAssets exceeds the total upload limit', 'stagedAssets');
    const sha256 = requiredOwn(asset, 'sha256', `${field}.sha256`);
    if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) {
      fail(`${field}.sha256 must be a lowercase SHA-256 digest`, `${field}.sha256`);
    }
    return { id, kind, storagePath, contentType, sizeBytes, sha256 };
  });
  assets.sort((left, right) => left.id.localeCompare(right.id));
  return { assets, ids, kinds: new Map(assets.map((asset) => [asset.id, asset.kind])) };
}

function validateAssetReferences(presentation, assets) {
  const references = [
    ['logoAssetId', presentation.logoAssetId, 'logo'],
    ['heroAssetId', presentation.heroAssetId, 'hero'],
    ...presentation.galleryAssetIds.map((id, index) => [`galleryAssetIds[${index}]`, id, 'gallery']),
  ];
  const seen = new Set();
  for (const [field, id, kind] of references) {
    if (id === null) continue;
    if (seen.has(id)) fail('presentation asset references must be unique', `presentation.${field}`);
    seen.add(id);
    if (!assets.ids.has(id) || assets.kinds.get(id) !== kind) {
      fail(`presentation.${field} must reference a staged ${kind} asset`, `presentation.${field}`);
    }
  }
}

function canonicalSerialize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(Object.is(value, -0) ? 0 : value);
  if (Array.isArray(value)) return `[${value.map(canonicalSerialize).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalSerialize(value[key])}`).join(',')}}`;
}

function hashMaterial(scope, value) {
  return createHash('sha256').update(canonicalSerialize({ scope, value }), 'utf8').digest('hex');
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function buildShopV2CreateProjection(draft) {
  const source = exactObject(draft, 'shop', ROOT_KEYS);
  if (requiredOwn(source, 'schemaVersion', 'schemaVersion') !== 2) {
    fail('schemaVersion must be exactly 2', 'schemaVersion');
  }
  const name = boundedString(requiredOwn(source, 'name', 'name'), 'name', { max: 100, normalize: true });
  const slug = canonicalSlug(requiredOwn(source, 'slug', 'slug'));
  if (requiredOwn(source, 'currency', 'currency') !== 'EUR') {
    fail('currency must be EUR', 'currency');
  }
  if (requiredOwn(source, 'minorUnitDigits', 'minorUnitDigits') !== 2) {
    fail('minorUnitDigits must be 2 for EUR', 'minorUnitDigits');
  }
  const presentation = normalizePresentation(requiredOwn(source, 'presentation', 'presentation'));
  const contact = normalizeContact(requiredOwn(source, 'contact', 'contact'));
  const weeklyAvailability = normalizeWeek(requiredOwn(source, 'weeklyAvailability', 'weeklyAvailability'), 'weeklyAvailability');
  const { services, ids: serviceIds } = normalizeServices(requiredOwn(source, 'services', 'services'));
  const employees = normalizeEmployees(requiredOwn(source, 'employees', 'employees'), serviceIds);
  assertEmployeeAvailabilityWithinShop(employees, weeklyAvailability);
  const assets = normalizeAssets(requiredOwn(source, 'stagedAssets', 'stagedAssets'));
  validateAssetReferences(presentation, assets);

  const publicShop = {
    schemaVersion: 2,
    status: 'draft',
    name,
    slug,
    presentation,
    contact,
    timeZone: canonicalTimeZone(requiredOwn(source, 'timeZone', 'timeZone')),
    currency: 'EUR',
    minorUnitDigits: 2,
    bookingPolicy: normalizePolicy(requiredOwn(source, 'bookingPolicy', 'bookingPolicy')),
    weeklyAvailability,
    services,
    employees,
  };
  const consent = normalizeConsent(requiredOwn(source, 'consent', 'consent'));
  const canonicalName = name.toLowerCase();
  const requestMaterial = canonicalSerialize({
    schemaVersion: 2,
    publicShop,
    consent,
    stagedAssets: assets.assets,
  });
  const privateShop = {
    schemaVersion: 2,
    consent,
    stagedAssets: assets.assets,
    reservationKeys: {
      normalizedName: canonicalName,
      canonicalSlug: slug,
      nameKey: hashMaterial('shop-name-reservation:v2', canonicalName),
      slugKey: hashMaterial('shop-slug-reservation:v2', slug),
    },
    requestMaterial,
  };
  return deepFreeze({ publicShop, privateShop });
}

module.exports = {
  ShopV2SchemaError,
  WEEKDAYS,
  buildShopV2CreateProjection,
};
