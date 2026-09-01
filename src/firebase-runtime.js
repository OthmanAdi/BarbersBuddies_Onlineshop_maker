/* global globalThis */

const FIREBASE_CONFIG_FIELDS = Object.freeze({
    apiKey: 'REACT_APP_FIREBASE_API_KEY',
    authDomain: 'REACT_APP_FIREBASE_AUTH_DOMAIN',
    projectId: 'REACT_APP_FIREBASE_PROJECT_ID',
    storageBucket: 'REACT_APP_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'REACT_APP_FIREBASE_APP_ID',
    measurementId: 'REACT_APP_FIREBASE_MEASUREMENT_ID'
});

const REQUIRED_CONFIG_FIELDS = Object.freeze([
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
]);

const DEMO_FIREBASE_CONFIG = Object.freeze({
    apiKey: 'demo-barbersbuddies',
    authDomain: 'demo-barbersbuddies.firebaseapp.com',
    projectId: 'demo-barbersbuddies',
    storageBucket: 'demo-barbersbuddies.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:demo-barbersbuddies'
});

export const DEFAULT_FIREBASE_EMULATORS = Object.freeze({
    host: '127.0.0.1',
    authPort: 9099,
    firestorePort: 8080,
    functionsPort: 5001,
    storagePort: 9199
});

const EMULATOR_CONNECTION_REGISTRY = Symbol.for(
    'barbersbuddies.firebase.emulatorConnectionRegistry'
);

export class FirebaseRuntimeConfigError extends Error {
    constructor(message, code = 'FIREBASE_RUNTIME_CONFIG_INVALID') {
        super(message);
        this.name = 'FirebaseRuntimeConfigError';
        this.code = code;
    }
}

const readEnvironmentValue = (environment, variableName) => {
    if ((typeof environment !== 'object' && typeof environment !== 'function') || environment === null) {
        throw new FirebaseRuntimeConfigError(
            'Firebase runtime environment must be a plain environment object.',
            'FIREBASE_RUNTIME_ENVIRONMENT_UNREADABLE'
        );
    }

    let descriptor;
    try {
        descriptor = Object.getOwnPropertyDescriptor(environment, variableName);
    } catch {
        throw new FirebaseRuntimeConfigError(
            'Firebase runtime environment could not be read safely.',
            'FIREBASE_RUNTIME_ENVIRONMENT_UNREADABLE'
        );
    }

    if (!descriptor) return undefined;

    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throw new FirebaseRuntimeConfigError(
            `Firebase configuration variable ${variableName} must be a plain environment value.`,
            'FIREBASE_RUNTIME_ENVIRONMENT_UNREADABLE'
        );
    }

    return descriptor.value;
};

const readConfigValue = (environment, variableName) => {
    const rawValue = readEnvironmentValue(environment, variableName);
    if (rawValue === undefined || rawValue === null || rawValue === '') {
        return undefined;
    }

    if (typeof rawValue !== 'string') {
        throw new FirebaseRuntimeConfigError(
            `Firebase configuration variable ${variableName} must be a string.`
        );
    }

    const value = rawValue.trim();
    if (!value) {
        return undefined;
    }

    const hasControlCharacter = Array.from(value).some((character) => {
        const characterCode = character.charCodeAt(0);
        return characterCode < 32 || characterCode === 127;
    });

    if (value.length > 512 || hasControlCharacter) {
        throw new FirebaseRuntimeConfigError(
            `Firebase configuration variable ${variableName} contains an invalid value.`
        );
    }

    return value;
};

const readEmulatorPreference = (environment) => {
    const value = readConfigValue(environment, 'REACT_APP_FIREBASE_USE_EMULATORS');
    if (value === undefined) return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;

    throw new FirebaseRuntimeConfigError(
        'REACT_APP_FIREBASE_USE_EMULATORS must be exactly "true" or "false".'
    );
};

const validateProjectId = (projectId) => {
    if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(projectId)) {
        throw new FirebaseRuntimeConfigError(
            'REACT_APP_FIREBASE_PROJECT_ID is not a valid Firebase project ID.'
        );
    }
};

export const resolveFirebaseRuntimeConfig = (environment = {}) => {
    const suppliedConfig = {};
    const suppliedFields = [];

    for (const [configKey, variableName] of Object.entries(FIREBASE_CONFIG_FIELDS)) {
        const value = readConfigValue(environment, variableName);
        if (value !== undefined) {
            suppliedConfig[configKey] = value;
            suppliedFields.push(configKey);
        }
    }

    const emulatorPreference = readEmulatorPreference(environment);
    const isDevelopment = readConfigValue(environment, 'NODE_ENV') === 'development';

    if (suppliedFields.length === 0 && isDevelopment && emulatorPreference !== false) {
        return Object.freeze({
            config: DEMO_FIREBASE_CONFIG,
            mode: 'emulator',
            emulator: DEFAULT_FIREBASE_EMULATORS,
            source: 'development-default'
        });
    }

    const missingVariables = REQUIRED_CONFIG_FIELDS
        .filter((field) => suppliedConfig[field] === undefined)
        .map((field) => FIREBASE_CONFIG_FIELDS[field]);

    if (missingVariables.length > 0) {
        throw new FirebaseRuntimeConfigError(
            `Firebase configuration is incomplete. Set every required client variable; missing: ${missingVariables.join(', ')}. ` +
            'For local development, remove all REACT_APP_FIREBASE_* values to use the disposable demo emulators.',
            'FIREBASE_RUNTIME_CONFIG_INCOMPLETE'
        );
    }

    validateProjectId(suppliedConfig.projectId);

    if (emulatorPreference === true && !suppliedConfig.projectId.startsWith('demo-')) {
        throw new FirebaseRuntimeConfigError(
            'Firebase emulator mode requires a project ID beginning with "demo-".',
            'FIREBASE_EMULATOR_PROJECT_UNSAFE'
        );
    }

    return Object.freeze({
        config: Object.freeze({...suppliedConfig}),
        mode: emulatorPreference === true ? 'emulator' : 'live',
        emulator: emulatorPreference === true ? DEFAULT_FIREBASE_EMULATORS : null,
        source: 'environment'
    });
};

const getEmulatorConnectionRegistry = () => {
    const existing = globalThis[EMULATOR_CONNECTION_REGISTRY];
    if (existing instanceof WeakMap) return existing;

    const registry = new WeakMap();
    Object.defineProperty(globalThis, EMULATOR_CONNECTION_REGISTRY, {
        configurable: false,
        enumerable: false,
        value: registry,
        writable: false
    });
    return registry;
};

const runEmulatorConnector = (completedServices, serviceName, connect) => {
    if (completedServices.has(serviceName)) return false;

    try {
        connect();
    } catch {
        throw new FirebaseRuntimeConfigError(
            `Firebase ${serviceName} emulator connection failed.`,
            'FIREBASE_EMULATOR_CONNECTION_FAILED'
        );
    }

    completedServices.add(serviceName);
    return true;
};

export const connectFirebaseEmulatorsOnce = (app, services, connectors) => {
    if (!app || (typeof app !== 'object' && typeof app !== 'function')) {
        throw new FirebaseRuntimeConfigError('Firebase emulator connection requires an initialized app.');
    }

    const {host, authPort, firestorePort, functionsPort, storagePort} = DEFAULT_FIREBASE_EMULATORS;
    const registry = getEmulatorConnectionRegistry();
    let completedServices = registry.get(app);
    if (!completedServices) {
        completedServices = new Set();
        registry.set(app, completedServices);
    }

    let connectedAnyService = false;
    connectedAnyService = runEmulatorConnector(completedServices, 'Auth', () => {
        connectors.connectAuthEmulator(
            services.auth,
            `http://${host}:${authPort}`,
            {disableWarnings: true}
        );
    }) || connectedAnyService;
    connectedAnyService = runEmulatorConnector(completedServices, 'Firestore', () => {
        connectors.connectFirestoreEmulator(services.db, host, firestorePort);
    }) || connectedAnyService;
    connectedAnyService = runEmulatorConnector(completedServices, 'Functions', () => {
        connectors.connectFunctionsEmulator(services.functions, host, functionsPort);
    }) || connectedAnyService;
    connectedAnyService = runEmulatorConnector(completedServices, 'Storage', () => {
        connectors.connectStorageEmulator(services.storage, host, storagePort);
    }) || connectedAnyService;

    return connectedAnyService;
};
