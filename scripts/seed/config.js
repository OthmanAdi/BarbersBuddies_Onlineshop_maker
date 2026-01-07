/**
 * Seed Configuration
 * Central configuration for the demo data seed system
 */

module.exports = {
  // Demo account credentials (these will be created in Firebase Auth)
  demoAccounts: {
    owner: {
      email: 'demo-owner@barbersbuddies.com',
      password: 'DemoOwner2026!',
      displayName: 'Demo Shop Owner',
      userType: 'shop-owner'
    },
    customer: {
      email: 'demo-customer@barbersbuddies.com',
      password: 'DemoCustomer2026!',
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
    pastDays: 5,      // Jan 1-5 for past appointments
    futureDays: 7     // Jan 7-13 for future appointments
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
