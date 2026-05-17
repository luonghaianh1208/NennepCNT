-- Create violation-images bucket (public for display)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'violation-images',
  'violation-images',
  TRUE,
  5242880,  -- 5MB before compression
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
);

-- Public read for violation images
CREATE POLICY "Public read violation-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'violation-images');

-- Helper function for storage permissions (security definer to use has_permission)
CREATE OR REPLACE FUNCTION storage_has_permission(p_slug TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_permission(p_slug);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Authenticated users with image.upload permission can upload
CREATE POLICY "Users with image.upload permission can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'violation-images'
  AND storage_has_permission('image.upload')
);

-- Admin can delete
CREATE POLICY "Admins can delete violation-images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'violation-images'
  AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role_ids && ARRAY[(SELECT id FROM roles WHERE is_admin = TRUE)])
);