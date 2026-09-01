'use strict';

const { BookingError } = require('./errors');

const ENABLED_VALUE = 'true';
const ENVIRONMENT_FLAGS = Object.freeze([
  'FUNCTIONS_EMULATOR',
  'BOOKING_V2_ENABLED',
]);

function hasExactOwnFlag(env, name) {
  try {
    return (
      Object.prototype.hasOwnProperty.call(env, name) &&
      env[name] === ENABLED_VALUE
    );
  } catch {
    return false;
  }
}

function isBookingV2Enabled(env) {
  if (env === null || typeof env !== 'object') {
    return false;
  }

  return ENVIRONMENT_FLAGS.some((name) => hasExactOwnFlag(env, name));
}

function assertBookingV2Enabled(env) {
  if (!isBookingV2Enabled(env)) {
    throw new BookingError(
      'FORBIDDEN',
      'Booking v2 is not enabled.',
      { httpStatus: 403, retryable: false },
    );
  }
}

function withBookingV2Runtime(command, options = {}) {
  if (typeof command !== 'function') {
    throw new TypeError('command must be a function');
  }
  if (
    options === null ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('options must be an object');
  }

  const env = options.env === undefined ? process.env : options.env;
  if (env === null || typeof env !== 'object' || Array.isArray(env)) {
    throw new TypeError('env must be an object');
  }

  return function bookingV2RuntimeGuardedCommand(...args) {
    assertBookingV2Enabled(env);
    return Reflect.apply(command, this, args);
  };
}

module.exports = {
  assertBookingV2Enabled,
  isBookingV2Enabled,
  withBookingV2Runtime,
};
