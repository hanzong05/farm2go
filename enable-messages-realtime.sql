-- Enable Real-time for Messages Table
-- Run this in your Supabase SQL Editor to make chat truly real-time

-- 1. Enable realtime for messages table (CRITICAL FOR CHAT)
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS messages;

-- 2. Ensure RLS is enabled for messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

-- 4. Create RLS policies for real-time messages
CREATE POLICY "Users can view their own messages" ON messages
  FOR SELECT
  USING (
    auth.uid()::text = sender_id OR
    auth.uid()::text = receiver_id OR
    auth.role() = 'service_role'
  );

CREATE POLICY "Users can insert messages" ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = sender_id OR
    auth.role() = 'service_role'
  );

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE
  USING (
    auth.uid()::text = receiver_id OR
    auth.role() = 'service_role'
  );

-- 5. Enable real-time for ALL necessary tables
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS orders;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS products;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS profiles;

-- 6. Create function to check which tables have real-time enabled
CREATE OR REPLACE FUNCTION check_all_realtime_tables()
RETURNS TABLE (
  table_name text,
  realtime_enabled boolean,
  rls_enabled boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::text,
    EXISTS(
      SELECT 1 FROM pg_publication_tables pt
      WHERE pt.pubname = 'supabase_realtime'
      AND pt.tablename = t.tablename
    ) as realtime_enabled,
    COALESCE(
      (SELECT c.relrowsecurity
       FROM pg_class c
       WHERE c.relname = t.tablename), false
    ) as rls_enabled
  FROM (
    VALUES
      ('messages'),
      ('notifications'),
      ('orders'),
      ('products'),
      ('transactions'),
      ('profiles')
  ) as t(tablename);
END;
$$ LANGUAGE plpgsql;

-- 7. Check the real-time status
SELECT * FROM check_all_realtime_tables();

-- 8. Verify messages table structure
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;

-- 9. Test message creation function
CREATE OR REPLACE FUNCTION test_realtime_message()
RETURNS uuid AS $$
DECLARE
  test_user_id text;
  test_receiver_id text;
  message_id uuid;
BEGIN
  -- Get two test user IDs
  SELECT id INTO test_user_id FROM profiles WHERE user_type = 'farmer' LIMIT 1;
  SELECT id INTO test_receiver_id FROM profiles WHERE user_type = 'buyer' AND id != test_user_id LIMIT 1;

  IF test_user_id IS NOT NULL AND test_receiver_id IS NOT NULL THEN
    -- Insert a test message
    INSERT INTO messages (
      sender_id,
      receiver_id,
      content,
      message_type,
      is_read,
      is_deleted_by_sender,
      is_deleted_by_receiver,
      created_at,
      updated_at
    ) VALUES (
      test_user_id,
      test_receiver_id,
      'Real-time test message: ' || NOW()::text,
      'text',
      false,
      false,
      false,
      NOW(),
      NOW()
    ) RETURNING id INTO message_id;

    RAISE NOTICE 'Test message created with ID: % from % to %', message_id, test_user_id, test_receiver_id;
    RETURN message_id;
  ELSE
    RAISE NOTICE 'Need at least one farmer and one buyer in profiles table for testing';
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 10. Show current real-time publication tables
SELECT
  schemaname,
  tablename,
  'ENABLED' as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 11. Instructions
/*
INSTRUCTIONS TO MAKE CHAT REAL-TIME:

1. Copy and run this ENTIRE SQL script in your Supabase SQL Editor
2. Verify all tables show "realtime_enabled: true" in the check results
3. Test with: SELECT test_realtime_message();
4. The message should appear instantly in your app's chat

If it still doesn't work:
- Check browser console for WebSocket errors
- Verify Supabase project has Real-time enabled in dashboard
- Make sure you're using the correct Supabase URL/keys
- Check network tab for realtime WebSocket connections
*/