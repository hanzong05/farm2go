-- Script to check and fix admin barangay locations

-- 1. Check current admin users and their barangay settings
SELECT
  id,
  email,
  first_name,
  last_name,
  user_type,
  barangay,
  created_at
FROM profiles
WHERE user_type IN ('admin', 'super-admin')
ORDER BY created_at;

-- 2. If your admin user doesn't have a barangay set, uncomment and run one of these:

-- Option A: Set specific barangay for your admin
-- UPDATE profiles
-- SET barangay = 'Care Barangay Hall'
-- WHERE email = 'barangay@farm2go.com' AND user_type = 'admin';

-- Option B: Set barangay for all admins without one
-- UPDATE profiles
-- SET barangay = 'Care Barangay Hall'
-- WHERE user_type = 'admin' AND (barangay IS NULL OR barangay = '');

-- 3. Verify the update
SELECT
  email,
  first_name,
  last_name,
  user_type,
  barangay
FROM profiles
WHERE user_type IN ('admin', 'super-admin');

-- 4. Check what users are in each barangay
SELECT
  barangay,
  user_type,
  COUNT(*) as user_count
FROM profiles
WHERE barangay IS NOT NULL
GROUP BY barangay, user_type
ORDER BY barangay, user_type;