import {
  BookingV2RuntimeConfigError,
  resolveBookingV2Endpoints,
} from './bookingRuntime';

const emulatorRuntime = (environment = 'development') => ({
  environment,
  firebase: {
    mode: 'emulator',
    config: { projectId: 'demo-barbersbuddies' },
    emulator: { host: '127.0.0.1', functionsPort: 5001 },
  },
});

const productionRuntime = (projectId = 'barbersbuddies-production') => ({
  environment: 'production',
  firebase: {
    mode: 'live',
    config: { projectId },
    emulator: null,
  },
});

const productionEnvironment = {
  REACT_APP_BOOKING_V2_CREATE_ENDPOINT:
    'https://us-central1.example.cloudfunctions.net/createBookingV2',
  REACT_APP_BOOKING_V2_CANCEL_ENDPOINT:
    'https://us-central1.example.cloudfunctions.net/cancelBookingV2',
  REACT_APP_BOOKING_V2_RESCHEDULE_ENDPOINT:
    'https://us-central1.example.cloudfunctions.net/rescheduleBookingV2',
};

describe('booking v2 runtime endpoint resolution', () => {
  test.each(['development', 'test'])(
    'derives disposable emulator endpoints in %s',
    (environment) => {
      expect(resolveBookingV2Endpoints({
        runtime: emulatorRuntime(environment),
        environment: {},
      })).toEqual({
        create:
          'http://127.0.0.1:5001/demo-barbersbuddies/us-central1/createBookingV2',
        cancel:
          'http://127.0.0.1:5001/demo-barbersbuddies/us-central1/cancelBookingV2',
        reschedule:
          'http://127.0.0.1:5001/demo-barbersbuddies/us-central1/rescheduleBookingV2',
      });
    }
  );

  test('requires and returns exact HTTPS endpoints in production', () => {
    expect(resolveBookingV2Endpoints({
      runtime: productionRuntime(),
      environment: productionEnvironment,
    })).toEqual({
      create: productionEnvironment.REACT_APP_BOOKING_V2_CREATE_ENDPOINT,
      cancel: productionEnvironment.REACT_APP_BOOKING_V2_CANCEL_ENDPOINT,
      reschedule: productionEnvironment.REACT_APP_BOOKING_V2_RESCHEDULE_ENDPOINT,
    });
  });

  test.each([
    [
      'missing endpoint',
      { ...productionEnvironment, REACT_APP_BOOKING_V2_CREATE_ENDPOINT: undefined },
      'BOOKING_V2_PRODUCTION_ENDPOINT_REQUIRED',
    ],
    [
      'localhost endpoint',
      {
        ...productionEnvironment,
        REACT_APP_BOOKING_V2_CREATE_ENDPOINT:
          'https://localhost/createBookingV2',
      },
      'BOOKING_V2_PRODUCTION_ENDPOINT_INVALID',
    ],
    [
      'demo project endpoint',
      {
        ...productionEnvironment,
        REACT_APP_BOOKING_V2_CREATE_ENDPOINT:
          'https://us-central1.example.cloudfunctions.net/demo-project/us-central1/createBookingV2',
      },
      'BOOKING_V2_PRODUCTION_ENDPOINT_INVALID',
    ],
    [
      'wrong operation endpoint',
      {
        ...productionEnvironment,
        REACT_APP_BOOKING_V2_CREATE_ENDPOINT:
          'https://us-central1.example.cloudfunctions.net/cancelBookingV2',
      },
      'BOOKING_V2_PRODUCTION_ENDPOINT_INVALID',
    ],
  ])('refuses %s', (_label, environment, code) => {
    expect(() => resolveBookingV2Endpoints({
      runtime: productionRuntime(),
      environment,
    })).toThrow(expect.objectContaining({
      name: 'BookingV2RuntimeConfigError',
      code,
    }));
  });

  test.each([
    ['development against live Firebase', {
      ...emulatorRuntime(),
      firebase: { ...emulatorRuntime().firebase, mode: 'live' },
    }, 'BOOKING_V2_EMULATOR_RUNTIME_UNSAFE'],
    ['development against another demo project', {
      ...emulatorRuntime(),
      firebase: {
        ...emulatorRuntime().firebase,
        config: { projectId: 'demo-something-else' },
      },
    }, 'BOOKING_V2_EMULATOR_RUNTIME_UNSAFE'],
    ['production against a demo project', productionRuntime('demo-barbersbuddies'),
      'BOOKING_V2_PRODUCTION_RUNTIME_UNSAFE'],
  ])('fails closed for %s', (_label, runtime, code) => {
    expect(() => resolveBookingV2Endpoints({
      runtime,
      environment: productionEnvironment,
    })).toThrow(expect.objectContaining({ code }));
  });

  test('rejects accessor-backed endpoint variables before invoking them', () => {
    const environment = { ...productionEnvironment };
    const getter = jest.fn(() => productionEnvironment.REACT_APP_BOOKING_V2_CREATE_ENDPOINT);
    Object.defineProperty(environment, 'REACT_APP_BOOKING_V2_CREATE_ENDPOINT', {
      enumerable: true,
      get: getter,
    });

    expect(() => resolveBookingV2Endpoints({
      runtime: productionRuntime(),
      environment,
    })).toThrow(BookingV2RuntimeConfigError);
    expect(getter).not.toHaveBeenCalled();
  });
});
