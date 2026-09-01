import {
  BookingCommandError,
  cancelBooking,
  createBooking,
  createIdempotencyKey,
  postBookingCommand,
  rescheduleBooking,
} from './bookingCommands';

const successEnvelope = {
  ok: true,
  commandId: 'command-123',
  replayed: false,
  booking: {
    bookingId: 'booking-123',
    version: 1,
    status: 'pending',
    resourceId: 'employee:employee-123',
    startAt: '2026-09-02T08:00:00.000Z',
    endAt: '2026-09-02T08:30:00.000Z',
  },
};

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

describe('booking command client', () => {
  test('posts guest creation to the v2 endpoint without an authorization header', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(successEnvelope));
    const payload = { shopId: 'shop-1', localDate: '2026-09-02' };

    await expect(createBooking({
      baseUrl: 'https://europe-west1-example.cloudfunctions.net///',
      payload,
      idempotencyKey: 'intent-key-123456',
      fetchImpl,
    })).resolves.toEqual(successEnvelope);

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://europe-west1-example.cloudfunctions.net/createBookingV2',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'intent-key-123456',
        },
        body: JSON.stringify(payload),
      },
    );
  });

  test.each([
    ['cancel', cancelBooking, 'cancelBookingV2'],
    ['reschedule', rescheduleBooking, 'rescheduleBookingV2'],
  ])('posts authenticated %s with the expected version', async (_name, command, endpoint) => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(successEnvelope));
    const payload = { bookingId: 'booking-123', expectedVersion: 4 };

    await command({
      baseUrl: 'https://booking.test',
      payload,
      idempotencyKey: 'stable-mutation-key',
      idToken: 'firebase-id-token',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      `https://booking.test/${endpoint}`,
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'stable-mutation-key',
          Authorization: 'Bearer firebase-id-token',
        },
        body: JSON.stringify(payload),
      }),
    );
  });

  test('returns a replayed command envelope unchanged', async () => {
    const replayed = { ...successEnvelope, replayed: true };
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(replayed));

    await expect(createBooking({
      baseUrl: 'https://booking.test',
      payload: { shopId: 'shop-1' },
      idempotencyKey: 'same-key-for-retry',
      fetchImpl,
    })).resolves.toEqual(replayed);

    expect(fetchImpl.mock.calls[0][1].headers['Idempotency-Key']).toBe('same-key-for-retry');
  });

  test.each([
    ['bookingId', { bookingId: '' }],
    ['version', { version: 0 }],
    ['status', { status: 'rescheduled' }],
    ['resourceId', { resourceId: '   ' }],
    ['startAt', { startAt: null }],
    ['endAt', { endAt: '' }],
  ])('rejects a success envelope with an invalid canonical %s', async (_field, patch) => {
    const malformedEnvelope = {
      ...successEnvelope,
      booking: { ...successEnvelope.booking, ...patch },
    };
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(malformedEnvelope));

    await expect(createBooking({
      baseUrl: 'https://booking.test',
      payload: { shopId: 'shop-1' },
      idempotencyKey: 'malformed-success-key',
      fetchImpl,
    })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 200,
      retryable: false,
    });
  });

  test('maps known server errors to stable safe client errors', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({
      ok: false,
      error: {
        code: 'SLOT_CONFLICT',
        message: 'internal collection and document details',
        retryable: false,
      },
    }, { ok: false, status: 409 }));

    await expect(createBooking({
      baseUrl: 'https://booking.test',
      payload: { shopId: 'shop-1' },
      idempotencyKey: 'conflicting-intent',
      fetchImpl,
    })).rejects.toMatchObject({
      name: 'BookingCommandError',
      code: 'SLOT_CONFLICT',
      message: 'That appointment time is no longer available.',
      status: 409,
      retryable: false,
    });
  });

  test('does not expose unknown server error details', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({
      ok: false,
      error: {
        code: 'DATABASE_PASSWORD_LEAK',
        message: 'sensitive internal failure details',
      },
    }, { ok: false, status: 500 }));

    let error;
    try {
      await createBooking({
        baseUrl: 'https://booking.test',
        payload: { shopId: 'shop-1' },
        idempotencyKey: 'server-failure-key',
        fetchImpl,
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(BookingCommandError);
    expect(error).toMatchObject({ code: 'INTERNAL', status: 500, retryable: true });
    expect(JSON.stringify(error)).not.toContain('sensitive');
    expect(JSON.stringify(error)).not.toContain('DATABASE_PASSWORD_LEAK');
  });

  test('maps an unknown non-server HTTP error to a documented safe code', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({
      ok: false,
      error: {
        code: 'UNDOCUMENTED_GATEWAY_CODE',
        message: 'internal gateway details',
      },
    }, { ok: false, status: 418 }));

    await expect(createBooking({
      baseUrl: 'https://booking.test',
      payload: { shopId: 'shop-1' },
      idempotencyKey: 'unknown-error-key',
      fetchImpl,
    })).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: 'The booking request is invalid.',
      status: 418,
    });
  });

  test('maps invalid JSON without retaining parser or response details', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: jest.fn().mockRejectedValue(new Error('unexpected token near secret')),
    });

    await expect(createBooking({
      baseUrl: 'https://booking.test',
      payload: { shopId: 'shop-1' },
      idempotencyKey: 'invalid-json-key',
      fetchImpl,
    })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 502,
      retryable: true,
    });
  });

  test('maps a network failure without retaining transport details', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('DNS details and internal host'));

    await expect(createBooking({
      baseUrl: 'https://booking.test',
      payload: { shopId: 'shop-1' },
      idempotencyKey: 'network-failure-key',
      fetchImpl,
    })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
      retryable: true,
    });
  });

  test('requires caller-owned request identity and mutation authorization inputs', async () => {
    const fetchImpl = jest.fn();

    await expect(postBookingCommand({
      baseUrl: '',
      endpoint: 'createBookingV2',
      payload: {},
      idempotencyKey: 'valid-key-123456',
      fetchImpl,
    })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    await expect(createBooking({
      baseUrl: 'https://booking.test',
      payload: {},
      fetchImpl,
    })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    await expect(cancelBooking({
      baseUrl: 'https://booking.test',
      payload: { bookingId: 'booking-123', expectedVersion: 1 },
      idempotencyKey: 'cancel-key-123456',
      fetchImpl,
    })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    await expect(rescheduleBooking({
      baseUrl: 'https://booking.test',
      payload: { bookingId: 'booking-123', expectedVersion: 0 },
      idempotencyKey: 'reschedule-key-123456',
      idToken: 'firebase-id-token',
      fetchImpl,
    })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('forwards an AbortSignal and maps aborts separately from network failures', async () => {
    const signal = { aborted: false };
    const abortError = new Error('aborted by browser');
    abortError.name = 'AbortError';
    const fetchImpl = jest.fn().mockRejectedValue(abortError);

    await expect(createBooking({
      baseUrl: 'https://booking.test',
      payload: { shopId: 'shop-1' },
      idempotencyKey: 'abort-key-123456',
      fetchImpl,
      signal,
    })).rejects.toMatchObject({ code: 'REQUEST_ABORTED', retryable: false });

    expect(fetchImpl.mock.calls[0][1].signal).toBe(signal);
  });
});

describe('createIdempotencyKey', () => {
  test('uses randomUUID when available', () => {
    const randomUUID = jest.fn().mockReturnValue('12345678-1234-4234-9234-123456789abc');

    expect(createIdempotencyKey({ randomUUID })).toBe(
      '12345678-1234-4234-9234-123456789abc',
    );
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  test('uses secure random bytes for its UUID fallback', () => {
    const getRandomValues = jest.fn((bytes) => {
      bytes.set(Array.from({ length: 16 }, (_, index) => index));
      return bytes;
    });

    const key = createIdempotencyKey({ getRandomValues });

    expect(key).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(getRandomValues).toHaveBeenCalledTimes(1);
  });

  test('fails closed when secure randomness is unavailable', () => {
    expect(() => createIdempotencyKey({})).toThrow(
      expect.objectContaining({ code: 'CRYPTO_UNAVAILABLE' }),
    );
  });
});
