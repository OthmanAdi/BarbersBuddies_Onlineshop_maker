import {
  ShopCreationSchemaError,
  normalizeWeeklyAvailability,
  priceToMinorUnits,
  serializeBookingV2ShopCreation,
} from './shopCreationSchema';

function validDraft(overrides = {}) {
  return {
    currency: 'EUR',
    timeZone: 'Europe/Berlin',
    bookingPolicy: {
      guestBookingEnabled: true,
      cancellationNoticeMinutes: 120,
      consentVersion: 'booking-v2-2026-09',
    },
    availability: {
      Monday: { open: '09:00', close: '18:00', slotDuration: 30 },
      Tuesday: null,
    },
    services: [
      {
        id: 'haircut',
        name: ' Haircut ',
        price: '19.90',
        duration: '030',
        description: 'Legacy display description',
        imageUrls: ['https://example.test/haircut.jpg'],
      },
    ],
    employees: [
      {
        id: 'employee-a',
        name: ' Employee A ',
        serviceIds: ['haircut'],
        weeklyAvailability: {
          Monday: [{ startLocalTime: '09:00', endLocalTime: '18:00' }],
        },
        expertise: ['Classic cuts'],
        photo: 'https://example.test/employee.jpg',
      },
    ],
    ...overrides,
  };
}

function captureSchemaError(callback) {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(ShopCreationSchemaError);
    return error;
  }
  throw new Error('Expected ShopCreationSchemaError');
}

describe('priceToMinorUnits', () => {
  test.each([
    ['0', 0],
    ['0.1', 10],
    ['0.01', 1],
    ['19.90', 1990],
    ['90071992547409.91', Number.MAX_SAFE_INTEGER],
  ])('converts %s exactly without binary floating-point rounding', (price, expected) => {
    expect(priceToMinorUnits(price)).toBe(expected);
  });

  test.each([
    1.25,
    -1,
    '',
    ' 1.00',
    '01.00',
    '-1.00',
    '+1.00',
    '1,00',
    '1.001',
    '1e3',
    '90071992547409.92',
  ])('rejects unsafe or non-canonical money input %#', (price) => {
    const error = captureSchemaError(() => priceToMinorUnits(price, 'services[2].price'));
    expect(error).toMatchObject({ code: 'INVALID_ARGUMENT', field: 'services[2].price' });
    expect(error.details).toMatchObject({ field: 'services[2].price' });
  });
});

describe('normalizeWeeklyAvailability', () => {
  test('canonicalizes English weekday keys and sorts explicit half-open intervals', () => {
    expect(normalizeWeeklyAvailability({
      Monday: [
        { startLocalTime: '13:00', endLocalTime: '17:00' },
        { open: '09:00', close: '12:00' },
      ],
      tuesday: null,
    })).toEqual({
      monday: [
        { startLocalTime: '09:00', endLocalTime: '12:00' },
        { startLocalTime: '13:00', endLocalTime: '17:00' },
      ],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    });
  });

  test.each([
    [{ Montag: { open: '09:00', close: '17:00' } }, 'weeklyAvailability.Montag'],
    [{ monday: null, Monday: null }, 'weeklyAvailability.Monday'],
    [{ Monday: [9, 10, 11] }, 'weeklyAvailability.Monday[0]'],
    [{ Monday: [{ startLocalTime: '09:00', endLocalTime: '09:00' }] }, 'weeklyAvailability.Monday[0]'],
    [{ Monday: [{ startLocalTime: '17:00', endLocalTime: '09:00' }] }, 'weeklyAvailability.Monday[0]'],
    [{ Monday: [{ startLocalTime: '9:00', endLocalTime: '10:00' }] }, 'weeklyAvailability.Monday[0].startLocalTime'],
    [{ Monday: [{ startLocalTime: '24:00', endLocalTime: '23:00' }] }, 'weeklyAvailability.Monday[0].startLocalTime'],
    [{ Monday: [
      { startLocalTime: '09:00', endLocalTime: '12:00' },
      { startLocalTime: '11:59', endLocalTime: '13:00' },
    ] }, 'weeklyAvailability.Monday[1]'],
  ])('rejects invalid availability at a stable field path', (availability, field) => {
    const error = captureSchemaError(() => normalizeWeeklyAvailability(availability));
    expect(error.field).toBe(field);
  });

  test('allows adjacent intervals because the representation is half-open', () => {
    expect(normalizeWeeklyAvailability({
      Monday: [
        { startLocalTime: '09:00', endLocalTime: '12:00' },
        { startLocalTime: '12:00', endLocalTime: '13:00' },
      ],
    }).monday).toHaveLength(2);
  });
});

describe('serializeBookingV2ShopCreation', () => {
  test('builds additive booking-v2 fields and keeps legacy display fields', () => {
    const result = serializeBookingV2ShopCreation(validDraft());

    expect(result).toMatchObject({
      schemaVersion: 2,
      timeZone: 'Europe/Berlin',
      currency: 'EUR',
      bookingPolicy: {
        guestBookingEnabled: true,
        cancellationNoticeMinutes: 120,
        consentVersion: 'booking-v2-2026-09',
      },
      availability: {
        Monday: { open: '09:00', close: '18:00', slotDuration: 30 },
        Tuesday: null,
      },
      services: [{
        id: 'haircut',
        name: 'Haircut',
        active: true,
        price: '19.90',
        priceMinor: 1990,
        currency: 'EUR',
        duration: '30',
        durationMinutes: 30,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        description: 'Legacy display description',
        imageUrls: ['https://example.test/haircut.jpg'],
      }],
      employees: [{
        id: 'employee-a',
        name: 'Employee A',
        active: true,
        bookable: true,
        serviceIds: ['haircut'],
        expertise: ['Classic cuts'],
        photo: 'https://example.test/employee.jpg',
      }],
    });
    expect(result.weeklyAvailability.monday).toEqual([
      { startLocalTime: '09:00', endLocalTime: '18:00' },
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.services[0])).toBe(true);
  });

  test('uses an injected factory exactly once for each missing service identifier', () => {
    const idFactory = jest
      .fn()
      .mockReturnValueOnce('generated-one')
      .mockReturnValueOnce('generated-two');
    const result = serializeBookingV2ShopCreation(validDraft({
      services: [
        { name: 'One', price: '10', durationMinutes: 15 },
        { id: null, name: 'Two', price: '20.25', durationMinutes: 30 },
        { id: 'existing', name: 'Three', price: '1', durationMinutes: 5 },
      ],
      employees: [],
    }), { idFactory });

    expect(idFactory).toHaveBeenCalledTimes(2);
    expect(idFactory.mock.calls.map(([context]) => context.index)).toEqual([0, 1]);
    expect(result.services.map(({ id }) => id)).toEqual([
      'generated-one',
      'generated-two',
      'existing',
    ]);
  });

  test('does not call the ID factory for an invalid existing identifier', () => {
    const idFactory = jest.fn(() => 'replacement');
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
      services: [{ id: ' bad ', name: 'Bad', price: '10', durationMinutes: 30 }],
      employees: [],
    }), { idFactory }));
    expect(error.field).toBe('services[0].id');
    expect(idFactory).not.toHaveBeenCalled();
  });

  test('treats an explicit empty service ID as invalid instead of missing', () => {
    const idFactory = jest.fn(() => 'replacement');
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
      services: [{ id: '', name: 'Bad', price: '10', durationMinutes: 30 }],
      employees: [],
    }), { idFactory }));
    expect(error.field).toBe('services[0].id');
    expect(idFactory).not.toHaveBeenCalled();
  });

  test.each([
    [undefined, 'services[0].id'],
    [() => ' bad ', 'services[0].id'],
    [() => { throw new Error('factory detail'); }, 'services[0].id'],
  ])('fails safely when a missing service ID cannot be generated', (idFactory, field) => {
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
      services: [{ name: 'Needs ID', price: '10', durationMinutes: 30 }],
      employees: [],
    }), idFactory ? { idFactory } : undefined));
    expect(error).toMatchObject({ code: 'INVALID_ARGUMENT', field });
    expect(error.message).not.toContain('factory detail');
  });

  test('detects duplicate generated and existing service identifiers', () => {
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
      services: [
        { name: 'One', price: '10', durationMinutes: 15 },
        { id: 'same', name: 'Two', price: '10', durationMinutes: 15 },
      ],
      employees: [],
    }), { idFactory: () => 'same' }));
    expect(error).toMatchObject({
      code: 'INVALID_ARGUMENT',
      field: 'services[1].id',
      details: { duplicateId: 'same' },
    });
  });

  test.each([
    [{ durationMinutes: 0 }, 'INVALID_DURATION', 'services[0].durationMinutes'],
    [{ durationMinutes: 721 }, 'INVALID_DURATION', 'services[0].durationMinutes'],
    [{ durationMinutes: 30.5 }, 'INVALID_DURATION', 'services[0].durationMinutes'],
    [{ durationMinutes: 30, bufferBeforeMinutes: -1 }, 'INVALID_DURATION', 'services[0].bufferBeforeMinutes'],
    [{ durationMinutes: 30, bufferAfterMinutes: 241 }, 'INVALID_DURATION', 'services[0].bufferAfterMinutes'],
    [{ durationMinutes: 30, duration: '45' }, 'INVALID_DURATION', 'services[0].duration'],
    [{ durationMinutes: 30, duration: {} }, 'INVALID_DURATION', 'services[0].duration'],
  ])('rejects unsafe duration data', (serviceFields, code, field) => {
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
      services: [{ id: 'haircut', name: 'Haircut', price: '10', ...serviceFields }],
      employees: [],
    })));
    expect(error).toMatchObject({ code, field });
  });

  test.each([
    [{ priceMinor: 999 }, 'services[0].priceMinor'],
    [{ currency: 'USD' }, 'services[0].currency'],
  ])('rejects contradictory canonical and display service fields', (serviceFields, field) => {
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
      services: [{
        id: 'haircut',
        name: 'Haircut',
        price: '10.00',
        durationMinutes: 30,
        ...serviceFields,
      }],
      employees: [],
    })));
    expect(error.field).toBe(field);
  });

  test.each([
    [undefined],
    [''],
    [' Europe/Berlin '],
    ['+02:00'],
    ['Mars/Olympus_Mons'],
  ])('requires a caller-supplied valid IANA timezone %#', (timeZone) => {
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
      timeZone,
      employees: [],
    })));
    expect(error).toMatchObject({ code: 'SHOP_TIMEZONE_REQUIRED', field: 'timeZone' });
  });

  test.each([
    [{ cancellationNoticeMinutes: 0, consentVersion: 'v1' }, 'bookingPolicy.guestBookingEnabled'],
    [{ guestBookingEnabled: true, consentVersion: 'v1' }, 'bookingPolicy.cancellationNoticeMinutes'],
    [{ guestBookingEnabled: true, cancellationNoticeMinutes: -1, consentVersion: 'v1' }, 'bookingPolicy.cancellationNoticeMinutes'],
    [{ guestBookingEnabled: true, cancellationNoticeMinutes: 0, consentVersion: ' ' }, 'bookingPolicy.consentVersion'],
  ])('requires every explicit booking policy decision', (bookingPolicy, field) => {
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
      bookingPolicy,
      employees: [],
    })));
    expect(error.field).toBe(field);
  });

  test.each([
    ['eur'],
    ['EU'],
    ['EURO'],
    [undefined],
  ])('requires an explicit canonical currency %#', (currency) => {
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
      currency,
      employees: [],
    })));
    expect(error.field).toBe('currency');
  });

  test('treats explicitly supplied null weekly availability as invalid', () => {
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
      weeklyAvailability: null,
      employees: [],
    })));
    expect(error.field).toBe('weeklyAvailability');
  });

  test('requires canonical unique employees with explicit valid service assignments', () => {
    const cases = [
      [{ id: ' employee-a ', name: 'A', serviceIds: ['haircut'], weeklyAvailability: {} }, 'employees[0].id'],
      [{ id: 'employee-a', name: 'A', serviceIds: [], weeklyAvailability: {} }, 'employees[0].serviceIds'],
      [{ id: 'employee-a', name: 'A', serviceIds: ['unknown'], weeklyAvailability: {} }, 'employees[0].serviceIds[0]'],
      [{ id: 'employee-a', name: 'A', serviceIds: ['haircut', 'haircut'], weeklyAvailability: {} }, 'employees[0].serviceIds[1]'],
      [{ id: 'employee-a', name: 'A', serviceIds: ['haircut'] }, 'employees[0].weeklyAvailability'],
    ];

    for (const [employee, field] of cases) {
      const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
        employees: [employee],
      })));
      expect(error).toMatchObject({ code: 'SHOP_RESOURCE_CONFIG_REQUIRED', field });
    }
  });

  test('detects duplicate employee identifiers', () => {
    const employee = {
      id: 'employee-a',
      name: 'A',
      serviceIds: ['haircut'],
      weeklyAvailability: {},
    };
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
      employees: [employee, { ...employee, name: 'B' }],
    })));
    expect(error).toMatchObject({
      code: 'SHOP_RESOURCE_CONFIG_REQUIRED',
      field: 'employees[1].id',
    });
  });

  test('rejects current inclusive integer-hour employee schedules instead of guessing', () => {
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
      employees: [{
        id: 'employee-a',
        name: 'A',
        serviceIds: ['haircut'],
        schedule: { Monday: [9, 10, 11, 12] },
      }],
    })));
    expect(error).toMatchObject({
      code: 'OUTSIDE_AVAILABILITY',
      field: 'employees[0].schedule.Monday[0]',
    });
  });

  test('rejects localized employee weekday keys instead of translating them', () => {
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
      employees: [{
        id: 'employee-a',
        name: 'A',
        serviceIds: ['haircut'],
        schedule: { Montag: [{ open: '09:00', close: '17:00' }] },
      }],
    })));
    expect(error).toMatchObject({
      code: 'OUTSIDE_AVAILABILITY',
      field: 'employees[0].schedule.Montag',
    });
  });

  test('validates a legacy employee schedule even when authoritative hours are supplied', () => {
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
      employees: [{
        id: 'employee-a',
        name: 'A',
        serviceIds: ['haircut'],
        weeklyAvailability: { Monday: [{ open: '09:00', close: '17:00' }] },
        schedule: { Monday: [9, 10, 11] },
      }],
    })));
    expect(error.field).toBe('employees[0].schedule.Monday[0]');
  });

  test('rejects conflicting explicit employee schedule representations', () => {
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
      employees: [{
        id: 'employee-a',
        name: 'A',
        serviceIds: ['haircut'],
        weeklyAvailability: { Monday: [{ open: '09:00', close: '17:00' }] },
        schedule: { Monday: [{ open: '10:00', close: '17:00' }] },
      }],
    })));
    expect(error).toMatchObject({
      code: 'SHOP_RESOURCE_CONFIG_REQUIRED',
      field: 'employees[0].schedule',
    });
  });

  test('rejects conflicting shop availability representations', () => {
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(validDraft({
      weeklyAvailability: {
        Monday: [{ startLocalTime: '10:00', endLocalTime: '18:00' }],
      },
      employees: [],
    })));
    expect(error).toMatchObject({
      code: 'OUTSIDE_AVAILABILITY',
      field: 'availability',
    });
  });

  test('does not mutate source drafts', () => {
    const draft = validDraft({ employees: [] });
    const before = JSON.stringify(draft);
    serializeBookingV2ShopCreation(draft);
    expect(JSON.stringify(draft)).toBe(before);
  });

  test('deep-copies retained legacy and nested display data', () => {
    const draft = validDraft();
    const result = serializeBookingV2ShopCreation(draft);

    draft.availability.Monday.open = '12:00';
    draft.availability.Monday.slotDuration = 5;
    draft.services[0].imageUrls[0] = 'https://example.test/changed.jpg';
    draft.employees[0].expertise[0] = 'Changed';
    draft.employees[0].serviceIds[0] = 'changed';

    expect(result.availability.Monday.open).toBe('09:00');
    expect(result.availability.Monday.slotDuration).toBe(30);
    expect(result.services[0].imageUrls[0]).toBe('https://example.test/haircut.jpg');
    expect(result.employees[0].expertise[0]).toBe('Classic cuts');
    expect(result.employees[0].serviceIds[0]).toBe('haircut');
    expect(Object.isFrozen(result.availability.Monday)).toBe(true);
    expect(Object.isFrozen(result.services[0].imageUrls)).toBe(true);
  });

  test.each([
    ['services', (draft) => { draft.services = new Array(1); }],
    ['employees', (draft) => { draft.employees = new Array(1); }],
    ['weeklyAvailability.Monday', (draft) => {
      draft.weeklyAvailability = { Monday: new Array(1) };
      delete draft.availability;
    }],
    ['services[0].imageUrls', (draft) => { draft.services[0].imageUrls = new Array(1); }],
    ['employees[0].serviceIds', (draft) => { draft.employees[0].serviceIds = new Array(1); }],
    ['employees[0].expertise', (draft) => { draft.employees[0].expertise = new Array(1); }],
  ])('rejects sparse array input at %s', (field, makeSparse) => {
    const draft = validDraft();
    makeSparse(draft);
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(draft));
    expect(error.field).toBe(field);
  });

  test('rejects extra array properties', () => {
    const draft = validDraft();
    draft.services.extra = 'hostile';
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(draft));
    expect(error.field).toBe('services');
  });

  test.each([
    ['shop', (draft) => { draft.unexpected = true; }],
    ['bookingPolicy', (draft) => { draft.bookingPolicy.unexpected = true; }],
    ['services[0]', (draft) => { draft.services[0].unexpected = true; }],
    ['employees[0]', (draft) => { draft.employees[0].unexpected = true; }],
    ['availability.Monday', (draft) => { draft.availability.Monday.unexpected = true; }],
  ])('rejects undeclared object fields at %s', (field, addExtra) => {
    const draft = validDraft();
    addExtra(draft);
    const error = captureSchemaError(() => serializeBookingV2ShopCreation(draft));
    expect(error.field).toBe(field);
  });

  test('rejects symbols and non-enumerable fields', () => {
    const symbolDraft = validDraft();
    symbolDraft.services[0][Symbol('hostile')] = true;
    expect(captureSchemaError(
      () => serializeBookingV2ShopCreation(symbolDraft),
    ).field).toBe('services[0]');

    const hiddenDraft = validDraft();
    Object.defineProperty(hiddenDraft.bookingPolicy, 'hidden', { value: true });
    expect(captureSchemaError(
      () => serializeBookingV2ShopCreation(hiddenDraft),
    ).field).toBe('bookingPolicy');
  });

  test.each([
    ['shop', (draft, getter) => Object.defineProperty(draft, 'currency', { enumerable: true, get: getter })],
    ['bookingPolicy', (draft, getter) => Object.defineProperty(
      draft.bookingPolicy,
      'consentVersion',
      { enumerable: true, get: getter },
    )],
    ['services[0]', (draft, getter) => Object.defineProperty(
      draft.services[0],
      'name',
      { enumerable: true, get: getter },
    )],
    ['services', (draft, getter) => Object.defineProperty(
      draft.services,
      0,
      { configurable: true, enumerable: true, get: getter },
    )],
    ['availability.Monday', (draft, getter) => Object.defineProperty(
      draft.availability.Monday,
      'open',
      { enumerable: true, get: getter },
    )],
  ])('rejects accessors at %s without executing them', (field, installAccessor) => {
    const draft = validDraft();
    const getter = jest.fn(() => {
      throw new Error('must not execute');
    });
    installAccessor(draft, getter);

    const error = captureSchemaError(() => serializeBookingV2ShopCreation(draft));
    expect(error).toMatchObject({ code: 'INVALID_ARGUMENT', field });
    expect(error.message).not.toContain('must not execute');
    expect(getter).not.toHaveBeenCalled();
  });

  test('rejects accessor options without executing them', () => {
    const getter = jest.fn(() => {
      throw new Error('must not execute');
    });
    const options = {};
    Object.defineProperty(options, 'idFactory', { enumerable: true, get: getter });

    const error = captureSchemaError(() => serializeBookingV2ShopCreation(
      validDraft(),
      options,
    ));
    expect(error).toMatchObject({ code: 'INVALID_ARGUMENT', field: 'options' });
    expect(getter).not.toHaveBeenCalled();
  });
});
