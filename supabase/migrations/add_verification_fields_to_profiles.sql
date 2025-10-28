-- Add verification fields to profiles table
-- This allows us to track verification status directly in the profile

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'not_submitted'
  CHECK (verification_status IN ('not_submitted', 'pending', 'approved', 'rejected'));

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS verification_approved_at TIMESTAMPTZ;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS verification_rejected_at TIMESTAMPTZ;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS verification_admin_notes TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS id_document_url TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS face_photo_url TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS id_document_type TEXT;

-- Create index for faster queries on verification_status
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON profiles(verification_status);

-- Add comment to explain the column
COMMENT ON COLUMN profiles.verification_status IS 'Verification status: not_submitted (default), pending, approved, rejected';
