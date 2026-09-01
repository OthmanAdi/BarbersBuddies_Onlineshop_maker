'use strict';

const { timingSafeEqual } = require('node:crypto');
const { types: utilTypes } = require('node:util');

const DEFAULT_DEMO_PROJECT_ID = 'demo-barbersbuddies';
const ENABLED_VALUE = 'true';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

class ShopV2RuntimeError extends Error {
  constructor() {
    super('Shop creation v2 is not available.');
    this.name = 'ShopV2RuntimeError';
    this.code = 'SHOP_V2_DISABLED';
    this.httpStatus = 404;
    this.retryable = false;
  }
}

function isProxy(value) {
  try {
    return utilTypes.isProxy(value);
  } catch {
    return true;
  }
}

function ownDataValue(record, name) {
  if (record === null || typeof record !== 'object' || Array.isArray(record) || isProxy(record)) {
    return undefined;
  }
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, name);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function exactTokenMatch(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' ||
      !TOKEN_PATTERN.test(left) || !TOKEN_PATTERN.test(right)) {
    return false;
  }
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function resolveProjectId(env) {
  const gcloudProject = ownDataValue(env, 'GCLOUD_PROJECT');
  const gcpProject = ownDataValue(env, 'GCP_PROJECT');
  if (gcloudProject !== undefined && gcpProject !== undefined && gcloudProject !== gcpProject) {
    return undefined;
  }
  const projectId = gcloudProject === undefined ? gcpProject : gcloudProject;
  return typeof projectId === 'string' ? projectId : undefined;
}

function isValidDemoProjectId(value) {
  return typeof value === 'string' &&
    value.startsWith('demo-') &&
    /^[a-z0-9-]{6,63}$/.test(value);
}

function isShopV2Enabled(env, options = {}) {
  if (env === null || typeof env !== 'object' || Array.isArray(env) || isProxy(env) ||
      options === null || typeof options !== 'object' || Array.isArray(options) || isProxy(options)) {
    return false;
  }
  if (ownDataValue(env, 'SHOP_V2_ENABLED') !== ENABLED_VALUE) return false;

  const projectId = resolveProjectId(env);
  const emulatorFlag = ownDataValue(env, 'FUNCTIONS_EMULATOR');
  const demoProjectId = ownDataValue(options, 'demoProjectId') === undefined
    ? DEFAULT_DEMO_PROJECT_ID
    : ownDataValue(options, 'demoProjectId');

  if (emulatorFlag === ENABLED_VALUE) {
    return isValidDemoProjectId(demoProjectId) && projectId === demoProjectId;
  }

  // Any emulator-looking value fails closed instead of falling through to the
  // separate production activation contract.
  if (emulatorFlag !== undefined) return false;
  if (ownDataValue(env, 'SHOP_V2_PRODUCTION_ACTIVATION') !== ENABLED_VALUE) return false;

  return exactTokenMatch(
    ownDataValue(env, 'SHOP_V2_PRODUCTION_ACTIVATION_TOKEN'),
    ownDataValue(options, 'expectedProductionActivationToken'),
  );
}

function assertShopV2Enabled(env, options) {
  if (!isShopV2Enabled(env, options)) throw new ShopV2RuntimeError();
}

module.exports = {
  DEFAULT_DEMO_PROJECT_ID,
  ShopV2RuntimeError,
  assertShopV2Enabled,
  isShopV2Enabled,
};
