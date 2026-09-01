/** @jest-environment node */

import {deleteApp, initializeApp} from 'firebase/app';
import {
    connectAuthEmulator,
    getAuth,
    signInAnonymously,
    signOut,
    updateProfile
} from 'firebase/auth';
import {
    connectFirestoreEmulator,
    deleteDoc,
    doc,
    getDoc,
    getFirestore,
    runTransaction,
    serverTimestamp,
    setDoc,
    terminate
} from 'firebase/firestore';
import {resolveAppRuntime} from '../runtime/appRuntime';
import {createDemoAccessController} from './demoAccessController';
import {
    createProfessionalShopFixtureProvisioner,
    professionalShopIdFor
} from './professionalShopFixture';

const runEmulatorTests = process.env.RUN_DEMO_ACCESS_EMULATOR_TESTS === 'true';
const describeEmulator = runEmulatorTests ? describe : describe.skip;

describeEmulator('Firebase-backed professional demo access', () => {
    let app;
    let auth;
    let db;

    beforeEach(() => {
        app = initializeApp({
            apiKey: 'demo-barbersbuddies',
            authDomain: 'demo-barbersbuddies.firebaseapp.com',
            projectId: 'demo-barbersbuddies',
            storageBucket: 'demo-barbersbuddies.appspot.com',
            messagingSenderId: '000000000000',
            appId: '1:000000000000:web:demo-barbersbuddies'
        }, `demo-access-${Date.now()}-${Math.random()}`);
        auth = getAuth(app);
        db = getFirestore(app);
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
        connectFirestoreEmulator(db, '127.0.0.1', 8080);
    });

    afterEach(async () => {
        if (auth.currentUser) {
            try {
                await deleteDoc(doc(db, 'barberShops', professionalShopIdFor(auth.currentUser.uid)));
                await deleteDoc(doc(db, 'users', auth.currentUser.uid));
            } catch {
                // The disposable emulator will still be isolated by project ID.
            }
            await signOut(auth);
        }
        await terminate(db);
        await deleteApp(app);
    });

    test('creates a passwordless shop-owner identity and its own Firestore profile', async () => {
        const runtime = resolveAppRuntime({NODE_ENV: 'development'});
        const controller = createDemoAccessController({
            runtime,
            auth,
            db,
            signInAnonymously,
            signOut,
            updateProfile,
            doc,
            getDoc,
            setDoc,
            serverTimestamp,
            provisionPersonaFixture: createProfessionalShopFixtureProvisioner({
                runtime,
                db,
                doc,
                runTransaction,
                serverTimestamp
            })
        });

        const result = await controller.enter('professional');
        const profile = await getDoc(doc(db, 'users', result.userId));
        const shopRef = doc(db, 'barberShops', professionalShopIdFor(result.userId));
        const shop = await getDoc(shopRef);

        expect(auth.currentUser).toMatchObject({
            uid: result.userId,
            isAnonymous: true,
            displayName: 'BarbersBuddies Demo Professional'
        });
        expect(profile.exists()).toBe(true);
        expect(profile.data()).toMatchObject({
            demoPersonaId: 'professional',
            demoAccessVersion: 1,
            email: 'professional@barbersbuddies.invalid',
            userType: 'shop-owner',
            isSubscribed: true,
            subscriptionStatus: 'demo'
        });
        expect(profile.data()).not.toHaveProperty('password');
        expect(shop.exists()).toBe(true);
        expect(shop.data()).toMatchObject({
            schemaVersion: 2,
            ownerId: result.userId,
            demoFixtureKind: 'professional-shop',
            demoFixtureVersion: 1,
            timeZone: 'Europe/Berlin',
            currency: 'EUR',
            bookingPolicy: {
                consentVersion: 'demo-booking-consent-v1',
                guestBookingEnabled: true
            },
            services: [expect.objectContaining({id: 'classic-haircut'})],
            employees: [expect.objectContaining({id: 'demo-professional-stylist'})]
        });
        expect(Object.keys(shop.data().weeklyAvailability)).toHaveLength(7);
        expect(Object.keys(shop.data().availability)).toHaveLength(7);
        expect(result.shopId).toBe(professionalShopIdFor(result.userId));
        expect(result.destination).toBe('/account');

        await setDoc(shopRef, {localTestState: 'preserve-me'}, {merge: true});
        const reentry = await controller.enter('professional');
        const preservedShop = await getDoc(shopRef);

        expect(reentry).toMatchObject({
            userId: result.userId,
            shopId: result.shopId
        });
        expect(preservedShop.data().localTestState).toBe('preserve-me');
    });
});
