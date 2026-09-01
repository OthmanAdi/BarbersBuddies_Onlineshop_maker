/**
 * BarbersBuddies Demo Data Seed Script
 *
 * This script populates Firebase with demo data for:
 * - 2 demo accounts (shop owner + customer)
 * - 12 barbershops with services, employees, and availability
 * - 200+ bookings across all statuses
 * - 100+ ratings with reviews
 * - 20+ conversation threads
 * - 50+ notifications
 *
 * Usage:
 *   Start the Firebase Auth and Firestore emulators first, then run:
 *   npm run seed        - Seed emulator demo data
 *   npm run seed:clean  - Remove emulator demo data
 *
 * Requirements:
 *   - FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST
 *   - SEED_FIREBASE_PROJECT_ID beginning with "demo-"
 *   - Node.js 20+
 */

const admin = require('firebase-admin');

// Data generators
const { demoUsers, generateShopOwners, generateCustomers } = require('./data/users');
const { generateAllShops } = require('./data/shops');
const { generateShopBookings, generateDemoCustomerBookings } = require('./data/bookings');
const { generateShopRatings, calculateShopRatingAggregates } = require('./data/ratings');
const { generateDemoShopConversations } = require('./data/messages');
const { generateShopNotifications } = require('./data/notifications');
const config = require('./config');

const parseLocalEmulatorHost = (name, value) => {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  const match = value.match(/^(localhost|127\.0\.0\.1|\[::1\]):(\d{1,5})$/);
  const port = match ? Number(match[2]) : 0;

  if (!match || port < 1 || port > 65535) {
    throw new Error(`${name} must point to a local emulator as host:port`);
  }

  return value;
};

const validateEmulatorEnvironment = (env = process.env) => {
  parseLocalEmulatorHost('FIREBASE_AUTH_EMULATOR_HOST', env.FIREBASE_AUTH_EMULATOR_HOST);
  parseLocalEmulatorHost('FIRESTORE_EMULATOR_HOST', env.FIRESTORE_EMULATOR_HOST);

  const projectId = env.SEED_FIREBASE_PROJECT_ID;
  if (!projectId || !projectId.startsWith('demo-')) {
    throw new Error('SEED_FIREBASE_PROJECT_ID must begin with "demo-"');
  }

  return { projectId };
};

// Initialize Firebase Admin without any production credentials.
const initializeFirebase = () => {
  const { projectId } = validateEmulatorEnvironment();

  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
  } else if (admin.app().options.projectId !== projectId) {
    throw new Error('Firebase Admin was already initialized for a different project');
  }

  console.log(`✅ Firebase Admin initialized for local demo project ${projectId}`);
  return admin.firestore();
};

const upsertDemoAuthUsers = async auth => {
  const accounts = [
    { uid: demoUsers[0].id, ...config.demoAccounts.owner },
    { uid: demoUsers[1].id, ...config.demoAccounts.customer }
  ];

  for (const account of accounts) {
    const userRecord = {
      email: account.email,
      password: account.password,
      displayName: account.displayName,
      emailVerified: true,
      disabled: false
    };

    try {
      await auth.getUser(account.uid);
      await auth.updateUser(account.uid, userRecord);
      console.log(`   ✓ Auth user updated: ${account.email}`);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }

      await auth.createUser({ uid: account.uid, ...userRecord });
      console.log(`   ✓ Auth user created: ${account.email}`);
    }
  }
};

// Batch write helper (Firestore limit is 500 per batch)
const batchWrite = async (db, collection, documents) => {
  const batchSize = 400;
  const batches = [];

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = db.batch();
    const chunk = documents.slice(i, i + batchSize);

    chunk.forEach(doc => {
      const ref = doc.id
        ? db.collection(collection).doc(doc.id)
        : db.collection(collection).doc();
      const { id, ...data } = doc;
      batch.set(ref, data);
    });

    batches.push(batch.commit());
  }

  await Promise.all(batches);
  console.log(`   ✓ ${documents.length} documents written to ${collection}`);
};

// Main seed function
const seed = async () => {
  console.log('\n🌱 Starting BarbersBuddies Demo Data Seed...\n');

  const db = initializeFirebase();
  const auth = admin.auth();

  try {
    // ========================================
    // 1. CREATE USERS
    // ========================================
    console.log('👤 Creating users...');

    // Create or refresh demo accounts so the credentials printed below are valid.
    await upsertDemoAuthUsers(auth);

    // Generate additional users
    const shopOwners = generateShopOwners();
    const customers = generateCustomers(50);

    // Write user documents to Firestore
    const allUsers = [...demoUsers, ...shopOwners, ...customers];
    await batchWrite(db, 'users', allUsers);

    // ========================================
    // 2. CREATE SHOPS
    // ========================================
    console.log('\n🏪 Creating barbershops...');

    const ownerIds = shopOwners.map(o => o.id);
    const shops = generateAllShops(ownerIds);
    await batchWrite(db, 'barberShops', shops);

    // Create shopNames index
    const shopNames = shops.map(s => ({
      id: s.id,
      name: s.name,
      nameSearch: s.name.toLowerCase(),
      createdAt: s.createdAt
    }));
    await batchWrite(db, 'shopNames', shopNames);

    // ========================================
    // 3. CREATE BOOKINGS
    // ========================================
    console.log('\n📅 Creating bookings...');

    let allBookings = [];
    const allCustomers = [...customers, demoUsers[1]]; // Include demo customer

    // Generate bookings for each shop
    for (const shop of shops) {
      const bookingCount = shop.id === 'demo-shop-id'
        ? 50  // More bookings for demo shop
        : Math.floor(Math.random() * 20) + 10;

      const shopBookings = generateShopBookings(shop, allCustomers, bookingCount);
      allBookings.push(...shopBookings);
    }

    // Generate demo customer's bookings across shops
    const demoCustomer = demoUsers[1];
    const demoCustomerBookings = generateDemoCustomerBookings(shops, demoCustomer);
    allBookings.push(...demoCustomerBookings);

    // ========================================
    // 4. CREATE RATINGS (and update bookings)
    // ========================================
    console.log('\n⭐ Creating ratings...');

    let allRatings = [];

    for (const shop of shops) {
      const shopBookings = allBookings.filter(b => b.shopId === shop.id && b.status === 'completed');
      const { ratings, updatedBookings } = generateShopRatings(shopBookings, shop, 70);

      // Update bookings with rating info
      updatedBookings.forEach(updated => {
        const index = allBookings.findIndex(b => b.id === updated.id);
        if (index !== -1) allBookings[index] = updated;
      });

      allRatings.push(...ratings);

      // Update shop with rating aggregates
      const aggregates = calculateShopRatingAggregates(ratings);
      Object.assign(shop, aggregates);
    }

    // Write all bookings
    await batchWrite(db, 'bookings', allBookings);

    // Write all ratings
    await batchWrite(db, 'ratings', allRatings);

    // Update shops with rating data
    for (const shop of shops) {
      await db.collection('barberShops').doc(shop.id).update({
        ratings: shop.ratings,
        averageRating: shop.averageRating,
        totalRatings: shop.totalRatings,
        ratingDistribution: shop.ratingDistribution,
        ratingIds: shop.ratingIds,
        lastRatedAt: shop.lastRatedAt
      });
    }
    console.log('   ✓ Shop ratings updated');

    // ========================================
    // 5. CREATE MESSAGES
    // ========================================
    console.log('\n💬 Creating message threads...');

    const demoShop = shops.find(s => s.id === 'demo-shop-id');
    const demoShopBookings = allBookings.filter(b => b.shopId === 'demo-shop-id');
    const messages = generateDemoShopConversations(demoShopBookings, demoShop, 20);
    await batchWrite(db, 'messages', messages);

    // ========================================
    // 6. CREATE NOTIFICATIONS
    // ========================================
    console.log('\n🔔 Creating notifications...');

    const demoShopRatings = allRatings.filter(r => r.shopId === 'demo-shop-id');
    const notifications = generateShopNotifications(demoShopBookings, demoShop, demoShopRatings);
    await batchWrite(db, 'notifications', notifications.slice(0, 50));

    // ========================================
    // 7. CREATE BOOKED TIME SLOTS
    // ========================================
    console.log('\n🕐 Creating booked time slots...');

    const bookedSlots = allBookings
      .filter(b => ['confirmed', 'pending', 'completed'].includes(b.status))
      .map(b => ({
        id: b.timeSlotId,
        shopId: b.shopId,
        date: b.selectedDate,
        time: b.selectedTime,
        status: b.status === 'completed' ? 'completed' : 'booked',
        employeeId: b.employeeId,
        employeeName: b.employeeName,
        bookingId: b.id,
        createdAt: b.createdAt
      }));
    await batchWrite(db, 'bookedTimeSlots', bookedSlots.slice(0, 100));

    // ========================================
    // 8. CREATE NOTIFICATION PREFERENCES
    // ========================================
    console.log('\n⚙️ Creating notification preferences...');

    const notifPrefs = demoUsers.map(u => ({
      id: u.id,
      enabled: true,
      preferences: {
        oneHourBefore: true,
        oneDayBefore: true,
        threeDaysBefore: false,
        oneWeekBefore: false,
        onBooking: true
      },
      userEmail: u.email,
      updatedAt: new Date()
    }));
    await batchWrite(db, 'notificationPreferences', notifPrefs);

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n' + '='.repeat(50));
    console.log('✅ SEED COMPLETE!');
    console.log('='.repeat(50));
    console.log(`
📊 Data Summary:
   • Users: ${allUsers.length}
   • Shops: ${shops.length}
   • Bookings: ${allBookings.length}
   • Ratings: ${allRatings.length}
   • Messages: ${messages.length}
   • Notifications: ${Math.min(notifications.length, 50)}

🔑 Demo Credentials:
   Shop Owner: ${config.demoAccounts.owner.email} / ${config.demoAccounts.owner.password}
   Customer:   ${config.demoAccounts.customer.email} / ${config.demoAccounts.customer.password}

🏪 Demo Shop URL: /shop/demo-barbershop
`);

  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  }
};

// Clean function to remove demo data
const clean = async () => {
  console.log('\n🧹 Cleaning demo data...\n');

  const db = initializeFirebase();
  const auth = admin.auth();

  const collections = [
    'users', 'barberShops', 'bookings', 'ratings',
    'messages', 'notifications', 'bookedTimeSlots',
    'shopNames', 'notificationPreferences'
  ];

  for (const collection of collections) {
    const snapshot = await db.collection(collection).get();
    const batch = db.batch();

    snapshot.docs.forEach(doc => batch.delete(doc.ref));

    if (snapshot.docs.length > 0) {
      await batch.commit();
      console.log(`   ✓ Deleted ${snapshot.docs.length} docs from ${collection}`);
    }
  }

  // Delete demo auth users
  for (const user of demoUsers) {
    try {
      await auth.deleteUser(user.id);
      console.log(`   ✓ Deleted auth user: ${user.email}`);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') {
        console.log(`   ⚠ Could not delete: ${user.email}`);
      }
    }
  }

  console.log('\n✅ Clean complete!\n');
};

// CLI handling
if (require.main === module) {
  const command = process.argv[2];
  const operation = command === 'clean' ? clean() : seed();

  operation.catch(error => {
    console.error('\n❌ Seed operation failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  initializeFirebase,
  parseLocalEmulatorHost,
  upsertDemoAuthUsers,
  validateEmulatorEnvironment
};
