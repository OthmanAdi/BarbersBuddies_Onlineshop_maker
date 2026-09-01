'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const admin = require('firebase-admin');

process.env.GCLOUD_PROJECT = 'demo-barbersbuddies';
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo-barbersbuddies' });
delete process.env.BOOKING_V2_ENABLED;
delete process.env.FUNCTIONS_EMULATOR;
delete process.env.MAILGUN_API_KEY;

const exportedFunctions = require('../../index');

test.after(async () => {
  await Promise.all(admin.apps.map((app) => app.delete()));
});

function fakeResponse() {
  return {
    headers: {},
    statusCode: null,
    body: undefined,
    set(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
  };
}

test('index loads without Mailgun secrets and exports exactly the three initial v2 commands', () => {
  for (const name of ['createBookingV2', 'cancelBookingV2', 'rescheduleBookingV2']) {
    assert.equal(typeof exportedFunctions[name], 'function', name);
  }
  assert.equal(exportedFunctions.getBookingAvailabilityV2, undefined);
});

test('production-like command execution is dark by default', async () => {
  const request = {
    method: 'POST',
    body: {},
    headers: {
      'content-type': 'application/json',
      'idempotency-key': '00000000-0000-4000-8000-000000000001',
    },
  };
  const response = fakeResponse();

  await exportedFunctions.createBookingV2(request, response);

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, {
    ok: false,
    error: {
      code: 'FORBIDDEN',
      message: 'the verified caller is not allowed to perform this command',
      retryable: false,
    },
  });
});

test('schema-v2 status updates bypass the legacy notification and email trigger', async () => {
  const result = await exportedFunctions.onStatusChange.run({
    before: { data: () => ({ schemaVersion: 2, status: 'pending' }) },
    after: { data: () => ({ schemaVersion: 2, status: 'cancelled' }) },
  }, {
    params: { bookingId: 'booking-v2-test' },
  });

  assert.equal(result, null);
});
