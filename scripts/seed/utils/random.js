/**
 * Random Data Generators for Seed Data
 */

/**
 * Get random item from array
 * @param {Array} arr - Source array
 * @returns {*} Random item
 */
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Get random number in range
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Get random float in range
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} decimals - Decimal places
 * @returns {number} Random float
 */
const randomFloat = (min, max, decimals = 2) => {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
};

/**
 * Get random subset of array
 * @param {Array} arr - Source array
 * @param {number} count - Number of items
 * @returns {Array} Random subset
 */
const randomSubset = (arr, count) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
};

/**
 * Generate random ID
 * @param {number} length - ID length
 * @returns {string} Random ID
 */
const generateId = (length = 20) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
};

/**
 * Generate random phone number
 * @returns {string} Phone number
 */
const randomPhone = () => {
  const prefixes = ['+49', '+1', '+44', '+33'];
  const prefix = randomItem(prefixes);
  const number = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
  return `${prefix}${number}`;
};

/**
 * Weighted random selection based on distribution
 * @param {Object} distribution - Object with keys and percentage values
 * @returns {string} Selected key
 */
const weightedRandom = (distribution) => {
  const entries = Object.entries(distribution);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let random = Math.random() * total;

  for (const [key, weight] of entries) {
    random -= weight;
    if (random <= 0) return key;
  }

  return entries[0][0];
};

/**
 * Shuffle array in place
 * @param {Array} arr - Array to shuffle
 * @returns {Array} Shuffled array
 */
const shuffleArray = (arr) => {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// Name generators
const FIRST_NAMES = [
  'James', 'Michael', 'David', 'John', 'Robert', 'Carlos', 'Ahmed', 'Wei',
  'Marcus', 'Antonio', 'Kevin', 'Tyler', 'Brandon', 'Derek', 'Omar', 'Jamal',
  'Luis', 'Alex', 'Chris', 'Daniel', 'Ryan', 'Justin', 'Eric', 'Jason'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson',
  'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Clark', 'Lewis', 'Walker'
];

/**
 * Generate random name
 * @returns {string} Full name
 */
const randomName = () => `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;

/**
 * Generate random email from name
 * @param {string} name - Person's name
 * @returns {string} Email address
 */
const nameToEmail = (name) => {
  const clean = name.toLowerCase().replace(/\s+/g, '.');
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'mail.com'];
  return `${clean}${randomInt(1, 99)}@${randomItem(domains)}`;
};

module.exports = {
  randomItem,
  randomInt,
  randomFloat,
  randomSubset,
  generateId,
  randomPhone,
  weightedRandom,
  shuffleArray,
  randomName,
  nameToEmail,
  FIRST_NAMES,
  LAST_NAMES
};
