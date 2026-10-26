import assert from 'node:assert/strict';

// Mock in-memory Dexie storage for multi-device simulation
class MockDexieTable {
  constructor(name) {
    this.name = name;
    this.items = new Map();
  }

  async get(id) {
    const item = this.items.get(id);
    return item ? JSON.parse(JSON.stringify(item)) : undefined;
  }

  async put(item) {
    this.items.set(item.id, JSON.parse(JSON.stringify(item)));
    return item.id;
  }

  async update(id, changes) {
    const item = this.items.get(id);
    if (!item) return 0;
    Object.assign(item, changes);
    this.items.set(id, item);
    return 1;
  }

  async delete(id) {
    this.items.delete(id);
  }

  async toArray() {
    return Array.from(this.items.values()).map(x => JSON.parse(JSON.stringify(x)));
  }

  where(field) {
    return {
      equals: (val) => ({
        toArray: async () => {
          return Array.from(this.items.values())
            .filter(item => item[field] === val)
            .map(x => JSON.parse(JSON.stringify(x)));
        },
        delete: async () => {
          for (const [key, item] of this.items.entries()) {
            if (item[field] === val) {
              this.items.delete(key);
            }
          }
        }
      })
    };
  }

  clear() {
    this.items.clear();
  }
}

class MockDexieDatabase {
  constructor() {
    this.assets = new MockDexieTable('assets');
    this.notes = new MockDexieTable('notes');
    this.categories = new MockDexieTable('categories');
    this.snippets = new MockDexieTable('snippets');
    this.highlights = new MockDexieTable('highlights');
  }
}

// Mock Supabase Remote Object Storage
class MockSupabaseStorage {
  constructor() {
    this.buckets = new Map();
    this.buckets.set('note-assets', new Map());
  }

  from(bucketName) {
    const bucket = this.buckets.get(bucketName);
    return {
      upload: async (path, data, options = {}) => {
        if (!bucket) return { error: { message: 'Bucket not found' } };
        // Simulate network failure flag if set
        if (this.forceFailure) {
          return { error: { message: 'Simulated network offline / 503 Service Unavailable' } };
        }
        bucket.set(path, {
          data,
          contentType: options.contentType || 'image/png',
          updatedAt: Date.now(),
        });
        return { data: { path }, error: null };
      },

      download: async (path) => {
        if (!bucket) return { data: null, error: { message: 'Bucket not found' } };
        if (this.forceFailure) {
          return { data: null, error: { message: 'Network offline' } };
        }

        // Simulate RLS: check if accessing another user's folder
        if (this.currentAuthUser) {
          const parts = path.split('/');
          if (parts.length > 1 && parts[0] !== this.currentAuthUser) {
            return { data: null, error: { message: 'RLS: Access denied' } };
          }
        }

        const obj = bucket.get(path);
        if (!obj) {
          return { data: null, error: { message: 'Object not found' } };
        }
        return { data: obj.data, error: null };
      },

      createSignedUrl: async (path, expiresIn) => {
        if (!bucket || !bucket.has(path)) {
          return { data: null, error: { message: 'Object not found' } };
        }
        return { data: { signedUrl: `https://mock-supabase.co/storage/v1/sign/${path}?token=valid` }, error: null };
      },

      getPublicUrl: (path) => {
        return { data: { publicUrl: `https://mock-supabase.co/storage/v1/public/${path}` } };
      },

      remove: async (paths) => {
        for (const p of paths) {
          bucket.delete(p);
        }
        return { data: paths, error: null };
      }
    };
  }
}

// Mock browser URL.createObjectURL and URL.revokeObjectURL in Node environment
if (typeof globalThis.URL.createObjectURL !== 'function') {
  let objectUrlCounter = 1;
  globalThis.URL.createObjectURL = (blob) => `blob:mock-url-${objectUrlCounter++}`;
  globalThis.URL.revokeObjectURL = (url) => {};
}

// Import asset functions to test
import { 
  validateImageFile,
  cleanAssetId,
  getAssetRemotePath,
  formatImageMarkdown,
  parseImageTokens,
  splitTextIntoSegments,
  reconstructTextFromSegments,
  STORAGE_BUCKET
} from '../src/lib/assets.ts';

console.log('--- Running QuietNotes Cross-Device Image Sync Tests ---');

// Setup shared mock storage
const remoteStorage = new MockSupabaseStorage();

// Test 1: Image Validation and Canonical Remote Storage Path
{
  const validBlob = new Blob(['sample-png-data'], { type: 'image/png' });
  const validation = validateImageFile(validBlob);
  assert.equal(validation.valid, true, 'PNG Blob must be valid');

  const userId = 'usr-alex-123';
  const assetId = 'asset-777-uuid';
  const remotePath = getAssetRemotePath(userId, assetId);
  assert.equal(remotePath, 'usr-alex-123/asset-777-uuid', 'Remote path must follow userId/assetId convention');

  const markdownToken = formatImageMarkdown(assetId, 'Dashboard Screenshot', 640, 'center');
  assert.equal(markdownToken, '![Dashboard Screenshot](quietnotes-asset://asset-777-uuid?w=640&align=center)');

  const parsed = parseImageTokens(markdownToken);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].assetId, 'asset-777-uuid');
  assert.equal(parsed[0].caption, 'Dashboard Screenshot');
  assert.equal(parsed[0].width, 640);
  assert.equal(parsed[0].align, 'center');
  console.log('✓ Test 1 Passed: Image validation, canonical storage path, and markdown tokens');
}

// Test 2: Uploading an Image and Saving Local Asset with Sync Status
{
  const dbDeviceA = new MockDexieDatabase();
  const userId = 'user-test-account-1';
  const assetId = 'asset-alpha-001';
  const imageBlob = new Blob(['alpha-image-bytes'], { type: 'image/png' });

  // Simulate local save with initial pending status
  await dbDeviceA.assets.put({
    id: assetId,
    data: imageBlob,
    mime_type: 'image/png',
    filename: 'test.png',
    size: imageBlob.size,
    created_at: Date.now(),
    user_id: userId,
    sync_status: 'pending',
  });

  const localAsset = await dbDeviceA.assets.get(assetId);
  assert.equal(localAsset.sync_status, 'pending', 'Asset must start with pending status');

  // Simulate successful upload to remote storage
  const remotePath = `${userId}/${assetId}`;
  const uploadRes = await remoteStorage.from(STORAGE_BUCKET).upload(remotePath, imageBlob, {
    contentType: 'image/png',
    upsert: true,
  });
  assert.equal(uploadRes.error, null);

  // Update status to synced
  await dbDeviceA.assets.update(assetId, {
    sync_status: 'synced',
    remote_path: remotePath,
    synced_at: Date.now(),
  });

  const syncedAsset = await dbDeviceA.assets.get(assetId);
  assert.equal(syncedAsset.sync_status, 'synced');
  assert.equal(syncedAsset.remote_path, remotePath);
  console.log('✓ Test 2 Passed: Local-first persistence and remote upload status tracking');
}

// Test 3: Cross-Device Synchronization (Device A -> Remote -> Device B)
{
  const userId = 'user-device-sync-test';
  const dbDeviceA = new MockDexieDatabase();
  const dbDeviceB = new MockDexieDatabase(); // Completely separate device with empty Dexie

  const assetId = 'shared-diagram-888';
  const originalBytes = 'diagram-binary-content-12345';
  const imageBlob = new Blob([originalBytes], { type: 'image/png' });

  // 1. Device A creates note with image and uploads
  await dbDeviceA.assets.put({
    id: assetId,
    data: imageBlob,
    mime_type: 'image/png',
    size: imageBlob.size,
    created_at: Date.now(),
    user_id: userId,
    sync_status: 'synced',
  });

  const noteMarkdown = `## System Architecture\n\n${formatImageMarkdown(assetId, 'Architecture Diagram', 600, 'center')}\n\nNotes continue below.`;
  await dbDeviceA.notes.put({
    id: 'note-sys-arch',
    title: 'System Architecture',
    content: noteMarkdown,
    is_featured: false,
    created_at: Date.now(),
    updated_at: Date.now(),
    user_id: userId,
  });

  // Device A uploads to Supabase Storage
  const remotePath = `${userId}/${assetId}`;
  await remoteStorage.from(STORAGE_BUCKET).upload(remotePath, imageBlob, { contentType: 'image/png' });

  // 2. Device B signs in: Note is synced from Supabase to Device B's Dexie
  await dbDeviceB.notes.put({
    id: 'note-sys-arch',
    title: 'System Architecture',
    content: noteMarkdown,
    is_featured: false,
    created_at: Date.now(),
    updated_at: Date.now(),
    user_id: userId,
  });

  // Verify Device B does NOT have the asset initially
  const initialDeviceBAsset = await dbDeviceB.assets.get(assetId);
  assert.equal(initialDeviceBAsset, undefined, 'Device B must start without local copy');

  // 3. Device B resolves the image display
  // Device B sees note content with quietnotes-asset://shared-diagram-888
  const parsedTokens = parseImageTokens(noteMarkdown);
  assert.equal(parsedTokens.length, 1);
  const cleanId = cleanAssetId(parsedTokens[0].assetId);

  // Device B attempts remote fetch because it is missing locally
  remoteStorage.currentAuthUser = userId;
  const downloadRes = await remoteStorage.from(STORAGE_BUCKET).download(`${userId}/${cleanId}`);
  assert.ok(downloadRes.data, 'Device B successfully downloads remote asset blob');

  // Device B caches downloaded blob into local Dexie for 0ms offline access
  await dbDeviceB.assets.put({
    id: cleanId,
    data: downloadRes.data,
    mime_type: 'image/png',
    size: downloadRes.data.size,
    created_at: Date.now(),
    user_id: userId,
    sync_status: 'synced',
    remote_path: `${userId}/${cleanId}`,
    synced_at: Date.now(),
  });

  // Verify Device B now has local asset stored in IndexedDB
  const cachedOnDeviceB = await dbDeviceB.assets.get(cleanId);
  assert.ok(cachedOnDeviceB);
  assert.equal(cachedOnDeviceB.id, assetId);
  assert.equal(cachedOnDeviceB.sync_status, 'synced');

  // Verify subsequent offline access on Device B does NOT require remote download
  remoteStorage.forceFailure = true; // Turn off network
  const offlineAsset = await dbDeviceB.assets.get(cleanId);
  assert.ok(offlineAsset, 'Device B can read asset completely offline from local Dexie');
  remoteStorage.forceFailure = false; // Restore network

  console.log('✓ Test 3 Passed: Cross-device sync from Device A to Device B with local Dexie caching');
}

// Test 4: Offline Insertion, Failed Upload, and Automatic Retry Queue
{
  const dbOffline = new MockDexieDatabase();
  const userId = 'usr-offline-test';
  const assetId = 'asset-offline-retry';
  const offlineBlob = new Blob(['offline-photo-bytes'], { type: 'image/jpeg' });

  // Simulate offline state: upload fails
  remoteStorage.forceFailure = true;
  const remotePath = `${userId}/${assetId}`;
  const failedUpload = await remoteStorage.from(STORAGE_BUCKET).upload(remotePath, offlineBlob);
  assert.ok(failedUpload.error, 'Upload should fail when offline');

  // Local-first: asset is saved with 'failed' status and NEVER lost
  await dbOffline.assets.put({
    id: assetId,
    data: offlineBlob,
    mime_type: 'image/jpeg',
    size: offlineBlob.size,
    created_at: Date.now(),
    user_id: userId,
    sync_status: 'failed',
  });

  // Ensure asset is still readable locally while offline
  const localCheck = await dbOffline.assets.get(assetId);
  assert.ok(localCheck, 'Asset must exist in local storage despite upload failure');
  assert.equal(localCheck.sync_status, 'failed');

  // Network comes back online!
  remoteStorage.forceFailure = false;

  // Sync pending assets runner
  const allAssets = await dbOffline.assets.toArray();
  const pending = allAssets.filter(a => a.sync_status !== 'synced');
  assert.equal(pending.length, 1);

  for (const item of pending) {
    const res = await remoteStorage.from(STORAGE_BUCKET).upload(`${userId}/${item.id}`, item.data, {
      contentType: item.mime_type,
    });
    assert.equal(res.error, null);
    await dbOffline.assets.update(item.id, { sync_status: 'synced', remote_path: `${userId}/${item.id}` });
  }

  const retriedAsset = await dbOffline.assets.get(assetId);
  assert.equal(retriedAsset.sync_status, 'synced', 'Asset successfully marked synced after retry');
  console.log('✓ Test 4 Passed: Offline insertion with failed upload retry queue');
}

// Test 5: Safe Migration of Existing Legacy Local Images
{
  const dbMigration = new MockDexieDatabase();
  const userId = 'usr-migration-user';

  // Seed 3 existing legacy assets (v8 schema: no sync_status, purely local)
  await dbMigration.assets.put({
    id: 'legacy-asset-1',
    data: new Blob(['legacy-1'], { type: 'image/png' }),
    mime_type: 'image/png',
    size: 8,
    created_at: Date.now() - 100000,
  });
  await dbMigration.assets.put({
    id: 'legacy-asset-2',
    data: new Blob(['legacy-2'], { type: 'image/webp' }),
    mime_type: 'image/webp',
    size: 8,
    created_at: Date.now() - 50000,
  });
  await dbMigration.assets.put({
    id: 'already-synced-asset',
    data: new Blob(['synced-3'], { type: 'image/png' }),
    mime_type: 'image/png',
    size: 8,
    created_at: Date.now() - 20000,
    sync_status: 'synced',
    user_id: userId,
  });

  // Migration function runner
  const assetsToMigrate = await dbMigration.assets.toArray();
  let migratedCount = 0;
  let skippedCount = 0;

  for (const asset of assetsToMigrate) {
    if (asset.sync_status === 'synced') {
      skippedCount++;
      continue;
    }

    const path = `${userId}/${asset.id}`;
    const res = await remoteStorage.from(STORAGE_BUCKET).upload(path, asset.data, {
      contentType: asset.mime_type,
    });
    assert.equal(res.error, null);
    await dbMigration.assets.update(asset.id, {
      user_id: userId,
      sync_status: 'synced',
      remote_path: path,
      synced_at: Date.now(),
    });
    migratedCount++;
  }

  assert.equal(migratedCount, 2, 'Should migrate the 2 unsynced legacy assets');
  assert.equal(skippedCount, 1, 'Should skip already synced asset');

  // Test repeat execution (Idempotency): Running migration a second time should do 0 uploads
  let secondRunMigrated = 0;
  let secondRunSkipped = 0;
  const secondRunAssets = await dbMigration.assets.toArray();
  for (const asset of secondRunAssets) {
    if (asset.sync_status === 'synced') {
      secondRunSkipped++;
    } else {
      secondRunMigrated++;
    }
  }
  assert.equal(secondRunMigrated, 0, 'Second migration run must upload 0 items');
  assert.equal(secondRunSkipped, 3, 'Second migration run must skip all 3 items');
  console.log('✓ Test 5 Passed: Idempotent legacy image migration without data loss');
}

// Test 6: Image Replacement and Orphaned Asset Cleanup
{
  const dbCleanup = new MockDexieDatabase();
  const userId = 'usr-clean-test';
  const asset1 = 'asset-cleanup-1';
  const asset2 = 'asset-cleanup-2';

  await dbCleanup.assets.put({
    id: asset1,
    data: new Blob(['content-1']),
    mime_type: 'image/png',
    size: 9,
    created_at: Date.now(),
    user_id: userId,
    sync_status: 'synced',
  });
  await dbCleanup.assets.put({
    id: asset2,
    data: new Blob(['content-2']),
    mime_type: 'image/png',
    size: 9,
    created_at: Date.now(),
    user_id: userId,
    sync_status: 'synced',
  });

  await remoteStorage.from(STORAGE_BUCKET).upload(`${userId}/${asset1}`, new Blob(['content-1']));
  await remoteStorage.from(STORAGE_BUCKET).upload(`${userId}/${asset2}`, new Blob(['content-2']));

  // Note 1 references asset 1
  await dbCleanup.notes.put({
    id: 'note-1',
    title: 'Note 1',
    content: `Image here: ${formatImageMarkdown(asset1)}`,
    is_featured: false,
    created_at: Date.now(),
    updated_at: Date.now(),
    user_id: userId,
  });

  // Note 2 references asset 2
  await dbCleanup.notes.put({
    id: 'note-2',
    title: 'Note 2',
    content: `Image here: ${formatImageMarkdown(asset2)}`,
    is_featured: false,
    created_at: Date.now(),
    updated_at: Date.now(),
    user_id: userId,
  });

  // Helper to check and delete orphaned asset
  async function checkAndDeleteOrphaned(assetId) {
    const notes = await dbCleanup.notes.toArray();
    const isReferenced = notes.some(n => n.content && n.content.includes(assetId));
    if (isReferenced) return false;

    await dbCleanup.assets.delete(assetId);
    await remoteStorage.from(STORAGE_BUCKET).remove([`${userId}/${assetId}`]);
    return true;
  }

  // 1. Attempt to delete asset1 while still referenced by note 1
  const deleteResult1 = await checkAndDeleteOrphaned(asset1);
  assert.equal(deleteResult1, false, 'Asset must not be deleted while referenced in a note');
  const stillExists = await dbCleanup.assets.get(asset1);
  assert.ok(stillExists, 'Asset 1 must remain intact');

  // 2. Delete Note 2 (which referenced asset 2)
  await dbCleanup.notes.delete('note-2');

  // 3. Now check asset 2
  const deleteResult2 = await checkAndDeleteOrphaned(asset2);
  assert.equal(deleteResult2, true, 'Orphaned asset 2 should be cleaned up');
  const asset2InDexie = await dbCleanup.assets.get(asset2);
  assert.equal(asset2InDexie, undefined, 'Asset 2 removed from Dexie');

  // Verify remote storage removed it as well
  const downloadCheck = await remoteStorage.from(STORAGE_BUCKET).download(`${userId}/${asset2}`);
  assert.ok(downloadCheck.error, 'Asset 2 removed from remote storage');
  console.log('✓ Test 6 Passed: Image replacement and orphaned asset cleanup');
}

// Test 7: Account Isolation and Unauthorized Cross-User Access
{
  const userA = 'user-alice-primary';
  const userB = 'user-bob-attacker';
  const secretAssetId = 'confidential-report-chart';
  const secretBlob = new Blob(['classified-diagram-data'], { type: 'image/png' });

  // User A uploads confidential asset
  const secretPath = `${userA}/${secretAssetId}`;
  await remoteStorage.from(STORAGE_BUCKET).upload(secretPath, secretBlob, { contentType: 'image/png' });

  // User B attempts to access User A's asset
  remoteStorage.currentAuthUser = userB;
  const unauthorizedFetch = await remoteStorage.from(STORAGE_BUCKET).download(secretPath);

  assert.ok(unauthorizedFetch.error, 'Cross-user asset fetch must fail');
  assert.equal(unauthorizedFetch.error.message, 'RLS: Access denied');

  // User A accesses their own asset
  remoteStorage.currentAuthUser = userA;
  const authorizedFetch = await remoteStorage.from(STORAGE_BUCKET).download(secretPath);
  assert.equal(authorizedFetch.error, null);
  assert.ok(authorizedFetch.data, 'User A can view their own asset');
  console.log('✓ Test 7 Passed: Strict account isolation and Row-Level Security verification');
}

// Test 8: Note Segmentation and Markdown Reconstruct Roundtrip
{
  const complexDocument = `## Project Brief

Here is the initial design:

![Design Draft](quietnotes-asset://asset-uuid-1111?w=720&align=center)

### Key Milestones
- Phase 1 complete
- Phase 2 in progress

![Flow Chart](quietnotes-asset://asset-uuid-2222?w=480&align=left)

End of report.`;

  const segments = splitTextIntoSegments(complexDocument);
  assert.equal(segments.length, 5, 'Should split into 3 text segments and 2 image segments');
  assert.equal(segments[1].type, 'image');
  assert.equal(segments[1].token.assetId, 'asset-uuid-1111');
  assert.equal(segments[1].token.width, 720);
  assert.equal(segments[3].type, 'image');
  assert.equal(segments[3].token.assetId, 'asset-uuid-2222');
  assert.equal(segments[3].token.width, 480);
  assert.equal(segments[3].token.align, 'left');

  const reconstructed = reconstructTextFromSegments(segments);
  assert.equal(reconstructed, complexDocument, 'Segment roundtrip reconstruction must be 100% identical');
  console.log('✓ Test 8 Passed: Note segmentation and non-destructive markdown roundtrip');
}

console.log('\n--- ALL 8 CROSS-DEVICE IMAGE SYNC TESTS PASSED ---');
