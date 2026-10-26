import type { NoteAsset } from './db';

let _dbInstance: any = null;
async function getDb() {
  if (!_dbInstance) {
    const mod = await import('./db');
    _dbInstance = mod.db;
  }
  return _dbInstance;
}

let _supabaseInstance: any = null;
async function getSupabase() {
  if (!_supabaseInstance) {
    const mod = await import('./supabase');
    _supabaseInstance = mod.supabase;
  }
  return _supabaseInstance;
}

export const STORAGE_BUCKET = 'note-assets';
export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB limit
export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

// In-memory cache for created object URLs to prevent redundant creates and memory leaks
const objectUrlCache = new Map<string, string>();

/**
 * Validate image file format and file size
 */
export function validateImageFile(file: File | Blob): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'ไม่พบไฟล์รูปภาพ (No file provided)' };
  }

  const mime = file.type?.toLowerCase() || '';
  const isAllowed = ALLOWED_MIME_TYPES.some((t) => mime.includes(t.replace('image/', '')));
  if (!isAllowed) {
    return { 
      valid: false, 
      error: 'รองรับเฉพาะไฟล์ PNG, JPG/JPEG และ WebP เท่านั้น (Only PNG, JPG, and WebP are supported)' 
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return { 
      valid: false, 
      error: `ขนาดไฟล์ใหญ่เกินไป (${sizeMb}MB) สูงสุดไม่เกิน 20MB (File is too large, max 20MB)` 
    };
  }

  return { valid: true };
}

/**
 * Generates the canonical storage path for an asset under a user account
 */
export function getAssetRemotePath(userId: string, assetId: string): string {
  const cleanId = cleanAssetId(assetId);
  return `${userId}/${cleanId}`;
}

/**
 * Helper to strip URL protocol prefixes and query parameters from asset IDs
 */
export function cleanAssetId(assetIdOrUrl: string): string {
  if (!assetIdOrUrl) return '';
  return assetIdOrUrl
    .replace(/^quietnotes-asset:\/\//i, '')
    .replace(/^asset:/i, '')
    .split('?')[0]
    .split('#')[0]
    .trim();
}

/**
 * Uploads an asset blob to Supabase Storage with status tracking
 */
export async function uploadAssetRemote(
  assetId: string, 
  data: Blob, 
  userId: string, 
  mimeType: string = 'image/png'
): Promise<{ success: boolean; path?: string; error?: string }> {
  const cleanId = cleanAssetId(assetId);
  const remotePath = getAssetRemotePath(userId, cleanId);
  const db = await getDb();

  try {
    // Mark as uploading in local Dexie
    await db.assets.update(cleanId, { sync_status: 'uploading' }).catch(() => {});

    const supabase = await getSupabase();
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(remotePath, data, {
        contentType: mimeType || 'image/png',
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      console.warn(`Supabase storage upload failed for ${remotePath}:`, error.message);
      await db.assets.update(cleanId, { sync_status: 'failed' }).catch(() => {});
      return { success: false, error: error.message };
    }

    const now = Date.now();
    await db.assets.update(cleanId, {
      user_id: userId,
      sync_status: 'synced',
      remote_path: remotePath,
      synced_at: now,
    }).catch(() => {});

    return { success: true, path: remotePath };
  } catch (err: any) {
    console.warn(`Network offline or storage error uploading asset ${cleanId}:`, err);
    await db.assets.update(cleanId, { sync_status: 'failed' }).catch(() => {});
    return { success: false, error: err?.message || 'Storage upload error' };
  }
}

/**
 * Persists an image Blob into Dexie IndexedDB and initiates authenticated remote sync
 */
export async function saveImageAsset(file: File | Blob, userId?: string): Promise<string> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'ไฟล์รูปภาพไม่ถูกต้อง');
  }

  const assetId = crypto.randomUUID();
  const filename = file instanceof File ? file.name : `image-${Date.now()}`;
  const now = Date.now();

  const assetRecord: NoteAsset = {
    id: assetId,
    data: file,
    mime_type: file.type || 'image/png',
    filename,
    size: file.size,
    created_at: now,
    user_id: userId,
    sync_status: userId ? 'pending' : 'synced',
  };

  // 1. Guaranteed 0ms Local-First storage in IndexedDB / Dexie
  const db = await getDb();
  await db.assets.put(assetRecord);

  // 2. Cache the object URL in memory for immediate seamless display
  const objUrl = URL.createObjectURL(file);
  objectUrlCache.set(assetId, objUrl);

  // 3. Initiate authenticated remote upload
  if (userId) {
    uploadAssetRemote(assetId, file, userId, file.type).catch((err) => {
      console.warn('Initial remote asset upload deferred or failed:', err);
    });
  }

  return assetId;
}

/**
 * Resolves an asset ID to a usable browser display URL (Blob Object URL or Data URL)
 * On a second device, downloads the remote object, saves it to local Dexie, and returns an object URL.
 */
export async function resolveAssetDisplayUrl(assetIdOrUrl: string, userId?: string): Promise<string> {
  if (!assetIdOrUrl) return '';

  // If it's already an HTTP / HTTPS / Data URL, return directly
  if (assetIdOrUrl.startsWith('data:') || assetIdOrUrl.startsWith('http://') || assetIdOrUrl.startsWith('https://') || assetIdOrUrl.startsWith('blob:')) {
    return assetIdOrUrl;
  }

  const cleanId = cleanAssetId(assetIdOrUrl);
  if (!cleanId) return '';

  // 1. Check in-memory cache first (instant response)
  const cached = objectUrlCache.get(cleanId);
  if (cached) {
    return cached;
  }

  // 2. Check local Dexie IndexedDB
  try {
    const db = await getDb();
    const asset = await db.assets.get(cleanId);
    if (asset && asset.data) {
      const objUrl = URL.createObjectURL(asset.data);
      objectUrlCache.set(cleanId, objUrl);
      return objUrl;
    }
  } catch (err) {
    console.warn(`Error loading asset ${cleanId} from Dexie:`, err);
  }

  // 3. Asset not found locally (e.g. Device B after note synchronization)
  // Attempt downloading from remote Supabase Storage and caching locally
  try {
    const supabase = await getSupabase();
    const candidates: string[] = [];

    if (userId) {
      candidates.push(`${userId}/${cleanId}`);
      candidates.push(`${userId}/${cleanId}.png`);
      candidates.push(`${userId}/${cleanId}.jpg`);
      candidates.push(`${userId}/${cleanId}.jpeg`);
      candidates.push(`${userId}/${cleanId}.webp`);
    }
    candidates.push(cleanId);

    for (const candidatePath of candidates) {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(candidatePath);
      if (data && !error) {
        // Successfully downloaded image bytes from remote storage!
        // Cache into local Dexie for 0ms offline access and future loads
        const db = await getDb();
        const downloadedAsset: NoteAsset = {
          id: cleanId,
          data: data,
          mime_type: data.type || 'image/png',
          filename: cleanId,
          size: data.size,
          created_at: Date.now(),
          user_id: userId,
          sync_status: 'synced',
          remote_path: candidatePath,
          synced_at: Date.now(),
        };
        await db.assets.put(downloadedAsset);

        const objUrl = URL.createObjectURL(data);
        objectUrlCache.set(cleanId, objUrl);
        return objUrl;
      }
    }

    // Fallback: If direct download is blocked by auth or pending, try signed URL
    if (userId) {
      const { data: signedData } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(`${userId}/${cleanId}`, 3600);
      if (signedData?.signedUrl) {
        return signedData.signedUrl;
      }
    }

    // Final fallback: try public URL
    const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(cleanId);
    if (publicData?.publicUrl) {
      return publicData.publicUrl;
    }
  } catch (err) {
    console.warn(`Remote resolution failed for asset ${cleanId}:`, err);
  }

  return '';
}

/**
 * Scans notes for image tokens and pre-fetches any missing assets from remote storage into Dexie
 */
export async function prefetchNoteAssets(userId: string): Promise<void> {
  if (!userId) return;

  try {
    const db = await getDb();
    const notes = await db.notes.where('user_id').equals(userId).toArray();
    const referencedAssetIds = new Set<string>();

    for (const note of notes) {
      if (!note.content) continue;
      const tokens = parseImageTokens(note.content);
      for (const tok of tokens) {
        const cleanId = cleanAssetId(tok.assetId);
        if (cleanId) referencedAssetIds.add(cleanId);
      }
    }

    // For any referenced asset not yet in Dexie, fetch in background
    for (const assetId of referencedAssetIds) {
      const existing = await db.assets.get(assetId);
      if (!existing || !existing.data) {
        resolveAssetDisplayUrl(assetId, userId).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Error during prefetchNoteAssets:', err);
  }
}

/**
 * Retries and syncs all pending or failed assets in Dexie with Supabase Storage
 */
export async function syncPendingAssets(userId: string): Promise<{ syncedCount: number; failedCount: number }> {
  if (!userId) return { syncedCount: 0, failedCount: 0 };

  let syncedCount = 0;
  let failedCount = 0;

  try {
    const db = await getDb();
    const allAssets: NoteAsset[] = await db.assets.toArray();
    const pending = allAssets.filter(
      (a) => (!a.user_id || a.user_id === userId) && a.sync_status !== 'synced' && a.data
    );

    for (const asset of pending) {
      const res = await uploadAssetRemote(asset.id, asset.data, userId, asset.mime_type);
      if (res.success) {
        syncedCount++;
      } else {
        failedCount++;
      }
    }
  } catch (err) {
    console.warn('Error in syncPendingAssets:', err);
  }

  return { syncedCount, failedCount };
}

/**
 * Migrates existing local-only images to remote Supabase storage safely and idempotently
 */
export async function migrateExistingImages(userId: string): Promise<{ migratedCount: number; skippedCount: number }> {
  if (!userId) return { migratedCount: 0, skippedCount: 0 };

  let migratedCount = 0;
  let skippedCount = 0;

  try {
    const db = await getDb();
    const assets: NoteAsset[] = await db.assets.toArray();

    for (const asset of assets) {
      if (asset.sync_status === 'synced') {
        skippedCount++;
        continue;
      }

      if (asset.data) {
        const res = await uploadAssetRemote(asset.id, asset.data, userId, asset.mime_type);
        if (res.success) {
          migratedCount++;
        }
      }
    }
  } catch (err) {
    console.warn('Error in migrateExistingImages:', err);
  }

  return { migratedCount, skippedCount };
}

/**
 * Deletes an image asset from Dexie and remote storage only if it is no longer referenced by any note
 */
export async function deleteAssetIfOrphaned(assetId: string, userId?: string): Promise<boolean> {
  const cleanId = cleanAssetId(assetId);
  if (!cleanId) return false;

  try {
    const db = await getDb();
    const allNotes = await db.notes.toArray();

    // Check if any note still references this asset
    const isReferenced = allNotes.some((n: any) => n.content && n.content.includes(cleanId));
    if (isReferenced) {
      return false; // Still referenced in another note, preserve it
    }

    // 1. Delete from local Dexie
    await db.assets.delete(cleanId);

    // 2. Revoke in-memory object URL
    revokeAssetDisplayUrl(cleanId);

    // 3. Delete from Supabase Storage if remote
    if (userId) {
      const supabase = await getSupabase();
      const pathsToDelete = [
        `${userId}/${cleanId}`,
        `${userId}/${cleanId}.png`,
        `${userId}/${cleanId}.jpg`,
        `${userId}/${cleanId}.jpeg`,
        `${userId}/${cleanId}.webp`,
      ];
      await supabase.storage.from(STORAGE_BUCKET).remove(pathsToDelete).catch(() => {});
    }

    return true;
  } catch (err) {
    console.warn(`Error deleting orphaned asset ${cleanId}:`, err);
    return false;
  }
}

/**
 * Revoke cached object URL to free browser memory
 */
export function revokeAssetDisplayUrl(assetId: string) {
  const cleanId = cleanAssetId(assetId);
  const cached = objectUrlCache.get(cleanId);
  if (cached && cached.startsWith('blob:')) {
    URL.revokeObjectURL(cached);
    objectUrlCache.delete(cleanId);
  }
}

/**
 * Revoke all in-memory object URLs on sign-out to prevent cross-account leaks and memory leaks
 */
export function clearUserAssetMemoryCache() {
  for (const [key, url] of objectUrlCache.entries()) {
    if (url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
  }
  objectUrlCache.clear();
}

/**
 * Format markdown token for an embedded image
 */
export function formatImageMarkdown(
  assetId: string, 
  caption: string = '', 
  width: number = 540, 
  align: 'left' | 'center' | 'right' = 'center'
): string {
  const cleanCaption = caption.replace(/[\[\]\(\)\n]/g, '').trim();
  const cleanId = cleanAssetId(assetId);
  return `![${cleanCaption}](quietnotes-asset://${cleanId}?w=${width}&align=${align})`;
}

export interface ParsedImageToken {
  raw: string;
  caption: string;
  assetId: string;
  width: number;
  align: 'left' | 'center' | 'right';
  startIndex: number;
  endIndex: number;
}

/**
 * Parse all image markdown tokens from note content text
 */
export function parseImageTokens(text: string): ParsedImageToken[] {
  if (!text) return [];

  const regex = /!\[([^\]]*)\]\(((?:quietnotes-asset:\/\/|asset:|data:image\/|https?:\/\/)[^)]+)\)/gi;
  const results: ParsedImageToken[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const caption = match[1] || '';
    const fullUrl = match[2] || '';

    // Parse query params for width and align
    let width = 540;
    let align: 'left' | 'center' | 'right' = 'center';

    const urlParts = fullUrl.split('?');
    const baseTarget = urlParts[0];
    const queryString = urlParts[1] || '';

    if (queryString) {
      const searchParams = new URLSearchParams(queryString);
      const w = parseInt(searchParams.get('w') || searchParams.get('width') || '540', 10);
      if (!isNaN(w) && w > 50) width = w;
      const a = searchParams.get('align');
      if (a === 'left' || a === 'center' || a === 'right') {
        align = a;
      }
    }

    const assetId = cleanAssetId(baseTarget);

    results.push({
      raw,
      caption,
      assetId,
      width,
      align,
      startIndex: match.index,
      endIndex: match.index + raw.length,
    });
  }

  return results;
}

export type DocumentSegment = 
  | { type: 'text'; text: string; id: string }
  | { type: 'image'; token: ParsedImageToken; id: string };

/**
 * Splits note text into alternating text and image segments
 */
export function splitTextIntoSegments(fullText: string): DocumentSegment[] {
  if (!fullText) {
    return [{ type: 'text', text: '', id: 'seg-0' }];
  }

  const tokens = parseImageTokens(fullText);
  if (tokens.length === 0) {
    return [{ type: 'text', text: fullText, id: 'seg-0' }];
  }

  const segments: DocumentSegment[] = [];
  let lastIndex = 0;

  tokens.forEach((token, idx) => {
    if (token.startIndex > lastIndex) {
      segments.push({
        type: 'text',
        text: fullText.slice(lastIndex, token.startIndex),
        id: `seg-text-${idx}-${lastIndex}`,
      });
    }

    segments.push({
      type: 'image',
      token,
      id: `seg-img-${token.assetId}-${idx}`,
    });

    lastIndex = token.endIndex;
  });

  if (lastIndex < fullText.length) {
    segments.push({
      type: 'text',
      text: fullText.slice(lastIndex),
      id: `seg-text-end-${lastIndex}`,
    });
  }

  return segments;
}

/**
 * Reconstructs full note text from segments
 */
export function reconstructTextFromSegments(segments: DocumentSegment[]): string {
  return segments
    .map((seg) => {
      if (seg.type === 'text') {
        return seg.text;
      }
      return formatImageMarkdown(
        seg.token.assetId,
        seg.token.caption,
        seg.token.width,
        seg.token.align
      );
    })
    .join('');
}
