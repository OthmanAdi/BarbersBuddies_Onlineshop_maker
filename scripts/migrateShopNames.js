import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { config } from '../src/firebase/config';

// Initialize Firebase
const app = initializeApp(config);
const db = getFirestore(app);

const migrateShopNames = async () => {
  console.log('Starting migration...');
  try {
    const shops = await getDocs(collection(db, 'barberShops'));
    const batch = writeBatch(db);
    let count = 0;

    for (const shop of shops.docs) {
      const data = shop.data();
      batch.set(doc(db, 'shopNames', shop.id), {
        name: data.name,
        nameSearch: data.name.toLowerCase().trim(),
        createdAt: data.createdAt || new Date()
      });
      count++;

      // Firebase batch has a limit of 500 operations
      if (count % 400 === 0) {
        await batch.commit();
        console.log(`Processed ${count} shops...`);
      }
    }

    // Commit any remaining operations
    await batch.commit();
    console.log(`Migration completed! Processed ${count} shops total.`);

  } catch (error) {
    console.error('Error during migration:', error);
  }
};

// Run the migration
migrateShopNames().then(() => process.exit(0));
