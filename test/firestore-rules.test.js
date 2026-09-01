const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} = require('firebase/firestore');

const PROJECT_ID = 'demo-barbersbuddies';
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;

if (!EMULATOR_HOST) {
  throw new Error(
    'FIRESTORE_EMULATOR_HOST is not set. Run this test through Firebase emulators:exec for the disposable demo-barbersbuddies project.',
  );
}

const hostSeparator = EMULATOR_HOST.lastIndexOf(':');
const emulatorHost = EMULATOR_HOST.slice(0, hostSeparator);
const emulatorPort = Number(EMULATOR_HOST.slice(hostSeparator + 1));

if (!emulatorHost || !Number.isInteger(emulatorPort)) {
  throw new Error(`Invalid FIRESTORE_EMULATOR_HOST: ${EMULATOR_HOST}`);
}

const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
const indexConfiguration = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'firestore.indexes.json'), 'utf8'),
);

let testEnv;

function firestoreFor(uid, tokenOptions) {
  return testEnv.authenticatedContext(uid, tokenOptions).firestore();
}

async function seedDocuments(documents) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all(
      Object.entries(documents).map(([documentPath, data]) =>
        setDoc(doc(db, documentPath), data),
      ),
    );
  });
}

describe('Firestore booking policy', { concurrency: false }, () => {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: emulatorHost,
        port: emulatorPort,
        rules,
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedDocuments({
      'barberShops/shop-a': {
        name: 'Test Shop',
        ownerId: 'owner-a',
      },
      'bookings/current-booking': {
        customerUid: 'customer-a',
        selectedDate: '2026-09-01',
        selectedTime: '10:00',
        shopId: 'shop-a',
        userEmail: 'current@example.test',
      },
      'bookings/legacy-booking': {
        selectedDate: '2026-09-02',
        selectedTime: '11:00',
        shopId: 'shop-a',
        userEmail: 'legacy@example.test',
      },
      'bookings/current-booking/events/created': {
        type: 'created',
      },
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
      await testEnv.cleanup();
    }
  });

  test('anonymous users cannot read bookings', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'bookings/current-booking')));
  });

  test('unrelated authenticated users cannot read bookings', async () => {
    const db = firestoreFor('unrelated-user', {
      email: 'unrelated@example.test',
      email_verified: true,
    });
    await assertFails(getDoc(doc(db, 'bookings/current-booking')));
  });

  test('the customerUid participant can read a current booking', async () => {
    const db = firestoreFor('customer-a', {
      email: 'different@example.test',
      email_verified: false,
    });
    await assertSucceeds(getDoc(doc(db, 'bookings/current-booking')));
  });

  test('an exact verified-email participant can read a legacy booking', async () => {
    const db = firestoreFor('legacy-customer', {
      email: 'legacy@example.test',
      email_verified: true,
    });
    await assertSucceeds(getDoc(doc(db, 'bookings/legacy-booking')));
  });

  test('an unverified email cannot authorize a legacy booking read', async () => {
    const db = firestoreFor('legacy-customer', {
      email: 'legacy@example.test',
      email_verified: false,
    });
    await assertFails(getDoc(doc(db, 'bookings/legacy-booking')));
  });

  test('the current authoritative shop owner can read a booking', async () => {
    const db = firestoreFor('owner-a');
    await assertSucceeds(getDoc(doc(db, 'bookings/current-booking')));
  });

  test('the customer can query only bookings constrained by customerUid', async () => {
    const db = firestoreFor('customer-a');
    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'bookings'),
          where('customerUid', '==', 'customer-a'),
        ),
      ),
    );
  });

  test('the verified legacy customer can query only bookings constrained by exact email', async () => {
    const db = firestoreFor('legacy-customer', {
      email: 'legacy@example.test',
      email_verified: true,
    });
    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'bookings'),
          where('userEmail', '==', 'legacy@example.test'),
        ),
      ),
    );
  });

  test('the current shop owner can query bookings constrained by authoritative shopId', async () => {
    const db = firestoreFor('owner-a');
    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'bookings'),
          where('shopId', '==', 'shop-a'),
        ),
      ),
    );
  });

  test('an unrelated user cannot query all bookings', async () => {
    const db = firestoreFor('unrelated-user');
    await assertFails(getDocs(collection(db, 'bookings')));
  });

  test('a stale embedded shopOwnerId cannot authorize a booking read', async () => {
    await seedDocuments({
      'bookings/stale-owner-booking': {
        customerUid: 'customer-a',
        shopId: 'shop-a',
        shopOwnerId: 'former-owner',
      },
    });
    const db = firestoreFor('former-owner');
    await assertFails(getDoc(doc(db, 'bookings/stale-owner-booking')));
  });

  test('booking participants can read events but cannot write them', async () => {
    const db = firestoreFor('customer-a');
    const eventRef = doc(db, 'bookings/current-booking/events/created');
    await assertSucceeds(getDoc(eventRef));
    await assertFails(updateDoc(eventRef, { type: 'changed' }));
  });

  test('unrelated users cannot read booking events', async () => {
    const db = firestoreFor('unrelated-user');
    await assertFails(
      getDoc(doc(db, 'bookings/current-booking/events/created')),
    );
  });

  test('clients cannot read server-owned occupancy, command, outbox, or legacy slot records', async () => {
    await seedDocuments({
      'bookingOccupancy/existing': { bookingId: 'current-booking' },
      'bookingCommands/existing': { bookingId: 'current-booking' },
      'bookingOutbox/existing': { bookingId: 'current-booking' },
      'bookedTimeSlots/existing': { bookingId: 'current-booking' },
    });
    const db = firestoreFor('owner-a');

    for (const collectionName of [
      'bookingOccupancy',
      'bookingCommands',
      'bookingOutbox',
      'bookedTimeSlots',
    ]) {
      await assertFails(getDoc(doc(db, `${collectionName}/existing`)));
    }
  });

  test('shop creation requires ownerId to equal the authenticated uid', async () => {
    const db = firestoreFor('owner-b');
    await assertSucceeds(
      setDoc(doc(db, 'barberShops/shop-b'), {
        name: 'Owned Shop',
        ownerId: 'owner-b',
      }),
    );
    await assertFails(
      setDoc(doc(db, 'barberShops/claimed-shop'), {
        name: 'Claimed Shop',
        ownerId: 'someone-else',
      }),
    );
  });

  test('a current shop owner cannot reassign ownerId', async () => {
    const db = firestoreFor('owner-a');
    await assertFails(
      updateDoc(doc(db, 'barberShops/shop-a'), { ownerId: 'new-owner' }),
    );
  });

  for (const collectionName of [
    'bookings',
    'bookingOccupancy',
    'bookingCommands',
    'bookingOutbox',
    'bookedTimeSlots',
  ]) {
    test(`authenticated clients cannot create, update, or delete ${collectionName} records`, async () => {
      const db = firestoreFor('owner-a', {
        email: 'current@example.test',
        email_verified: true,
      });
      const existingPath = `${collectionName}/existing`;
      const newPath = `${collectionName}/new`;

      await seedDocuments({
        [existingPath]: {
          customerUid: 'owner-a',
          shopId: 'shop-a',
          userEmail: 'current@example.test',
          state: 'pending',
        },
      });

      await assertFails(setDoc(doc(db, newPath), { shopId: 'shop-a' }));
      await assertFails(updateDoc(doc(db, existingPath), { state: 'changed' }));
      await assertFails(deleteDoc(doc(db, existingPath)));
    });
  }

  test('authenticated clients cannot create or delete booking events', async () => {
    const db = firestoreFor('customer-a');
    await assertFails(
      setDoc(doc(db, 'bookings/current-booking/events/client-event'), {
        type: 'client-created',
      }),
    );
    await assertFails(
      deleteDoc(doc(db, 'bookings/current-booking/events/created')),
    );
  });

  test('indexes support owner calendar queries by shopId, selectedDate, then selectedTime', () => {
    assert.deepEqual(indexConfiguration.indexes[0], {
      collectionGroup: 'bookings',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'shopId', order: 'ASCENDING' },
        { fieldPath: 'selectedDate', order: 'ASCENDING' },
        { fieldPath: 'selectedTime', order: 'ASCENDING' },
      ],
    });
  });

  test('indexes support owner booking lists by shopId then newest createdAt', () => {
    assert.deepEqual(indexConfiguration.indexes[1], {
      collectionGroup: 'bookings',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'shopId', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' },
      ],
    });
  });

  test('indexes support pending outbox delivery by state then availableAt', () => {
    assert.deepEqual(indexConfiguration.indexes[2], {
      collectionGroup: 'bookingOutbox',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'state', order: 'ASCENDING' },
        { fieldPath: 'availableAt', order: 'ASCENDING' },
      ],
    });
  });
});
