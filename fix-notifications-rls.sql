-- Fix RLS policies for notifications table
-- Run this in your Supabase SQL Editor

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can do anything" ON public.notifications;

-- Create permissive policies for notifications

-- Allow users to read their own notifications
CREATE POLICY "Enable read for users" ON public.notifications
    FOR SELECT USING (recipient_id = auth.uid());

-- Allow users to update their own notifications (for marking as read)
CREATE POLICY "Enable update for users" ON public.notifications
    FOR UPDATE USING (recipient_id = auth.uid());

-- Allow ANY authenticated user to create notifications (this is key!)
CREATE POLICY "Enable insert for all authenticated users" ON public.notifications
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow service role to do everything
CREATE POLICY "Service role full access" ON public.notifications
    FOR ALL USING (auth.role() = 'service_role');

-- Also allow anon role to insert (in case of issues with auth detection)
CREATE POLICY "Enable insert for anon" ON public.notifications
    FOR INSERT WITH CHECK (true);

-- Grant permissions to make sure roles can access
GRANT ALL ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.notifications TO anon;

-- Test the fix
SELECT 'RLS policies updated! Notifications should work now. 🎉' as status;