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
 *   npm run seed        - Seed demo data
 *   npm run seed:clean  - Remove all demo data
 *
 * Requirements:
 *   - Firebase Admin SDK credentials (serviceAccountKey.json)
 *   - Node.js 16+
 */

const admin = require('firebase-admin');
const path = require('path');

// Data generators
const { demoUsers, generateShopOwners, generateCustomers } = require('./data/users');
const { generateAllShops } = require('./data/shops');
const { generateShopBookings, generateDemoCustomerBookings } = require('./data/bookings');
const { generateShopRatings, calculateShopRatingAggregates } = require('./data/ratings');
const { generateDemoShopConversations } = require('./data/messages');
const { generateShopNotifications } = require('./data/notifications');
const config = require('./config');

// Initialize Firebase Admin
const initializeFirebase = () => {
  const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');

  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized');
    return admin.firestore();
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin');
    console.error('   Make sure serviceAccountKey.json exists in the project root');
    console.error('   Download it from Firebase Console > Project Settings > Service Accounts');
    process.exit(1);
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

    // Create demo accounts in Firebase Auth
    for (const user of demoUsers) {
      try {
        await auth.createUser({
          uid: user.id,
          email: user.email,
          password: user.password,
          displayName: user.displayName,
          emailVerified: true
        });
        console.log(`   ✓ Auth user created: ${user.email}`);
      } catch (e) {
        if (e.code === 'auth/uid-already-exists' || e.code === 'auth/email-already-exists') {
          console.log(`   ⚠ Auth user exists: ${user.email}`);
        } else {
          throw e;
        }
      }
    }

    // Generate additional users
    const shopOwners = generateShopOwners();
    const customers = generateCustomers(50);

    // Write user documents to Firestore
    const allUsers = [...demoUsers, ...shopOwners, ...customers];
    await batchWrite(db, 'users', allUsers.map(u => {
      const { password, ...userData } = u;
      return userData;
    }));

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
const command = process.argv[2];

if (command === 'clean') {
  clean();
} else {
  seed();
}
