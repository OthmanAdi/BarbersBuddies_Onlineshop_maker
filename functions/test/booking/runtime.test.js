'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { BookingError } = require('../../src/booking/errors');
const {
  assertBookingV2Enabled,
  isBookingV2Enabled,
  withBookingV2Runtime,
} = require('../../src/booking/runtime');

test('production-like environments are disabled by default', () => {
  assert.equal(isBookingV2Enabled({}), false);
  assert.equal(isBookingV2Enabled(Object.create(null)), false);
});

test('the exact emulator flag enables booking v2', () => {
  assert.equal(isBookingV2Enabled({ FUNCTIONS_EMULATOR: 'true' }), true);
});

test('the exact explicit activation flag enables booking v2', () => {
  assert.equal(isBookingV2Enabled({ BOOKING_V2_ENABLED: 'true' }), true);
});

test('either exact flag is sufficient', () => {
  assert.equal(isBookingV2Enabled({
    FUNCTIONS_EMULATOR: 'false',
    BOOKING_V2_ENABLED: 'true',
  }), true);
});

test('misleading flag values remain disabled', () => {
  for (const value of [true, 1, 'TRUE', 'True', ' true', 'true ', '1', 'yes']) {
    assert.equal(
      isBookingV2Enabled({ FUNCTIONS_EMULATOR: value }),
      false,
      `unexpectedly enabled for ${JSON.stringify(value)}`,
    );
  }
});

test('inherited activation flags do not enable the runtime', () => {
  const env = Object.create({ BOOKING_V2_ENABLED: 'true' });
  assert.equal(isBookingV2Enabled(env), false);
});

test('non-object and array environments fail closed', () => {
  for (const env of [undefined, null, true, 'true', 1, [], () => {}]) {
    assert.equal(isBookingV2Enabled(env), false);
  }
});

test('throwing environment access fails closed', () => {
  const env = {};
  Object.defineProperty(env, 'FUNCTIONS_EMULATOR', {
    enumerable: true,
    get() {
      throw new Error('sensitive environment failure');
    },
  });

  assert.equal(isBookingV2Enabled(env), false);
});

test('a revoked environment proxy fails closed', () => {
  const { proxy, revoke } = Proxy.revocable(
    { FUNCTIONS_EMULATOR: 'true' },
    {},
  );
  revoke();

  assert.equal(isBookingV2Enabled(proxy), false);
});

test('assertion rejects with a stable redacted BookingError', () => {
  assert.throws(
    () => assertBookingV2Enabled({ SECRET_VALUE: 'must-not-appear' }),
    (error) => {
      assert.ok(error instanceof BookingError);
      assert.equal(error.code, 'FORBIDDEN');
      assert.equal(error.message, 'Booking v2 is not enabled.');
      assert.equal(error.httpStatus, 403);
      assert.equal(error.retryable, false);
      assert.deepEqual(error.details, {});
      assert.doesNotMatch(JSON.stringify(error), /SECRET_VALUE|must-not-appear/);
      return true;
    },
  );
});

test('assertion permits either exact activation flag', () => {
  assert.doesNotThrow(() => assertBookingV2Enabled({ FUNCTIONS_EMULATOR: 'true' }));
  assert.doesNotThrow(() => assertBookingV2Enabled({ BOOKING_V2_ENABLED: 'true' }));
});

test('wrapper rejects invalid dependencies during construction', () => {
  assert.throws(() => withBookingV2Runtime(null), /command must be a function/);
  assert.throws(() => withBookingV2Runtime(() => {}, null), /options must be an object/);
  assert.throws(
    () => withBookingV2Runtime(() => {}, { env: 'FUNCTIONS_EMULATOR=true' }),
    /env must be an object/,
  );
  assert.throws(
    () => withBookingV2Runtime(() => {}, { env: [] }),
    /env must be an object/,
  );
});

test('disabled wrapper rejects without invoking the command', () => {
  let calls = 0;
  const guarded = withBookingV2Runtime(
    () => {
      calls += 1;
    },
    { env: {} },
  );

  assert.throws(() => guarded('ignored'), (error) => error.code === 'FORBIDDEN');
  assert.equal(calls, 0);
});

test('enabled wrapper preserves arguments, return value, and receiver', () => {
  const receiver = {
    prefix: 'booking',
    command: withBookingV2Runtime(
      function command(first, second) {
        return `${this.prefix}:${first}:${second}`;
      },
      { env: { BOOKING_V2_ENABLED: 'true' } },
    ),
  };

  assert.equal(receiver.command('one', 'two'), 'booking:one:two');
});

test('enabled wrapper passes through promise results unchanged', async () => {
  const result = Promise.resolve({ ok: true });
  const guarded = withBookingV2Runtime(() => result, {
    env: { FUNCTIONS_EMULATOR: 'true' },
  });

  assert.equal(guarded(), result);
  assert.deepEqual(await guarded(), { ok: true });
});
