-- ========================================================================
-- QuietNotes: Remote Storage Setup for Note Images
-- Migration: 20261026_note_images_storage.sql
-- ========================================================================

-- 1. Create or update private storage bucket 'note-assets'
-- Images are stored privately under: {user_id}/{asset_id}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'note-assets',
  'note-assets',
  false, -- Private bucket: access strictly controlled via RLS / authenticated tokens
  20971520, -- 20MB max file size limit (20 * 1024 * 1024 bytes)
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- NOTE: Do NOT run 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;'
-- storage.objects is owned by 'supabase_storage_admin', and RLS is already active by default.
-- Running ALTER TABLE as the 'postgres' role causes ERROR: 42501: must be owner of table objects.

-- 2. Policy: Authenticated users can view / download images inside their own account folder
DROP POLICY IF EXISTS "Users can view their own note assets" ON storage.objects;
CREATE POLICY "Users can view their own note assets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'note-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Policy: Authenticated users can upload images to their own account folder
DROP POLICY IF EXISTS "Users can upload their own note assets" ON storage.objects;
CREATE POLICY "Users can upload their own note assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'note-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Policy: Authenticated users can update images in their own account folder
DROP POLICY IF EXISTS "Users can update their own note assets" ON storage.objects;
CREATE POLICY "Users can update their own note assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'note-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Policy: Authenticated users can delete images in their own account folder
DROP POLICY IF EXISTS "Users can delete their own note assets" ON storage.objects;
CREATE POLICY "Users can delete their own note assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'note-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
