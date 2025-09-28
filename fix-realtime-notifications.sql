-- Fix Real-time Notifications Setup
-- Run this in your Supabase SQL Editor

-- 1. Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 2. Ensure RLS is enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create notifications for others" ON notifications;

-- 4. Create comprehensive RLS policies for real-time
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT
  USING (
    auth.uid()::text = recipient_id OR
    auth.role() = 'service_role'
  );

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE
  USING (
    auth.uid()::text = recipient_id OR
    auth.role() = 'service_role'
  );

CREATE POLICY "Authenticated users can insert notifications" ON notifications
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' OR
    auth.role() = 'service_role' OR
    auth.uid() IS NOT NULL
  );

-- 5. Create function to check realtime status
CREATE OR REPLACE FUNCTION check_realtime_status()
RETURNS TABLE (
  table_name text,
  realtime_enabled boolean,
  rls_enabled boolean,
  policies_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    'notifications'::text as table_name,
    EXISTS(
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND tablename = 'notifications'
    ) as realtime_enabled,
    (
      SELECT relrowsecurity
      FROM pg_class
      WHERE relname = 'notifications'
    ) as rls_enabled,
    (
      SELECT COUNT(*)
      FROM pg_policies
      WHERE tablename = 'notifications'
    ) as policies_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Check the status
SELECT * FROM check_realtime_status();

-- 7. Test notification creation function
CREATE OR REPLACE FUNCTION test_notification_creation()
RETURNS void AS $$
DECLARE
  test_user_id uuid;
  notification_id uuid;
BEGIN
  -- Get a test user ID (replace with an actual user ID from your profiles table)
  SELECT id INTO test_user_id FROM profiles LIMIT 1;

  IF test_user_id IS NOT NULL THEN
    -- Insert a test notification
    INSERT INTO notifications (
      recipient_id,
      type,
      title,
      message,
      sender_id,
      created_at,
      is_read
    ) VALUES (
      test_user_id::text,
      'system_message',
      'Real-time Test',
      'This is a test notification to verify real-time functionality',
      test_user_id::text,
      NOW(),
      false
    ) RETURNING id INTO notification_id;

    RAISE NOTICE 'Test notification created with ID: %', notification_id;
  ELSE
    RAISE NOTICE 'No users found in profiles table for testing';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 8. Enable real-time for all necessary tables
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS orders;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS products;

-- 9. Verify all tables in realtime publication
SELECT
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 10. Create a trigger to ensure notification timestamps
CREATE OR REPLACE FUNCTION update_notification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at = COALESCE(NEW.created_at, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notification_timestamp_trigger ON notifications;
CREATE TRIGGER update_notification_timestamp_trigger
  BEFORE INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_timestamp();

-- 11. Instructions for testing
/*
To test real-time notifications:

1. Run this entire script in Supabase SQL Editor
2. Check the results of check_realtime_status() - all should be true/positive
3. Open your app and ensure a user is logged in
4. Run: SELECT test_notification_creation();
5. The notification should appear in real-time in your app

If notifications still don't work in real-time:
1. Check browser developer console for WebSocket connection errors
2. Verify your Supabase project has real-time enabled in the dashboard
3. Check that your Supabase client is initialized with realtime enabled
4. Ensure you're not hitting rate limits
*/

COMMENT ON FUNCTION check_realtime_status() IS 'Check if real-time is properly configured for notifications';
COMMENT ON FUNCTION test_notification_creation() IS 'Create a test notification to verify real-time functionality';