import {resolveFirebaseRuntimeConfig} from '../firebase-runtime';

const APP_ENVIRONMENTS = new Set(['development', 'test', 'production']);

export class AppRuntimeConfigError extends Error {
    constructor(message, code = 'APP_RUNTIME_CONFIG_INVALID') {
        super(message);
        this.name = 'AppRuntimeConfigError';
        this.code = code;
    }
}

const readEnvironmentValue = (environment, variableName) => {
    if ((typeof environment !== 'object' && typeof environment !== 'function') || environment === null) {
        throw new AppRuntimeConfigError(
            'Application runtime environment must be a plain environment object.',
            'APP_RUNTIME_ENVIRONMENT_UNREADABLE'
        );
    }

    let descriptor;
    try {
        descriptor = Object.getOwnPropertyDescriptor(environment, variableName);
    } catch {
        throw new AppRuntimeConfigError(
            'Application runtime environment could not be read safely.',
            'APP_RUNTIME_ENVIRONMENT_UNREADABLE'
        );
    }

    if (!descriptor) return undefined;
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throw new AppRuntimeConfigError(
            `Application runtime variable ${variableName} must be a plain environment value.`,
            'APP_RUNTIME_ENVIRONMENT_UNREADABLE'
        );
    }
    return descriptor.value;
};

const readApplicationEnvironment = (environment) => {
    const value = readEnvironmentValue(environment, 'NODE_ENV');
    if (typeof value !== 'string' || !APP_ENVIRONMENTS.has(value)) {
        throw new AppRuntimeConfigError(
            'NODE_ENV must be exactly "development", "test", or "production".',
            'APP_RUNTIME_ENVIRONMENT_INVALID'
        );
    }
    return value;
};

const readDemoAccessPreference = (environment) => {
    const value = readEnvironmentValue(environment, 'REACT_APP_DEMO_ACCESS');
    if (value === undefined || value === '') return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new AppRuntimeConfigError(
        'REACT_APP_DEMO_ACCESS must be exactly "true" or "false".',
        'APP_RUNTIME_DEMO_ACCESS_INVALID'
    );
};

const resolveDemoAccessCapability = ({environment, firebase, preference}) => {
    const projectId = firebase.config.projectId;
    const isSafeLocalRuntime = (
        environment === 'development' &&
        firebase.mode === 'emulator' &&
        typeof projectId === 'string' &&
        projectId.startsWith('demo-')
    );

    if (preference === true && !isSafeLocalRuntime) {
        throw new AppRuntimeConfigError(
            'Demo access can be enabled only in development with a demo-prefixed Firebase emulator project.',
            'APP_RUNTIME_DEMO_ACCESS_UNSAFE'
        );
    }

    const enabled = isSafeLocalRuntime && preference !== false;
    let reason = 'environment-not-eligible';
    if (enabled) reason = preference === true ? 'explicit-local-emulator' : 'local-emulator-default';
    if (isSafeLocalRuntime && preference === false) reason = 'explicitly-disabled';

    return Object.freeze({enabled, reason});
};

export const resolveAppRuntime = (environment = {}) => {
    const appEnvironment = readApplicationEnvironment(environment);
    const firebase = resolveFirebaseRuntimeConfig(environment);
    const demoAccessPreference = readDemoAccessPreference(environment);
    const demoAccess = resolveDemoAccessCapability({
        environment: appEnvironment,
        firebase,
        preference: demoAccessPreference
    });

    return Object.freeze({
        environment: appEnvironment,
        isDevelopment: appEnvironment === 'development',
        isTest: appEnvironment === 'test',
        isProduction: appEnvironment === 'production',
        firebase,
        features: Object.freeze({demoAccess})
    });
};

export const isDemoAccessEnabled = (runtime) => {
    try {
        return (
            runtime?.environment === 'development' &&
            runtime?.firebase?.mode === 'emulator' &&
            typeof runtime?.firebase?.config?.projectId === 'string' &&
            runtime.firebase.config.projectId.startsWith('demo-') &&
            runtime?.features?.demoAccess?.enabled === true
        );
    } catch {
        return false;
    }
};
