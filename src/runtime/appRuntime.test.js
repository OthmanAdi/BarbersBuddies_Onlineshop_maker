import {
    AppRuntimeConfigError,
    isDemoAccessEnabled,
    resolveAppRuntime
} from './appRuntime';

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

describe('application runtime', () => {
    test('enables demo access by default only for blank local development', () => {
        const runtime = resolveAppRuntime({NODE_ENV: 'development'});

        expect(runtime.environment).toBe('development');
        expect(runtime.isDevelopment).toBe(true);
        expect(runtime.isProduction).toBe(false);
        expect(runtime.firebase.mode).toBe('emulator');
        expect(runtime.firebase.config.projectId).toBe('demo-barbersbuddies');
        expect(runtime.features.demoAccess).toEqual({
            enabled: true,
            reason: 'local-emulator-default'
        });
        expect(isDemoAccessEnabled(runtime)).toBe(true);
        expect(Object.isFrozen(runtime)).toBe(true);
        expect(Object.isFrozen(runtime.features)).toBe(true);
        expect(Object.isFrozen(runtime.features.demoAccess)).toBe(true);
    });

    test('allows local demo access to be disabled explicitly', () => {
        const runtime = resolveAppRuntime({
            NODE_ENV: 'development',
            REACT_APP_DEMO_ACCESS: 'false'
        });

        expect(runtime.features.demoAccess).toEqual({
            enabled: false,
            reason: 'explicitly-disabled'
        });
        expect(isDemoAccessEnabled(runtime)).toBe(false);
    });

    test('keeps production live and demo-disabled from the first decision', () => {
        const runtime = resolveAppRuntime(completeEnvironment());

        expect(runtime).toMatchObject({
            environment: 'production',
            isDevelopment: false,
            isProduction: true,
            firebase: {mode: 'live'},
            features: {
                demoAccess: {
                    enabled: false,
                    reason: 'environment-not-eligible'
                }
            }
        });
        expect(isDemoAccessEnabled(runtime)).toBe(false);
    });

    test.each([
        completeEnvironment({REACT_APP_DEMO_ACCESS: 'true'}),
        completeEnvironment({
            NODE_ENV: 'development',
            REACT_APP_DEMO_ACCESS: 'true'
        }),
        completeEnvironment({
            NODE_ENV: 'production',
            REACT_APP_FIREBASE_PROJECT_ID: 'demo-production',
            REACT_APP_FIREBASE_USE_EMULATORS: 'true',
            REACT_APP_DEMO_ACCESS: 'true'
        })
    ])('rejects forced demo access outside the exact local emulator boundary', (environment) => {
        expect(() => resolveAppRuntime(environment)).toThrow(AppRuntimeConfigError);
        expect(() => resolveAppRuntime(environment)).toThrow(
            'only in development with a demo-prefixed Firebase emulator project'
        );
    });

    test('accepts explicit demo access for a complete development emulator config', () => {
        const runtime = resolveAppRuntime(completeEnvironment({
            NODE_ENV: 'development',
            REACT_APP_FIREBASE_PROJECT_ID: 'demo-explicit-project',
            REACT_APP_FIREBASE_USE_EMULATORS: 'true',
            REACT_APP_DEMO_ACCESS: 'true'
        }));

        expect(runtime.features.demoAccess).toEqual({
            enabled: true,
            reason: 'explicit-local-emulator'
        });
        expect(isDemoAccessEnabled(runtime)).toBe(true);
    });

    test.each([undefined, 'dev', 'Development', '', null])(
        'rejects ambiguous NODE_ENV value %#',
        (NODE_ENV) => {
            expect(() => resolveAppRuntime({NODE_ENV})).toThrow(
                'NODE_ENV must be exactly'
            );
        }
    );

    test.each(['TRUE', '1', true, ' false '])(
        'rejects ambiguous demo preference %#',
        (preference) => {
            expect(() => resolveAppRuntime({
                NODE_ENV: 'development',
                REACT_APP_DEMO_ACCESS: preference
            })).toThrow('must be exactly "true" or "false"');
        }
    );

    test('does not execute environment accessors or proxy getters', () => {
        const accessorEnvironment = {NODE_ENV: 'development'};
        const getter = jest.fn(() => 'true');
        Object.defineProperty(accessorEnvironment, 'REACT_APP_DEMO_ACCESS', {
            enumerable: true,
            get: getter
        });

        expect(() => resolveAppRuntime(accessorEnvironment)).toThrow(
            'must be a plain environment value'
        );
        expect(getter).not.toHaveBeenCalled();

        const getTrap = jest.fn(() => {
            throw new Error('raw runtime secret');
        });
        const proxyEnvironment = new Proxy({NODE_ENV: 'development'}, {get: getTrap});
        expect(resolveAppRuntime(proxyEnvironment).features.demoAccess.enabled).toBe(true);
        expect(getTrap).not.toHaveBeenCalled();
    });

    test('treats malformed or hostile runtime objects as demo-disabled', () => {
        expect(isDemoAccessEnabled(null)).toBe(false);
        expect(isDemoAccessEnabled({})).toBe(false);
        expect(isDemoAccessEnabled(new Proxy({}, {
            get() {
                throw new Error('raw runtime secret');
            }
        }))).toBe(false);
    });
});
