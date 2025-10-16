-- Fix Storage Policies for product-images bucket
-- Run this SQL in your Supabase SQL Editor

-- 1. Allow public to view product images (SELECT)
CREATE POLICY "Public can view product images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- 2. Allow authenticated users to update product images
CREATE POLICY "Allow authenticated users to update product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

-- 3. Allow authenticated users to delete product images
CREATE POLICY "Allow authenticated users to delete product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- Verify the policies were created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'objects' AND policyname LIKE '%product%'
ORDER BY policyname;
