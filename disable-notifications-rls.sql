-- TEMPORARY: Disable RLS on notifications table
-- Run this if the RLS policies are still causing issues

-- Disable Row Level Security entirely for notifications (temporarily)
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- Grant full permissions to all roles
GRANT ALL ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.notifications TO anon;

-- Note: This makes the table completely open
-- You should re-enable RLS later with proper policies for production

SELECT 'RLS disabled for notifications table. This is temporary!' as status;