'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const FormData = require('form-data');
const Mailgun = require('mailgun.js');

const {
  MailgunConfigurationError,
  MailgunDeliveryError,
  MailgunInputError,
  createMailgunProvider,
} = require('../../src/booking/mailgun-provider');

function createFakeClient(implementation = async () => ({ status: 200 })) {
  const calls = [];
  return {
    calls,
    client: {
      messages: {
        async create(...args) {
          calls.push(args);
          return implementation(...args);
        },
      },
    },
  };
}

function createProvider(implementation, overrides = {}) {
  const fake = createFakeClient(implementation);
  const provider = createMailgunProvider({
    client: fake.client,
    sendingDomain: 'mail.example.com',
    fromAddress: 'booking@example.com',
    replyTo: 'support@example.com',
    ...overrides,
  });
  return { ...fake, provider };
}

function validMessage(overrides = {}) {
  return {
    to: 'customer@example.net',
    subject: 'Booking confirmed',
    text: 'Your booking is confirmed.',
    html: '<p>Your booking is confirmed.</p>',
    providerKey: 'outbox.01234567:create:v2',
    ...overrides,
  };
}

async function captureError(promise) {
  try {
    await promise;
    assert.fail('Expected the operation to reject.');
  } catch (error) {
    return error;
  }
}

function captureSyncError(action) {
  let caught;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, 'Expected the operation to throw.');
  return caught;
}

test('sends the validated Mailgun payload with deterministic correlation metadata', async () => {
  const { provider, calls } = createProvider(async () => ({ status: 202, id: 'provider-secret-id' }));

  const first = await provider.sendEmail(validMessage());
  const second = await provider.sendEmail(validMessage());

  assert.equal(provider.guarantee, 'at-least-once');
  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    accepted: true,
    state: 'accepted',
    delivered: false,
    guarantee: 'at-least-once',
    correlationId: first.correlationId,
  });
  assert.match(first.correlationId, /^[a-f0-9]{64}$/u);
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'mail.example.com');
  assert.deepEqual(calls[0][1], {
    from: 'booking@example.com',
    to: 'customer@example.net',
    subject: 'Booking confirmed',
    text: 'Your booking is confirmed.',
    html: '<p>Your booking is confirmed.</p>',
    'h:Message-Id': `<bb-${first.correlationId}@mail.example.com>`,
    'h:Reply-To': 'support@example.com',
    'v:booking-correlation-sha256': first.correlationId,
  });
  assert.equal(JSON.stringify(first).includes('provider-secret-id'), false);
});

test('supports the installed Mailgun v9 client shape without making a network request', async () => {
  const client = new Mailgun(FormData).client({
    username: 'api',
    key: 'test-only-not-a-secret',
  });
  const calls = [];
  client.messages.create = async (...args) => {
    calls.push(args);
    return { status: 202 };
  };
  const provider = createMailgunProvider({
    client,
    sendingDomain: 'mail.example.com',
    fromAddress: 'booking@example.com',
  });

  const result = await provider.sendEmail(validMessage());

  assert.equal(result.accepted, true);
  assert.equal(result.delivered, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'mail.example.com');
});

test('supports text-only or html-only messages and an omitted reply-to address', async () => {
  const { provider, calls } = createProvider(undefined, { replyTo: undefined });

  await provider.sendEmail(validMessage({ html: undefined }));
  await provider.sendEmail(validMessage({ text: undefined }));

  assert.equal('html' in calls[0][1], false);
  assert.equal('h:Reply-To' in calls[0][1], false);
  assert.equal('text' in calls[1][1], false);
});

test('different provider keys produce different identifiers without exposing the raw key', async () => {
  const { provider, calls } = createProvider();
  const secretLookingKey = 'outbox.secret-customer-reference';

  const first = await provider.sendEmail(validMessage({ providerKey: secretLookingKey }));
  const second = await provider.sendEmail(validMessage({ providerKey: 'outbox.other-reference' }));

  assert.notEqual(first.correlationId, second.correlationId);
  assert.equal(JSON.stringify(calls).includes(secretLookingKey), false);
});

test('rejects missing or malformed injected configuration before sending', () => {
  const fake = createFakeClient();
  const cases = [
    null,
    { client: undefined, sendingDomain: 'mail.example.com', fromAddress: 'booking@example.com' },
    { client: fake.client, sendingDomain: 'localhost', fromAddress: 'booking@example.com' },
    { client: fake.client, sendingDomain: 'mail.example.com\r\nBcc: victim@example.com', fromAddress: 'booking@example.com' },
    { client: fake.client, sendingDomain: 'mail.example.com', fromAddress: 'Booking <booking@example.com>' },
    { client: fake.client, sendingDomain: 'mail.example.com', fromAddress: 'booking@example.com\n' },
    { client: fake.client, sendingDomain: 'mail.example.com', fromAddress: 'booking@example.com', replyTo: '' },
  ];

  for (const config of cases) {
    assert.throws(() => createMailgunProvider(config), MailgunConfigurationError);
  }
  assert.equal(fake.calls.length, 0);
});

test('rejects hostile configuration accessors, proxies, symbols, cycles, and unexpected shapes safely', () => {
  const rawSecret = 'raw-config-secret';
  const fixedMessage = 'Mailgun provider configuration is invalid.';
  const base = {
    client: createFakeClient().client,
    sendingDomain: 'mail.example.com',
    fromAddress: 'booking@example.com',
  };
  const getterConfig = { ...base };
  Object.defineProperty(getterConfig, 'replyTo', {
    enumerable: true,
    get() { throw new Error(rawSecret); },
  });
  const proxyConfig = new Proxy(base, {
    get() { throw new Error(rawSecret); },
    ownKeys() { throw new Error(rawSecret); },
    getPrototypeOf() { throw new Error(rawSecret); },
  });
  const symbolConfig = { ...base, [Symbol(rawSecret)]: true };
  const cyclicConfig = { ...base };
  cyclicConfig.client = cyclicConfig;
  const nonPlainConfig = Object.assign(Object.create({ inherited: true }), base);
  const unexpectedConfig = { ...base, apiKey: rawSecret };
  const nonEnumerableConfig = { ...base };
  Object.defineProperty(nonEnumerableConfig, 'replyTo', { value: 'support@example.com' });

  for (const config of [
    getterConfig,
    proxyConfig,
    symbolConfig,
    cyclicConfig,
    nonPlainConfig,
    unexpectedConfig,
    nonEnumerableConfig,
  ]) {
    const error = captureSyncError(() => createMailgunProvider(config));
    assert.ok(error instanceof MailgunConfigurationError);
    assert.equal(error.message, fixedMessage);
    assert.equal(error.message.includes(rawSecret), false);
    assert.equal('cause' in error, false);
  }
});

test('rejects accessor-backed or proxied Mailgun clients without evaluating their properties', () => {
  let getterReads = 0;
  const clientWithGetter = {};
  Object.defineProperty(clientWithGetter, 'messages', {
    enumerable: true,
    get() {
      getterReads += 1;
      throw new Error('raw-client-secret');
    },
  });
  const proxyClient = new Proxy({}, {
    get() { throw new Error('raw-client-secret'); },
  });
  let applyCalls = 0;
  const clientWithProxyMethod = {
    messages: {
      create: new Proxy(async () => ({ status: 200 }), {
        apply() {
          applyCalls += 1;
          throw new Error('raw-client-secret');
        },
      }),
    },
  };

  for (const client of [clientWithGetter, proxyClient, clientWithProxyMethod]) {
    const error = captureSyncError(() => createMailgunProvider({
      client,
      sendingDomain: 'mail.example.com',
      fromAddress: 'booking@example.com',
    }));
    assert.ok(error instanceof MailgunConfigurationError);
    assert.equal(error.message.includes('raw-client-secret'), false);
  }
  assert.equal(getterReads, 0);
  assert.equal(applyCalls, 0);
});

test('rejects hostile headers, addresses, keys, and invalid bodies without calling Mailgun', async () => {
  const { provider, calls } = createProvider();
  const cases = [
    validMessage({ to: 'customer@example.net\r\nBcc: victim@example.com' }),
    validMessage({ to: 'not-an-address' }),
    validMessage({ to: '.customer@example.net' }),
    validMessage({ subject: 'Confirmed\nBcc: victim@example.com' }),
    validMessage({ subject: ' '.repeat(2) }),
    validMessage({ providerKey: 'outbox\r\nX-Header:value' }),
    validMessage({ providerKey: 'x'.repeat(201) }),
    validMessage({ text: undefined, html: undefined }),
    validMessage({ text: '' }),
    validMessage({ html: '' }),
    validMessage({ text: 'x'.repeat(1_000_001) }),
  ];

  for (const message of cases) {
    await assert.rejects(provider.sendEmail(message), MailgunInputError);
  }
  await assert.rejects(provider.sendEmail(null), MailgunInputError);
  assert.equal(calls.length, 0);
});

test('rejects hostile message accessors, proxies, symbols, cycles, and unexpected shapes safely', async () => {
  const { provider, calls } = createProvider();
  const rawSecret = 'raw-message-secret';
  const getterMessage = validMessage();
  Object.defineProperty(getterMessage, 'to', {
    enumerable: true,
    get() { throw new Error(rawSecret); },
  });
  const proxyMessage = new Proxy(validMessage(), {
    get() { throw new Error(rawSecret); },
    ownKeys() { throw new Error(rawSecret); },
    getPrototypeOf() { throw new Error(rawSecret); },
  });
  const symbolMessage = { ...validMessage(), [Symbol(rawSecret)]: true };
  const cyclicMessage = validMessage();
  cyclicMessage.html = cyclicMessage;
  const nonPlainMessage = Object.assign(Object.create({ inherited: true }), validMessage());
  const unexpectedMessage = { ...validMessage(), apiKey: rawSecret };
  const nonEnumerableMessage = validMessage();
  delete nonEnumerableMessage.html;
  Object.defineProperty(nonEnumerableMessage, 'html', { value: '<p>hidden</p>' });

  for (const [caseName, message] of [
    ['getter', getterMessage],
    ['proxy', proxyMessage],
    ['symbol', symbolMessage],
    ['cycle', cyclicMessage],
    ['nonplain', nonPlainMessage],
    ['unexpected', unexpectedMessage],
    ['nonenumerable', nonEnumerableMessage],
  ]) {
    const error = await captureError(provider.sendEmail(message));
    assert.ok(error instanceof MailgunInputError, caseName);
    assert.equal(error.code, 'MAILGUN_MESSAGE_INVALID', caseName);
    assert.equal(error.message, 'A valid email message is required.', caseName);
    assert.equal(error.message.includes(rawSecret), false, caseName);
    assert.equal('cause' in error, false, caseName);
  }
  assert.equal(calls.length, 0);
});

test('classifies timeouts, networks, rate limits, and provider failures as retryable', async () => {
  const cases = [
    [{ code: 'ETIMEDOUT' }, 'MAILGUN_TIMEOUT', 'timeout'],
    [{ name: 'AbortError' }, 'MAILGUN_TIMEOUT', 'timeout'],
    [{ code: 'ECONNRESET' }, 'MAILGUN_NETWORK_ERROR', 'network'],
    [{ status: 429 }, 'MAILGUN_RATE_LIMITED', 'rate-limited'],
    [{ statusCode: '503' }, 'MAILGUN_UNAVAILABLE', 'provider-unavailable'],
  ];

  for (const [providerError, code, category] of cases) {
    const { provider } = createProvider(async () => {
      throw providerError;
    });
    const error = await captureError(provider.sendEmail(validMessage()));
    assert.ok(error instanceof MailgunDeliveryError);
    assert.equal(error.code, code);
    assert.equal(error.category, category);
    assert.equal(error.retryable, true);
    assert.equal(error.guarantee, 'at-least-once');
  }
});

test('classifies provider auth, configuration, recipient, and template rejections as non-retryable', async () => {
  const cases = [
    [{ status: 400, body: 'invalid recipient customer@example.net' }, 'MAILGUN_REQUEST_REJECTED', 'request-rejected'],
    [{ status: 401 }, 'MAILGUN_CONFIGURATION_REJECTED', 'configuration'],
    [{ status: 403 }, 'MAILGUN_CONFIGURATION_REJECTED', 'configuration'],
    [{ status: 404 }, 'MAILGUN_CONFIGURATION_REJECTED', 'configuration'],
    [{ status: 422, message: 'template missing' }, 'MAILGUN_REQUEST_REJECTED', 'request-rejected'],
  ];

  for (const [providerError, code, category] of cases) {
    const { provider } = createProvider(async () => {
      throw providerError;
    });
    const error = await captureError(provider.sendEmail(validMessage()));
    assert.equal(error.code, code);
    assert.equal(error.category, category);
    assert.equal(error.retryable, false);
  }
});

test('treats only explicit 2xx responses as accepted, never as delivered', async () => {
  for (const response of [{ status: 200 }, { status: '204' }, { statusCode: 202 }]) {
    const { provider } = createProvider(async () => response);
    const result = await provider.sendEmail(validMessage());
    assert.equal(result.accepted, true);
    assert.equal(result.delivered, false);
    assert.equal(result.state, 'accepted');
  }

  for (const response of [{}, null, { status: 302 }, { status: 429 }, { status: 500 }]) {
    const { provider } = createProvider(async () => response);
    await assert.rejects(provider.sendEmail(validMessage()), MailgunDeliveryError);
  }
});

test('unknown and malformed failures are retryable but reveal no provider body, PII, or secrets', async () => {
  const sensitiveValues = [
    'customer@example.net',
    'super-secret-provider-body',
    'api-key-value',
    'Your booking is confirmed.',
  ];
  const hostile = Object.create(null, {
    status: { get() { throw new Error('super-secret-provider-body'); } },
    statusCode: { get() { throw new Error('customer@example.net'); } },
    code: { get() { throw new Error('api-key-value'); } },
    name: { get() { throw new Error('Your booking is confirmed.'); } },
    message: { get() { throw new Error('must not be read'); } },
    toString: { get() { throw new Error('must not be read'); } },
  });
  const { provider } = createProvider(async () => {
    throw hostile;
  });

  const error = await captureError(provider.sendEmail(validMessage()));
  assert.equal(error.code, 'MAILGUN_UNKNOWN_ERROR');
  assert.equal(error.category, 'unknown');
  assert.equal(error.retryable, true);
  assert.equal('cause' in error, false);
  const serialized = JSON.stringify({
    name: error.name,
    message: error.message,
    code: error.code,
    category: error.category,
  });
  for (const sensitive of sensitiveValues) {
    assert.equal(serialized.includes(sensitive), false);
  }
});

test('redacts hostile getters on non-2xx provider responses', async () => {
  const response = Object.create(null, {
    status: { get() { throw new Error('raw-response-secret'); } },
    statusCode: { get() { throw new Error('customer@example.net'); } },
  });
  const { provider } = createProvider(async () => response);

  const error = await captureError(provider.sendEmail(validMessage()));
  assert.ok(error instanceof MailgunDeliveryError);
  assert.equal(error.code, 'MAILGUN_UNKNOWN_ERROR');
  assert.equal(error.retryable, true);
  assert.equal(error.message.includes('raw-response-secret'), false);
  assert.equal(error.message.includes('customer@example.net'), false);
  assert.equal('cause' in error, false);
});

test('does not expose raw provider errors even when their safe status is classified', async () => {
  const raw = {
    status: 500,
    message: 'provider body with customer@example.net and api-key-value',
    response: { body: 'provider-secret-body' },
  };
  const { provider } = createProvider(async () => {
    throw raw;
  });

  const error = await captureError(provider.sendEmail(validMessage()));
  assert.equal(error.code, 'MAILGUN_UNAVAILABLE');
  assert.equal('cause' in error, false);
  assert.equal(JSON.stringify(error).includes('customer@example.net'), false);
  assert.equal(JSON.stringify(error).includes('provider-secret-body'), false);
});
