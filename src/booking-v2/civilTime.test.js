import {
  BACKEND_TIME_AUTHORITY_NOTICE,
  CivilTimeError,
  addCivilMinutes,
  assertHalfOpenIntervalContains,
  buildBufferedCivilInterval,
  civilTimeToMinutes,
  createHalfOpenInterval,
  halfOpenIntervalContains,
  halfOpenIntervalsOverlap,
  iterateCivilSlots,
  minutesToCivilTime,
  parseCivilDate,
  parseCivilTime,
  roundCivilTimeUp,
  serializeCivilDate,
  serializeCivilTime,
  weekdayForCivilDate,
} from './civilTime';

function expectCivilError(callback, code) {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(CivilTimeError);
    expect(error.code).toBe(code);
    return;
  }
  throw new Error(`Expected CivilTimeError ${code}`);
}

describe('canonical civil dates without Date parsing', () => {
  test('parses and serializes a canonical leap date', () => {
    expect(parseCivilDate('2024-02-29')).toEqual({
      year: 2024,
      month: 2,
      day: 29,
    });
    expect(serializeCivilDate(2024, 2, 29)).toBe('2024-02-29');
  });

  test.each([
    '2023-02-29',
    '1900-02-29',
    '2026-04-31',
    '2026-00-01',
    '2026-13-01',
  ])('rejects impossible civil date %s', (value) => {
    expect(() => parseCivilDate(value)).toThrow(CivilTimeError);
  });

  test.each(['2026-9-01', '26-09-01', '2026/09/01', '2026-09-01T00:00'])(
    'rejects non-canonical civil date %s',
    (value) => {
      expectCivilError(() => parseCivilDate(value), 'INVALID_CIVIL_DATE_FORMAT');
    }
  );

  test('looks up the English weekday independently of host timezone', () => {
    expect(weekdayForCivilDate('2026-09-01')).toBe('Tuesday');
    expect(weekdayForCivilDate('2000-01-01')).toBe('Saturday');
  });
});

describe('canonical civil wall-clock times', () => {
  test('parses and serializes canonical HH:mm', () => {
    expect(parseCivilTime('09:05')).toEqual({
      hour: 9,
      minute: 5,
      minutesSinceMidnight: 545,
    });
    expect(serializeCivilTime(9, 5)).toBe('09:05');
    expect(civilTimeToMinutes('23:59')).toBe(1439);
    expect(minutesToCivilTime(545)).toBe('09:05');
  });

  test.each(['9:05', '09:5', '09:60', '24:00', '09.05', ' 09:05 '])(
    'rejects invalid or non-canonical time %s',
    (value) => {
      expect(() => parseCivilTime(value)).toThrow(CivilTimeError);
    }
  );

  test('rejects 24:00 instead of treating it as a same-day wall-clock time', () => {
    expect(() => parseCivilTime('24:00')).toThrow(CivilTimeError);
  });

  test('carries minutes correctly instead of emitting 09:60', () => {
    expect(addCivilMinutes('09:53', 7)).toBe('10:00');
    expect(roundCivilTimeUp('09:53', 15)).toBe('10:00');
    expect(roundCivilTimeUp('09:45', 15)).toBe('09:45');
  });

  test('keeps arithmetic and rounding within one civil day', () => {
    expectCivilError(() => addCivilMinutes('23:59', 1), 'CIVIL_TIME_OUT_OF_DAY');
    expectCivilError(
      () => roundCivilTimeUp('23:59', 15),
      'CIVIL_TIME_OUT_OF_DAY'
    );
  });
});

describe('half-open intervals', () => {
  test('allows adjacency while detecting real overlap', () => {
    expect(halfOpenIntervalsOverlap('09:00', '09:30', '09:30', '10:00')).toBe(
      false
    );
    expect(halfOpenIntervalsOverlap('09:00', '09:31', '09:30', '10:00')).toBe(
      true
    );
  });

  test('validates same-day interval ordering', () => {
    expect(createHalfOpenInterval('09:00', '10:00')).toEqual({
      startLocalTime: '09:00',
      endLocalTime: '10:00',
      startMinutes: 540,
      endMinutes: 600,
    });
    expectCivilError(
      () => createHalfOpenInterval('10:00', '10:00'),
      'INVALID_HALF_OPEN_INTERVAL'
    );
  });

  test('rejects full-day and cross-midnight intervals without implicit date rollover', () => {
    expect(() => createHalfOpenInterval('00:00', '24:00')).toThrow(
      CivilTimeError
    );
    expectCivilError(
      () => createHalfOpenInterval('23:30', '00:30'),
      'INVALID_HALF_OPEN_INTERVAL'
    );
  });

  test('uses inclusive start and exclusive close containment', () => {
    expect(halfOpenIntervalContains('09:00', '10:00', '09:00', '10:00')).toBe(
      true
    );
    expect(halfOpenIntervalContains('09:00', '10:00', '09:45', '10:00')).toBe(
      true
    );
    expect(halfOpenIntervalContains('09:00', '10:00', '09:45', '10:15')).toBe(
      false
    );
    expectCivilError(
      () => assertHalfOpenIntervalContains('09:00', '10:00', '09:45', '10:15'),
      'INTERVAL_OUTSIDE_CONTAINER'
    );
  });
});

describe('duration, buffers, and safe slot iteration', () => {
  test('builds immutable service occupancy including both buffers', () => {
    const interval = buildBufferedCivilInterval('10:00', 45, 5, 10);

    expect(interval).toEqual({
      startLocalTime: '09:55',
      endLocalTime: '10:55',
      startMinutes: 595,
      endMinutes: 655,
      nominalStartLocalTime: '10:00',
      nominalEndLocalTime: '10:45',
      nominalStartMinutes: 600,
      nominalEndMinutes: 645,
      durationMinutes: 45,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 10,
    });
    expect(Object.isFrozen(interval)).toBe(true);
  });

  test('rejects buffered occupancy ending at or after the civil-day boundary', () => {
    expectCivilError(
      () => buildBufferedCivilInterval('23:00', 60),
      'CIVIL_INTERVAL_OUT_OF_DAY'
    );
    expectCivilError(
      () => buildBufferedCivilInterval('23:30', 29, 0, 2),
      'CIVIL_INTERVAL_OUT_OF_DAY'
    );
  });

  test('emits only starts whose full buffered occupancy fits before close', () => {
    expect(iterateCivilSlots('09:00', '11:00', 30, 45, 0, 15)).toEqual([
      '09:00',
      '09:30',
      '10:00',
    ]);
    expect(iterateCivilSlots('09:00', '10:00', 30, 31)).toEqual(['09:00']);
  });

  test('treats close as exclusive and never emits a close-overrun', () => {
    expect(iterateCivilSlots('09:00', '10:00', 30, 30)).toEqual([
      '09:00',
      '09:30',
    ]);
    expect(iterateCivilSlots('09:00', '10:00', 30, 30)).not.toContain('10:00');
  });

  test.each([0, -1])('rejects unsafe slot increment %s', (increment) => {
    expect(() => iterateCivilSlots('09:00', '10:00', increment, 30)).toThrow(
      CivilTimeError
    );
  });
});

describe('hostile and coercive input rejection', () => {
  test.each([
    null,
    undefined,
    20260901,
    Object('2026-09-01'),
    { toString: () => '2026-09-01' },
    Symbol('2026-09-01'),
  ])('does not coerce a civil date input', (value) => {
    expectCivilError(() => parseCivilDate(value), 'INVALID_CIVIL_DATE_TYPE');
  });

  test('does not inspect hostile object properties', () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('hostile getter executed');
        },
      }
    );

    expectCivilError(() => parseCivilTime(hostile), 'INVALID_CIVIL_TIME_TYPE');
  });

  test('does not coerce numeric inputs', () => {
    expect(() => serializeCivilTime('9', 0)).toThrow(CivilTimeError);
    expect(() => addCivilMinutes('09:00', '30')).toThrow(CivilTimeError);
    expect(() => iterateCivilSlots('09:00', '10:00', 30, '30')).toThrow(
      CivilTimeError
    );
  });

  test('makes the backend IANA and DST authority boundary explicit', () => {
    expect(BACKEND_TIME_AUTHORITY_NOTICE).toMatch(/backend/i);
    expect(BACKEND_TIME_AUTHORITY_NOTICE).toMatch(/IANA/);
    expect(BACKEND_TIME_AUTHORITY_NOTICE).toMatch(/DST/);
  });
});
