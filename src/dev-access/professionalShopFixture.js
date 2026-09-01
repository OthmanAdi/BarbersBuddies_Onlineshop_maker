import {isDemoAccessEnabled} from '../runtime/appRuntime';
import {
    PROFESSIONAL_DEMO_FIXTURE_KIND,
    PROFESSIONAL_DEMO_FIXTURE_VERSION,
    PROFESSIONAL_DEMO_PERSONA_ID
} from './personas';

export const PROFESSIONAL_SHOP_FIXTURE_VERSION = PROFESSIONAL_DEMO_FIXTURE_VERSION;
export const PROFESSIONAL_SHOP_FIXTURE_KIND = PROFESSIONAL_DEMO_FIXTURE_KIND;

const SHOP_ID_PREFIX = 'demo-professional-';
const CONSENT_VERSION = 'demo-booking-consent-v1';
const SERVICE_ID = 'classic-haircut';
const EMPLOYEE_ID = 'demo-professional-stylist';

const DAY_NAMES = Object.freeze([
    ['monday', 'Monday'],
    ['tuesday', 'Tuesday'],
    ['wednesday', 'Wednesday'],
    ['thursday', 'Thursday'],
    ['friday', 'Friday'],
    ['saturday', 'Saturday'],
    ['sunday', 'Sunday']
]);

const INLINE_EMPLOYEE_AVATAR =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"%3E%3Crect width="80" height="80" rx="16" fill="%231681d8"/%3E%3Ccircle cx="40" cy="30" r="14" fill="%23fff"/%3E%3Cpath d="M16 72c3-17 12-25 24-25s21 8 24 25" fill="%23fff"/%3E%3C/svg%3E';

export class PersonaFixtureError extends Error {
    constructor(code) {
        super(code);
        this.name = 'PersonaFixtureError';
        this.code = code;
    }
}

const fail = (code) => {
    throw new PersonaFixtureError(code);
};

const createCanonicalAvailability = () => Object.fromEntries(
    DAY_NAMES.map(([canonicalDay]) => [canonicalDay, [{
        startLocalTime: '09:00',
        endLocalTime: '18:00'
    }]])
);

const createLegacyAvailability = () => Object.fromEntries(
    DAY_NAMES.map(([, legacyDay]) => [legacyDay, {
        open: '09:00',
        close: '18:00',
        slotDuration: 30
    }])
);

const createLegacySchedule = () => Object.fromEntries(
    DAY_NAMES.map(([, legacyDay]) => [legacyDay, [9, 10, 11, 12, 13, 14, 15, 16, 17]])
);

export const professionalShopIdFor = (userId) => `${SHOP_ID_PREFIX}${userId}`;

export const createProfessionalShopFixtureData = ({userId, timestamp}) => {
    const weeklyAvailability = createCanonicalAvailability();
    const service = {
        id: SERVICE_ID,
        name: 'Classic Haircut',
        description: 'A professional haircut in the disposable local demo.',
        category: 'Haircuts',
        active: true,
        duration: '30',
        durationMinutes: 30,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        price: '25.00',
        priceMinor: 2500,
        currency: 'EUR',
        imageUrls: []
    };
    const employee = {
        id: EMPLOYEE_ID,
        name: 'Demo Professional',
        active: true,
        bookable: true,
        serviceIds: [SERVICE_ID],
        expertise: ['Haircuts'],
        photo: INLINE_EMPLOYEE_AVATAR,
        schedule: createLegacySchedule(),
        weeklyAvailability,
        dateExceptions: {}
    };

    return {
        schemaVersion: 2,
        active: true,
        status: 'active',
        ownerId: userId,
        name: 'BarbersBuddies Demo Studio',
        nameSearch: 'barbersbuddies demo studio',
        email: 'professional@barbersbuddies.invalid',
        phoneNumber: '+49305550100',
        address: 'Demo Street 1, 10115 Berlin',
        biography: '<p>A disposable local studio for safely testing BarbersBuddies.</p>',
        uniqueUrl: professionalShopIdFor(userId),
        timeZone: 'Europe/Berlin',
        currency: 'EUR',
        weeklyAvailability,
        dateExceptions: {},
        availability: createLegacyAvailability(),
        bookingPolicy: {
            consentVersion: CONSENT_VERSION,
            guestBookingEnabled: true,
            cancellationNoticeMinutes: 60
        },
        services: [service],
        employees: [employee],
        employeeRegistrationTokens: {},
        imageUrls: [],
        paymentMethods: [],
        pricingTier: 'standard',
        specialDates: {},
        blocks: [
            {id: 'header', type: 'header', active: true},
            {id: 'services', type: 'services', active: true},
            {id: 'team', type: 'team', active: true},
            {id: 'contact', type: 'contact', active: true},
            {id: 'availability', type: 'availability', active: true},
            {id: 'cta', type: 'cta', active: true}
        ],
        demoFixtureKind: PROFESSIONAL_SHOP_FIXTURE_KIND,
        demoFixtureVersion: PROFESSIONAL_SHOP_FIXTURE_VERSION,
        demoPersonaId: PROFESSIONAL_DEMO_PERSONA_ID,
        createdAt: timestamp,
        lastUpdated: timestamp
    };
};

const isMatchingFixture = (shop, userId) => (
    shop !== null &&
    typeof shop === 'object' &&
    !Array.isArray(shop) &&
    shop.ownerId === userId &&
    shop.demoFixtureKind === PROFESSIONAL_SHOP_FIXTURE_KIND &&
    shop.demoFixtureVersion === PROFESSIONAL_SHOP_FIXTURE_VERSION &&
    shop.demoPersonaId === PROFESSIONAL_DEMO_PERSONA_ID
);

export const createProfessionalShopFixtureProvisioner = ({
    runtime,
    db,
    doc,
    runTransaction,
    serverTimestamp
}) => async ({persona, user}) => {
    if (!isDemoAccessEnabled(runtime)) fail('DEMO_ACCESS_DISABLED');
    if (!persona?.fixture || persona.fixture.kind !== PROFESSIONAL_SHOP_FIXTURE_KIND) {
        return null;
    }
    if (
        persona.id !== PROFESSIONAL_DEMO_PERSONA_ID ||
        persona.fixture.version !== PROFESSIONAL_SHOP_FIXTURE_VERSION ||
        user?.isAnonymous !== true ||
        typeof user.uid !== 'string' ||
        user.uid.length < 1 ||
        user.uid.length > 128
    ) {
        fail('DEMO_FIXTURE_FAILED');
    }

    const shopId = professionalShopIdFor(user.uid);
    const shopRef = doc(db, 'barberShops', shopId);
    let created = false;

    try {
        await runTransaction(db, async (transaction) => {
            created = false;
            const snapshot = await transaction.get(shopRef);
            if (snapshot.exists()) {
                if (!isMatchingFixture(snapshot.data(), user.uid)) {
                    fail('DEMO_FIXTURE_CONFLICT');
                }
                return;
            }

            transaction.set(shopRef, createProfessionalShopFixtureData({
                userId: user.uid,
                timestamp: serverTimestamp()
            }));
            created = true;
        });
    } catch (error) {
        if (error instanceof PersonaFixtureError) throw error;
        fail('DEMO_FIXTURE_FAILED');
    }

    return Object.freeze({shopId, created});
};
