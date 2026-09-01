/**
 * Seed Configuration
 * Central configuration for the emulator-only demo data seed system.
 */

const crypto = require('crypto');

const readDemoEmail = (environmentKey, fallback) => {
  const email = (process.env[environmentKey] || fallback).trim().toLowerCase();

  // Demo identities must never be routable, even when explicitly overridden.
  if (!/^[^\s@]+@[^\s@]+\.invalid$/i.test(email)) {
    throw new Error(`${environmentKey} must be a non-routable .invalid email address`);
  }

  return email;
};

const readDemoPassword = environmentKey => {
  const override = process.env[environmentKey];

  if (override !== undefined) {
    if (override.length < 12) {
      throw new Error(`${environmentKey} must contain at least 12 characters`);
    }

    return override;
  }

  // A new password is generated each time this seed process starts.
  return crypto.randomBytes(24).toString('base64url');
};

module.exports = {
  // These identities exist only in the local Firebase Auth emulator.
  demoAccounts: {
    owner: {
      email: readDemoEmail('SEED_DEMO_OWNER_EMAIL', 'owner@barbersbuddies.invalid'),
      password: readDemoPassword('SEED_DEMO_OWNER_PASSWORD'),
      displayName: 'Demo Shop Owner',
      userType: 'shop-owner'
    },
    customer: {
      email: readDemoEmail('SEED_DEMO_CUSTOMER_EMAIL', 'customer@barbersbuddies.invalid'),
      password: readDemoPassword('SEED_DEMO_CUSTOMER_PASSWORD'),
      displayName: 'Demo Customer',
      userType: 'customer'
    }
  },

  // Data counts
  counts: {
    shops: 12,
    bookingsPerShop: { min: 10, max: 30 },
    ratingsPerShop: { min: 5, max: 20 },
    employeesPerShop: { min: 2, max: 5 },
    servicesPerShop: { min: 5, max: 10 },
    messagesPerConversation: { min: 3, max: 8 },
    conversationsForDemoShop: 20,
    notificationsForDemoShop: 50
  },

  // Date ranges (relative to today)
  dateRanges: {
    pastDays: 5,
    futureDays: 7
  },

  // Booking status distribution (percentages)
  bookingStatusDistribution: {
    completed: 40,
    confirmed: 25,
    pending: 15,
    cancelled: 15,
    rescheduled: 5
  }
};
