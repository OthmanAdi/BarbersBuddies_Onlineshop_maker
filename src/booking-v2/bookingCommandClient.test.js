import { createBookingCommandClient } from './bookingCommandClient';

const endpoints = {
  create: 'http://127.0.0.1:5001/demo-barbersbuddies/europe-west1/createBookingV2',
  cancel: 'http://127.0.0.1:5001/demo-barbersbuddies/europe-west1/cancelBookingV2',
  reschedule: 'http://127.0.0.1:5001/demo-barbersbuddies/europe-west1/rescheduleBookingV2',
};

const successEnvelope = {
  ok: true,
  commandId: 'command-123',
  replayed: false,
  booking: {
    bookingId: 'booking-123',
    version: 1,
    status: 'pending',
    resourceId: 'employee:employee-123',
    startAt: '2026-09-03T07:30:00.000Z',
    endAt: '2026-09-03T08:00:00.000Z',
  },
};

function response(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

function client(overrides = {}) {
  return createBookingCommandClient({
    endpoints,
    getIdToken: jest.fn().mockResolvedValue('firebase.id.token'),
    fetchImpl: jest.fn().mockResolvedValue(response(successEnvelope)),
    ...overrides,
  });
}

const command = {
  operation: 'create',
  payload: {
    shopId: 'shop-123',
    localDate: '2026-09-03',
    localStartTime: '09:30',
  },
  idempotencyKey: '00000000-0000-4000-8000-000000000001',
};

describe('authenticated booking command boundary', () => {
  test('gets an injected ID token and sends one POST JSON request', async () => {
    const getIdToken = jest.fn().mockResolvedValue('firebase.id.token');
    const fetchImpl = jest.fn().mockResolvedValue(response(successEnvelope));
    const bookingClient = client({ getIdToken, fetchImpl });

    await expect(bookingClient.execute(command)).resolves.toEqual(successEnvelope);

    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(getIdToken).toHaveBeenCalledWith();
    expect(fetchImpl).toHaveBeenCalledWith(endpoints.create, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer firebase.id.token',
        'Content-Type': 'application/json',
        'Idempotency-Key': command.idempotencyKey,
      },
      body: JSON.stringify(command.payload),
      signal: expect.any(Object),
    });
  });

  test('uses the same idempotency-key alphabet as the booking backend', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(successEnvelope));
    const bookingClient = client({ fetchImpl });

    await expect(bookingClient.execute({
      ...command,
      idempotencyKey: 'request:key.0000001',
    })).resolves.toMatchObject({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await expect(bookingClient.execute({
      ...command,
      idempotencyKey: 'request~key.0000001',
    })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('snapshots validated payload before awaiting token acquisition', async () => {
    let releaseToken;
    const token = new Promise((resolve) => {
      releaseToken = resolve;
    });
    const payload = { ...command.payload };
    const fetchImpl = jest.fn().mockResolvedValue(response(successEnvelope));
    const bookingClient = client({
      getIdToken: jest.fn(() => token),
      fetchImpl,
    });
    const pending = bookingClient.execute({ ...command, payload });

    payload.localStartTime = '18:00';
    payload.unvalidated = () => 'must not cross the boundary';
    releaseToken('firebase.id.token');

    await expect(pending).resolves.toEqual(successEnvelope);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual(command.payload);
  });

  test('supports guest create only through explicit configuration', async () => {
    const getIdToken = jest.fn().mockRejectedValue(new Error('must not run'));
    const fetchImpl = jest.fn().mockResolvedValue(response(successEnvelope));
    const bookingClient = client({
      createAuthMode: 'guest',
      getIdToken,
      fetchImpl,
    });

    await expect(bookingClient.execute(command)).resolves.toEqual(successEnvelope);
    expect(getIdToken).not.toHaveBeenCalled();
    expect(fetchImpl.mock.calls[0][1].headers).toEqual({
      'Content-Type': 'application/json',
      'Idempotency-Key': command.idempotencyKey,
    });
  });

  test.each(['cancel', 'reschedule'])(
    'keeps %s authenticated even when create is configured for guests',
    async (operation) => {
      const getIdToken = jest.fn().mockResolvedValue('firebase.id.token');
      const fetchImpl = jest.fn().mockResolvedValue(response(successEnvelope));
      const bookingClient = client({
        createAuthMode: 'guest',
        getIdToken,
        fetchImpl,
      });

      await bookingClient.execute({ ...command, operation });

      expect(getIdToken).toHaveBeenCalledTimes(1);
      expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe(
        'Bearer firebase.id.token'
      );
    }
  );

  test('does not call the endpoint when token acquisition fails', async () => {
    const fetchImpl = jest.fn();
    const bookingClient = client({
      getIdToken: jest.fn().mockRejectedValue(new Error('private token details')),
      fetchImpl,
    });

    let error;
    try {
      await bookingClient.execute(command);
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({
      code: 'AUTH_TOKEN_FAILED',
      ambiguous: false,
      retryable: true,
    });
    expect(JSON.stringify(error)).not.toContain('private token details');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test.each([
    ['class instance', new Date('2026-09-03T09:30:00Z')],
    ['undefined property', { shopId: undefined }],
    ['sparse array', { serviceIds: Array(1) }],
  ])('rejects a %s payload before token or network access', async (_name, payload) => {
    const getIdToken = jest.fn();
    const fetchImpl = jest.fn();
    const bookingClient = client({ getIdToken, fetchImpl });

    await expect(bookingClient.execute({ ...command, payload }))
      .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(getIdToken).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('returns a canonical replayed success envelope', async () => {
    const replayed = { ...successEnvelope, replayed: true };
    const bookingClient = client({
      fetchImpl: jest.fn().mockResolvedValue(response(replayed)),
    });

    await expect(bookingClient.execute(command)).resolves.toEqual(replayed);
  });

  test('maps a canonical server failure without exposing its message', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response({
      ok: false,
      error: {
        code: 'SLOT_CONFLICT',
        message: 'internal collection details and private@example.test',
        retryable: false,
      },
    }, { ok: false, status: 409 }));
    const bookingClient = client({ fetchImpl });

    let error;
    try {
      await bookingClient.execute(command);
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({
      code: 'SLOT_CONFLICT',
      status: 409,
      retryable: false,
      ambiguous: false,
    });
    expect(JSON.stringify(error)).not.toContain('private@example.test');
    expect(JSON.stringify(error)).not.toContain('internal collection');
  });

  test('treats non-JSON responses as ambiguous instead of guessing success', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new Error('private response body')),
    });
    const bookingClient = client({ fetchImpl });

    await expect(bookingClient.execute(command)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 200,
      retryable: true,
      ambiguous: true,
    });
  });

  test.each(['status', 'ok', 'json'])(
    'rejects an own %s accessor without invoking or exposing it',
    async (property) => {
      const getter = jest.fn(() => {
        throw new Error(`private ${property} response detail`);
      });
      const hostileResponse = response(successEnvelope);
      Object.defineProperty(hostileResponse, property, {
        configurable: true,
        enumerable: true,
        get: getter,
      });
      const bookingClient = client({
        fetchImpl: jest.fn().mockResolvedValue(hostileResponse),
      });

      let error;
      try {
        await bookingClient.execute(command);
      } catch (caught) {
        error = caught;
      }
      expect(error).toMatchObject({
        code: 'INVALID_RESPONSE',
        retryable: true,
        ambiguous: true,
      });
      expect(getter).not.toHaveBeenCalled();
      expect(JSON.stringify(error)).not.toContain('private');
    }
  );

  test('never reads irrelevant statusText or headers accessors', async () => {
    const statusTextGetter = jest.fn(() => {
      throw new Error('private status text');
    });
    const headersGetter = jest.fn(() => {
      throw new Error('private response headers');
    });
    const guardedResponse = response(successEnvelope);
    Object.defineProperties(guardedResponse, {
      statusText: { enumerable: true, get: statusTextGetter },
      headers: { enumerable: true, get: headersGetter },
    });
    const bookingClient = client({
      fetchImpl: jest.fn().mockResolvedValue(guardedResponse),
    });

    await expect(bookingClient.execute(command)).resolves.toEqual(successEnvelope);
    expect(statusTextGetter).not.toHaveBeenCalled();
    expect(headersGetter).not.toHaveBeenCalled();
  });

  test('normalizes a hostile response proxy without exposing trap details', async () => {
    const descriptorTrap = jest.fn(() => {
      throw new Error('private proxy response detail');
    });
    const hostileResponse = new Proxy(response(successEnvelope), {
      getOwnPropertyDescriptor: descriptorTrap,
    });
    const bookingClient = client({
      fetchImpl: jest.fn().mockResolvedValue(hostileResponse),
    });

    let error;
    try {
      await bookingClient.execute(command);
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({
      code: 'INVALID_RESPONSE',
      retryable: true,
      ambiguous: true,
    });
    expect(descriptorTrap).toHaveBeenCalled();
    expect(JSON.stringify(error)).not.toContain('private proxy');
  });

  test('normalizes a hostile inherited response getter without exposing it', async () => {
    const prototype = {};
    Object.defineProperty(prototype, 'ok', {
      get() {
        throw new Error('private inherited response detail');
      },
    });
    const hostileResponse = Object.assign(Object.create(prototype), {
      status: 200,
      json: jest.fn().mockResolvedValue(successEnvelope),
    });
    const bookingClient = client({
      fetchImpl: jest.fn().mockResolvedValue(hostileResponse),
    });

    let error;
    try {
      await bookingClient.execute(command);
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({
      code: 'INVALID_RESPONSE',
      ambiguous: true,
    });
    expect(JSON.stringify(error)).not.toContain('private inherited');
  });

  test('treats network failure as ambiguous and preserves retry semantics', async () => {
    const bookingClient = client({
      fetchImpl: jest.fn().mockRejectedValue(new Error('private network detail')),
    });

    await expect(bookingClient.execute(command)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      retryable: true,
      ambiguous: true,
    });
  });

  test('times out a dispatched request without guessing its outcome', async () => {
    jest.useFakeTimers();
    try {
      let confirmDispatched;
      const dispatched = new Promise((resolve) => {
        confirmDispatched = resolve;
      });
      const bookingClient = client({
        fetchImpl: jest.fn(() => {
          confirmDispatched();
          return new Promise(() => {});
        }),
        timeoutMs: 25,
      });
      const pending = bookingClient.execute(command);
      await dispatched;
      jest.advanceTimersByTime(25);

      await expect(pending).rejects.toMatchObject({
        code: 'REQUEST_TIMEOUT',
        retryable: true,
        ambiguous: true,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  test('distinguishes caller abort while retaining ambiguous request identity', async () => {
    const external = new AbortController();
    let confirmDispatched;
    const dispatched = new Promise((resolve) => {
      confirmDispatched = resolve;
    });
    const bookingClient = client({
      fetchImpl: jest.fn(() => {
        confirmDispatched();
        return new Promise(() => {});
      }),
    });
    const pending = bookingClient.execute({ ...command, signal: external.signal });
    await dispatched;
    external.abort();

    await expect(pending).rejects.toMatchObject({
      code: 'REQUEST_ABORTED',
      retryable: false,
      ambiguous: true,
    });
  });

  test.each([
    ['extra success field', { ...successEnvelope, debug: true }],
    ['unknown failure code', {
      ok: false,
      error: { code: 'PRIVATE_ERROR', message: 'private', retryable: true },
    }],
  ])('rejects %s as an ambiguous invalid envelope', async (_name, envelope) => {
    const bookingClient = client({
      fetchImpl: jest.fn().mockResolvedValue(response(envelope)),
    });

    await expect(bookingClient.execute(command)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      ambiguous: true,
    });
  });
});

describe('configuration safety', () => {
  test('does not contain a default endpoint and requires exact v2 operations', () => {
    expect(() => createBookingCommandClient({
      endpoints: { create: endpoints.create },
      getIdToken: jest.fn(),
      fetchImpl: jest.fn(),
    })).toThrow(expect.objectContaining({ code: 'INVALID_CLIENT_CONFIGURATION' }));
  });

  test.each([
    'http://production.example/createBookingV2',
    'https://example.test/notBookingV2',
    'https://user:password@example.test/createBookingV2',
    'https://example.test/createBookingV2?secret=value',
  ])('rejects unsafe create endpoint %s', (create) => {
    expect(() => createBookingCommandClient({
      endpoints: { ...endpoints, create },
      getIdToken: jest.fn(),
      fetchImpl: jest.fn(),
    })).toThrow(expect.objectContaining({ code: 'INVALID_CLIENT_CONFIGURATION' }));
  });

  test.each(['optional', 'anonymous', true, null])(
    'rejects invalid create auth mode %p',
    (createAuthMode) => {
      expect(() => client({ createAuthMode })).toThrow(expect.objectContaining({
        code: 'INVALID_CLIENT_CONFIGURATION',
      }));
    }
  );
});
