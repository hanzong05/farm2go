-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Allow authenticated farmers to upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow farmers to update their own product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow farmers to delete their own product images" ON storage.objects;

-- Create more permissive policy for authenticated users (temporary for testing)
CREATE POLICY "Allow authenticated users to upload product images" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Create policy to allow authenticated users to update product images
CREATE POLICY "Allow authenticated users to update product images" ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

-- Create policy to allow authenticated users to delete product images
CREATE POLICY "Allow authenticated users to delete product images" ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- Keep the public read policy
-- CREATE POLICY "Allow public read access to product images" ON storage.objects
-- FOR SELECT
-- TO public
-- USING (bucket_id = 'product-images');