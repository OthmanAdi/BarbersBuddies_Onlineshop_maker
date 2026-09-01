'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_DEMO_PROJECT_ID,
  ShopV2RuntimeError,
  assertShopV2Enabled,
  isShopV2Enabled,
} = require('../../src/shop-v2/runtime');

const PRODUCTION_TOKEN = 'production_activation_token_000001';

function demoEnv(overrides = {}) {
  return {
    SHOP_V2_ENABLED: 'true',
    FUNCTIONS_EMULATOR: 'true',
    GCLOUD_PROJECT: DEFAULT_DEMO_PROJECT_ID,
    ...overrides,
  };
}

test('shop creation v2 is disabled by default', () => {
  for (const env of [{}, Object.create(null), null, [], 'true', undefined]) {
    assert.equal(isShopV2Enabled(env), false);
  }
});

test('only the exact enabled value is accepted', () => {
  for (const value of [true, 1, 'TRUE', 'True', ' true', 'true ', 'yes']) {
    assert.equal(isShopV2Enabled(demoEnv({ SHOP_V2_ENABLED: value })), false);
  }
  assert.equal(isShopV2Enabled(demoEnv()), true);
});

test('emulator activation requires an exact explicitly demo-prefixed project', () => {
  assert.equal(isShopV2Enabled(demoEnv()), true);
  assert.equal(isShopV2Enabled(demoEnv({ GCLOUD_PROJECT: 'production-project' })), false);
  assert.equal(isShopV2Enabled(demoEnv({ GCLOUD_PROJECT: undefined })), false);
  assert.equal(isShopV2Enabled(demoEnv({ GCP_PROJECT: 'other-project' })), false);
  assert.equal(isShopV2Enabled(demoEnv(), { demoProjectId: 'production-project' }), false);
  assert.equal(isShopV2Enabled(
    { ...demoEnv(), GCLOUD_PROJECT: 'demo-isolated-shop' },
    { demoProjectId: 'demo-isolated-shop' },
  ), true);
});

test('misleading emulator flags fail closed and cannot fall through to production activation', () => {
  for (const value of [false, 'false', 'TRUE', ' true', 1]) {
    assert.equal(isShopV2Enabled({
      SHOP_V2_ENABLED: 'true',
      FUNCTIONS_EMULATOR: value,
      GCLOUD_PROJECT: 'production-project',
      SHOP_V2_PRODUCTION_ACTIVATION: 'true',
      SHOP_V2_PRODUCTION_ACTIVATION_TOKEN: PRODUCTION_TOKEN,
    }, { expectedProductionActivationToken: PRODUCTION_TOKEN }), false);
  }
});

test('production-like activation requires an independent exact token contract', () => {
  const env = {
    SHOP_V2_ENABLED: 'true',
    GCLOUD_PROJECT: 'production-project',
    SHOP_V2_PRODUCTION_ACTIVATION: 'true',
    SHOP_V2_PRODUCTION_ACTIVATION_TOKEN: PRODUCTION_TOKEN,
  };
  assert.equal(isShopV2Enabled(env), false);
  assert.equal(isShopV2Enabled(env, { expectedProductionActivationToken: 'wrong_activation_token_000000000' }), false);
  assert.equal(isShopV2Enabled(env, { expectedProductionActivationToken: PRODUCTION_TOKEN }), true);
  assert.equal(isShopV2Enabled({ ...env, SHOP_V2_PRODUCTION_ACTIVATION: 'TRUE' }, {
    expectedProductionActivationToken: PRODUCTION_TOKEN,
  }), false);
});

test('short, malformed, or differently sized production tokens never activate', () => {
  for (const token of ['', 'short', 'x'.repeat(31), 'contains spaces 00000000000000000000', 'x'.repeat(129)]) {
    assert.equal(isShopV2Enabled({
      SHOP_V2_ENABLED: 'true',
      SHOP_V2_PRODUCTION_ACTIVATION: 'true',
      SHOP_V2_PRODUCTION_ACTIVATION_TOKEN: token,
    }, { expectedProductionActivationToken: token }), false);
  }
});

test('inherited, accessor, and proxy activation values fail closed without invoking getters', () => {
  assert.equal(isShopV2Enabled(Object.create(demoEnv())), false);
  let getterCalls = 0;
  const env = demoEnv();
  Object.defineProperty(env, 'SHOP_V2_ENABLED', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 'true';
    },
  });
  assert.equal(isShopV2Enabled(env), false);
  assert.equal(getterCalls, 0);
  assert.equal(isShopV2Enabled(new Proxy(demoEnv(), {
    getOwnPropertyDescriptor() {
      getterCalls += 1;
      throw new Error('must not run');
    },
  })), false);
  assert.equal(getterCalls, 0);
});

test('assertion returns one stable redacted disabled error', () => {
  assert.throws(() => assertShopV2Enabled({ SECRET: 'must-not-leak' }), (error) => {
    assert.ok(error instanceof ShopV2RuntimeError);
    assert.equal(error.code, 'SHOP_V2_DISABLED');
    assert.equal(error.httpStatus, 404);
    assert.equal(error.retryable, false);
    assert.doesNotMatch(JSON.stringify(error), /SECRET|must-not-leak/);
    return true;
  });
});
