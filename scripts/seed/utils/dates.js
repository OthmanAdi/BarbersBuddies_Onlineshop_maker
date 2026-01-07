/**
 * Date Utilities for Seed Data
 * All dates are relative to TODAY (2026-01-06)
 */

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

/**
 * Generate a date string offset from today
 * @param {number} daysOffset - Positive for future, negative for past
 * @returns {string} Date in YYYY-MM-DD format
 */
const generateDate = (daysOffset) => {
  const date = new Date(TODAY);
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
};

/**
 * Get today's date as string
 * @returns {string} Date in YYYY-MM-DD format
 */
const getToday = () => generateDate(0);

/**
 * Generate a random date within a range
 * @param {number} minDaysOffset - Minimum days from today (negative for past)
 * @param {number} maxDaysOffset - Maximum days from today
 * @returns {string} Date in YYYY-MM-DD format
 */
const randomDate = (minDaysOffset, maxDaysOffset) => {
  const offset = Math.floor(Math.random() * (maxDaysOffset - minDaysOffset + 1)) + minDaysOffset;
  return generateDate(offset);
};

/**
 * Generate a random time slot
 * @param {string} openTime - Opening time (e.g., "09:00")
 * @param {string} closeTime - Closing time (e.g., "18:00")
 * @returns {string} Time in HH:MM format
 */
const randomTimeSlot = (openTime = '09:00', closeTime = '18:00') => {
  const [openHour] = openTime.split(':').map(Number);
  const [closeHour] = closeTime.split(':').map(Number);

  const hour = Math.floor(Math.random() * (closeHour - openHour)) + openHour;
  const minute = Math.random() < 0.5 ? '00' : '30';

  return `${hour.toString().padStart(2, '0')}:${minute}`;
};

/**
 * Generate a Firestore-compatible timestamp
 * @param {number} daysOffset - Days from today
 * @param {string} time - Optional time in HH:MM format
 * @returns {Date} JavaScript Date object
 */
const generateTimestamp = (daysOffset = 0, time = null) => {
  const date = new Date(TODAY);
  date.setDate(date.getDate() + daysOffset);

  if (time) {
    const [hours, minutes] = time.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
  } else {
    date.setHours(
      Math.floor(Math.random() * 12) + 8,
      Math.random() < 0.5 ? 0 : 30,
      0, 0
    );
  }

  return date;
};

/**
 * Get past dates array for appointments
 * @param {number} count - Number of past dates
 * @returns {string[]} Array of date strings
 */
const getPastDates = (count = 5) => {
  return Array.from({ length: count }, (_, i) => generateDate(-(count - i)));
};

/**
 * Get future dates array for appointments
 * @param {number} count - Number of future dates
 * @returns {string[]} Array of date strings
 */
const getFutureDates = (count = 7) => {
  return Array.from({ length: count }, (_, i) => generateDate(i + 1));
};

module.exports = {
  TODAY,
  generateDate,
  getToday,
  randomDate,
  randomTimeSlot,
  generateTimestamp,
  getPastDates,
  getFutureDates
};
