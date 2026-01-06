const { initializeApp } = require('firebase-admin');

const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const migrateShopNames = async () => {
  console.log('Starting migration...');
  try {
    const shops = await db.collection('barberShops').get();
    const batch = db.batch();
    let count = 0;

    for (const shop of shops.docs) {
      const data = shop.data();
      batch.set(db.collection('shopNames').doc(shop.id), {
        name: data.name,
        nameSearch: data.name.toLowerCase().trim(),
        createdAt: data.createdAt || new Date()
      });
      count++;

      if (count % 400 === 0) {
        await batch.commit();
        console.log(`Processed ${count} shops...`);
      }
    }

    await batch.commit();
    console.log(`Migration completed! Processed ${count} shops total.`);

  } catch (error) {
    console.error('Error during migration:', error);
  }
};

migrateShopNames().then(() => process.exit(0));