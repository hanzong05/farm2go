-- Create storage bucket for verification documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-documents',
  'verification-documents',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- Create policy to allow authenticated users to upload their own verification documents
CREATE POLICY "Users can upload their own verification documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow authenticated users to view their own verification documents
CREATE POLICY "Users can view their own verification documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow admins to view all verification documents
CREATE POLICY "Admins can view all verification documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type IN ('admin', 'super-admin')
  )
);

-- Create policy to allow admins to delete verification documents
CREATE POLICY "Admins can delete verification documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'verification-documents'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type IN ('admin', 'super-admin')
  )
);