'use strict';

const { createHash } = require('node:crypto');
const { types: { isProxy } } = require('node:util');

const DELIVERY_GUARANTEE = 'at-least-once';
const MAX_EMAIL_LENGTH = 254;
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 1_000_000;
const MAX_PROVIDER_KEY_LENGTH = 200;

const NETWORK_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
]);

const TIMEOUT_ERROR_CODES = new Set([
  'ESOCKETTIMEDOUT',
  'ETIMEDOUT',
]);

class MailgunConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MailgunConfigurationError';
    this.code = 'MAILGUN_CONFIGURATION_INVALID';
    this.retryable = false;
    this.guarantee = DELIVERY_GUARANTEE;
  }
}

class MailgunInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MailgunInputError';
    this.code = code;
    this.retryable = false;
    this.guarantee = DELIVERY_GUARANTEE;
  }
}

class MailgunDeliveryError extends Error {
  constructor({ code, retryable, category }) {
    super('The email provider did not accept the message.');
    this.name = 'MailgunDeliveryError';
    this.code = code;
    this.retryable = retryable;
    this.category = category;
    this.guarantee = DELIVERY_GUARANTEE;
  }
}

function isPlainString(value, { minLength = 1, maxLength }) {
  return typeof value === 'string'
    && value.length >= minLength
    && value.length <= maxLength;
}

function hasHeaderControlCharacters(value) {
  return /[\u0000-\u001f\u007f]/u.test(value);
}

function validateDomain(value) {
  if (!isPlainString(value, { maxLength: 253 })
    || value !== value.trim()
    || hasHeaderControlCharacters(value)
    || !/^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/u.test(value)) {
    throw new MailgunConfigurationError('A valid Mailgun sending domain is required.');
  }

  return value.toLowerCase();
}

function isValidAddress(value) {
  if (!isPlainString(value, { maxLength: MAX_EMAIL_LENGTH })
    || value !== value.trim()
    || hasHeaderControlCharacters(value)
    || /[\s<>(),;:\\"\[\]]/u.test(value)) {
    return false;
  }

  const separator = value.lastIndexOf('@');
  if (separator < 1 || separator === value.length - 1 || value.indexOf('@') !== separator) {
    return false;
  }

  const localPart = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  return localPart.length <= 64
    && !localPart.startsWith('.')
    && !localPart.endsWith('.')
    && !localPart.includes('..')
    && /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/u.test(localPart)
    && domain.length <= 253
    && /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/u.test(domain);
}

function validateConfiguredAddress(value, label) {
  if (!isValidAddress(value)) {
    throw new MailgunConfigurationError(`A valid ${label} is required.`);
  }

  return value;
}

function validateRecipient(value) {
  if (!isValidAddress(value)) {
    throw new MailgunInputError('MAILGUN_RECIPIENT_INVALID', 'A valid recipient address is required.');
  }

  return value;
}

function validateSubject(value) {
  if (!isPlainString(value, { maxLength: MAX_SUBJECT_LENGTH })
    || value !== value.trim()
    || hasHeaderControlCharacters(value)) {
    throw new MailgunInputError('MAILGUN_SUBJECT_INVALID', 'A valid email subject is required.');
  }

  return value;
}

function validateBody(value, label) {
  if (value === undefined) {
    return undefined;
  }

  if (!isPlainString(value, { maxLength: MAX_BODY_LENGTH })) {
    throw new MailgunInputError(`MAILGUN_${label.toUpperCase()}_INVALID`, `A valid ${label} body is required.`);
  }

  return value;
}

function validateProviderKey(value) {
  if (!isPlainString(value, { maxLength: MAX_PROVIDER_KEY_LENGTH })
    || !/^[a-zA-Z0-9._:-]+$/u.test(value)) {
    throw new MailgunInputError(
      'MAILGUN_PROVIDER_KEY_INVALID',
      'A valid deterministic provider key is required.',
    );
  }

  return value;
}

function digestProviderKey(sendingDomain, providerKey) {
  return createHash('sha256')
    .update('barbersbuddies-mailgun:v1\0', 'utf8')
    .update(sendingDomain, 'ascii')
    .update('\0', 'ascii')
    .update(providerKey, 'ascii')
    .digest('hex');
}

function safeRead(value, property) {
  try {
    return value !== null && (typeof value === 'object' || typeof value === 'function')
      ? value[property]
      : undefined;
  } catch (_error) {
    return undefined;
  }
}

function readExactPlainDataObject(value, allowedKeys, createError) {
  try {
    if (value === null
      || typeof value !== 'object'
      || isProxy(value)
      || Object.getPrototypeOf(value) !== Object.prototype) {
      throw createError();
    }

    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string' || !allowedKeys.has(key))) {
      throw createError();
    }

    const result = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined
        || descriptor.enumerable !== true
        || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
        || descriptor.value === value) {
        throw createError();
      }
      result[key] = descriptor.value;
    }
    return result;
  } catch (_error) {
    throw createError();
  }
}

function readDataPropertyWithoutAccessors(value, property) {
  try {
    if (value === null
      || (typeof value !== 'object' && typeof value !== 'function')
      || isProxy(value)) {
      return undefined;
    }

    let current = value;
    while (current !== null) {
      if (isProxy(current)) {
        return undefined;
      }
      const descriptor = Object.getOwnPropertyDescriptor(current, property);
      if (descriptor !== undefined) {
        return Object.prototype.hasOwnProperty.call(descriptor, 'value')
          ? descriptor.value
          : undefined;
      }
      current = Object.getPrototypeOf(current);
    }
    return undefined;
  } catch (_error) {
    return undefined;
  }
}

function readStatus(value) {
  const candidate = safeRead(value, 'status') ?? safeRead(value, 'statusCode');
  if (typeof candidate === 'number' && Number.isInteger(candidate)) {
    return candidate;
  }
  if (typeof candidate === 'string' && /^[1-5][0-9]{2}$/u.test(candidate)) {
    return Number(candidate);
  }
  return undefined;
}

function readSafeToken(value, property) {
  const candidate = safeRead(value, property);
  return typeof candidate === 'string' && /^[A-Za-z0-9_]+$/u.test(candidate)
    ? candidate.toUpperCase()
    : undefined;
}

function classifyProviderFailure(error) {
  const status = readStatus(error);
  const providerCode = readSafeToken(error, 'code');
  const providerName = readSafeToken(error, 'name');

  if (status === 408 || TIMEOUT_ERROR_CODES.has(providerCode)
    || providerName === 'ABORTERROR' || providerName === 'TIMEOUTERROR') {
    return { code: 'MAILGUN_TIMEOUT', retryable: true, category: 'timeout' };
  }
  if (status === 429) {
    return { code: 'MAILGUN_RATE_LIMITED', retryable: true, category: 'rate-limited' };
  }
  if (typeof status === 'number' && status >= 500 && status <= 599) {
    return { code: 'MAILGUN_UNAVAILABLE', retryable: true, category: 'provider-unavailable' };
  }
  if (NETWORK_ERROR_CODES.has(providerCode)) {
    return { code: 'MAILGUN_NETWORK_ERROR', retryable: true, category: 'network' };
  }
  if (status === 401 || status === 403 || status === 404) {
    return { code: 'MAILGUN_CONFIGURATION_REJECTED', retryable: false, category: 'configuration' };
  }
  if (typeof status === 'number' && status >= 400 && status <= 499) {
    return { code: 'MAILGUN_REQUEST_REJECTED', retryable: false, category: 'request-rejected' };
  }

  // An unclassified exception may have happened after Mailgun received the
  // request. Retrying is the safest outbox policy, and the deterministic
  // Message-Id gives operators a stable correlation handle without claiming
  // provider-side idempotency.
  return { code: 'MAILGUN_UNKNOWN_ERROR', retryable: true, category: 'unknown' };
}

function createMailgunProvider(options = {}) {
  const config = readExactPlainDataObject(
    options,
    new Set(['client', 'sendingDomain', 'fromAddress', 'replyTo']),
    () => new MailgunConfigurationError('Mailgun provider configuration is invalid.'),
  );
  const {
    client,
    sendingDomain,
    fromAddress,
    replyTo,
  } = config;
  const messages = readDataPropertyWithoutAccessors(client, 'messages');
  const createMessage = readDataPropertyWithoutAccessors(messages, 'create');
  if (typeof createMessage !== 'function' || isProxy(createMessage)) {
    throw new MailgunConfigurationError('A constructed Mailgun client is required.');
  }

  const validatedDomain = validateDomain(sendingDomain);
  const validatedFrom = validateConfiguredAddress(fromAddress, 'from address');
  const validatedReplyTo = replyTo === undefined
    ? undefined
    : validateConfiguredAddress(replyTo, 'reply-to address');

  async function sendEmail(message = {}) {
    const input = readExactPlainDataObject(
      message,
      new Set(['to', 'subject', 'text', 'html', 'providerKey']),
      () => new MailgunInputError('MAILGUN_MESSAGE_INVALID', 'A valid email message is required.'),
    );
    const {
      to,
      subject,
      text,
      html,
      providerKey,
    } = input;
    const validatedTo = validateRecipient(to);
    const validatedSubject = validateSubject(subject);
    const validatedText = validateBody(text, 'text');
    const validatedHtml = validateBody(html, 'html');
    const validatedKey = validateProviderKey(providerKey);

    if (validatedText === undefined && validatedHtml === undefined) {
      throw new MailgunInputError('MAILGUN_BODY_REQUIRED', 'An email body is required.');
    }

    const correlationDigest = digestProviderKey(validatedDomain, validatedKey);
    const payload = {
      from: validatedFrom,
      to: validatedTo,
      subject: validatedSubject,
      'h:Message-Id': `<bb-${correlationDigest}@${validatedDomain}>`,
      'v:booking-correlation-sha256': correlationDigest,
    };
    if (validatedReplyTo !== undefined) {
      payload['h:Reply-To'] = validatedReplyTo;
    }
    if (validatedText !== undefined) {
      payload.text = validatedText;
    }
    if (validatedHtml !== undefined) {
      payload.html = validatedHtml;
    }

    let response;
    try {
      response = await Reflect.apply(createMessage, messages, [validatedDomain, payload]);
    } catch (error) {
      throw new MailgunDeliveryError(classifyProviderFailure(error));
    }

    const status = readStatus(response);
    if (!Number.isInteger(status) || status < 200 || status > 299) {
      throw new MailgunDeliveryError(classifyProviderFailure(response));
    }

    return Object.freeze({
      accepted: true,
      state: 'accepted',
      delivered: false,
      guarantee: DELIVERY_GUARANTEE,
      correlationId: correlationDigest,
    });
  }

  return Object.freeze({
    guarantee: DELIVERY_GUARANTEE,
    sendEmail,
  });
}

module.exports = {
  DELIVERY_GUARANTEE,
  MailgunConfigurationError,
  MailgunDeliveryError,
  MailgunInputError,
  classifyProviderFailure,
  createMailgunProvider,
};
