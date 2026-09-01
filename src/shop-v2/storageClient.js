const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  'image/avif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const ALLOWED_ASSET_KINDS = new Set(['logo', 'hero', 'gallery']);
const AUTH_UID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const DRAFT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const ASSET_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

const ERROR_MESSAGES = Object.freeze({
  INVALID_REQUEST: 'The staged asset request is invalid.',
  INVALID_AUTH_UID: 'The authenticated user identifier is invalid.',
  INVALID_DRAFT_ID: 'The shop draft identifier is invalid.',
  INVALID_ASSET_KIND: 'The staged asset kind is invalid.',
  INVALID_CONTENT_TYPE: 'The staged asset content type is not supported.',
  INVALID_ASSET_DATA: 'The staged asset data is invalid.',
  INVALID_ASSET_SIZE: 'The staged asset size is outside the allowed range.',
  INVALID_ASSET_ID: 'The staged asset identifier is invalid.',
  CRYPTO_UNAVAILABLE: 'Secure asset processing is unavailable.',
  ASSET_ID_GENERATION_FAILED: 'A secure staged asset identifier could not be generated.',
  ASSET_DIGEST_FAILED: 'The staged asset digest could not be computed.',
  STORAGE_UNAVAILABLE: 'Firebase Storage is unavailable.',
  STORAGE_REFERENCE_FAILED: 'The staged asset destination could not be created.',
  STORAGE_UPLOAD_FAILED: 'The staged asset upload failed.',
  STORAGE_VERIFICATION_FAILED: 'The staged asset upload could not be verified.',
});

export class ShopV2StorageClientError extends Error {
  constructor(code) {
    super(ERROR_MESSAGES[code] || ERROR_MESSAGES.INVALID_REQUEST);
    this.name = 'ShopV2StorageClientError';
    this.code = code;
  }
}

function fail(code) {
  throw new ShopV2StorageClientError(code);
}

function readOwnDataProperty(object, key, { optional = false } = {}) {
  try {
    if (object === null || (typeof object !== 'object' && typeof object !== 'function')) {
      fail('INVALID_REQUEST');
    }
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor) {
      if (optional) return undefined;
      fail('INVALID_REQUEST');
    }
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      fail('INVALID_REQUEST');
    }
    return descriptor.value;
  } catch (error) {
    if (error instanceof ShopV2StorageClientError) throw error;
    fail('INVALID_REQUEST');
  }
}

function requireFunction(value, code) {
  if (typeof value !== 'function') fail(code);
  return value;
}

function requireStorage(value) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    fail('STORAGE_UNAVAILABLE');
  }
  return value;
}

function requirePattern(value, pattern, code) {
  if (typeof value !== 'string' || !pattern.test(value)) fail(code);
  return value;
}

function requireKind(value) {
  if (typeof value !== 'string' || !ALLOWED_ASSET_KINDS.has(value)) {
    fail('INVALID_ASSET_KIND');
  }
  return value;
}

function requireContentType(value) {
  if (typeof value !== 'string' || !ALLOWED_CONTENT_TYPES.has(value)) {
    fail('INVALID_CONTENT_TYPE');
  }
  return value;
}

function resolveCrypto(cryptoImpl) {
  if (cryptoImpl !== undefined) return cryptoImpl;
  try {
    return typeof window !== 'undefined' ? window.crypto : undefined;
  } catch (_error) {
    return undefined;
  }
}

function generateAssetId(cryptoImpl) {
  let randomUUID;
  try {
    randomUUID = cryptoImpl?.randomUUID;
  } catch (_error) {
    fail('ASSET_ID_GENERATION_FAILED');
  }
  if (typeof randomUUID !== 'function') fail('CRYPTO_UNAVAILABLE');

  let value;
  try {
    value = Reflect.apply(randomUUID, cryptoImpl, []);
  } catch (_error) {
    fail('ASSET_ID_GENERATION_FAILED');
  }
  return requirePattern(value, ASSET_ID_PATTERN, 'INVALID_ASSET_ID');
}

function copyArrayBuffer(value) {
  try {
    const copy = ArrayBuffer.prototype.slice.call(value, 0);
    return new Uint8Array(copy);
  } catch (_error) {
    return null;
  }
}

function copyUint8Array(value) {
  try {
    return Uint8Array.prototype.slice.call(value);
  } catch (_error) {
    return null;
  }
}

async function copyBlob(value) {
  try {
    if (typeof Blob === 'undefined' || !(value instanceof Blob)) return null;
    const arrayBuffer = await Blob.prototype.arrayBuffer.call(value);
    return copyArrayBuffer(arrayBuffer);
  } catch (_error) {
    return null;
  }
}

async function snapshotAssetBytes(value) {
  let bytes = copyUint8Array(value);
  if (bytes === null) bytes = copyArrayBuffer(value);
  if (bytes === null) bytes = await copyBlob(value);
  if (bytes === null) fail('INVALID_ASSET_DATA');
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_ASSET_BYTES) {
    fail('INVALID_ASSET_SIZE');
  }
  return bytes;
}

function bytesToLowerHex(bytes) {
  let value = '';
  for (let index = 0; index < bytes.length; index += 1) {
    value += bytes[index].toString(16).padStart(2, '0');
  }
  return value;
}

async function sha256(bytes, cryptoImpl) {
  let subtle;
  let digest;
  try {
    subtle = cryptoImpl?.subtle;
    digest = subtle?.digest;
  } catch (_error) {
    fail('ASSET_DIGEST_FAILED');
  }
  if (typeof digest !== 'function') fail('CRYPTO_UNAVAILABLE');

  let result;
  try {
    result = await Reflect.apply(digest, subtle, ['SHA-256', bytes]);
  } catch (_error) {
    fail('ASSET_DIGEST_FAILED');
  }

  const digestBytes = copyArrayBuffer(result) || copyUint8Array(result);
  if (digestBytes === null || digestBytes.byteLength !== 32) {
    fail('ASSET_DIGEST_FAILED');
  }
  return bytesToLowerHex(digestBytes);
}

function readUploadResult(result) {
  try {
    return {
      metadata: readOwnDataProperty(result, 'metadata'),
      ref: readOwnDataProperty(result, 'ref'),
    };
  } catch (_error) {
    fail('STORAGE_VERIFICATION_FAILED');
  }
}

function verifyUploadResult(result, expected) {
  let snapshot;
  try {
    snapshot = readUploadResult(result);
    if (snapshot.ref !== expected.ref) fail('STORAGE_VERIFICATION_FAILED');

    const fullPath = readOwnDataProperty(snapshot.metadata, 'fullPath');
    const contentType = readOwnDataProperty(snapshot.metadata, 'contentType');
    const size = readOwnDataProperty(snapshot.metadata, 'size');
    if (
      fullPath !== expected.storagePath ||
      contentType !== expected.contentType ||
      size !== expected.sizeBytes
    ) {
      fail('STORAGE_VERIFICATION_FAILED');
    }
  } catch (_error) {
    fail('STORAGE_VERIFICATION_FAILED');
  }
}

async function bestEffortDelete(deleteObject, targetRef) {
  if (typeof deleteObject !== 'function') return;
  try {
    await Reflect.apply(deleteObject, undefined, [targetRef]);
  } catch (_error) {
    // Verification remains the authoritative failure. Cleanup is best effort.
  }
}

export async function uploadShopStagingAsset(options) {
  const storage = requireStorage(readOwnDataProperty(options, 'storage'));
  const ref = requireFunction(
    readOwnDataProperty(options, 'ref'),
    'STORAGE_UNAVAILABLE'
  );
  const uploadBytes = requireFunction(
    readOwnDataProperty(options, 'uploadBytes'),
    'STORAGE_UNAVAILABLE'
  );
  const deleteObject = readOwnDataProperty(options, 'deleteObject', { optional: true });
  if (deleteObject !== undefined && typeof deleteObject !== 'function') {
    fail('STORAGE_UNAVAILABLE');
  }

  const uid = requirePattern(
    readOwnDataProperty(options, 'uid'),
    AUTH_UID_PATTERN,
    'INVALID_AUTH_UID'
  );
  const draftId = requirePattern(
    readOwnDataProperty(options, 'draftId'),
    DRAFT_ID_PATTERN,
    'INVALID_DRAFT_ID'
  );
  const kind = requireKind(readOwnDataProperty(options, 'kind'));
  const contentType = requireContentType(
    readOwnDataProperty(options, 'contentType')
  );
  const bytes = await snapshotAssetBytes(readOwnDataProperty(options, 'data'));
  const cryptoImpl = resolveCrypto(
    readOwnDataProperty(options, 'cryptoImpl', { optional: true })
  );
  const suppliedAssetId = readOwnDataProperty(options, 'assetId', { optional: true });
  const assetId = suppliedAssetId === undefined
    ? generateAssetId(cryptoImpl)
    : requirePattern(suppliedAssetId, ASSET_ID_PATTERN, 'INVALID_ASSET_ID');
  const digest = await sha256(bytes, cryptoImpl);
  const storagePath = `shop-staging/${uid}/${draftId}/${assetId}`;

  let targetRef;
  try {
    targetRef = Reflect.apply(ref, undefined, [storage, storagePath]);
  } catch (_error) {
    fail('STORAGE_REFERENCE_FAILED');
  }
  if (targetRef === null || (typeof targetRef !== 'object' && typeof targetRef !== 'function')) {
    fail('STORAGE_REFERENCE_FAILED');
  }

  let uploadResult;
  try {
    uploadResult = await Reflect.apply(uploadBytes, undefined, [
      targetRef,
      bytes,
      { contentType },
    ]);
  } catch (_error) {
    fail('STORAGE_UPLOAD_FAILED');
  }

  try {
    verifyUploadResult(uploadResult, {
      ref: targetRef,
      storagePath,
      contentType,
      sizeBytes: bytes.byteLength,
    });
  } catch (_error) {
    await bestEffortDelete(deleteObject, targetRef);
    fail('STORAGE_VERIFICATION_FAILED');
  }

  return {
    id: assetId,
    kind,
    storagePath,
    contentType,
    sizeBytes: bytes.byteLength,
    sha256: digest,
  };
}
