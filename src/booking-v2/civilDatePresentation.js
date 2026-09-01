import { parseCivilDate, serializeCivilDate } from './civilTime';

function requireValidDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError('Expected a valid Date instance.');
  }

  return value;
}

export function civilDateFromLocalDate(date) {
  const value = requireValidDate(date);
  return serializeCivilDate(
    value.getFullYear(),
    value.getMonth() + 1,
    value.getDate()
  );
}

export function isCivilDateToday(localDate, now = new Date()) {
  parseCivilDate(localDate);
  return localDate === civilDateFromLocalDate(now);
}

export function isCivilDateWithinInclusiveRange(
  localDate,
  startLocalDate,
  endLocalDate
) {
  parseCivilDate(localDate);
  parseCivilDate(startLocalDate);
  parseCivilDate(endLocalDate);

  return startLocalDate <= localDate && localDate <= endLocalDate;
}

export function formatCivilDate(localDate, locale, options = {}) {
  const { year, month, day } = parseCivilDate(localDate);
  const presentationDate = new Date(0);
  presentationDate.setUTCFullYear(year, month - 1, day);
  presentationDate.setUTCHours(12, 0, 0, 0);

  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: 'UTC',
  }).format(presentationDate);
}
