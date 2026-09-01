'use strict';

const { BookingError } = require('./errors');

const SUPPORTED_CURRENCY = 'EUR';
const SUPPORTED_MINOR_UNIT_DIGITS = 2;
const SUPPORTED_CURRENCY_POLICY = Object.freeze({
  currency: SUPPORTED_CURRENCY,
  minorUnitDigits: SUPPORTED_MINOR_UNIT_DIGITS,
});

function currencyError(field) {
  return new BookingError(
    'INVALID_ARGUMENT',
    `${field} must use the supported currency ${SUPPORTED_CURRENCY}`,
    {
      httpStatus: 400,
      retryable: false,
      details: {
        field,
        supportedCurrency: SUPPORTED_CURRENCY,
      },
    },
  );
}

function resolveCurrencyPolicy(value, field = 'currency') {
  if (value !== SUPPORTED_CURRENCY) {
    throw currencyError(field);
  }
  return SUPPORTED_CURRENCY_POLICY;
}

function normalizePriceMinor(value, field = 'priceMinor') {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BookingError(
      'INVALID_ARGUMENT',
      `${field} must be a non-negative safe integer`,
      {
        httpStatus: 400,
        retryable: false,
        details: { field },
      },
    );
  }
  return value;
}

function formatMinorAmount(priceMinor, currency = SUPPORTED_CURRENCY) {
  const policy = resolveCurrencyPolicy(currency);
  const normalizedPrice = normalizePriceMinor(priceMinor);
  const divisor = 10 ** policy.minorUnitDigits;
  const whole = Math.floor(normalizedPrice / divisor);
  const fraction = String(normalizedPrice % divisor).padStart(policy.minorUnitDigits, '0');
  return `${whole}.${fraction}`;
}

module.exports = {
  SUPPORTED_CURRENCY,
  SUPPORTED_MINOR_UNIT_DIGITS,
  formatMinorAmount,
  resolveCurrencyPolicy,
};
