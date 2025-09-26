-- SIMPLE NOTIFICATIONS TABLE FIX
-- Run this step by step in Supabase SQL Editor

-- Step 1: Remove any problematic constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Step 2: If table doesn't exist, create it
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID NOT NULL,
    sender_id UUID,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    action_data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Enable RLS (Row Level Security)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Step 4: Create basic policies
DROP POLICY IF EXISTS "Enable read access for users" ON public.notifications;
CREATE POLICY "Enable read access for users" ON public.notifications
    FOR SELECT USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.notifications;
CREATE POLICY "Enable insert for authenticated users" ON public.notifications
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for users" ON public.notifications;
CREATE POLICY "Enable update for users" ON public.notifications
    FOR UPDATE USING (recipient_id = auth.uid());

-- Step 5: Grant permissions
GRANT ALL ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- Step 6: Test with a simple insert
INSERT INTO public.notifications (recipient_id, type, title, message)
VALUES (
    (SELECT id FROM profiles LIMIT 1),
    'system_message',
    'Test Notification',
    'This is a test to verify notifications are working'
);

-- Step 7: Show success
SELECT 'Notifications table is now ready! 🎉' as status;