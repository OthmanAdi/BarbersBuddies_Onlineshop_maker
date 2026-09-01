/**
 * Pure civil-date and wall-clock helpers for the booking UI.
 *
 * These helpers deliberately do not turn a civil date/time into an instant.
 * The backend must resolve `localDate` + `localStartTime` in the authoritative
 * shop IANA time zone and must reject DST gaps or apply the approved repeated-
 * time policy. Browser and host time zones are never scheduling authority.
 * Canonical times are limited to 00:00 through 23:59. Full-day, `24:00`, and
 * cross-midnight intervals require an explicit date-aware backend contract and
 * are intentionally rejected here rather than silently wrapping to another day.
 */

const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const CIVIL_TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const MINUTES_PER_DAY = 24 * 60;
const ENGLISH_WEEKDAYS = Object.freeze([
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]);

export const BACKEND_TIME_AUTHORITY_NOTICE =
  'Civil date/time must be resolved by the backend in the authoritative shop IANA time zone; this module does not resolve DST.';

export class CivilTimeError extends Error {
  constructor(code, message, field) {
    super(message);
    this.name = 'CivilTimeError';
    this.code = code;
    this.field = field;
  }
}

function fail(code, message, field) {
  throw new CivilTimeError(code, message, field);
}

function requireInteger(value, field, { minimum, maximum }) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    fail('INVALID_INTEGER', `${field} must be a safe integer.`, field);
  }

  if (value < minimum || value > maximum) {
    fail(
      'INTEGER_OUT_OF_RANGE',
      `${field} must be between ${minimum} and ${maximum}.`,
      field
    );
  }

  return value;
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function validateDateParts(year, month, day) {
  requireInteger(year, 'year', { minimum: 1, maximum: 9999 });
  requireInteger(month, 'month', { minimum: 1, maximum: 12 });
  requireInteger(day, 'day', {
    minimum: 1,
    maximum: daysInMonth(year, month),
  });
}

function validateTimeParts(hour, minute) {
  requireInteger(hour, 'hour', { minimum: 0, maximum: 23 });
  requireInteger(minute, 'minute', { minimum: 0, maximum: 59 });
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function serializeCivilDate(year, month, day) {
  validateDateParts(year, month, day);
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

export function parseCivilDate(value) {
  if (typeof value !== 'string') {
    fail('INVALID_CIVIL_DATE_TYPE', 'Civil date must be a string.', 'localDate');
  }

  const match = CIVIL_DATE_PATTERN.exec(value);
  if (!match) {
    fail(
      'INVALID_CIVIL_DATE_FORMAT',
      'Civil date must use canonical YYYY-MM-DD format.',
      'localDate'
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  validateDateParts(year, month, day);

  return Object.freeze({ year, month, day });
}

export function serializeCivilTime(hour, minute) {
  validateTimeParts(hour, minute);
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function parseCivilTime(value) {
  if (typeof value !== 'string') {
    fail('INVALID_CIVIL_TIME_TYPE', 'Civil time must be a string.', 'localTime');
  }

  const match = CIVIL_TIME_PATTERN.exec(value);
  if (!match) {
    fail(
      'INVALID_CIVIL_TIME_FORMAT',
      'Civil time must use canonical HH:mm format.',
      'localTime'
    );
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  validateTimeParts(hour, minute);

  return Object.freeze({ hour, minute, minutesSinceMidnight: hour * 60 + minute });
}

export function weekdayForCivilDate(localDate) {
  const { year, month, day } = parseCivilDate(localDate);
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const adjustedYear = month < 3 ? year - 1 : year;
  const index =
    (adjustedYear +
      Math.floor(adjustedYear / 4) -
      Math.floor(adjustedYear / 100) +
      Math.floor(adjustedYear / 400) +
      offsets[month - 1] +
      day) %
    7;

  return ENGLISH_WEEKDAYS[index];
}

export function civilTimeToMinutes(localTime) {
  return parseCivilTime(localTime).minutesSinceMidnight;
}

export function minutesToCivilTime(minutesSinceMidnight) {
  requireInteger(minutesSinceMidnight, 'minutesSinceMidnight', {
    minimum: 0,
    maximum: MINUTES_PER_DAY - 1,
  });

  return serializeCivilTime(
    Math.floor(minutesSinceMidnight / 60),
    minutesSinceMidnight % 60
  );
}

export function addCivilMinutes(localTime, deltaMinutes) {
  requireInteger(deltaMinutes, 'deltaMinutes', {
    minimum: -(MINUTES_PER_DAY - 1),
    maximum: MINUTES_PER_DAY - 1,
  });

  const result = civilTimeToMinutes(localTime) + deltaMinutes;
  if (result < 0 || result >= MINUTES_PER_DAY) {
    fail(
      'CIVIL_TIME_OUT_OF_DAY',
      'Civil minute arithmetic must remain within the same civil day.',
      'localTime'
    );
  }

  return minutesToCivilTime(result);
}

export function roundCivilTimeUp(localTime, incrementMinutes) {
  requireInteger(incrementMinutes, 'incrementMinutes', {
    minimum: 1,
    maximum: MINUTES_PER_DAY,
  });

  const minutes = civilTimeToMinutes(localTime);
  const rounded = Math.ceil(minutes / incrementMinutes) * incrementMinutes;
  if (rounded >= MINUTES_PER_DAY) {
    fail(
      'CIVIL_TIME_OUT_OF_DAY',
      'Rounded civil time must remain within the same civil day.',
      'localTime'
    );
  }

  return minutesToCivilTime(rounded);
}

export function createHalfOpenInterval(startLocalTime, endLocalTime) {
  const startMinutes = civilTimeToMinutes(startLocalTime);
  const endMinutes = civilTimeToMinutes(endLocalTime);

  if (endMinutes <= startMinutes) {
    fail(
      'INVALID_HALF_OPEN_INTERVAL',
      'A same-day half-open interval must end after it starts.',
      'interval'
    );
  }

  return Object.freeze({
    startLocalTime,
    endLocalTime,
    startMinutes,
    endMinutes,
  });
}

export function halfOpenIntervalsOverlap(
  leftStartLocalTime,
  leftEndLocalTime,
  rightStartLocalTime,
  rightEndLocalTime
) {
  const left = createHalfOpenInterval(leftStartLocalTime, leftEndLocalTime);
  const right = createHalfOpenInterval(rightStartLocalTime, rightEndLocalTime);
  return left.startMinutes < right.endMinutes && right.startMinutes < left.endMinutes;
}

export function halfOpenIntervalContains(
  containerStartLocalTime,
  containerEndLocalTime,
  candidateStartLocalTime,
  candidateEndLocalTime
) {
  const container = createHalfOpenInterval(
    containerStartLocalTime,
    containerEndLocalTime
  );
  const candidate = createHalfOpenInterval(
    candidateStartLocalTime,
    candidateEndLocalTime
  );

  return (
    container.startMinutes <= candidate.startMinutes &&
    candidate.endMinutes <= container.endMinutes
  );
}

export function assertHalfOpenIntervalContains(
  containerStartLocalTime,
  containerEndLocalTime,
  candidateStartLocalTime,
  candidateEndLocalTime
) {
  if (
    !halfOpenIntervalContains(
      containerStartLocalTime,
      containerEndLocalTime,
      candidateStartLocalTime,
      candidateEndLocalTime
    )
  ) {
    fail(
      'INTERVAL_OUTSIDE_CONTAINER',
      'Candidate interval must fit inside the containing half-open interval.',
      'interval'
    );
  }
}

export function buildBufferedCivilInterval(
  startLocalTime,
  durationMinutes,
  bufferBeforeMinutes = 0,
  bufferAfterMinutes = 0
) {
  requireInteger(durationMinutes, 'durationMinutes', {
    minimum: 1,
    maximum: MINUTES_PER_DAY - 1,
  });
  requireInteger(bufferBeforeMinutes, 'bufferBeforeMinutes', {
    minimum: 0,
    maximum: MINUTES_PER_DAY - 1,
  });
  requireInteger(bufferAfterMinutes, 'bufferAfterMinutes', {
    minimum: 0,
    maximum: MINUTES_PER_DAY - 1,
  });

  const nominalStartMinutes = civilTimeToMinutes(startLocalTime);
  const nominalEndMinutes = nominalStartMinutes + durationMinutes;
  const startMinutes = nominalStartMinutes - bufferBeforeMinutes;
  const endMinutes = nominalEndMinutes + bufferAfterMinutes;

  if (startMinutes < 0 || endMinutes >= MINUTES_PER_DAY) {
    fail(
      'CIVIL_INTERVAL_OUT_OF_DAY',
      'Buffered civil interval must remain within the same civil day.',
      'interval'
    );
  }

  return Object.freeze({
    startLocalTime: minutesToCivilTime(startMinutes),
    endLocalTime: minutesToCivilTime(endMinutes),
    startMinutes,
    endMinutes,
    nominalStartLocalTime: startLocalTime,
    nominalEndLocalTime: minutesToCivilTime(nominalEndMinutes),
    nominalStartMinutes,
    nominalEndMinutes,
    durationMinutes,
    bufferBeforeMinutes,
    bufferAfterMinutes,
  });
}

export function iterateCivilSlots(
  openLocalTime,
  closeLocalTime,
  incrementMinutes,
  durationMinutes,
  bufferBeforeMinutes = 0,
  bufferAfterMinutes = 0
) {
  const availability = createHalfOpenInterval(openLocalTime, closeLocalTime);
  requireInteger(incrementMinutes, 'incrementMinutes', {
    minimum: 1,
    maximum: MINUTES_PER_DAY,
  });
  requireInteger(durationMinutes, 'durationMinutes', {
    minimum: 1,
    maximum: MINUTES_PER_DAY - 1,
  });
  requireInteger(bufferBeforeMinutes, 'bufferBeforeMinutes', {
    minimum: 0,
    maximum: MINUTES_PER_DAY - 1,
  });
  requireInteger(bufferAfterMinutes, 'bufferAfterMinutes', {
    minimum: 0,
    maximum: MINUTES_PER_DAY - 1,
  });

  const slots = [];
  for (
    let nominalStartMinutes = availability.startMinutes;
    nominalStartMinutes < availability.endMinutes;
    nominalStartMinutes += incrementMinutes
  ) {
    const occupiedStartMinutes = nominalStartMinutes - bufferBeforeMinutes;
    const occupiedEndMinutes =
      nominalStartMinutes + durationMinutes + bufferAfterMinutes;

    if (occupiedEndMinutes > availability.endMinutes) {
      break;
    }

    if (occupiedStartMinutes >= availability.startMinutes) {
      slots.push(minutesToCivilTime(nominalStartMinutes));
    }
  }

  return Object.freeze(slots);
}
