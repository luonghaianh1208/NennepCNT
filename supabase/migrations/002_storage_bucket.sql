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

-- Authenticated users can upload
CREATE POLICY "Users with image.upload can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'violation-images'
  AND auth.role() = 'authenticated'
);

-- Admin can delete
CREATE POLICY "Admins can delete violation-images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'violation-images'
  AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role_ids && ARRAY[(SELECT id FROM roles WHERE is_admin = TRUE)])
);