'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { BookingError } = require('../../src/booking/errors');
const {
  MAX_TRANSACTION_OCCUPANCY_MINUTES,
  assertWithinAvailability,
  resolveBookableInterval,
  resolveBookingInterval,
} = require('../../src/booking/time');

const MONDAY_HOURS = Object.freeze({
  monday: Object.freeze([
    Object.freeze({ startLocalTime: '09:00', endLocalTime: '18:00' }),
  ]),
});

function assertBookingError(callback, code) {
  const expectedStatus = code === 'OUTSIDE_AVAILABILITY' ||
    code === 'SHOP_TIMEZONE_REQUIRED'
    ? 422
    : 400;
  assert.throws(callback, (error) => {
    assert.ok(error instanceof BookingError);
    assert.equal(error.code, code);
    assert.equal(error.httpStatus, expectedStatus);
    assert.equal(error.retryable, false);
    return true;
  });
}

test('resolves Berlin winter civil time with the UTC+1 offset', () => {
  const interval = resolveBookingInterval({
    localDate: '2026-01-15',
    localStartTime: '10:00',
    timeZone: 'Europe/Berlin',
    durationMinutes: 60,
  });

  assert.equal(interval.startAtEpochMs, Date.parse('2026-01-15T09:00:00Z'));
  assert.equal(interval.endAtEpochMs, Date.parse('2026-01-15T10:00:00Z'));
  assert.equal(interval.timeZone, 'Europe/Berlin');
  assert.equal(interval.weekday, 'thursday');
  assert.ok(Object.isFrozen(interval));
});

test('resolves Berlin summer civil time with the UTC+2 offset', () => {
  const interval = resolveBookingInterval({
    localDate: '2026-07-15',
    localStartTime: '10:00',
    timeZone: 'Europe/Berlin',
    durationMinutes: 60,
  });

  assert.equal(interval.startAtEpochMs, Date.parse('2026-07-15T08:00:00Z'));
  assert.equal(interval.endAtEpochMs, Date.parse('2026-07-15T09:00:00Z'));
});

test('rejects the Berlin 2026 spring DST gap', () => {
  assertBookingError(() => resolveBookingInterval({
    localDate: '2026-03-29',
    localStartTime: '02:30',
    timeZone: 'Europe/Berlin',
    durationMinutes: 30,
  }), 'INVALID_TIME');
});

test('rejects the Berlin 2026 autumn DST fold instead of choosing an offset', () => {
  assertBookingError(() => resolveBookingInterval({
    localDate: '2026-10-25',
    localStartTime: '02:30',
    timeZone: 'Europe/Berlin',
    durationMinutes: 30,
  }), 'INVALID_TIME');
});

test('preserves stable error codes for invalid zones, dates, and times', async (t) => {
  const cases = [
    {
      name: 'invalid IANA zone',
      input: {
        localDate: '2026-01-15',
        localStartTime: '10:00',
        timeZone: 'Europe/Not_A_Zone',
        durationMinutes: 30,
      },
      code: 'SHOP_TIMEZONE_REQUIRED',
    },
    {
      name: 'fixed offset instead of IANA zone',
      input: {
        localDate: '2026-01-15',
        localStartTime: '10:00',
        timeZone: '+01:00',
        durationMinutes: 30,
      },
      code: 'SHOP_TIMEZONE_REQUIRED',
    },
    {
      name: 'invalid civil date',
      input: {
        localDate: '2026-02-30',
        localStartTime: '10:00',
        timeZone: 'Europe/Berlin',
        durationMinutes: 30,
      },
      code: 'INVALID_DATE',
    },
    {
      name: 'invalid civil time',
      input: {
        localDate: '2026-01-15',
        localStartTime: '24:00',
        timeZone: 'Europe/Berlin',
        durationMinutes: 30,
      },
      code: 'INVALID_TIME',
    },
  ];

  for (const fixture of cases) {
    await t.test(fixture.name, () => {
      assertBookingError(() => resolveBookingInterval(fixture.input), fixture.code);
    });
  }
});

test('accepts an occupied interval whose half-open end equals closing time', () => {
  const interval = resolveBookableInterval({
    localDate: '2026-01-05',
    localStartTime: '17:30',
    timeZone: 'Europe/Berlin',
    durationMinutes: 30,
    weeklyAvailability: MONDAY_HOURS,
  });

  assert.equal(interval.occupiedEndMinute, 18 * 60);
});

test('rejects a booking starting at closing time', () => {
  assertBookingError(() => resolveBookableInterval({
    localDate: '2026-01-05',
    localStartTime: '18:00',
    timeZone: 'Europe/Berlin',
    durationMinutes: 5,
    weeklyAvailability: MONDAY_HOURS,
  }), 'OUTSIDE_AVAILABILITY');
});

test('preserves exact half-open adjacency between resolved intervals', () => {
  const first = resolveBookingInterval({
    localDate: '2026-01-05',
    localStartTime: '09:00',
    timeZone: 'Europe/Berlin',
    durationMinutes: 30,
  });
  const second = resolveBookingInterval({
    localDate: '2026-01-05',
    localStartTime: '09:30',
    timeZone: 'Europe/Berlin',
    durationMinutes: 30,
  });

  assert.equal(first.endAtEpochMs, second.startAtEpochMs);
  assert.equal(
    first.startAtEpochMs < second.endAtEpochMs &&
      second.startAtEpochMs < first.endAtEpochMs,
    false,
  );
});

test('returns occupied epoch boundaries including before and after buffers', () => {
  const interval = resolveBookingInterval({
    localDate: '2026-01-15',
    localStartTime: '10:00',
    timeZone: 'Europe/Berlin',
    durationMinutes: 30,
    bufferBeforeMinutes: 10,
    bufferAfterMinutes: 15,
  });

  assert.equal(interval.startAtEpochMs, Date.parse('2026-01-15T09:00:00Z'));
  assert.equal(interval.endAtEpochMs, Date.parse('2026-01-15T09:30:00Z'));
  assert.equal(interval.occupiedStartAtEpochMs, Date.parse('2026-01-15T08:50:00Z'));
  assert.equal(interval.occupiedEndAtEpochMs, Date.parse('2026-01-15T09:45:00Z'));
  assert.equal(interval.occupiedStartMinute, (9 * 60) + 50);
  assert.equal(interval.occupiedEndMinute, (10 * 60) + 45);
});

test('availability includes the occupied buffer window', () => {
  const interval = resolveBookingInterval({
    localDate: '2026-01-05',
    localStartTime: '09:00',
    timeZone: 'Europe/Berlin',
    durationMinutes: 30,
    bufferBeforeMinutes: 5,
  });

  assertBookingError(() => assertWithinAvailability({
    interval,
    weeklyAvailability: MONDAY_HOURS,
  }), 'OUTSIDE_AVAILABILITY');
});

test('rejects booking and availability intervals that cross midnight', () => {
  assertBookingError(() => resolveBookingInterval({
    localDate: '2026-01-05',
    localStartTime: '23:30',
    timeZone: 'Europe/Berlin',
    durationMinutes: 30,
  }), 'INVALID_DURATION');

  const interval = resolveBookingInterval({
    localDate: '2026-01-05',
    localStartTime: '23:00',
    timeZone: 'Europe/Berlin',
    durationMinutes: 30,
  });
  assertBookingError(() => assertWithinAvailability({
    interval,
    weeklyAvailability: {
      monday: [{ startLocalTime: '22:00', endLocalTime: '01:00' }],
    },
  }), 'OUTSIDE_AVAILABILITY');
});

test('maps buffer-only cross-midnight occupancy to OUTSIDE_AVAILABILITY', () => {
  assertBookingError(() => resolveBookingInterval({
    localDate: '2026-01-05',
    localStartTime: '00:00',
    timeZone: 'Europe/Berlin',
    durationMinutes: 30,
    bufferBeforeMinutes: 5,
  }), 'OUTSIDE_AVAILABILITY');
});

test('rejects occupancy that would claim too many transaction buckets', () => {
  assertBookingError(() => resolveBookingInterval({
    localDate: '2026-01-05',
    localStartTime: '05:00',
    timeZone: 'Europe/Berlin',
    durationMinutes: MAX_TRANSACTION_OCCUPANCY_MINUTES,
    bufferAfterMinutes: 5,
  }), 'INVALID_DURATION');
});

test('requires five-minute starts but preserves exact non-aligned duration and buffers', () => {
  assertBookingError(() => resolveBookingInterval({
    localDate: '2026-01-05',
    localStartTime: '09:03',
    timeZone: 'Europe/Berlin',
    durationMinutes: 30,
  }), 'INVALID_TIME');

  const exact = resolveBookingInterval({
    localDate: '2026-01-05',
    localStartTime: '09:00',
    timeZone: 'Europe/Berlin',
    durationMinutes: 7,
    bufferBeforeMinutes: 1,
    bufferAfterMinutes: 2,
  });
  assert.equal(exact.endAtEpochMs - exact.startAtEpochMs, 7 * 60 * 1000);
  assert.equal(
    exact.occupiedEndAtEpochMs - exact.occupiedStartAtEpochMs,
    10 * 60 * 1000,
  );
});

test('applies date exceptions only when they are passed explicitly', () => {
  const input = {
    localDate: '2026-01-05',
    localStartTime: '09:00',
    timeZone: 'Europe/Berlin',
    durationMinutes: 30,
    weeklyAvailability: MONDAY_HOURS,
  };

  assert.doesNotThrow(() => resolveBookableInterval(input));
  assertBookingError(() => resolveBookableInterval({
    ...input,
    dateException: { localDate: '2026-01-05', mode: 'closed' },
  }), 'OUTSIDE_AVAILABILITY');
  assert.doesNotThrow(() => resolveBookableInterval({
    ...input,
    localStartTime: '19:00',
    dateException: {
      localDate: '2026-01-05',
      mode: 'replace',
      intervals: [{ startLocalTime: '19:00', endLocalTime: '20:00' }],
    },
  }));
});
