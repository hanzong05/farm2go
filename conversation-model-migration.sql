-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Ensure user1_id is always less than user2_id for consistency
  CONSTRAINT conversations_user_order CHECK (user1_id < user2_id),
  -- Ensure unique conversation between two users
  CONSTRAINT conversations_unique_pair UNIQUE (user1_id, user2_id)
);

-- Update messages table to include conversation_id
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_conversations_users ON conversations(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Create function to automatically create conversation and set conversation_id
CREATE OR REPLACE FUNCTION create_or_get_conversation_id(sender_uuid UUID, receiver_uuid UUID)
RETURNS UUID AS $$
DECLARE
    conversation_uuid UUID;
    user1_uuid UUID;
    user2_uuid UUID;
BEGIN
    -- Ensure user1 < user2 for consistency
    IF sender_uuid < receiver_uuid THEN
        user1_uuid := sender_uuid;
        user2_uuid := receiver_uuid;
    ELSE
        user1_uuid := receiver_uuid;
        user2_uuid := sender_uuid;
    END IF;

    -- Try to find existing conversation
    SELECT id INTO conversation_uuid
    FROM conversations
    WHERE user1_id = user1_uuid AND user2_id = user2_uuid;

    -- If no conversation exists, create one
    IF conversation_uuid IS NULL THEN
        INSERT INTO conversations (user1_id, user2_id)
        VALUES (user1_uuid, user2_uuid)
        RETURNING id INTO conversation_uuid;
    END IF;

    RETURN conversation_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set conversation_id on message insert
-- This follows the workflow: "Create conversation automatically (trigger)"
CREATE OR REPLACE FUNCTION set_message_conversation_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the trigger execution for debugging
    RAISE NOTICE 'WORKFLOW TRIGGER: Processing message from % to %', NEW.sender_id, NEW.receiver_id;

    -- Set conversation_id if not provided (automatic conversation creation)
    IF NEW.conversation_id IS NULL THEN
        RAISE NOTICE 'WORKFLOW TRIGGER: No conversation_id provided, creating/finding conversation...';
        NEW.conversation_id := create_or_get_conversation_id(NEW.sender_id, NEW.receiver_id);
        RAISE NOTICE 'WORKFLOW TRIGGER: Conversation ID set to %', NEW.conversation_id;
    ELSE
        RAISE NOTICE 'WORKFLOW TRIGGER: Conversation ID already provided: %', NEW.conversation_id;
    END IF;

    -- Ensure we have a conversation_id before proceeding
    IF NEW.conversation_id IS NULL THEN
        RAISE EXCEPTION 'WORKFLOW TRIGGER: Failed to create or find conversation between % and %', NEW.sender_id, NEW.receiver_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that executes BEFORE INSERT
DROP TRIGGER IF EXISTS trigger_set_message_conversation_id ON messages;
CREATE TRIGGER trigger_set_message_conversation_id
    BEFORE INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION set_message_conversation_id();

-- Add a trigger to log successful message insertion for workflow tracking
CREATE OR REPLACE FUNCTION log_message_workflow()
RETURNS TRIGGER AS $$
BEGIN
    RAISE NOTICE 'WORKFLOW: Message stored in database with conversation_id %, sender %, receiver %, content: %',
                 NEW.conversation_id, NEW.sender_id, NEW.receiver_id, LEFT(NEW.content, 50);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_message_workflow ON messages;
CREATE TRIGGER trigger_log_message_workflow
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION log_message_workflow();

-- Update existing messages to have conversation_id
UPDATE messages
SET conversation_id = create_or_get_conversation_id(sender_id, receiver_id)
WHERE conversation_id IS NULL;

-- Enable RLS for conversations table
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversations
CREATE POLICY "Users can view their own conversations"
ON conversations FOR SELECT
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create conversations"
ON conversations FOR INSERT
WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Update messages RLS policies to work with conversations
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
CREATE POLICY "Users can view their own messages"
ON messages FOR SELECT
USING (
  auth.uid() = sender_id
  OR auth.uid() = receiver_id
  OR EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.user1_id = auth.uid() OR conversations.user2_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
CREATE POLICY "Users can insert their own messages"
ON messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
CREATE POLICY "Users can update their own messages"
ON messages FOR UPDATE
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);