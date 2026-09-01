import {resolveAppRuntime} from '../runtime/appRuntime';
import {
    createDemoAccessController,
    DemoAccessError
} from './demoAccessController';
import {
    getDemoPersona,
    isDemoPersonaIdentity,
    listDemoPersonas,
    PROFESSIONAL_DEMO_PERSONA_ID
} from './personas';

const developmentRuntime = () => resolveAppRuntime({NODE_ENV: 'development'});

const productionRuntime = () => resolveAppRuntime({
    NODE_ENV: 'production',
    REACT_APP_FIREBASE_API_KEY: 'test-api-key',
    REACT_APP_FIREBASE_AUTH_DOMAIN: 'barbersbuddies.example.invalid',
    REACT_APP_FIREBASE_PROJECT_ID: 'barbersbuddies-live',
    REACT_APP_FIREBASE_STORAGE_BUCKET: 'barbersbuddies-live.appspot.com',
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID: '123456789012',
    REACT_APP_FIREBASE_APP_ID: '1:123456789012:web:abcdef'
});

const createSnapshot = (profile = null) => ({
    exists: jest.fn(() => profile !== null),
    data: jest.fn(() => profile)
});

const setup = (overrides = {}) => {
    const user = {
        uid: 'demo-user-1',
        isAnonymous: true,
        email: null
    };
    const timestamp = {type: 'server-timestamp'};
    const userRef = {path: 'users/demo-user-1'};
    const dependencies = {
        runtime: developmentRuntime(),
        auth: {name: 'auth'},
        db: {name: 'db'},
        signInAnonymously: jest.fn(async () => ({user})),
        signOut: jest.fn(async () => undefined),
        updateProfile: jest.fn(async () => undefined),
        doc: jest.fn(() => userRef),
        getDoc: jest.fn(async () => createSnapshot()),
        setDoc: jest.fn(async () => undefined),
        serverTimestamp: jest.fn(() => timestamp),
        notify: jest.fn(),
        ...overrides
    };
    return {
        controller: createDemoAccessController(dependencies),
        dependencies,
        timestamp,
        user,
        userRef
    };
};

describe('demo persona registry', () => {
    test('exposes an immutable professional profile with no credential', () => {
        const persona = getDemoPersona(PROFESSIONAL_DEMO_PERSONA_ID);

        expect(persona).toMatchObject({
            id: 'professional',
            label: 'Professional',
            destination: '/account',
            fixture: {
                kind: 'professional-shop',
                version: 1
            },
            profile: {
                email: 'professional@barbersbuddies.invalid',
                userType: 'shop-owner',
                providerId: 'anonymous'
            }
        });
        expect(Object.isFrozen(persona)).toBe(true);
        expect(Object.isFrozen(persona.profile)).toBe(true);
        expect(Object.isFrozen(persona.fixture)).toBe(true);
        expect(Object.keys(persona.profile)).not.toContain('password');
        expect(listDemoPersonas()).toEqual([persona]);
        expect(getDemoPersona('administrator')).toBeNull();
    });

    test('recognizes demo identities only inside the exact safe runtime', () => {
        const local = developmentRuntime();
        const production = productionRuntime();

        expect(isDemoPersonaIdentity({isAnonymous: true}, local)).toBe(true);
        expect(isDemoPersonaIdentity('professional@barbersbuddies.invalid', local)).toBe(true);
        expect(isDemoPersonaIdentity('professional@barbersbuddies.invalid', production)).toBe(false);
        expect(isDemoPersonaIdentity({isAnonymous: true}, production)).toBe(false);
        expect(isDemoPersonaIdentity('demo-owner@barbersbuddies.com', local)).toBe(false);
    });
});

describe('demo access controller', () => {
    test('fails before every Firebase call outside local development emulators', async () => {
        const signInAnonymously = jest.fn();
        const {controller, dependencies} = setup({
            runtime: productionRuntime(),
            signInAnonymously
        });

        await expect(controller.enter('professional')).rejects.toMatchObject({
            code: 'DEMO_ACCESS_DISABLED',
            message: 'Local demo access is unavailable in this runtime.'
        });
        expect(controller.isEnabled()).toBe(false);
        expect(signInAnonymously).not.toHaveBeenCalled();
        expect(dependencies.getDoc).not.toHaveBeenCalled();
        expect(dependencies.setDoc).not.toHaveBeenCalled();
    });

    test('rejects unknown personas before authentication', async () => {
        const {controller, dependencies} = setup();

        await expect(controller.enter('administrator')).rejects.toMatchObject({
            code: 'DEMO_PERSONA_UNKNOWN'
        });
        expect(dependencies.signInAnonymously).not.toHaveBeenCalled();
    });

    test('creates the exact disposable professional profile and returns safe navigation data', async () => {
        const {controller, dependencies, timestamp, user, userRef} = setup();

        await expect(controller.enter('professional')).resolves.toEqual({
            personaId: 'professional',
            userId: 'demo-user-1',
            userType: 'shop-owner',
            destination: '/account'
        });

        expect(dependencies.signInAnonymously).toHaveBeenCalledWith(dependencies.auth);
        expect(dependencies.updateProfile).toHaveBeenCalledWith(user, {
            displayName: 'BarbersBuddies Demo Professional'
        });
        expect(dependencies.doc).toHaveBeenCalledWith(
            dependencies.db,
            'users',
            'demo-user-1'
        );
        expect(dependencies.getDoc).toHaveBeenCalledWith(userRef);
        expect(dependencies.setDoc).toHaveBeenCalledTimes(1);
        expect(dependencies.setDoc).toHaveBeenCalledWith(userRef, expect.objectContaining({
            demoPersonaId: 'professional',
            demoAccessVersion: 1,
            email: 'professional@barbersbuddies.invalid',
            displayName: 'BarbersBuddies Demo Professional',
            userType: 'shop-owner',
            isSubscribed: true,
            createdAt: timestamp,
            lastLoginAt: timestamp,
            lastUpdated: timestamp
        }));
        const writtenProfile = dependencies.setDoc.mock.calls[0][1];
        expect(Object.keys(writtenProfile)).not.toContain('password');
        expect(JSON.stringify(writtenProfile)).not.toMatch(/credential|token|secret/i);
        expect(dependencies.notify).toHaveBeenCalledWith({
            personaId: 'professional',
            userType: 'shop-owner'
        });
        expect(dependencies.signOut).not.toHaveBeenCalled();
    });

    test('reuses a matching profile without replacing its durable fields', async () => {
        const profile = {
            demoPersonaId: 'professional',
            demoAccessVersion: 1,
            userType: 'shop-owner',
            customFixtureState: 'preserve-me'
        };
        const getDoc = jest.fn(async () => createSnapshot(profile));
        const {controller, dependencies, timestamp, userRef} = setup({getDoc});

        await controller.enter('professional');

        expect(dependencies.setDoc).toHaveBeenCalledWith(userRef, {
            lastLoginAt: timestamp,
            lastUpdated: timestamp
        }, {merge: true});
        expect(dependencies.setDoc.mock.calls[0][1]).not.toHaveProperty('customFixtureState');
    });

    test('prepares the optional persona fixture only after the profile write', async () => {
        const provisionPersonaFixture = jest.fn(async () => ({
            shopId: 'demo-professional-demo-user-1',
            created: true
        }));
        const {controller, dependencies, user} = setup({provisionPersonaFixture});

        await expect(controller.enter('professional')).resolves.toEqual({
            personaId: 'professional',
            userId: user.uid,
            userType: 'shop-owner',
            destination: '/account',
            shopId: 'demo-professional-demo-user-1'
        });

        expect(provisionPersonaFixture).toHaveBeenCalledWith({
            persona: getDemoPersona(PROFESSIONAL_DEMO_PERSONA_ID),
            user
        });
        expect(dependencies.setDoc.mock.invocationCallOrder[0]).toBeLessThan(
            provisionPersonaFixture.mock.invocationCallOrder[0]
        );
        expect(dependencies.notify.mock.invocationCallOrder[0]).toBeGreaterThan(
            provisionPersonaFixture.mock.invocationCallOrder[0]
        );
    });

    test.each([
        ['conflicts', {code: 'DEMO_FIXTURE_CONFLICT'}, 'DEMO_FIXTURE_CONFLICT'],
        ['sanitizes failures', new Error('raw fixture secret'), 'DEMO_FIXTURE_FAILED']
    ])('%s from persona fixture provisioning and signs out', async (_label, failure, code) => {
        const provisionPersonaFixture = jest.fn(async () => {
            throw failure;
        });
        const {controller, dependencies} = setup({provisionPersonaFixture});

        let receivedError;
        try {
            await controller.enter('professional');
        } catch (error) {
            receivedError = error;
        }

        expect(receivedError).toBeInstanceOf(DemoAccessError);
        expect(receivedError.code).toBe(code);
        expect(receivedError.message).not.toMatch(/raw|secret/i);
        expect(dependencies.signOut).toHaveBeenCalledWith(dependencies.auth);
        expect(dependencies.notify).not.toHaveBeenCalled();
    });

    test('coalesces rapid repeat entry into one Auth and Firestore operation', async () => {
        let resolveCredential;
        const user = {uid: 'demo-user-1', isAnonymous: true};
        const signInAnonymously = jest.fn(() => new Promise((resolve) => {
            resolveCredential = resolve;
        }));
        const {controller, dependencies} = setup({signInAnonymously});

        const first = controller.enter('professional');
        const second = controller.enter('professional');
        resolveCredential({user});

        await expect(Promise.all([first, second])).resolves.toEqual([
            expect.objectContaining({userId: 'demo-user-1'}),
            expect.objectContaining({userId: 'demo-user-1'})
        ]);
        expect(dependencies.signInAnonymously).toHaveBeenCalledTimes(1);
        expect(dependencies.setDoc).toHaveBeenCalledTimes(1);
    });

    test('does not overwrite a conflicting profile and signs out the local session', async () => {
        const getDoc = jest.fn(async () => createSnapshot({
            demoPersonaId: 'customer',
            demoAccessVersion: 1,
            userType: 'customer'
        }));
        const {controller, dependencies} = setup({getDoc});

        await expect(controller.enter('professional')).rejects.toMatchObject({
            code: 'DEMO_PROFILE_CONFLICT'
        });
        expect(dependencies.setDoc).not.toHaveBeenCalled();
        expect(dependencies.signOut).toHaveBeenCalledWith(dependencies.auth);
    });

    test.each([
        ['auth', () => ({signInAnonymously: jest.fn(async () => {
            throw new Error('raw auth secret');
        })}), 'DEMO_AUTH_FAILED', 0],
        ['profile update', () => ({updateProfile: jest.fn(async () => {
            throw new Error('raw profile secret');
        })}), 'DEMO_AUTH_FAILED', 1],
        ['Firestore read', () => ({getDoc: jest.fn(async () => {
            throw new Error('raw Firestore secret');
        })}), 'DEMO_PROFILE_FAILED', 1],
        ['Firestore write', () => ({setDoc: jest.fn(async () => {
            throw new Error('raw Firestore secret');
        })}), 'DEMO_PROFILE_FAILED', 1]
    ])('sanitizes %s failures', async (_label, createOverrides, code, signOutCalls) => {
        const overrides = createOverrides();
        const {controller, dependencies} = setup(overrides);
        let receivedError;
        try {
            await controller.enter('professional');
        } catch (error) {
            receivedError = error;
        }

        expect(receivedError).toBeInstanceOf(DemoAccessError);
        expect(receivedError.code).toBe(code);
        expect(receivedError.message).not.toMatch(/raw|secret|firestore/i);
        expect(dependencies.signOut).toHaveBeenCalledTimes(signOutCalls);
        expect(dependencies.signOut.mock.calls).toEqual(
            signOutCalls === 1 ? [[dependencies.auth]] : []
        );
    });

    test('rejects malformed non-anonymous credentials without reading Firestore', async () => {
        const {controller, dependencies} = setup({
            signInAnonymously: jest.fn(async () => ({
                user: {uid: 'live-user', isAnonymous: false}
            }))
        });

        await expect(controller.enter('professional')).rejects.toMatchObject({
            code: 'DEMO_AUTH_FAILED'
        });
        expect(dependencies.getDoc).not.toHaveBeenCalled();
        expect(dependencies.setDoc).not.toHaveBeenCalled();
    });
});
