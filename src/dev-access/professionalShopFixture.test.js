import {resolveAppRuntime} from '../runtime/appRuntime';
import {
    createProfessionalShopFixtureData,
    createProfessionalShopFixtureProvisioner,
    PersonaFixtureError,
    PROFESSIONAL_SHOP_FIXTURE_KIND,
    PROFESSIONAL_SHOP_FIXTURE_VERSION,
    professionalShopIdFor
} from './professionalShopFixture';
import {getDemoPersona, PROFESSIONAL_DEMO_PERSONA_ID} from './personas';

const runtime = () => resolveAppRuntime({NODE_ENV: 'development'});
const user = {uid: 'demo-user-1', isAnonymous: true};
const persona = getDemoPersona(PROFESSIONAL_DEMO_PERSONA_ID);

const snapshot = (data = null) => ({
    exists: jest.fn(() => data !== null),
    data: jest.fn(() => data)
});

const setup = (existingShop = null, overrides = {}) => {
    const shopRef = {path: 'barberShops/demo-professional-demo-user-1'};
    const transaction = {
        get: jest.fn(async () => snapshot(existingShop)),
        set: jest.fn()
    };
    const dependencies = {
        runtime: runtime(),
        db: {name: 'db'},
        doc: jest.fn(() => shopRef),
        runTransaction: jest.fn(async (_db, operation) => operation(transaction)),
        serverTimestamp: jest.fn(() => ({type: 'server-timestamp'})),
        ...overrides
    };
    return {
        provision: createProfessionalShopFixtureProvisioner(dependencies),
        dependencies,
        shopRef,
        transaction
    };
};

describe('professional shop fixture', () => {
    test('builds a hybrid seven-day legacy and booking-v2 shop without external assets', () => {
        const timestamp = {type: 'server-timestamp'};
        const fixture = createProfessionalShopFixtureData({
            userId: user.uid,
            timestamp
        });

        expect(fixture).toMatchObject({
            schemaVersion: 2,
            active: true,
            ownerId: user.uid,
            timeZone: 'Europe/Berlin',
            currency: 'EUR',
            bookingPolicy: {
                consentVersion: 'demo-booking-consent-v1',
                guestBookingEnabled: true,
                cancellationNoticeMinutes: 60
            },
            demoFixtureKind: PROFESSIONAL_SHOP_FIXTURE_KIND,
            demoFixtureVersion: PROFESSIONAL_SHOP_FIXTURE_VERSION,
            demoPersonaId: PROFESSIONAL_DEMO_PERSONA_ID,
            createdAt: timestamp,
            lastUpdated: timestamp
        });
        expect(Object.keys(fixture.weeklyAvailability)).toEqual([
            'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
        ]);
        expect(Object.keys(fixture.availability)).toEqual([
            'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
        ]);
        expect(fixture.services).toEqual([
            expect.objectContaining({
                id: 'classic-haircut',
                price: '25.00',
                priceMinor: 2500,
                duration: '30',
                durationMinutes: 30,
                currency: 'EUR'
            })
        ]);
        expect(fixture.employees).toEqual([
            expect.objectContaining({
                id: 'demo-professional-stylist',
                serviceIds: ['classic-haircut'],
                bookable: true
            })
        ]);
        expect(fixture.imageUrls).toEqual([]);
        expect(fixture.services[0].imageUrls).toEqual([]);
        expect(fixture.employees[0].photo).toMatch(/^data:image\/svg\+xml,/);
    });

    test('creates exactly the deterministic owner-scoped document in one transaction', async () => {
        const {provision, dependencies, shopRef, transaction} = setup();

        await expect(provision({persona, user})).resolves.toEqual({
            shopId: professionalShopIdFor(user.uid),
            created: true
        });

        expect(dependencies.doc).toHaveBeenCalledWith(
            dependencies.db,
            'barberShops',
            'demo-professional-demo-user-1'
        );
        expect(dependencies.runTransaction).toHaveBeenCalledTimes(1);
        expect(transaction.get).toHaveBeenCalledWith(shopRef);
        expect(transaction.set).toHaveBeenCalledWith(shopRef, expect.objectContaining({
            ownerId: user.uid,
            demoFixtureKind: PROFESSIONAL_SHOP_FIXTURE_KIND,
            demoFixtureVersion: PROFESSIONAL_SHOP_FIXTURE_VERSION
        }));
    });

    test('preserves a matching fixture without issuing a write', async () => {
        const existingShop = {
            ownerId: user.uid,
            demoFixtureKind: PROFESSIONAL_SHOP_FIXTURE_KIND,
            demoFixtureVersion: PROFESSIONAL_SHOP_FIXTURE_VERSION,
            demoPersonaId: PROFESSIONAL_DEMO_PERSONA_ID,
            localTestState: 'preserve-me'
        };
        const {provision, transaction} = setup(existingShop);

        await expect(provision({persona, user})).resolves.toEqual({
            shopId: professionalShopIdFor(user.uid),
            created: false
        });
        expect(transaction.set).not.toHaveBeenCalled();
    });

    test.each([
        ['another owner', {ownerId: 'another-user'}],
        ['another fixture', {demoFixtureKind: 'another-fixture'}],
        ['another fixture version', {demoFixtureVersion: 2}],
        ['another persona', {demoPersonaId: 'customer'}]
    ])('rejects %s without overwriting the document', async (_label, conflict) => {
        const existingShop = {
            ownerId: user.uid,
            demoFixtureKind: PROFESSIONAL_SHOP_FIXTURE_KIND,
            demoFixtureVersion: PROFESSIONAL_SHOP_FIXTURE_VERSION,
            demoPersonaId: PROFESSIONAL_DEMO_PERSONA_ID,
            ...conflict
        };
        const {provision, transaction} = setup(existingShop);

        await expect(provision({persona, user})).rejects.toMatchObject({
            name: 'PersonaFixtureError',
            code: 'DEMO_FIXTURE_CONFLICT'
        });
        expect(transaction.set).not.toHaveBeenCalled();
    });

    test('fails closed before Firestore outside the exact local emulator runtime', async () => {
        const doc = jest.fn();
        const runTransaction = jest.fn();
        const {provision} = setup(null, {
            runtime: resolveAppRuntime({
                NODE_ENV: 'production',
                REACT_APP_FIREBASE_API_KEY: 'test-api-key',
                REACT_APP_FIREBASE_AUTH_DOMAIN: 'barbersbuddies.example.invalid',
                REACT_APP_FIREBASE_PROJECT_ID: 'barbersbuddies-live',
                REACT_APP_FIREBASE_STORAGE_BUCKET: 'barbersbuddies-live.appspot.com',
                REACT_APP_FIREBASE_MESSAGING_SENDER_ID: '123456789012',
                REACT_APP_FIREBASE_APP_ID: '1:123456789012:web:abcdef'
            }),
            doc,
            runTransaction
        });

        let receivedError;
        try {
            await provision({persona, user});
        } catch (error) {
            receivedError = error;
        }
        expect(receivedError).toBeInstanceOf(PersonaFixtureError);
        expect(receivedError).toMatchObject({code: 'DEMO_ACCESS_DISABLED'});
        expect(doc).not.toHaveBeenCalled();
        expect(runTransaction).not.toHaveBeenCalled();
    });
});
