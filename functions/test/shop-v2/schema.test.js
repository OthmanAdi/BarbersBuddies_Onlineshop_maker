'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ShopV2SchemaError,
  WEEKDAYS,
  buildShopV2CreateProjection,
} = require('../../src/shop-v2/schema');

function emptyWeek(intervals = []) {
  return Object.fromEntries(WEEKDAYS.map((day) => [
    day,
    day === 'monday' ? intervals.map((interval) => ({ ...interval })) : [],
  ]));
}

function validDraft() {
  return {
    schemaVersion: 2,
    name: '  Barber  Buddies Mitte  ',
    slug: 'barber-buddies-mitte',
    presentation: {
      headline: '  Cuts with care  ',
      description: 'A calm neighborhood barbershop.',
      logoAssetId: 'asset-logo',
      heroAssetId: 'asset-hero',
      galleryAssetIds: ['asset-gallery'],
    },
    contact: {
      publicEmail: ' HELLO@EXAMPLE.COM ',
      publicPhone: '+493012345678',
      websiteUrl: 'https://example.com',
      street: ' Musterstrasse 1 ',
      postalCode: '10115',
      city: ' Berlin ',
      countryCode: 'DE',
    },
    timeZone: 'Europe/Berlin',
    currency: 'EUR',
    minorUnitDigits: 2,
    bookingPolicy: {
      guestBookingEnabled: true,
      cancellationNoticeMinutes: 1440,
      leadTimeMinutes: 60,
      bookingWindowDays: 90,
    },
    consent: {
      version: 'terms-2026-09',
      termsAccepted: true,
      privacyAccepted: true,
    },
    weeklyAvailability: emptyWeek([
      { startLocalTime: '09:00', endLocalTime: '12:00' },
      { startLocalTime: '13:00', endLocalTime: '18:00' },
    ]),
    services: [
      {
        id: 'haircut',
        name: ' Haircut ',
        description: '',
        active: true,
        priceMinor: 3500,
        durationMinutes: 30,
        bufferBeforeMinutes: 5,
        bufferAfterMinutes: 10,
      },
      {
        id: 'beard',
        name: 'Beard trim',
        description: 'Shape and finish',
        active: true,
        priceMinor: 1900,
        durationMinutes: 20,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 5,
      },
    ],
    employees: [
      {
        id: 'resource-b',
        active: true,
        serviceIds: ['haircut'],
        weeklyAvailability: emptyWeek([
          { startLocalTime: '09:00', endLocalTime: '12:00' },
        ]),
      },
      {
        id: 'resource-a',
        active: true,
        serviceIds: ['haircut', 'beard'],
        weeklyAvailability: emptyWeek([
          { startLocalTime: '13:00', endLocalTime: '18:00' },
        ]),
      },
    ],
    stagedAssets: [
      {
        id: 'asset-gallery',
        kind: 'gallery',
        storagePath: 'shop-staging/request-1/gallery.webp',
        contentType: 'image/webp',
        sizeBytes: 3000,
        sha256: '3'.repeat(64),
      },
      {
        id: 'asset-logo',
        kind: 'logo',
        storagePath: 'shop-staging/request-1/logo.png',
        contentType: 'image/png',
        sizeBytes: 1000,
        sha256: '1'.repeat(64),
      },
      {
        id: 'asset-hero',
        kind: 'hero',
        storagePath: 'shop-staging/request-1/hero.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 2000,
        sha256: '2'.repeat(64),
      },
    ],
  };
}

function expectSchemaError(field) {
  return (error) => {
    assert.ok(error instanceof ShopV2SchemaError);
    if (field) assert.equal(error.field, field);
    return true;
  };
}

function assertDeepFrozen(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
}

test('builds deterministic, normalized, deeply frozen public and private projections', () => {
  const left = buildShopV2CreateProjection(validDraft());
  const reordered = validDraft();
  reordered.services.reverse();
  reordered.employees.reverse();
  reordered.stagedAssets.reverse();
  const right = buildShopV2CreateProjection(reordered);

  assert.deepEqual(left, right);
  assert.deepEqual(Object.keys(left), ['publicShop', 'privateShop']);
  assert.equal(left.publicShop.name, 'Barber Buddies Mitte');
  assert.equal(left.publicShop.contact.publicEmail, 'hello@example.com');
  assert.equal(left.publicShop.contact.websiteUrl, 'https://example.com/');
  assert.deepEqual(left.publicShop.services.map(({ id }) => id), ['beard', 'haircut']);
  assert.deepEqual(left.publicShop.employees.map(({ id }) => id), ['resource-a', 'resource-b']);
  assert.deepEqual(left.privateShop.stagedAssets.map(({ id }) => id), [
    'asset-gallery', 'asset-hero', 'asset-logo',
  ]);
  assert.match(left.privateShop.reservationKeys.nameKey, /^[a-f0-9]{64}$/);
  assert.match(left.privateShop.reservationKeys.slugKey, /^[a-f0-9]{64}$/);
  assert.equal(left.privateShop.reservationKeys.normalizedName, 'barber buddies mitte');
  assert.doesNotThrow(() => JSON.parse(left.privateShop.requestMaterial));
  assertDeepFrozen(left);
});

test('keeps staging paths and consent private while public employees expose no PII', () => {
  const result = buildShopV2CreateProjection(validDraft());
  const publicJson = JSON.stringify(result.publicShop);
  const privateJson = JSON.stringify(result.privateShop);

  assert.doesNotMatch(publicJson, /shop-staging|sha256|termsAccepted|privacyAccepted/);
  assert.match(privateJson, /shop-staging/);
  assert.deepEqual(Object.keys(result.publicShop.employees[0]), [
    'id', 'active', 'serviceIds', 'weeklyAvailability',
  ]);
});

test('requires the exact v2 root and rejects caller-owned identity and credentials', () => {
  for (const [key, value] of [
    ['ownerId', 'uid-1'],
    ['userId', 'uid-1'],
    ['oauthAccessToken', 'secret'],
    ['registrationToken', 'secret'],
    ['inviteToken', 'secret'],
    ['provider', { name: 'google' }],
  ]) {
    const draft = validDraft();
    draft[key] = value;
    assert.throws(() => buildShopV2CreateProjection(draft), expectSchemaError('shop'));
  }
  const wrongVersion = validDraft();
  wrongVersion.schemaVersion = 1;
  assert.throws(() => buildShopV2CreateProjection(wrongVersion), expectSchemaError('schemaVersion'));
});

test('requires an explicit canonical slug and stable non-PII resource identifiers', () => {
  for (const slug of ['Barber-Buddies', 'barber buddies', 'barber-buddies-', 'ümlaut']) {
    const draft = validDraft();
    draft.slug = slug;
    assert.throws(() => buildShopV2CreateProjection(draft), expectSchemaError('slug'));
  }
  const employeeEmail = validDraft();
  employeeEmail.employees[0].id = 'person@example.com';
  assert.throws(
    () => buildShopV2CreateProjection(employeeEmail),
    expectSchemaError('employees[0].id'),
  );
});

test('enforces EUR with two minor-unit digits and safe integer prices', () => {
  for (const [field, value] of [['currency', 'USD'], ['minorUnitDigits', 3]]) {
    const draft = validDraft();
    draft[field] = value;
    assert.throws(() => buildShopV2CreateProjection(draft), expectSchemaError(field));
  }
  for (const priceMinor of [-1, 12.5, '3500', Number.MAX_SAFE_INTEGER + 1]) {
    const draft = validDraft();
    draft.services[0].priceMinor = priceMinor;
    assert.throws(
      () => buildShopV2CreateProjection(draft),
      expectSchemaError('services[0].priceMinor'),
    );
  }
});

test('normalizes IANA zones and rejects offsets or invalid zones', () => {
  assert.equal(buildShopV2CreateProjection(validDraft()).publicShop.timeZone, 'Europe/Berlin');
  for (const timeZone of ['+02:00', 'Berlin', 'Not/AZone', ' Europe/Berlin']) {
    const draft = validDraft();
    draft.timeZone = timeZone;
    assert.throws(() => buildShopV2CreateProjection(draft), (error) => {
      assert.ok(error instanceof ShopV2SchemaError);
      assert.equal(error.code, 'SHOP_TIMEZONE_REQUIRED');
      return true;
    });
  }
});

test('requires all seven weekdays and canonical five-minute half-open intervals', () => {
  const missingDay = validDraft();
  delete missingDay.weeklyAvailability.sunday;
  assert.throws(
    () => buildShopV2CreateProjection(missingDay),
    expectSchemaError('weeklyAvailability.sunday'),
  );

  const overlap = validDraft();
  overlap.weeklyAvailability.monday = [
    { startLocalTime: '09:00', endLocalTime: '12:00' },
    { startLocalTime: '11:55', endLocalTime: '13:00' },
  ];
  assert.throws(() => buildShopV2CreateProjection(overlap), (error) => {
    assert.equal(error.code, 'OUTSIDE_AVAILABILITY');
    return true;
  });

  const unaligned = validDraft();
  unaligned.employees[0].weeklyAvailability.monday[0].startLocalTime = '09:03';
  assert.throws(
    () => buildShopV2CreateProjection(unaligned),
    expectSchemaError('employees[0].weeklyAvailability.monday[0].startLocalTime'),
  );
});

test('accepts exact adjacency and deterministically sorts weekly intervals', () => {
  const draft = validDraft();
  draft.weeklyAvailability.monday = [
    { startLocalTime: '12:00', endLocalTime: '13:00' },
    { startLocalTime: '09:00', endLocalTime: '12:00' },
  ];
  draft.employees[0].weeklyAvailability.monday = [
    { startLocalTime: '09:00', endLocalTime: '12:00' },
  ];
  draft.employees[1].weeklyAvailability.monday = [
    { startLocalTime: '12:00', endLocalTime: '13:00' },
  ];
  assert.deepEqual(
    buildShopV2CreateProjection(draft).publicShop.weeklyAvailability.monday,
    [
      { startLocalTime: '09:00', endLocalTime: '12:00' },
      { startLocalTime: '12:00', endLocalTime: '13:00' },
    ],
  );
});

test('requires each active employee interval to fit within one shop interval', () => {
  const outside = validDraft();
  outside.employees[0].weeklyAvailability.monday = [
    { startLocalTime: '08:00', endLocalTime: '09:00' },
  ];
  assert.throws(() => buildShopV2CreateProjection(outside), (error) => {
    assert.equal(error.code, 'OUTSIDE_AVAILABILITY');
    assert.equal(error.field, 'employees[1].weeklyAvailability.monday[0]');
    return true;
  });

  const partialOverlap = validDraft();
  partialOverlap.employees[0].weeklyAvailability.monday = [
    { startLocalTime: '11:00', endLocalTime: '12:30' },
  ];
  assert.throws(
    () => buildShopV2CreateProjection(partialOverlap),
    (error) => error.code === 'OUTSIDE_AVAILABILITY',
  );

  const bridgesBreak = validDraft();
  bridgesBreak.employees[0].weeklyAvailability.monday = [
    { startLocalTime: '10:00', endLocalTime: '14:00' },
  ];
  assert.throws(
    () => buildShopV2CreateProjection(bridgesBreak),
    (error) => error.code === 'OUTSIDE_AVAILABILITY',
  );

  const bridgesAdjacentIntervals = validDraft();
  bridgesAdjacentIntervals.weeklyAvailability.monday = [
    { startLocalTime: '09:00', endLocalTime: '12:00' },
    { startLocalTime: '12:00', endLocalTime: '18:00' },
  ];
  bridgesAdjacentIntervals.employees[0].weeklyAvailability.monday = [
    { startLocalTime: '10:00', endLocalTime: '14:00' },
  ];
  assert.throws(
    () => buildShopV2CreateProjection(bridgesAdjacentIntervals),
    (error) => error.code === 'OUTSIDE_AVAILABILITY',
  );

  const closedDay = validDraft();
  closedDay.employees[0].weeklyAvailability.tuesday = [
    { startLocalTime: '10:00', endLocalTime: '11:00' },
  ];
  assert.throws(
    () => buildShopV2CreateProjection(closedDay),
    (error) => error.code === 'OUTSIDE_AVAILABILITY',
  );

  const exactBoundary = validDraft();
  exactBoundary.employees[0].weeklyAvailability.monday = [
    { startLocalTime: '09:00', endLocalTime: '12:00' },
  ];
  assert.doesNotThrow(() => buildShopV2CreateProjection(exactBoundary));

  const validSubset = validDraft();
  validSubset.employees[0].weeklyAvailability.monday = [
    { startLocalTime: '09:30', endLocalTime: '11:45' },
    { startLocalTime: '13:15', endLocalTime: '17:30' },
  ];
  assert.doesNotThrow(() => buildShopV2CreateProjection(validSubset));
});

test('requires stable unique services and employee assignments to known services', () => {
  const duplicateService = validDraft();
  duplicateService.services[1].id = 'haircut';
  assert.throws(
    () => buildShopV2CreateProjection(duplicateService),
    expectSchemaError('services[1].id'),
  );

  const unknownService = validDraft();
  unknownService.employees[0].serviceIds = ['unknown'];
  assert.throws(
    () => buildShopV2CreateProjection(unknownService),
    expectSchemaError('employees[0].serviceIds'),
  );

  const employeePii = validDraft();
  employeePii.employees[0].displayName = 'Private Person';
  assert.throws(
    () => buildShopV2CreateProjection(employeePii),
    expectSchemaError('employees[0]'),
  );
});

test('requires explicit policy and consent without accepting client timestamps', () => {
  const falseConsent = validDraft();
  falseConsent.consent.privacyAccepted = false;
  assert.throws(
    () => buildShopV2CreateProjection(falseConsent),
    expectSchemaError('consent.privacyAccepted'),
  );

  const clientTimestamp = validDraft();
  clientTimestamp.consent.acceptedAt = '2026-09-01T00:00:00Z';
  assert.throws(() => buildShopV2CreateProjection(clientTimestamp), expectSchemaError('consent'));

  const missingPolicy = validDraft();
  delete missingPolicy.bookingPolicy.leadTimeMinutes;
  assert.throws(
    () => buildShopV2CreateProjection(missingPolicy),
    expectSchemaError('bookingPolicy.leadTimeMinutes'),
  );
});

test('bounds the private staged asset bridge and validates every public reference', () => {
  const rawFile = validDraft();
  rawFile.stagedAssets[0].file = Buffer.from('raw');
  assert.throws(
    () => buildShopV2CreateProjection(rawFile),
    expectSchemaError('stagedAssets[0]'),
  );

  const wrongPath = validDraft();
  wrongPath.stagedAssets[0].storagePath = 'live-shops/shop-1/gallery.webp';
  assert.throws(
    () => buildShopV2CreateProjection(wrongPath),
    expectSchemaError('stagedAssets[0].storagePath'),
  );

  const wrongKind = validDraft();
  wrongKind.presentation.logoAssetId = 'asset-gallery';
  assert.throws(
    () => buildShopV2CreateProjection(wrongKind),
    expectSchemaError('presentation.logoAssetId'),
  );

  const missing = validDraft();
  missing.presentation.heroAssetId = 'asset-missing';
  assert.throws(
    () => buildShopV2CreateProjection(missing),
    expectSchemaError('presentation.heroAssetId'),
  );
});

test('rejects accessors without invoking them', () => {
  let calls = 0;
  const draft = validDraft();
  Object.defineProperty(draft.presentation, 'headline', {
    enumerable: true,
    get() {
      calls += 1;
      throw new Error('must not run');
    },
  });
  assert.throws(() => buildShopV2CreateProjection(draft), expectSchemaError('presentation'));
  assert.equal(calls, 0);
});

test('rejects proxies before invoking their traps', () => {
  let calls = 0;
  const draft = validDraft();
  draft.contact = new Proxy(draft.contact, {
    getPrototypeOf() {
      calls += 1;
      throw new Error('must not run');
    },
    ownKeys() {
      calls += 1;
      throw new Error('must not run');
    },
  });
  assert.throws(() => buildShopV2CreateProjection(draft), expectSchemaError('contact'));
  assert.equal(calls, 0);
});

test('rejects symbols, sparse arrays, custom prototypes, and cyclic graphs safely', () => {
  const symbol = validDraft();
  symbol[Symbol('secret')] = 'hidden';
  assert.throws(() => buildShopV2CreateProjection(symbol), expectSchemaError('shop'));

  const sparse = validDraft();
  sparse.services = new Array(2);
  sparse.services[1] = validDraft().services[0];
  assert.throws(() => buildShopV2CreateProjection(sparse), expectSchemaError('services'));

  const custom = validDraft();
  custom.presentation = Object.create({ inherited: true });
  Object.assign(custom.presentation, validDraft().presentation);
  assert.throws(() => buildShopV2CreateProjection(custom), expectSchemaError('presentation'));

  const cyclic = validDraft();
  cyclic.contact = cyclic;
  assert.throws(() => buildShopV2CreateProjection(cyclic), expectSchemaError('contact'));
});

test('canonical request material changes for material input and never includes caller identity', () => {
  const original = buildShopV2CreateProjection(validDraft());
  const changedDraft = validDraft();
  changedDraft.services[0].priceMinor += 1;
  const changed = buildShopV2CreateProjection(changedDraft);

  assert.notEqual(original.privateShop.requestMaterial, changed.privateShop.requestMaterial);
  assert.doesNotMatch(original.privateShop.requestMaterial, /ownerId|oauth|registrationToken/);
});
