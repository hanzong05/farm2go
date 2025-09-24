-- Create product-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true, -- Public bucket so product images can be viewed
  10 * 1024 * 1024, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated farmers to upload product images
CREATE POLICY "Allow authenticated farmers to upload product images" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'farmer'
  )
);

-- Create policy to allow anyone to read product images (public bucket)
CREATE POLICY "Allow public read access to product images" ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Create policy to allow farmers to update their own product images
CREATE POLICY "Allow farmers to update their own product images" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'farmer'
  )
);

-- Create policy to allow farmers to delete their own product images
CREATE POLICY "Allow farmers to delete their own product images" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'farmer'
  )
);