-- Create messages table for chat functionality
-- This table stores all messages between farmers, buyers, and admins

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Message content
    content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),

    -- Participants
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Message metadata
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
    subject VARCHAR(200), -- Optional subject for first message in conversation

    -- Status tracking
    is_read BOOLEAN DEFAULT FALSE,
    is_deleted_by_sender BOOLEAN DEFAULT FALSE,
    is_deleted_by_receiver BOOLEAN DEFAULT FALSE,

    -- Attachments (optional)
    attachment_url TEXT,
    attachment_type VARCHAR(50),
    attachment_name VARCHAR(255),

    -- Related entities (optional)
    related_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CHECK (sender_id != receiver_id), -- Can't send message to yourself
    CHECK (content IS NOT NULL OR attachment_url IS NOT NULL) -- Must have content or attachment
);

-- Create conversations view for easier querying
CREATE OR REPLACE VIEW public.conversations AS
SELECT DISTINCT
    CASE
        WHEN m.sender_id < m.receiver_id
        THEN m.sender_id || '-' || m.receiver_id
        ELSE m.receiver_id || '-' || m.sender_id
    END as conversation_id,

    CASE
        WHEN m.sender_id < m.receiver_id
        THEN m.sender_id
        ELSE m.receiver_id
    END as participant1_id,

    CASE
        WHEN m.sender_id < m.receiver_id
        THEN m.receiver_id
        ELSE m.sender_id
    END as participant2_id,

    -- Latest message info
    (SELECT content FROM public.messages m2
     WHERE (m2.sender_id = m.sender_id AND m2.receiver_id = m.receiver_id)
        OR (m2.sender_id = m.receiver_id AND m2.receiver_id = m.sender_id)
     ORDER BY m2.created_at DESC LIMIT 1) as last_message,

    (SELECT created_at FROM public.messages m2
     WHERE (m2.sender_id = m.sender_id AND m2.receiver_id = m.receiver_id)
        OR (m2.sender_id = m.receiver_id AND m2.receiver_id = m.sender_id)
     ORDER BY m2.created_at DESC LIMIT 1) as last_message_at,

    -- Unread count for each participant
    (SELECT COUNT(*) FROM public.messages m2
     WHERE m2.receiver_id = CASE
         WHEN m.sender_id < m.receiver_id THEN m.sender_id
         ELSE m.receiver_id
     END
     AND m2.sender_id = CASE
         WHEN m.sender_id < m.receiver_id THEN m.receiver_id
         ELSE m.sender_id
     END
     AND m2.is_read = FALSE
     AND m2.is_deleted_by_receiver = FALSE) as unread_count_participant1,

    (SELECT COUNT(*) FROM public.messages m2
     WHERE m2.receiver_id = CASE
         WHEN m.sender_id < m.receiver_id THEN m.receiver_id
         ELSE m.sender_id
     END
     AND m2.sender_id = CASE
         WHEN m.sender_id < m.receiver_id THEN m.sender_id
         ELSE m.receiver_id
     END
     AND m2.is_read = FALSE
     AND m2.is_deleted_by_receiver = FALSE) as unread_count_participant2

FROM public.messages m
WHERE m.is_deleted_by_sender = FALSE
   OR m.is_deleted_by_receiver = FALSE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages(receiver_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_product ON public.messages(related_product_id) WHERE related_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_order ON public.messages(related_order_id) WHERE related_order_id IS NOT NULL;

-- Enable Row Level Security (RLS)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can read messages where they are sender or receiver
CREATE POLICY "Users can read their own messages" ON public.messages
    FOR SELECT USING (
        auth.uid() = sender_id
        OR auth.uid() = receiver_id
    );

-- Users can insert messages where they are the sender
CREATE POLICY "Users can send messages" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND sender_id != receiver_id
    );

-- Users can update messages they sent (for editing, marking as read, etc.)
CREATE POLICY "Users can update their sent messages" ON public.messages
    FOR UPDATE USING (
        auth.uid() = sender_id
    );

-- Users can update messages they received (for marking as read, deleting, etc.)
CREATE POLICY "Users can update received messages" ON public.messages
    FOR UPDATE USING (
        auth.uid() = receiver_id
    ) WITH CHECK (
        -- Only allow updating read status and deletion flags for received messages
        auth.uid() = receiver_id
    );

-- Soft delete: Users can mark messages as deleted for themselves
CREATE POLICY "Users can soft delete messages" ON public.messages
    FOR UPDATE USING (
        auth.uid() = sender_id OR auth.uid() = receiver_id
    ) WITH CHECK (
        -- Only allow updating deletion flags
        (auth.uid() = sender_id AND OLD.sender_id = NEW.sender_id)
        OR (auth.uid() = receiver_id AND OLD.receiver_id = NEW.receiver_id)
    );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to mark message as read and set read_at timestamp
CREATE OR REPLACE FUNCTION mark_message_as_read(message_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.messages
    SET is_read = TRUE, read_at = NOW()
    WHERE id = message_id
      AND receiver_id = auth.uid()
      AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get conversation messages
CREATE OR REPLACE FUNCTION get_conversation_messages(
    other_user_id UUID,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS SETOF public.messages AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM public.messages
    WHERE (
        (sender_id = auth.uid() AND receiver_id = other_user_id)
        OR (sender_id = other_user_id AND receiver_id = auth.uid())
    )
    AND (
        (sender_id = auth.uid() AND is_deleted_by_sender = FALSE)
        OR (receiver_id = auth.uid() AND is_deleted_by_receiver = FALSE)
    )
    ORDER BY created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user conversations
CREATE OR REPLACE FUNCTION get_user_conversations()
RETURNS TABLE(
    conversation_id TEXT,
    other_user_id UUID,
    other_user_name TEXT,
    other_user_type TEXT,
    last_message TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    unread_count INTEGER,
    other_user_avatar TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.conversation_id,
        CASE
            WHEN c.participant1_id = auth.uid() THEN c.participant2_id
            ELSE c.participant1_id
        END as other_user_id,
        COALESCE(p.first_name || ' ' || p.last_name, p.email) as other_user_name,
        COALESCE(p.user_type, 'buyer') as other_user_type,
        c.last_message,
        c.last_message_at,
        CASE
            WHEN c.participant1_id = auth.uid() THEN c.unread_count_participant1::INTEGER
            ELSE c.unread_count_participant2::INTEGER
        END as unread_count,
        p.avatar_url as other_user_avatar
    FROM public.conversations c
    JOIN public.profiles p ON p.id = CASE
        WHEN c.participant1_id = auth.uid() THEN c.participant2_id
        ELSE c.participant1_id
    END
    WHERE c.participant1_id = auth.uid() OR c.participant2_id = auth.uid()
    ORDER BY c.last_message_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT SELECT ON public.conversations TO authenticated;
GRANT EXECUTE ON FUNCTION mark_message_as_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_messages(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_conversations() TO authenticated;

-- Insert some sample data for testing (optional)
-- You can uncomment this section if you want sample data

/*
-- Sample messages (replace with actual user IDs from your system)
INSERT INTO public.messages (sender_id, receiver_id, content, subject, related_product_id) VALUES
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Hello! I''m interested in your tomatoes. Are they still available?', 'Inquiry about Tomatoes', NULL),
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Yes, they are! We have fresh tomatoes available. How many kg do you need?', NULL, NULL),
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'I need about 5kg. What''s your price per kg?', NULL, NULL),
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Our tomatoes are ₱80 per kg. For 5kg, that would be ₱400 total. When do you need them?', NULL, NULL);
*/