'use strict';

const { Temporal } = require('@js-temporal/polyfill');
const {
  MINUTES_PER_DAY,
  OCCUPANCY_BUCKET_MINUTES,
  buildOccupancyWindow,
  normalizeBufferMinutes,
  normalizeDurationMinutes,
  parseLocalDate,
  parseLocalTime,
} = require('./domain');
const { BookingError } = require('./errors');

const MAX_TRANSACTION_OCCUPANCY_MINUTES = 12 * 60;
const WEEKDAYS = Object.freeze([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

function bookingError(code, message, details = {}, cause) {
  const httpStatus = code === 'OUTSIDE_AVAILABILITY' ||
    code === 'SHOP_TIMEZONE_REQUIRED'
    ? 422
    : 400;
  return new BookingError(code, message, {
    httpStatus,
    retryable: false,
    details,
    cause,
  });
}

function normalizeTimeZone(timeZone) {
  if (
    typeof timeZone !== 'string' ||
    timeZone.length === 0 ||
    timeZone !== timeZone.trim() ||
    /^[+-]\d{2}(?::?\d{2})?$/.test(timeZone)
  ) {
    throw bookingError('SHOP_TIMEZONE_REQUIRED', 'shop requires an IANA time zone', {
      field: 'timeZone',
    });
  }

  try {
    return Temporal.Instant.fromEpochMilliseconds(0)
      .toZonedDateTimeISO(timeZone)
      .timeZoneId;
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) {
      throw bookingError(
        'SHOP_TIMEZONE_REQUIRED',
        'shop requires a valid IANA time zone',
        { field: 'timeZone' },
        error,
      );
    }
    throw error;
  }
}

function assertStartBucketAlignment(value, field) {
  if (value % OCCUPANCY_BUCKET_MINUTES !== 0) {
    throw bookingError(
      'INVALID_TIME',
      `${field} must align to ${OCCUPANCY_BUCKET_MINUTES}-minute occupancy buckets`,
      { field, bucketMinutes: OCCUPANCY_BUCKET_MINUTES },
    );
  }
}

function sameCivilDate(zonedDateTime, date) {
  return zonedDateTime.year === date.year &&
    zonedDateTime.month === date.month &&
    zonedDateTime.day === date.day;
}

function wallMinute(zonedDateTime) {
  return (zonedDateTime.hour * 60) + zonedDateTime.minute;
}

function resolveBookingInterval({
  localDate,
  localStartTime,
  timeZone,
  durationMinutes,
  bufferBeforeMinutes = 0,
  bufferAfterMinutes = 0,
}) {
  const date = parseLocalDate(localDate);
  const time = parseLocalTime(localStartTime);
  const duration = normalizeDurationMinutes(durationMinutes);
  const bufferBefore = normalizeBufferMinutes(bufferBeforeMinutes, 'bufferBeforeMinutes');
  const bufferAfter = normalizeBufferMinutes(bufferAfterMinutes, 'bufferAfterMinutes');
  const zone = normalizeTimeZone(timeZone);

  if (time.totalMinutes + duration >= MINUTES_PER_DAY) {
    throw bookingError('INVALID_DURATION', 'booking service must end on its localDate', {
      field: 'durationMinutes',
    });
  }

  const localWindow = buildOccupancyWindow({
    localDate: date.value,
    localStartTime: time.value,
    durationMinutes: duration,
    bufferBeforeMinutes: bufferBefore,
    bufferAfterMinutes: bufferAfter,
  });

  assertStartBucketAlignment(localWindow.startMinute, 'localStartTime');

  const occupancyMinutes = localWindow.occupiedEndMinute - localWindow.occupiedStartMinute;
  if (occupancyMinutes > MAX_TRANSACTION_OCCUPANCY_MINUTES) {
    throw bookingError('INVALID_DURATION', 'booking occupancy is too long for one transaction', {
      field: 'durationMinutes',
      maxOccupancyMinutes: MAX_TRANSACTION_OCCUPANCY_MINUTES,
    });
  }

  let start;
  try {
    start = Temporal.PlainDateTime.from({
      year: date.year,
      month: date.month,
      day: date.day,
      hour: time.hour,
      minute: time.minute,
    }).toZonedDateTime(zone, { disambiguation: 'reject' });
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) {
      throw bookingError(
        'INVALID_TIME',
        'localDate and localStartTime do not resolve uniquely in timeZone',
        { field: 'localStartTime' },
        error,
      );
    }
    throw error;
  }
  const canonicalTimeZone = start.timeZoneId;
  const startInstant = start.toInstant();
  const endInstant = startInstant.add({ minutes: duration });
  const occupiedStartInstant = startInstant.subtract({ minutes: bufferBefore });
  const occupiedEndInstant = endInstant.add({ minutes: bufferAfter });
  const end = endInstant.toZonedDateTimeISO(canonicalTimeZone);
  const occupiedStart = occupiedStartInstant.toZonedDateTimeISO(canonicalTimeZone);
  const occupiedEnd = occupiedEndInstant.toZonedDateTimeISO(canonicalTimeZone);

  if (!sameCivilDate(end, date)) {
    throw bookingError('INVALID_DURATION', 'booking service must end on its localDate', {
      field: 'durationMinutes',
    });
  }

  if (!sameCivilDate(occupiedStart, date) || !sameCivilDate(occupiedEnd, date)) {
    throw bookingError('OUTSIDE_AVAILABILITY', 'overnight booking intervals are not supported', {
      field: 'bufferMinutes',
    });
  }

  return Object.freeze({
    localDate: date.value,
    localStartTime: time.value,
    timeZone: canonicalTimeZone,
    weekday: WEEKDAYS[start.dayOfWeek - 1],
    durationMinutes: duration,
    bufferBeforeMinutes: bufferBefore,
    bufferAfterMinutes: bufferAfter,
    startMinute: wallMinute(start),
    endMinute: wallMinute(end),
    occupiedStartMinute: wallMinute(occupiedStart),
    occupiedEndMinute: wallMinute(occupiedEnd),
    startAtEpochMs: startInstant.epochMilliseconds,
    endAtEpochMs: endInstant.epochMilliseconds,
    occupiedStartAtEpochMs: occupiedStartInstant.epochMilliseconds,
    occupiedEndAtEpochMs: occupiedEndInstant.epochMilliseconds,
  });
}

function normalizeAvailabilityInterval(interval, field) {
  if (
    interval === null ||
    typeof interval !== 'object' ||
    Array.isArray(interval)
  ) {
    throw bookingError('INVALID_ARGUMENT', 'availability intervals must be objects', { field });
  }

  const start = parseLocalTime(interval.startLocalTime);
  const end = parseLocalTime(interval.endLocalTime);

  if (start.totalMinutes >= end.totalMinutes) {
    throw bookingError('OUTSIDE_AVAILABILITY', 'overnight availability intervals are not supported', {
      field,
    });
  }

  return Object.freeze({
    startMinute: start.totalMinutes,
    endMinute: end.totalMinutes,
  });
}

function normalizeAvailabilityIntervals(intervals, field) {
  if (!Array.isArray(intervals)) {
    throw bookingError('INVALID_ARGUMENT', 'availability intervals must be an array', { field });
  }
  return intervals.map((interval, index) =>
    normalizeAvailabilityInterval(interval, `${field}[${index}]`));
}

function intervalsForBooking({ weeklyAvailability, weekday, localDate, dateException }) {
  if (
    weeklyAvailability === null ||
    typeof weeklyAvailability !== 'object' ||
    Array.isArray(weeklyAvailability)
  ) {
    throw bookingError('INVALID_ARGUMENT', 'weeklyAvailability must be an object', {
      field: 'weeklyAvailability',
    });
  }

  const weekly = normalizeAvailabilityIntervals(
    weeklyAvailability[weekday] ?? [],
    `weeklyAvailability.${weekday}`,
  );

  if (dateException === undefined || dateException === null) {
    return Object.freeze({ source: 'weekly', intervals: weekly });
  }
  if (
    typeof dateException !== 'object' ||
    Array.isArray(dateException)
  ) {
    throw bookingError('INVALID_ARGUMENT', 'dateException must be an object', {
      field: 'dateException',
    });
  }
  if (dateException.localDate !== undefined && dateException.localDate !== localDate) {
    throw bookingError('INVALID_ARGUMENT', 'dateException does not match localDate', {
      field: 'dateException.localDate',
    });
  }

  switch (dateException.mode) {
    case 'closed':
      return Object.freeze({ source: 'dateException:closed', intervals: [] });
    case 'replace':
      return Object.freeze({
        source: 'dateException:replace',
        intervals: normalizeAvailabilityIntervals(
          dateException.intervals,
          'dateException.intervals',
        ),
      });
    case 'add':
      return Object.freeze({
        source: 'dateException:add',
        intervals: weekly.concat(normalizeAvailabilityIntervals(
          dateException.intervals,
          'dateException.intervals',
        )),
      });
    default:
      throw bookingError('INVALID_ARGUMENT', 'dateException mode must be closed, replace, or add', {
        field: 'dateException.mode',
      });
  }
}

function assertWithinAvailability({
  interval,
  weeklyAvailability,
  dateException,
}) {
  if (
    interval === null ||
    typeof interval !== 'object' ||
    Array.isArray(interval)
  ) {
    throw bookingError('INVALID_ARGUMENT', 'interval must be a resolved booking interval', {
      field: 'interval',
    });
  }

  let start;
  let occupiedStart;
  let occupiedEnd;
  try {
    start = Temporal.Instant.fromEpochMilliseconds(interval.startAtEpochMs)
      .toZonedDateTimeISO(interval.timeZone);
    occupiedStart = Temporal.Instant.fromEpochMilliseconds(interval.occupiedStartAtEpochMs)
      .toZonedDateTimeISO(interval.timeZone);
    occupiedEnd = Temporal.Instant.fromEpochMilliseconds(interval.occupiedEndAtEpochMs)
      .toZonedDateTimeISO(interval.timeZone);
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) {
      throw bookingError(
        'INVALID_ARGUMENT',
        'interval is not a resolved booking interval',
        { field: 'interval' },
        error,
      );
    }
    throw error;
  }
  const weekday = WEEKDAYS[start.dayOfWeek - 1];
  const availability = intervalsForBooking({
    weeklyAvailability,
    weekday,
    localDate: interval.localDate,
    dateException,
  });
  const occupiedStartMinute = wallMinute(occupiedStart);
  const occupiedEndMinute = wallMinute(occupiedEnd);
  const matchingIndex = availability.intervals.findIndex(({ startMinute, endMinute }) =>
    occupiedStartMinute >= startMinute && occupiedEndMinute <= endMinute);

  if (matchingIndex === -1) {
    throw bookingError('OUTSIDE_AVAILABILITY', 'booking interval is outside shop availability', {
      localDate: interval.localDate,
      weekday,
      source: availability.source,
    });
  }

  return Object.freeze({
    weekday,
    source: availability.source,
    intervalIndex: matchingIndex,
  });
}

function resolveBookableInterval(input) {
  const {
    weeklyAvailability,
    dateException,
    ...timeInput
  } = input;
  const interval = resolveBookingInterval(timeInput);
  assertWithinAvailability({ interval, weeklyAvailability, dateException });
  return interval;
}

module.exports = {
  MAX_TRANSACTION_OCCUPANCY_MINUTES,
  WEEKDAYS,
  assertWithinAvailability,
  resolveBookableInterval,
  resolveBookingInterval,
};
