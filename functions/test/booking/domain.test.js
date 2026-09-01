'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { BookingError } = require('../../src/booking/errors');
const {
  assertStatusTransition,
  buildOccupancyWindow,
  canonicalSerialize,
  createCommandId,
  createOccupancyBuckets,
  createOccupancyId,
  createRequestHash,
  intervalsOverlap,
  isCapacityBlockingStatus,
  normalizeBufferMinutes,
  normalizeDurationMinutes,
  normalizeEmail,
  parseLocalDate,
  parseLocalTime,
  resolveResourceCandidates,
  sha256Canonical,
  statusAfterReschedule,
  sumServiceDuration,
  validateIdempotencyKey,
} = require('../../src/booking/domain');

function expectBookingError(code) {
  return (error) => error instanceof BookingError && error.code === code;
}

test('BookingError exposes a stable safe transport shape', () => {
  const originalDetails = { field: 'localDate', nested: { index: 2 } };
  const error = new BookingError('INVALID_INPUT', 'Invalid input', {
    httpStatus: 422,
    retryable: false,
    details: originalDetails,
  });

  originalDetails.nested.index = 99;
  assert.equal(error.name, 'BookingError');
  assert.equal(error.code, 'INVALID_INPUT');
  assert.equal(error.httpStatus, 422);
  assert.equal(error.retryable, false);
  assert.deepEqual(error.details, { field: 'localDate', nested: { index: 2 } });
  assert.ok(Object.isFrozen(error.details));
  assert.ok(Object.isFrozen(error.details.nested));
  assert.deepEqual(error.toJSON(), {
    name: 'BookingError',
    code: 'INVALID_INPUT',
    message: 'Invalid input',
    httpStatus: 422,
    retryable: false,
    details: { field: 'localDate', nested: { index: 2 } },
  });
});

test('BookingError rejects unsafe detail graphs and strips prototype control keys', () => {
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(
    () => new BookingError('INVALID_INPUT', 'Invalid input', { details: cyclic }),
    /must not contain cycles/,
  );

  const details = JSON.parse('{"safe":true,"__proto__":{"polluted":true}}');
  const error = new BookingError('INVALID_INPUT', 'Invalid input', { details });
  assert.deepEqual(error.details, { safe: true });
  assert.equal({}.polluted, undefined);
});

test('civil date parser is strict, Gregorian, and independent from host DST', () => {
  const previousTimeZone = process.env.TZ;
  process.env.TZ = 'Europe/Berlin';
  const berlinGapDay = parseLocalDate('2026-03-29');
  process.env.TZ = 'America/New_York';
  const newYorkView = parseLocalDate('2026-03-29');
  process.env.TZ = previousTimeZone;

  assert.deepEqual(berlinGapDay, newYorkView);
  assert.deepEqual(parseLocalDate('2024-02-29'), {
    value: '2024-02-29', year: 2024, month: 2, day: 29,
  });
  assert.throws(() => parseLocalDate('2023-02-29'), expectBookingError('INVALID_DATE'));
  assert.throws(() => parseLocalDate('2026-2-03'), expectBookingError('INVALID_DATE'));
  assert.throws(() => parseLocalDate('0000-01-01'), expectBookingError('INVALID_DATE'));
});

test('civil time parser accepts only exact HH:mm wall-clock values', () => {
  assert.deepEqual(parseLocalTime('00:00'), {
    value: '00:00', hour: 0, minute: 0, totalMinutes: 0,
  });
  assert.deepEqual(parseLocalTime('23:59'), {
    value: '23:59', hour: 23, minute: 59, totalMinutes: 1439,
  });
  assert.throws(() => parseLocalTime('24:00'), expectBookingError('INVALID_TIME'));
  assert.throws(() => parseLocalTime('9:30'), expectBookingError('INVALID_TIME'));
  assert.throws(() => parseLocalTime('09:30:00'), expectBookingError('INVALID_TIME'));
});

test('email, duration, buffer, and service inputs are normalized without coercion', () => {
  assert.equal(normalizeEmail('  Person+Cut@Example.COM '), 'person+cut@example.com');
  assert.throws(() => normalizeEmail('no-at-sign'), expectBookingError('INVALID_ARGUMENT'));

  assert.equal(normalizeDurationMinutes(30), 30);
  assert.equal(normalizeBufferMinutes(0), 0);
  assert.equal(normalizeBufferMinutes(15), 15);
  assert.throws(() => normalizeDurationMinutes('30'), expectBookingError('INVALID_DURATION'));
  assert.throws(() => normalizeDurationMinutes(0), expectBookingError('INVALID_DURATION'));
  assert.throws(() => normalizeBufferMinutes(-1), expectBookingError('INVALID_DURATION'));
  assert.throws(() => normalizeBufferMinutes(241), expectBookingError('INVALID_DURATION'));

  assert.equal(sumServiceDuration([{ durationMinutes: 20 }, 40]), 60);
  assert.throws(() => sumServiceDuration([]), expectBookingError('INVALID_ARGUMENT'));
  assert.throws(
    () => sumServiceDuration([{ durationMinutes: 600 }, { durationMinutes: 121 }]),
    expectBookingError('INVALID_DURATION'),
  );
});

test('half-open interval overlap allows exact adjacency', () => {
  assert.equal(intervalsOverlap(600, 630, 629, 660), true);
  assert.equal(intervalsOverlap(600, 630, 630, 660), false);
  assert.equal(intervalsOverlap(630, 660, 600, 630), false);
  assert.throws(() => intervalsOverlap(600, 600, 630, 660), expectBookingError('INVALID_ARGUMENT'));
});

test('occupancy window covers buffer before, service duration, and buffer after', () => {
  assert.deepEqual(buildOccupancyWindow({
    localDate: '2026-09-01',
    localStartTime: '10:05',
    durationMinutes: 32,
    bufferBeforeMinutes: 3,
    bufferAfterMinutes: 4,
  }), {
    localDate: '2026-09-01',
    localStartTime: '10:05',
    startMinute: 605,
    endMinute: 637,
    occupiedStartMinute: 602,
    occupiedEndMinute: 641,
    durationMinutes: 32,
    bufferBeforeMinutes: 3,
    bufferAfterMinutes: 4,
  });
});

test('five-minute buckets round outward and never cross the civil date', () => {
  const buckets = createOccupancyBuckets({
    localDate: '2026-09-01',
    localStartTime: '10:05',
    durationMinutes: 32,
    bufferBeforeMinutes: 3,
    bufferAfterMinutes: 4,
  });

  assert.equal(buckets.length, 9);
  assert.deepEqual(buckets[0], {
    localDate: '2026-09-01',
    startMinute: 600,
    endMinute: 605,
    startTime: '10:00',
    endTime: '10:05',
  });
  assert.deepEqual(buckets.at(-1), {
    localDate: '2026-09-01',
    startMinute: 640,
    endMinute: 645,
    startTime: '10:40',
    endTime: '10:45',
  });
  assert.throws(() => buildOccupancyWindow({
    localDate: '2026-09-01',
    localStartTime: '10:03',
    durationMinutes: 30,
  }), expectBookingError('INVALID_TIME'));
  assert.throws(() => createOccupancyBuckets({
    localDate: '2026-09-01',
    localStartTime: '10:03',
    durationMinutes: 30,
  }), expectBookingError('INVALID_TIME'));
  assert.throws(() => createOccupancyBuckets({
    localDate: '2026-09-01',
    localStartTime: '00:05',
    durationMinutes: 30,
    bufferBeforeMinutes: 10,
  }), expectBookingError('OUTSIDE_AVAILABILITY'));
  assert.throws(() => createOccupancyBuckets({
    localDate: '2026-09-01',
    localStartTime: '23:45',
    durationMinutes: 20,
  }), expectBookingError('INVALID_DURATION'));
  assert.throws(() => createOccupancyBuckets({
    localDate: '2026-09-01',
    localStartTime: '23:30',
    durationMinutes: 30,
    bufferAfterMinutes: 1,
  }), expectBookingError('OUTSIDE_AVAILABILITY'));
});

test('canonical serialization and SHA-256 hashes are key-order independent', () => {
  const left = { z: [3, { b: true, a: null }], a: 'text' };
  const right = { a: 'text', z: [3, { a: null, b: true }] };
  assert.equal(
    canonicalSerialize(left),
    '{"a":"text","z":[3,{"a":null,"b":true}]}',
  );
  assert.equal(canonicalSerialize(left), canonicalSerialize(right));
  assert.equal(sha256Canonical(left), sha256Canonical(right));
  assert.match(sha256Canonical(left), /^[a-f0-9]{64}$/);
  assert.throws(() => canonicalSerialize({ missing: undefined }), expectBookingError('INVALID_ARGUMENT'));
});

test('command, request, and occupancy identifiers are deterministic and scoped', () => {
  const key = 'request-20260901-0001';
  const commandA = createCommandId({
    operation: 'create', actorId: 'uid-1', idempotencyKey: key,
  });
  const commandB = createCommandId({
    idempotencyKey: key, actorId: 'uid-1', operation: 'create',
  });
  assert.equal(commandA, commandB);
  assert.notEqual(commandA, createCommandId({
    operation: 'create', actorId: 'uid-2', idempotencyKey: key,
  }));
  assert.notEqual(commandA, createCommandId({
    operation: 'cancel', actorId: 'uid-1', idempotencyKey: key,
  }));
  assert.throws(() => createCommandId({
    actorId: 'uid-1', idempotencyKey: key,
  }), expectBookingError('INVALID_ARGUMENT'));

  assert.equal(
    createRequestHash({ localDate: '2026-09-01', customer: { email: 'a@example.com' } }),
    createRequestHash({ customer: { email: 'a@example.com' }, localDate: '2026-09-01' }),
  );

  const occupancy = createOccupancyId({
    shopId: 'shop-1',
    resourceId: 'employee:employee-1',
    localDate: '2026-09-01',
    bucketStartMinute: 600,
  });
  assert.match(occupancy, /^[a-f0-9]{64}$/);
  assert.notEqual(occupancy, createOccupancyId({
    shopId: 'shop-1',
    resourceId: 'employee:employee-1',
    localDate: '2026-09-01',
    bucketStartMinute: 605,
  }));
});

test('idempotency keys are strict, preserved, and URL-safe', () => {
  assert.equal(validateIdempotencyKey('request-20260901_0001'), 'request-20260901_0001');
  assert.throws(() => validateIdempotencyKey('short'), expectBookingError('INVALID_IDEMPOTENCY_KEY'));
  assert.throws(
    () => validateIdempotencyKey('request key with spaces'),
    expectBookingError('INVALID_IDEMPOTENCY_KEY'),
  );
  assert.throws(
    () => validateIdempotencyKey(`x${'a'.repeat(128)}`),
    expectBookingError('INVALID_IDEMPOTENCY_KEY'),
  );
});

test('resource candidates validate explicit employees and sort skipped preferences', () => {
  const employees = [
    { id: 'employee-z', active: true },
    { id: 'employee-disabled', active: false },
    { id: 'employee-a', active: true },
  ];

  assert.deepEqual(resolveResourceCandidates({
    shopId: 'shop-1', preferredEmployeeId: 'employee-z', employees,
  }), ['employee:employee-z']);
  assert.deepEqual(resolveResourceCandidates({ shopId: 'shop-1', employees }), [
    'employee:employee-a',
    'employee:employee-z',
  ]);
  assert.deepEqual(resolveResourceCandidates({ shopId: 'shop-1', employees: [] }), [
    'shop:shop-1:primary',
  ]);
  assert.throws(() => resolveResourceCandidates({
    shopId: 'shop-1', preferredEmployeeId: 'employee-disabled', employees,
  }), (error) => {
    assert.equal(error.code, 'EMPLOYEE_UNAVAILABLE');
    assert.equal(error.httpStatus, 422);
    return true;
  });
  assert.throws(() => resolveResourceCandidates({
    shopId: 'shop-1', preferredEmployeeId: 'employee-missing', employees,
  }), (error) => {
    assert.equal(error.code, 'EMPLOYEE_NOT_FOUND');
    assert.equal(error.httpStatus, 404);
    return true;
  });
});

test('legacy employees without activity flags remain active while explicit inactivity is excluded', () => {
  const legacyEmployees = [
    { id: 'employee-z' },
    { id: 'employee-disabled-by-status', status: 'disabled' },
    { id: 'employee-inactive-by-status', status: 'INACTIVE' },
    { id: 'employee-inactive-by-flag', active: false },
    { id: 'employee-a', status: 'active' },
  ];

  assert.deepEqual(resolveResourceCandidates({
    shopId: 'shop-1',
    employees: legacyEmployees,
  }), [
    'employee:employee-a',
    'employee:employee-z',
  ]);
  assert.deepEqual(resolveResourceCandidates({
    shopId: 'shop-1',
    preferredEmployeeId: 'employee-z',
    employees: legacyEmployees,
  }), ['employee:employee-z']);
  assert.throws(() => resolveResourceCandidates({
    shopId: 'shop-1',
    preferredEmployeeId: 'employee-disabled-by-status',
    employees: legacyEmployees,
  }), expectBookingError('EMPLOYEE_UNAVAILABLE'));
  assert.throws(() => resolveResourceCandidates({
    shopId: 'shop-1',
    preferredEmployeeId: 'employee-inactive-by-flag',
    employees: legacyEmployees,
  }), expectBookingError('EMPLOYEE_UNAVAILABLE'));
});

test('malformed or unusable employee rosters fail closed', () => {
  assert.throws(() => resolveResourceCandidates({ shopId: 'shop-1', employees: null }), (error) => {
    assert.equal(error.code, 'SHOP_RESOURCE_CONFIG_REQUIRED');
    assert.equal(error.httpStatus, 422);
    return true;
  });
  assert.throws(
    () => resolveResourceCandidates({
      shopId: 'shop-1', employees: [{ id: 'x', active: 'yes' }],
    }),
    expectBookingError('SHOP_RESOURCE_CONFIG_REQUIRED'),
  );
  assert.throws(() => resolveResourceCandidates({
    shopId: 'shop-1', employees: [{ id: 'x', active: false }],
  }), (error) => {
    assert.equal(error.code, 'EMPLOYEE_UNAVAILABLE');
    assert.equal(error.httpStatus, 422);
    return true;
  });
  assert.throws(() => resolveResourceCandidates({
    shopId: 'shop-1', employees: [{ id: 'x', active: true }, { id: 'x', active: true }],
  }), expectBookingError('SHOP_RESOURCE_CONFIG_REQUIRED'));
});

test('booking state machine allows only the v2 lifecycle', () => {
  for (const next of ['confirmed', 'rejected', 'cancelled']) {
    assert.equal(assertStatusTransition('pending', next), next);
  }
  for (const next of ['completed', 'cancelled']) {
    assert.equal(assertStatusTransition('confirmed', next), next);
  }

  assert.throws(
    () => assertStatusTransition('pending', 'completed'),
    expectBookingError('INVALID_STATUS_TRANSITION'),
  );
  assert.throws(
    () => assertStatusTransition('confirmed', 'rejected'),
    expectBookingError('INVALID_STATUS_TRANSITION'),
  );
  assert.throws(
    () => assertStatusTransition('completed', 'cancelled'),
    expectBookingError('INVALID_STATUS_TRANSITION'),
  );
  assert.throws(
    () => assertStatusTransition('pending', 'pending'),
    expectBookingError('INVALID_STATUS_TRANSITION'),
  );
  assert.throws(
    () => assertStatusTransition('rescheduled', 'confirmed'),
    expectBookingError('INVALID_ARGUMENT'),
  );
});

test('reschedule preserves active status and rejects terminal bookings', () => {
  assert.equal(statusAfterReschedule('pending'), 'pending');
  assert.equal(statusAfterReschedule('confirmed'), 'confirmed');
  for (const terminal of ['completed', 'rejected', 'cancelled']) {
    assert.throws(
      () => statusAfterReschedule(terminal),
      expectBookingError('INVALID_STATUS_TRANSITION'),
    );
  }
});

test('legacy missing and rescheduled statuses remain capacity-blocking', () => {
  for (const blocking of [undefined, null, '', 'pending', 'confirmed', 'rescheduled', 'booked', 'unknown']) {
    assert.equal(isCapacityBlockingStatus(blocking), true, String(blocking));
  }
  assert.equal(isCapacityBlockingStatus('cancelled'), false);
  assert.equal(isCapacityBlockingStatus('rejected'), false);
  assert.equal(isCapacityBlockingStatus('completed'), false);
  assert.equal(isCapacityBlockingStatus(' CANCELLED '), false);
});
