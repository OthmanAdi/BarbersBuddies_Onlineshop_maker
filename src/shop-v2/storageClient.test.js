import { createHash } from 'crypto';
import {
  ShopV2StorageClientError,
  uploadShopStagingAsset,
} from './storageClient';

const ASSET_ID = '00000000-0000-4000-8000-000000000001';
const STORAGE_PATH = `shop-staging/User_123/draft-1/${ASSET_ID}`;

function createCrypto(overrides = {}) {
  const cryptoImpl = {
    randomUUID: jest.fn(() => ASSET_ID),
    subtle: {
      digest: jest.fn(async (_algorithm, input) => {
        const hash = createHash('sha256').update(Buffer.from(input)).digest();
        return hash.buffer.slice(
          hash.byteOffset,
          hash.byteOffset + hash.byteLength
        );
      }),
    },
  };
  return Object.assign(cryptoImpl, overrides);
}

function createSdk({ metadata = {}, resultRef, uploadResult } = {}) {
  const targetRef = { marker: 'exact-owned-ref' };
  const ref = jest.fn(() => targetRef);
  const uploadBytes = jest.fn(async (_ref, bytes, uploadMetadata) => (
    uploadResult || {
      ref: resultRef === undefined ? targetRef : resultRef,
      metadata: {
        fullPath: STORAGE_PATH,
        contentType: uploadMetadata.contentType,
        size: bytes.byteLength,
        ...metadata,
      },
    }
  ));
  const deleteObject = jest.fn(async () => undefined);
  return { targetRef, ref, uploadBytes, deleteObject };
}

function createOptions(overrides = {}) {
  const sdk = overrides.sdk || createSdk();
  const options = {
    storage: {},
    ref: sdk.ref,
    uploadBytes: sdk.uploadBytes,
    deleteObject: sdk.deleteObject,
    uid: 'User_123',
    draftId: 'draft-1',
    assetId: ASSET_ID,
    kind: 'hero',
    contentType: 'image/webp',
    data: new Uint8Array([0, 1, 2, 254, 255]),
    cryptoImpl: createCrypto(),
    ...overrides,
  };
  delete options.sdk;
  return { options, sdk };
}

async function expectCode(promise, code) {
  let error;
  try {
    await promise;
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(ShopV2StorageClientError);
  expect(error).toMatchObject({ code });
  expect(error.message).not.toMatch(/secret|firebase exploded|raw failure/i);
  return error;
}

describe('shop v2 staged asset storage client', () => {
  test('uploads an exact byte snapshot and returns only the server descriptor', async () => {
    const { options, sdk } = createOptions();
    const original = options.data;
    const expectedHash = createHash('sha256').update(Buffer.from(original)).digest('hex');
    const pending = uploadShopStagingAsset(options);
    original.fill(9);

    await expect(pending).resolves.toEqual({
      id: ASSET_ID,
      kind: 'hero',
      storagePath: STORAGE_PATH,
      contentType: 'image/webp',
      sizeBytes: 5,
      sha256: expectedHash,
    });

    expect(sdk.ref).toHaveBeenCalledWith(options.storage, STORAGE_PATH);
    expect(sdk.uploadBytes).toHaveBeenCalledTimes(1);
    const [uploadedRef, uploadedBytes, metadata] = sdk.uploadBytes.mock.calls[0];
    expect(uploadedRef).toBe(sdk.targetRef);
    expect(Array.from(uploadedBytes)).toEqual([0, 1, 2, 254, 255]);
    expect(metadata).toEqual({ contentType: 'image/webp' });
    expect(Object.keys(await pending)).toEqual([
      'id',
      'kind',
      'storagePath',
      'contentType',
      'sizeBytes',
      'sha256',
    ]);
    expect(sdk.deleteObject).not.toHaveBeenCalled();
  });

  test.each(['image/avif', 'image/jpeg', 'image/png', 'image/webp'])(
    'accepts the exact server-supported MIME type %s',
    async (contentType) => {
      const sdk = createSdk();
      const { options } = createOptions({ contentType, sdk });
      sdk.uploadBytes.mockImplementation(async (targetRef, bytes) => ({
        ref: targetRef,
        metadata: { fullPath: STORAGE_PATH, contentType, size: bytes.byteLength },
      }));
      await expect(uploadShopStagingAsset(options)).resolves.toMatchObject({ contentType });
    }
  );

  test.each(['logo', 'hero', 'gallery'])(
    'accepts the explicit asset kind %s',
    async (kind) => {
      const { options } = createOptions({ kind });
      await expect(uploadShopStagingAsset(options)).resolves.toMatchObject({ kind });
    }
  );

  test('accepts an ArrayBuffer and hashes only its exact bytes', async () => {
    const value = new Uint8Array([7, 8, 9]).buffer;
    const { options } = createOptions({ data: value });
    const result = await uploadShopStagingAsset(options);
    expect(result.sizeBytes).toBe(3);
    expect(result.sha256).toBe(createHash('sha256').update(Buffer.from([7, 8, 9])).digest('hex'));
  });

  test('accepts a Blob without consulting a file name', async () => {
    if (typeof Blob === 'undefined' || typeof Blob.prototype.arrayBuffer !== 'function') return;
    const value = new Blob([new Uint8Array([4, 5, 6])], { type: 'image/png' });
    Object.defineProperty(value, 'name', {
      get() {
        throw new Error('secret file name getter');
      },
    });
    const sdk = createSdk();
    const { options } = createOptions({ data: value, contentType: 'image/png', sdk });
    sdk.uploadBytes.mockImplementation(async (targetRef, bytes) => ({
      ref: targetRef,
      metadata: { fullPath: STORAGE_PATH, contentType: 'image/png', size: bytes.byteLength },
    }));
    await expect(uploadShopStagingAsset(options)).resolves.toMatchObject({ sizeBytes: 3 });
  });

  test('generates a strict UUID asset ID when none is supplied', async () => {
    const { options, sdk } = createOptions({ assetId: undefined });
    delete options.assetId;
    await expect(uploadShopStagingAsset(options)).resolves.toMatchObject({ id: ASSET_ID });
    expect(options.cryptoImpl.randomUUID).toHaveBeenCalledTimes(1);
    expect(sdk.ref).toHaveBeenCalledWith(options.storage, STORAGE_PATH);
  });

  test.each([
    ['', 'INVALID_AUTH_UID', 'uid'],
    ['../owner', 'INVALID_AUTH_UID', 'uid'],
    ['owner/name', 'INVALID_AUTH_UID', 'uid'],
    [' owner', 'INVALID_AUTH_UID', 'uid'],
    ['', 'INVALID_DRAFT_ID', 'draftId'],
    ['Draft-1', 'INVALID_DRAFT_ID', 'draftId'],
    ['draft/1', 'INVALID_DRAFT_ID', 'draftId'],
    ['../draft', 'INVALID_DRAFT_ID', 'draftId'],
  ])('rejects unsafe path segment %p for %s', async (value, code, field) => {
    const { options, sdk } = createOptions({ [field]: value });
    await expectCode(uploadShopStagingAsset(options), code);
    expect(sdk.ref).not.toHaveBeenCalled();
  });

  test.each([
    'asset-logo',
    '00000000-0000-1000-8000-000000000001',
    '00000000-0000-4000-7000-000000000001',
    '00000000-0000-4000-8000-000000000001/child',
    '00000000-0000-4000-8000-000000000001.PNG',
  ])('rejects non-opaque asset ID %p', async (assetId) => {
    const { options, sdk } = createOptions({ assetId });
    await expectCode(uploadShopStagingAsset(options), 'INVALID_ASSET_ID');
    expect(sdk.ref).not.toHaveBeenCalled();
  });

  test.each([
    'image/gif',
    'image/svg+xml',
    'image/png; charset=utf-8',
    'IMAGE/PNG',
    '',
  ])('rejects unsupported or non-exact MIME type %p', async (contentType) => {
    const { options, sdk } = createOptions({ contentType });
    await expectCode(uploadShopStagingAsset(options), 'INVALID_CONTENT_TYPE');
    expect(sdk.ref).not.toHaveBeenCalled();
  });

  test.each(['avatar', 'Gallery', '', null])('rejects invalid asset kind %p', async (kind) => {
    const { options, sdk } = createOptions({ kind });
    await expectCode(uploadShopStagingAsset(options), 'INVALID_ASSET_KIND');
    expect(sdk.ref).not.toHaveBeenCalled();
  });

  test.each([
    [new Uint8Array(0), 'INVALID_ASSET_SIZE'],
    [new Uint8Array((10 * 1024 * 1024) + 1), 'INVALID_ASSET_SIZE'],
    ['not bytes', 'INVALID_ASSET_DATA'],
    [new DataView(new ArrayBuffer(3)), 'INVALID_ASSET_DATA'],
    [{ byteLength: 3 }, 'INVALID_ASSET_DATA'],
  ])('rejects invalid data without calling Firebase', async (data, code) => {
    const { options, sdk } = createOptions({ data });
    await expectCode(uploadShopStagingAsset(options), code);
    expect(sdk.ref).not.toHaveBeenCalled();
    expect(sdk.uploadBytes).not.toHaveBeenCalled();
  });

  test('does not execute request property getters', async () => {
    const { options } = createOptions();
    let getterCalls = 0;
    Object.defineProperty(options, 'uid', {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error('secret getter');
      },
    });
    await expectCode(uploadShopStagingAsset(options), 'INVALID_REQUEST');
    expect(getterCalls).toBe(0);
  });

  test('sanitizes randomUUID failures and invalid generator output', async () => {
    const throwing = createCrypto();
    throwing.randomUUID.mockImplementation(() => {
      throw new Error('secret randomUUID failure');
    });
    const first = createOptions({ assetId: undefined, cryptoImpl: throwing });
    delete first.options.assetId;
    await expectCode(
      uploadShopStagingAsset(first.options),
      'ASSET_ID_GENERATION_FAILED'
    );

    const invalid = createCrypto();
    invalid.randomUUID.mockReturnValue('../secret');
    const second = createOptions({ assetId: undefined, cryptoImpl: invalid });
    delete second.options.assetId;
    await expectCode(uploadShopStagingAsset(second.options), 'INVALID_ASSET_ID');
  });

  test('sanitizes unavailable, rejected, and malformed SHA-256 operations', async () => {
    const unavailable = createOptions({ cryptoImpl: {} });
    await expectCode(uploadShopStagingAsset(unavailable.options), 'CRYPTO_UNAVAILABLE');

    const rejectedCrypto = createCrypto();
    rejectedCrypto.subtle.digest.mockRejectedValue(new Error('secret digest failure'));
    const rejected = createOptions({ cryptoImpl: rejectedCrypto });
    await expectCode(uploadShopStagingAsset(rejected.options), 'ASSET_DIGEST_FAILED');

    const malformedCrypto = createCrypto();
    malformedCrypto.subtle.digest.mockResolvedValue(new Uint8Array(31));
    const malformed = createOptions({ cryptoImpl: malformedCrypto });
    await expectCode(uploadShopStagingAsset(malformed.options), 'ASSET_DIGEST_FAILED');
  });

  test('sanitizes reference and upload failures', async () => {
    const refSdk = createSdk();
    refSdk.ref.mockImplementation(() => {
      throw new Error('secret Firebase exploded');
    });
    const first = createOptions({ sdk: refSdk });
    await expectCode(uploadShopStagingAsset(first.options), 'STORAGE_REFERENCE_FAILED');

    const uploadSdk = createSdk();
    uploadSdk.uploadBytes.mockRejectedValue(new Error('raw failure from Firebase'));
    const second = createOptions({ sdk: uploadSdk });
    await expectCode(uploadShopStagingAsset(second.options), 'STORAGE_UPLOAD_FAILED');
    expect(uploadSdk.deleteObject).not.toHaveBeenCalled();
  });

  test('validates hostile SDK proxies without invoking property getters', async () => {
    let getCalls = 0;
    const sdk = createSdk();
    const metadata = new Proxy({
      fullPath: STORAGE_PATH,
      contentType: 'image/webp',
      size: 5,
    }, {
      get() {
        getCalls += 1;
        throw new Error('secret metadata get');
      },
    });
    const result = new Proxy({ ref: sdk.targetRef, metadata }, {
      get(...trapArgs) {
        const property = trapArgs[1];
        // Promise resolution is required by JavaScript to inspect `then` on
        // every object returned from an async boundary. Keep that protocol
        // lookup inert so this test measures application property reads.
        if (property === 'then') return undefined;
        getCalls += 1;
        throw new Error('secret result get');
      },
    });
    sdk.uploadBytes.mockResolvedValue(result);
    const { options } = createOptions({ sdk });

    await expect(uploadShopStagingAsset(options)).resolves.toMatchObject({
      storagePath: STORAGE_PATH,
    });
    expect(getCalls).toBe(0);
  });

  test('rejects an upload-result accessor without executing it and cleans only the owned ref', async () => {
    let getterCalls = 0;
    const sdk = createSdk();
    const result = { ref: sdk.targetRef };
    Object.defineProperty(result, 'metadata', {
      get() {
        getterCalls += 1;
        throw new Error('secret result getter');
      },
    });
    sdk.uploadBytes.mockResolvedValue(result);
    const { options } = createOptions({ sdk });

    await expectCode(uploadShopStagingAsset(options), 'STORAGE_VERIFICATION_FAILED');
    expect(getterCalls).toBe(0);
    expect(sdk.deleteObject).toHaveBeenCalledTimes(1);
    expect(sdk.deleteObject).toHaveBeenCalledWith(sdk.targetRef);
  });

  test.each([
    { fullPath: 'shop-staging/User_123/draft-1/wrong', contentType: 'image/webp', size: 5 },
    { fullPath: STORAGE_PATH, contentType: 'image/png', size: 5 },
    { fullPath: STORAGE_PATH, contentType: 'image/webp', size: 4 },
  ])('cleans the exact ref after mismatched upload metadata %#', async (metadata) => {
    const sdk = createSdk({ metadata });
    const { options } = createOptions({ sdk });
    await expectCode(uploadShopStagingAsset(options), 'STORAGE_VERIFICATION_FAILED');
    expect(sdk.deleteObject).toHaveBeenCalledWith(sdk.targetRef);
  });

  test('cleans after returned-ref mismatch and preserves the verification error if cleanup fails', async () => {
    const sdk = createSdk({ resultRef: { marker: 'forged-ref' } });
    sdk.deleteObject.mockRejectedValue(new Error('secret cleanup failure'));
    const { options } = createOptions({ sdk });

    await expectCode(uploadShopStagingAsset(options), 'STORAGE_VERIFICATION_FAILED');
    expect(sdk.deleteObject).toHaveBeenCalledTimes(1);
    expect(sdk.deleteObject).toHaveBeenCalledWith(sdk.targetRef);
  });

  test('works without a cleanup primitive while retaining a stable verification failure', async () => {
    const sdk = createSdk({ metadata: { size: 999 } });
    const { options } = createOptions({ sdk });
    delete options.deleteObject;
    await expectCode(uploadShopStagingAsset(options), 'STORAGE_VERIFICATION_FAILED');
  });
});
