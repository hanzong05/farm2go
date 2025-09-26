-- Create expo_push_tokens table for storing Expo push notification tokens
CREATE TABLE IF NOT EXISTS expo_push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Enable RLS
ALTER TABLE expo_push_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view their own push tokens" ON expo_push_tokens;
CREATE POLICY "Users can view their own push tokens" ON expo_push_tokens
  FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert their own push tokens" ON expo_push_tokens;
CREATE POLICY "Users can insert their own push tokens" ON expo_push_tokens
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update their own push tokens" ON expo_push_tokens;
CREATE POLICY "Users can update their own push tokens" ON expo_push_tokens
  FOR UPDATE USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete their own push tokens" ON expo_push_tokens;
CREATE POLICY "Users can delete their own push tokens" ON expo_push_tokens
  FOR DELETE USING (auth.uid()::text = user_id);

-- Policy for service role to access all tokens (for sending notifications)
DROP POLICY IF EXISTS "Service role can access all push tokens" ON expo_push_tokens;
CREATE POLICY "Service role can access all push tokens" ON expo_push_tokens
  FOR ALL USING (auth.role() = 'service_role');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_expo_push_tokens_updated_at ON expo_push_tokens;
CREATE TRIGGER update_expo_push_tokens_updated_at
    BEFORE UPDATE ON expo_push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Index for performance
CREATE INDEX IF NOT EXISTS expo_push_tokens_user_id_idx ON expo_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS expo_push_tokens_platform_idx ON expo_push_tokens(platform);