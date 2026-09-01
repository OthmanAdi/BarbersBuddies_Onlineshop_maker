const fs = require('node:fs');
const path = require('node:path');
const { after, before, beforeEach, describe, test } = require('node:test');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  deleteObject,
  getBytes,
  listAll,
  ref,
  uploadBytes,
} = require('firebase/storage');

const PROJECT_ID = 'demo-barbersbuddies';
const EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
const MAX_STAGING_IMAGE_BYTES = 10 * 1024 * 1024;

if (!EMULATOR_HOST) {
  throw new Error(
    'FIREBASE_STORAGE_EMULATOR_HOST is not set. Run this test through Firebase emulators:exec for the disposable demo-barbersbuddies project.',
  );
}

const hostSeparator = EMULATOR_HOST.lastIndexOf(':');
const emulatorHost = EMULATOR_HOST.slice(0, hostSeparator);
const emulatorPort = Number(EMULATOR_HOST.slice(hostSeparator + 1));

if (!emulatorHost || !Number.isInteger(emulatorPort)) {
  throw new Error(`Invalid FIREBASE_STORAGE_EMULATOR_HOST: ${EMULATOR_HOST}`);
}

const rules = fs.readFileSync(path.join(__dirname, '..', 'storage.rules'), 'utf8');

let testEnv;

function storageFor(uid) {
  return testEnv.authenticatedContext(uid).storage();
}

function anonymousStorage() {
  return testEnv.unauthenticatedContext().storage();
}

async function upload(storage, objectPath, bytes = new Uint8Array([1]), contentType = 'image/png') {
  return uploadBytes(ref(storage, objectPath), bytes, { contentType });
}

async function seedObjects(objects) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const storage = context.storage();
    await Promise.all(
      objects.map(({ objectPath, bytes, contentType }) =>
        upload(storage, objectPath, bytes, contentType),
      ),
    );
  });
}

describe('Cloud Storage asset policy', { concurrency: false }, () => {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      storage: {
        host: emulatorHost,
        port: emulatorPort,
        rules,
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearStorage();
  });

  after(async () => {
    if (testEnv) {
      await testEnv.clearStorage();
      await testEnv.cleanup();
    }
  });

  test('profile image objects are readable and writable only by their owner', async () => {
    const owner = storageFor('owner-a');
    const otherUser = storageFor('owner-b');
    const objectPath = 'profile_images/owner-a';

    await assertSucceeds(upload(owner, objectPath));
    await assertSucceeds(
      upload(owner, objectPath, new Uint8Array([2]), 'image/webp'),
    );
    await assertSucceeds(getBytes(ref(owner, objectPath)));
    await assertFails(getBytes(ref(otherUser, objectPath)));
    await assertFails(getBytes(ref(anonymousStorage(), objectPath)));
    await assertFails(upload(otherUser, objectPath));
    await assertFails(upload(anonymousStorage(), objectPath));
    await assertFails(deleteObject(ref(otherUser, objectPath)));
    await assertSucceeds(deleteObject(ref(owner, objectPath)));
  });

  test('profile image directories cannot be listed', async () => {
    await seedObjects([
      { objectPath: 'profile_images/owner-a', contentType: 'image/png' },
    ]);

    await assertFails(listAll(ref(storageFor('owner-a'), 'profile_images')));
    await assertFails(listAll(ref(anonymousStorage(), 'profile_images')));
  });

  test('staging images allow exact owner object operations without directory listing', async () => {
    const owner = storageFor('owner-a');
    const objectPath = 'shop-staging/owner-a/draft-a/hero';

    await assertSucceeds(upload(owner, objectPath));
    await assertSucceeds(getBytes(ref(owner, objectPath)));
    await assertSucceeds(upload(owner, objectPath, new Uint8Array([2]), 'image/webp'));
    await assertFails(listAll(ref(owner, 'shop-staging/owner-a/draft-a')));
    await assertSucceeds(deleteObject(ref(owner, objectPath)));
  });

  test('anonymous and cross-owner callers cannot access staging objects', async () => {
    const objectPath = 'shop-staging/owner-a/draft-a/logo';
    await seedObjects([{ objectPath, contentType: 'image/png' }]);

    for (const storage of [anonymousStorage(), storageFor('owner-b')]) {
      await assertFails(getBytes(ref(storage, objectPath)));
      await assertFails(upload(storage, objectPath));
      await assertFails(deleteObject(ref(storage, objectPath)));
    }
  });

  test('staging writes accept image MIME types up to and including 10 MiB', async () => {
    const owner = storageFor('owner-a');
    await assertSucceeds(
      upload(
        owner,
        'shop-staging/owner-a/draft-a/maximum-image',
        new Uint8Array(MAX_STAGING_IMAGE_BYTES),
        'image/jpeg',
      ),
    );
  });

  test('staging writes reject files larger than 10 MiB', async () => {
    await assertFails(
      upload(
        storageFor('owner-a'),
        'shop-staging/owner-a/draft-a/oversized-image',
        new Uint8Array(MAX_STAGING_IMAGE_BYTES + 1),
        'image/jpeg',
      ),
    );
  });

  test('staging writes reject non-image and missing MIME types', async () => {
    const owner = storageFor('owner-a');

    await assertFails(
      upload(
        owner,
        'shop-staging/owner-a/draft-a/not-an-image',
        new Uint8Array([1]),
        'text/plain',
      ),
    );
    await assertFails(
      uploadBytes(
        ref(owner, 'shop-staging/owner-a/draft-a/missing-type'),
        new Uint8Array([1]),
      ),
    );
  });

  test('staging rejects shallower, deeper, and mismatched-owner path shapes', async () => {
    const owner = storageFor('owner-a');

    for (const objectPath of [
      'shop-staging/owner-a/draft-a',
      'shop-staging/owner-a/draft-a/asset-a/original.png',
      'shop-staging/owner-b/draft-a/asset-a',
    ]) {
      await assertFails(upload(owner, objectPath));
    }
  });

  test('public assets allow object downloads for everyone but never listing or client writes', async () => {
    const objectPath = 'shop-public/shop-a/hero';
    await seedObjects([{ objectPath, contentType: 'image/png' }]);

    await assertSucceeds(getBytes(ref(anonymousStorage(), objectPath)));
    await assertSucceeds(getBytes(ref(storageFor('owner-a'), objectPath)));
    await assertFails(listAll(ref(anonymousStorage(), 'shop-public/shop-a')));
    await assertFails(listAll(ref(storageFor('owner-a'), 'shop-public/shop-a')));
    await assertFails(upload(storageFor('owner-a'), objectPath));
    await assertFails(deleteObject(ref(storageFor('owner-a'), objectPath)));
  });

  test('legacy shop and employee-registration paths remain denied', async () => {
    const legacyPaths = [
      'shops/owner-a/logo.png',
      'shops/shop-a/employees/employee-a/profile.png',
      'shops/shop-a/employee-registration/token/portrait.png',
    ];

    await seedObjects(
      legacyPaths.map((objectPath) => ({ objectPath, contentType: 'image/png' })),
    );

    for (const objectPath of legacyPaths) {
      await assertFails(getBytes(ref(anonymousStorage(), objectPath)));
      await assertFails(getBytes(ref(storageFor('owner-a'), objectPath)));
      await assertFails(upload(storageFor('owner-a'), objectPath));
      await assertFails(deleteObject(ref(storageFor('owner-a'), objectPath)));
    }
  });

  test('unmatched paths are denied to anonymous and authenticated callers', async () => {
    const objectPath = 'miscellaneous/private.txt';
    await seedObjects([{ objectPath, contentType: 'text/plain' }]);

    for (const storage of [anonymousStorage(), storageFor('owner-a')]) {
      await assertFails(getBytes(ref(storage, objectPath)));
      await assertFails(upload(storage, objectPath, new Uint8Array([1]), 'text/plain'));
      await assertFails(deleteObject(ref(storage, objectPath)));
    }
  });
});
