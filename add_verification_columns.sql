-- ================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- ================================================
-- This adds verification fields to the profiles table
-- Run this once to fix the "column does not exist" error

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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON profiles(verification_status);

-- Update existing users to be approved (if they were previously verified via verification_submissions)
-- This ensures existing users don't disappear after the migration
UPDATE profiles
SET verification_status = 'approved',
    verification_approved_at = NOW(),
    verification_admin_notes = 'Migrated from verification_submissions table'
WHERE id IN (
  SELECT user_id
  FROM verification_submissions
  WHERE status = 'approved'
);

-- Success message
SELECT 'Migration completed successfully! Verification columns added to profiles table.' AS status;
