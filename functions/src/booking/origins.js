'use strict';

const { types: utilTypes } = require('node:util');

const EXPLICIT_ORIGINS_ENV = 'BOOKING_V2_ALLOWED_ORIGINS_JSON';
const KNOWN_PRODUCTION_ORIGINS = Object.freeze([
  'https://barbersbuddies.com',
  'https://www.barbersbuddies.com',
]);
const EMULATOR_DEVELOPMENT_ORIGINS = Object.freeze([
  'http://localhost:3000',
  'http://localhost:3100',
]);
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function configurationError(message) {
  throw new TypeError(message);
}

function isProxy(value) {
  try {
    return utilTypes.isProxy(value);
  } catch {
    return true;
  }
}

function readOwnEnvironmentValue(env, name) {
  if (env === null || typeof env !== 'object' || Array.isArray(env) || isProxy(env)) {
    configurationError('booking origin environment must be a plain record');
  }

  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(env, name);
  } catch {
    configurationError('booking origin environment could not be inspected');
  }
  if (!descriptor) return undefined;
  if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    configurationError(`${name} must be a data property`);
  }
  return descriptor.value;
}

function parseExactOrigin(candidate, { emulator }) {
  if (
    typeof candidate !== 'string' ||
    candidate.length === 0 ||
    candidate.length > 2048 ||
    candidate !== candidate.trim() ||
    candidate === 'null' ||
    candidate.includes('*') ||
    candidate.includes(',')
  ) {
    configurationError(`${EXPLICIT_ORIGINS_ENV} must contain exact origins`);
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    configurationError(`${EXPLICIT_ORIGINS_ENV} must contain exact http or https origins`);
  }

  if (
    parsed.origin !== candidate ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.pathname !== '/' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    configurationError(`${EXPLICIT_ORIGINS_ENV} must contain exact http or https origins`);
  }

  if (parsed.protocol === 'https:') return candidate;
  if (
    emulator &&
    parsed.protocol === 'http:' &&
    LOOPBACK_HOSTNAMES.has(parsed.hostname)
  ) {
    return candidate;
  }

  configurationError(
    emulator
      ? `${EXPLICIT_ORIGINS_ENV} permits HTTP only for loopback origins in the emulator`
      : `${EXPLICIT_ORIGINS_ENV} permits only HTTPS origins in production`,
  );
}

function parseExplicitOrigins(rawValue, runtime) {
  if (rawValue === undefined) return [];
  if (typeof rawValue !== 'string' || rawValue.length === 0) {
    configurationError(`${EXPLICIT_ORIGINS_ENV} must be a JSON array of exact origins`);
  }

  let values;
  try {
    values = JSON.parse(rawValue);
  } catch {
    configurationError(`${EXPLICIT_ORIGINS_ENV} must be valid JSON`);
  }
  if (!Array.isArray(values) || values.length > 32) {
    configurationError(`${EXPLICIT_ORIGINS_ENV} must be a JSON array with at most 32 origins`);
  }
  return values.map((value) => parseExactOrigin(value, runtime));
}

function resolveBookingAllowedOrigins(env = process.env) {
  const emulator = readOwnEnvironmentValue(env, 'FUNCTIONS_EMULATOR') === 'true';
  const explicitOrigins = parseExplicitOrigins(
    readOwnEnvironmentValue(env, EXPLICIT_ORIGINS_ENV),
    { emulator },
  );
  const defaults = emulator
    ? [...KNOWN_PRODUCTION_ORIGINS, ...EMULATOR_DEVELOPMENT_ORIGINS]
    : KNOWN_PRODUCTION_ORIGINS;

  return Object.freeze([...new Set([...defaults, ...explicitOrigins])]);
}

module.exports = {
  EMULATOR_DEVELOPMENT_ORIGINS,
  EXPLICIT_ORIGINS_ENV,
  KNOWN_PRODUCTION_ORIGINS,
  resolveBookingAllowedOrigins,
};
