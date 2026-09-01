import {
    connectFirebaseEmulatorsOnce,
    DEFAULT_FIREBASE_EMULATORS,
    FirebaseRuntimeConfigError,
    resolveFirebaseRuntimeConfig
} from './firebase-runtime';

const completeEnvironment = (overrides = {}) => ({
    NODE_ENV: 'production',
    REACT_APP_FIREBASE_API_KEY: 'test-api-key',
    REACT_APP_FIREBASE_AUTH_DOMAIN: 'barbersbuddies.example.invalid',
    REACT_APP_FIREBASE_PROJECT_ID: 'barbersbuddies-live',
    REACT_APP_FIREBASE_STORAGE_BUCKET: 'barbersbuddies-live.appspot.com',
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID: '123456789012',
    REACT_APP_FIREBASE_APP_ID: '1:123456789012:web:abcdef',
    ...overrides
});

describe('resolveFirebaseRuntimeConfig', () => {
    test('uses a non-secret demo project and emulators for an empty development environment', () => {
        const runtime = resolveFirebaseRuntimeConfig({NODE_ENV: 'development'});

        expect(runtime).toEqual({
            config: {
                apiKey: 'demo-barbersbuddies',
                authDomain: 'demo-barbersbuddies.firebaseapp.com',
                projectId: 'demo-barbersbuddies',
                storageBucket: 'demo-barbersbuddies.appspot.com',
                messagingSenderId: '000000000000',
                appId: '1:000000000000:web:demo-barbersbuddies'
            },
            mode: 'emulator',
            emulator: DEFAULT_FIREBASE_EMULATORS,
            source: 'development-default'
        });
    });

    test('fails closed when even one Firebase field is supplied without the complete set', () => {
        expect(() => resolveFirebaseRuntimeConfig({
            NODE_ENV: 'development',
            REACT_APP_FIREBASE_PROJECT_ID: 'demo-barbersbuddies'
        })).toThrow(FirebaseRuntimeConfigError);

        expect(() => resolveFirebaseRuntimeConfig({
            NODE_ENV: 'development',
            REACT_APP_FIREBASE_PROJECT_ID: 'demo-barbersbuddies'
        })).toThrow('Firebase configuration is incomplete');
    });

    test('returns a complete configured environment in live mode', () => {
        const runtime = resolveFirebaseRuntimeConfig(completeEnvironment({
            REACT_APP_FIREBASE_MEASUREMENT_ID: 'G-EXAMPLE123'
        }));

        expect(runtime.mode).toBe('live');
        expect(runtime.emulator).toBeNull();
        expect(runtime.config.projectId).toBe('barbersbuddies-live');
        expect(runtime.config.measurementId).toBe('G-EXAMPLE123');
    });

    test('allows explicit emulator mode only for a complete demo-prefixed project', () => {
        const runtime = resolveFirebaseRuntimeConfig(completeEnvironment({
            NODE_ENV: 'development',
            REACT_APP_FIREBASE_PROJECT_ID: 'demo-explicit-project',
            REACT_APP_FIREBASE_USE_EMULATORS: 'true'
        }));

        expect(runtime.mode).toBe('emulator');
        expect(runtime.config.projectId).toBe('demo-explicit-project');
        expect(runtime.emulator).toBe(DEFAULT_FIREBASE_EMULATORS);

        expect(() => resolveFirebaseRuntimeConfig(completeEnvironment({
            REACT_APP_FIREBASE_USE_EMULATORS: 'true'
        }))).toThrow('requires a project ID beginning with "demo-"');
    });

    test('rejects hostile or ambiguous runtime values without echoing them', () => {
        const hostileProjectId = 'demo-safe\nINJECTED_VALUE';

        expect(() => resolveFirebaseRuntimeConfig(completeEnvironment({
            REACT_APP_FIREBASE_PROJECT_ID: hostileProjectId
        }))).toThrow('contains an invalid value');

        let receivedError;
        try {
            resolveFirebaseRuntimeConfig(completeEnvironment({
                REACT_APP_FIREBASE_PROJECT_ID: hostileProjectId
            }));
        } catch (error) {
            receivedError = error;
        }
        expect(receivedError).toBeInstanceOf(FirebaseRuntimeConfigError);
        expect(receivedError.message).not.toContain('INJECTED_VALUE');

        expect(() => resolveFirebaseRuntimeConfig(completeEnvironment({
            REACT_APP_FIREBASE_USE_EMULATORS: 'TRUE'
        }))).toThrow('must be exactly "true" or "false"');
    });

    test('never executes injected environment accessors', () => {
        const environment = completeEnvironment();
        const getter = jest.fn(() => {
            throw new Error('RAW_ACCESSOR_SECRET');
        });
        Object.defineProperty(environment, 'REACT_APP_FIREBASE_API_KEY', {
            enumerable: true,
            get: getter
        });

        let receivedError;
        try {
            resolveFirebaseRuntimeConfig(environment);
        } catch (error) {
            receivedError = error;
        }

        expect(getter).not.toHaveBeenCalled();
        expect(receivedError).toBeInstanceOf(FirebaseRuntimeConfigError);
        expect(receivedError.code).toBe('FIREBASE_RUNTIME_ENVIRONMENT_UNREADABLE');
        expect(receivedError.message).not.toContain('RAW_ACCESSOR_SECRET');
    });

    test('reads proxy-backed data descriptors without invoking their value getter trap', () => {
        const getTrap = jest.fn(() => {
            throw new Error('RAW_PROXY_GET_SECRET');
        });
        const environment = new Proxy(completeEnvironment(), {get: getTrap});

        const runtime = resolveFirebaseRuntimeConfig(environment);

        expect(getTrap).not.toHaveBeenCalled();
        expect(runtime.mode).toBe('live');
    });

    test('normalizes hostile proxy descriptor failures without leaking their errors', () => {
        const environment = new Proxy({}, {
            getOwnPropertyDescriptor() {
                throw new Error('RAW_PROXY_DESCRIPTOR_SECRET');
            }
        });

        let receivedError;
        try {
            resolveFirebaseRuntimeConfig(environment);
        } catch (error) {
            receivedError = error;
        }

        expect(receivedError).toBeInstanceOf(FirebaseRuntimeConfigError);
        expect(receivedError.code).toBe('FIREBASE_RUNTIME_ENVIRONMENT_UNREADABLE');
        expect(receivedError.message).not.toContain('RAW_PROXY_DESCRIPTOR_SECRET');
    });

    test('does not silently choose emulators outside development', () => {
        expect(() => resolveFirebaseRuntimeConfig({NODE_ENV: 'production'}))
            .toThrow('Firebase configuration is incomplete');
    });
});

describe('connectFirebaseEmulatorsOnce', () => {
    test('connects every Firebase browser service synchronously and only once per app', () => {
        const app = {};
        const services = {
            auth: {},
            db: {},
            functions: {},
            storage: {}
        };
        const connectors = {
            connectAuthEmulator: jest.fn(),
            connectFirestoreEmulator: jest.fn(),
            connectFunctionsEmulator: jest.fn(),
            connectStorageEmulator: jest.fn()
        };

        expect(connectFirebaseEmulatorsOnce(app, services, connectors)).toBe(true);
        expect(connectFirebaseEmulatorsOnce(app, services, connectors)).toBe(false);

        expect(connectors.connectAuthEmulator).toHaveBeenCalledWith(
            services.auth,
            'http://127.0.0.1:9099',
            {disableWarnings: true}
        );
        expect(connectors.connectFirestoreEmulator).toHaveBeenCalledWith(services.db, '127.0.0.1', 8080);
        expect(connectors.connectFunctionsEmulator).toHaveBeenCalledWith(services.functions, '127.0.0.1', 5001);
        expect(connectors.connectStorageEmulator).toHaveBeenCalledWith(services.storage, '127.0.0.1', 9199);

        for (const connector of Object.values(connectors)) {
            expect(connector).toHaveBeenCalledTimes(1);
        }
    });

    test('retains per-service progress and retries only a connector that failed', () => {
        const app = {};
        const services = {auth: {}, db: {}, functions: {}, storage: {}};
        const connectors = {
            connectAuthEmulator: jest.fn(),
            connectFirestoreEmulator: jest.fn(),
            connectFunctionsEmulator: jest.fn(),
            connectStorageEmulator: jest.fn()
                .mockImplementationOnce(() => {
                    throw new Error('RAW_CONNECTOR_SECRET');
                })
        };

        let receivedError;
        try {
            connectFirebaseEmulatorsOnce(app, services, connectors);
        } catch (error) {
            receivedError = error;
        }

        expect(receivedError).toBeInstanceOf(FirebaseRuntimeConfigError);
        expect(receivedError.code).toBe('FIREBASE_EMULATOR_CONNECTION_FAILED');
        expect(receivedError.message).toBe('Firebase Storage emulator connection failed.');
        expect(receivedError.message).not.toContain('RAW_CONNECTOR_SECRET');
        expect(connectors.connectAuthEmulator).toHaveBeenCalledTimes(1);
        expect(connectors.connectFirestoreEmulator).toHaveBeenCalledTimes(1);
        expect(connectors.connectFunctionsEmulator).toHaveBeenCalledTimes(1);
        expect(connectors.connectStorageEmulator).toHaveBeenCalledTimes(1);

        expect(connectFirebaseEmulatorsOnce(app, services, connectors)).toBe(true);
        expect(connectors.connectAuthEmulator).toHaveBeenCalledTimes(1);
        expect(connectors.connectFirestoreEmulator).toHaveBeenCalledTimes(1);
        expect(connectors.connectFunctionsEmulator).toHaveBeenCalledTimes(1);
        expect(connectors.connectStorageEmulator).toHaveBeenCalledTimes(2);

        expect(connectFirebaseEmulatorsOnce(app, services, connectors)).toBe(false);
        expect(connectors.connectStorageEmulator).toHaveBeenCalledTimes(2);
    });

    test('retains connector completion across a module reload seam', () => {
        const app = {};
        const services = {auth: {}, db: {}, functions: {}, storage: {}};
        const connectors = {
            connectAuthEmulator: jest.fn(),
            connectFirestoreEmulator: jest.fn(),
            connectFunctionsEmulator: jest.fn(),
            connectStorageEmulator: jest.fn()
        };

        expect(connectFirebaseEmulatorsOnce(app, services, connectors)).toBe(true);

        jest.resetModules();
        const reloadedRuntime = require('./firebase-runtime');

        expect(reloadedRuntime.connectFirebaseEmulatorsOnce(app, services, connectors)).toBe(false);
        for (const connector of Object.values(connectors)) {
            expect(connector).toHaveBeenCalledTimes(1);
        }
    });
});
