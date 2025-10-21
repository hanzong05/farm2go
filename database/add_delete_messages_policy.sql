-- Add DELETE policy for messages table
-- This allows users to hard delete their own sent messages (for image/file deletions)

-- Users can delete messages they sent
CREATE POLICY "Users can delete their sent messages" ON public.messages
    FOR DELETE USING (
        auth.uid() = sender_id
    );
