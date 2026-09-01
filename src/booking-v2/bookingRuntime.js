const OPERATIONS = Object.freeze({
  create: 'createBookingV2',
  cancel: 'cancelBookingV2',
  reschedule: 'rescheduleBookingV2',
});

const PRODUCTION_ENDPOINT_VARIABLES = Object.freeze({
  create: 'REACT_APP_BOOKING_V2_CREATE_ENDPOINT',
  cancel: 'REACT_APP_BOOKING_V2_CANCEL_ENDPOINT',
  reschedule: 'REACT_APP_BOOKING_V2_RESCHEDULE_ENDPOINT',
});

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export class BookingV2RuntimeConfigError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BookingV2RuntimeConfigError';
    this.code = code;
  }
}

function configError(code, message) {
  throw new BookingV2RuntimeConfigError(code, message);
}

function readOwnDataProperty(value, property, label) {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  ) {
    configError('BOOKING_V2_RUNTIME_INVALID', `${label} is unavailable.`);
  }

  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, property);
  } catch (_error) {
    configError('BOOKING_V2_RUNTIME_UNREADABLE', `${label} cannot be read safely.`);
  }
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    configError('BOOKING_V2_RUNTIME_UNREADABLE', `${label} must be a plain runtime value.`);
  }
  return descriptor.value;
}

function readOptionalEnvironmentValue(environment, variableName) {
  if (
    environment === null ||
    (typeof environment !== 'object' && typeof environment !== 'function')
  ) {
    configError(
      'BOOKING_V2_ENVIRONMENT_INVALID',
      'Booking v2 endpoint configuration is unavailable.'
    );
  }

  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(environment, variableName);
  } catch (_error) {
    configError(
      'BOOKING_V2_ENVIRONMENT_UNREADABLE',
      `Booking v2 variable ${variableName} cannot be read safely.`
    );
  }
  if (!descriptor) return undefined;
  if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    configError(
      'BOOKING_V2_ENVIRONMENT_UNREADABLE',
      `Booking v2 variable ${variableName} must be a plain environment value.`
    );
  }
  return descriptor.value;
}

function productionEndpoint(operation, environment) {
  const variableName = PRODUCTION_ENDPOINT_VARIABLES[operation];
  const value = readOptionalEnvironmentValue(environment, variableName);
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    configError(
      'BOOKING_V2_PRODUCTION_ENDPOINT_REQUIRED',
      `${variableName} must be an explicit HTTPS booking v2 endpoint.`
    );
  }

  let endpoint;
  try {
    endpoint = new URL(value);
  } catch (_error) {
    configError(
      'BOOKING_V2_PRODUCTION_ENDPOINT_INVALID',
      `${variableName} is not a valid production endpoint.`
    );
  }

  const expectedPath = `/${OPERATIONS[operation]}`;
  const targetsDemoRuntime =
    endpoint.hostname.toLowerCase().includes('demo') ||
    endpoint.pathname.toLowerCase().includes('/demo-');
  if (
    endpoint.protocol !== 'https:' ||
    LOCAL_HOSTS.has(endpoint.hostname) ||
    targetsDemoRuntime ||
    endpoint.username !== '' ||
    endpoint.password !== '' ||
    endpoint.search !== '' ||
    endpoint.hash !== '' ||
    !endpoint.pathname.endsWith(expectedPath) ||
    endpoint.pathname.endsWith(`${expectedPath}/`)
  ) {
    configError(
      'BOOKING_V2_PRODUCTION_ENDPOINT_INVALID',
      `${variableName} is not a safe production endpoint.`
    );
  }
  return endpoint.toString();
}

function emulatorEndpoints(runtime) {
  const firebase = readOwnDataProperty(runtime, 'firebase', 'Firebase runtime');
  const mode = readOwnDataProperty(firebase, 'mode', 'Firebase runtime mode');
  const config = readOwnDataProperty(firebase, 'config', 'Firebase runtime config');
  const projectId = readOwnDataProperty(config, 'projectId', 'Firebase project ID');
  const emulator = readOwnDataProperty(firebase, 'emulator', 'Firebase emulator config');
  const host = readOwnDataProperty(emulator, 'host', 'Firebase emulator host');
  const functionsPort = readOwnDataProperty(
    emulator,
    'functionsPort',
    'Firebase Functions emulator port'
  );

  if (
    mode !== 'emulator' ||
    projectId !== 'demo-barbersbuddies' ||
    host !== '127.0.0.1' ||
    functionsPort !== 5001
  ) {
    configError(
      'BOOKING_V2_EMULATOR_RUNTIME_UNSAFE',
      'Local booking v2 requires the disposable demo-barbersbuddies emulator runtime.'
    );
  }

  const base = `http://127.0.0.1:5001/${projectId}/us-central1`;
  return Object.freeze(Object.fromEntries(
    Object.entries(OPERATIONS).map(([operation, endpointName]) => [
      operation,
      `${base}/${endpointName}`,
    ])
  ));
}

export function resolveBookingV2Endpoints({ runtime, environment = {} } = {}) {
  const appEnvironment = readOwnDataProperty(
    runtime,
    'environment',
    'Application environment'
  );

  if (appEnvironment === 'development' || appEnvironment === 'test') {
    return emulatorEndpoints(runtime);
  }

  if (appEnvironment !== 'production') {
    configError(
      'BOOKING_V2_RUNTIME_INVALID',
      'Booking v2 requires an explicit development, test, or production runtime.'
    );
  }

  const firebase = readOwnDataProperty(runtime, 'firebase', 'Firebase runtime');
  const mode = readOwnDataProperty(firebase, 'mode', 'Firebase runtime mode');
  const config = readOwnDataProperty(firebase, 'config', 'Firebase runtime config');
  const projectId = readOwnDataProperty(config, 'projectId', 'Firebase project ID');
  if (
    mode !== 'live' ||
    typeof projectId !== 'string' ||
    projectId.startsWith('demo-')
  ) {
    configError(
      'BOOKING_V2_PRODUCTION_RUNTIME_UNSAFE',
      'Production booking v2 requires a non-demo live Firebase runtime.'
    );
  }

  return Object.freeze(Object.fromEntries(
    Object.keys(OPERATIONS).map((operation) => [
      operation,
      productionEndpoint(operation, environment),
    ])
  ));
}

export { PRODUCTION_ENDPOINT_VARIABLES };
