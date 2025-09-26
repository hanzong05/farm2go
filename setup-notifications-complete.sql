-- COMPLETE NOTIFICATIONS TABLE SETUP
-- Run this in your Supabase SQL Editor to fix all notification issues

-- Step 1: Drop existing table if it has issues
DROP TABLE IF EXISTS public.notifications CASCADE;

-- Step 2: Create the notifications table fresh
CREATE TABLE public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
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

-- Step 3: Add indexes for performance
CREATE INDEX idx_notifications_recipient_id ON public.notifications(recipient_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_type ON public.notifications(type);

-- Step 4: Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (recipient_id = auth.uid());

CREATE POLICY "Authenticated users can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Service role can do anything" ON public.notifications
    FOR ALL USING (auth.role() = 'service_role');

-- Step 6: Grant permissions
GRANT ALL ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.notifications TO anon;

-- Step 7: Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Insert a test notification to verify everything works
DO $$
BEGIN
    -- Only insert test if there are profiles to use
    IF EXISTS (SELECT 1 FROM profiles LIMIT 1) THEN
        INSERT INTO public.notifications (
            recipient_id,
            type,
            title,
            message,
            action_data
        ) SELECT
            id,
            'system_message',
            '✅ Notifications System Ready',
            'Your notifications system has been set up successfully and is ready to use!',
            '{"setup_test": true}'::jsonb
        FROM profiles
        LIMIT 1;

        RAISE NOTICE 'Test notification created successfully!';
    ELSE
        RAISE NOTICE 'No profiles found - skipping test notification';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Test notification failed: %', SQLERRM;
END $$;

-- Success message
SELECT 'Notifications table setup complete! 🎉' AS status;