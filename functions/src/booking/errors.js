'use strict';

const BLOCKED_DETAIL_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DETAIL_DEPTH = 8;

function cloneSafeValue(value, depth, seen) {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('BookingError details may only contain finite numbers');
    }
    return Object.is(value, -0) ? 0 : value;
  }

  if (depth >= MAX_DETAIL_DEPTH) {
    throw new TypeError(`BookingError details exceed ${MAX_DETAIL_DEPTH} levels`);
  }

  if (typeof value !== 'object') {
    throw new TypeError('BookingError details must be JSON-safe');
  }

  if (seen.has(value)) {
    throw new TypeError('BookingError details must not contain cycles');
  }

  seen.add(value);
  let copy;

  if (Array.isArray(value)) {
    copy = value.map((entry) => cloneSafeValue(entry, depth + 1, seen));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('BookingError details must contain only plain objects');
    }

    copy = {};
    for (const [key, entry] of Object.entries(value)) {
      if (BLOCKED_DETAIL_KEYS.has(key)) {
        continue;
      }
      copy[key] = cloneSafeValue(entry, depth + 1, seen);
    }
  }

  seen.delete(value);
  return Object.freeze(copy);
}

function safeDetails(details) {
  if (details === undefined) {
    return Object.freeze({});
  }

  const prototype = details && Object.getPrototypeOf(details);
  if (
    details === null ||
    typeof details !== 'object' ||
    Array.isArray(details) ||
    (prototype !== Object.prototype && prototype !== null)
  ) {
    throw new TypeError('BookingError details must be a plain object');
  }

  return cloneSafeValue(details, 0, new WeakSet());
}

class BookingError extends Error {
  constructor(code, message, options = {}) {
    if (typeof code !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(code)) {
      throw new TypeError('BookingError code must be stable upper snake case');
    }
    if (typeof message !== 'string' || message.length === 0) {
      throw new TypeError('BookingError message must be a non-empty string');
    }

    const {
      httpStatus = 400,
      retryable = false,
      details,
      cause,
    } = options;

    if (!Number.isInteger(httpStatus) || httpStatus < 400 || httpStatus > 599) {
      throw new TypeError('BookingError httpStatus must be an integer from 400 to 599');
    }
    if (typeof retryable !== 'boolean') {
      throw new TypeError('BookingError retryable must be a boolean');
    }

    super(message, cause === undefined ? undefined : { cause });
    this.name = 'BookingError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
    this.details = safeDetails(details);
    Error.captureStackTrace?.(this, BookingError);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      retryable: this.retryable,
      details: this.details,
    };
  }
}

module.exports = {
  BookingError,
  safeDetails,
};
