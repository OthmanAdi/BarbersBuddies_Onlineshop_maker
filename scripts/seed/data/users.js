/**
 * Demo User Definitions
 */

const config = require('../config');
const { getAvatarUrl } = require('../utils/images');
const { generateTimestamp } = require('../utils/dates');
const { randomName, randomPhone } = require('../utils/random');

const ownerAccount = config.demoAccounts.owner;
const customerAccount = config.demoAccounts.customer;

// Demo accounts (main accounts for testing)
const demoUsers = [
  {
    id: 'demo-owner-uid',
    email: ownerAccount.email,
    displayName: ownerAccount.displayName,
    userType: ownerAccount.userType,
    photoURL: getAvatarUrl('demo-owner', 'men'),
    phoneNumber: '+4915123456789',
    createdAt: generateTimestamp(-30),
    lastLoginAt: generateTimestamp(0),
    emailVerified: true,
    isSubscribed: true,
    trialEndDate: generateTimestamp(30),
    language: 'en',
    providerId: 'password'
  },
  {
    id: 'demo-customer-uid',
    email: customerAccount.email,
    displayName: customerAccount.displayName,
    userType: customerAccount.userType,
    photoURL: getAvatarUrl('demo-customer', 'men'),
    phoneNumber: '+4915198765432',
    createdAt: generateTimestamp(-20),
    lastLoginAt: generateTimestamp(0),
    emailVerified: true,
    isSubscribed: false,
    trialEndDate: null,
    language: 'en',
    providerId: 'password'
  }
];

/**
 * Generate additional shop owner users (for the other 11 shops)
 * @returns {Array} Array of user objects
 */
const generateShopOwners = () => {
  const owners = [];

  for (let i = 0; i < 11; i++) {
    const name = randomName();
    owners.push({
      id: `shop-owner-${i + 1}-uid`,
      email: `shop-owner-${i + 1}@barbersbuddies.invalid`,
      displayName: name,
      userType: 'shop-owner',
      photoURL: getAvatarUrl(i + 100, 'men'),
      phoneNumber: randomPhone(),
      createdAt: generateTimestamp(-60 + i * 3),
      lastLoginAt: generateTimestamp(-i),
      emailVerified: true,
      isSubscribed: Math.random() > 0.3,
      trialEndDate: generateTimestamp(30),
      language: ['en', 'de', 'tr'][i % 3],
      providerId: Math.random() > 0.5 ? 'password' : 'google.com'
    });
  }

  return owners;
};

/**
 * Generate random customer users for bookings
 * @param {number} count - Number of customers to generate
 * @returns {Array} Array of customer user objects
 */
const generateCustomers = (count = 50) => {
  const customers = [];

  for (let i = 0; i < count; i++) {
    const name = randomName();
    const gender = Math.random() > 0.3 ? 'men' : 'women';
    customers.push({
      id: `customer-${i + 1}-uid`,
      email: `customer-${i + 1}@barbersbuddies.invalid`,
      displayName: name,
      userType: 'customer',
      photoURL: getAvatarUrl(i + 200, gender),
      phoneNumber: randomPhone(),
      createdAt: generateTimestamp(-90 + i),
      lastLoginAt: generateTimestamp(-Math.floor(Math.random() * 30)),
      emailVerified: Math.random() > 0.1,
      isSubscribed: false,
      trialEndDate: null,
      language: ['en', 'de', 'tr'][i % 3],
      providerId: Math.random() > 0.6 ? 'google.com' : 'password'
    });
  }

  return customers;
};

/**
 * Get all users for seeding
 * @returns {Object} Object containing all user arrays
 */
const getAllUsers = () => ({
  demoUsers,
  shopOwners: generateShopOwners(),
  customers: generateCustomers(50)
});

module.exports = {
  demoUsers,
  generateShopOwners,
  generateCustomers,
  getAllUsers
};
