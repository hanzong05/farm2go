-- Enable realtime for notifications table
alter publication supabase_realtime add table notifications;

-- Ensure RLS is enabled for notifications table
alter table notifications enable row level security;

-- Create policy for users to see their own notifications in realtime
drop policy if exists "Users can view their own notifications" on notifications;
create policy "Users can view their own notifications" on notifications
  for select using (auth.uid() = recipient_id);

-- Create policy for users to update their own notifications (mark as read)
drop policy if exists "Users can update their own notifications" on notifications;
create policy "Users can update their own notifications" on notifications
  for update using (auth.uid() = recipient_id);

-- Create policy for authenticated users to insert notifications (for admin actions)
drop policy if exists "Authenticated users can insert notifications" on notifications;
create policy "Authenticated users can insert notifications" on notifications
  for insert with check (auth.role() = 'authenticated');

-- Additional policy to allow service role (for server-side operations)
drop policy if exists "Service role can insert notifications" on notifications;
create policy "Service role can insert notifications" on notifications
  for insert with check (auth.role() = 'service_role');

-- Policy to allow users to insert notifications for others (like farmers notifying buyers)
drop policy if exists "Users can create notifications for others" on notifications;
create policy "Users can create notifications for others" on notifications
  for insert with check (
    auth.uid() IS NOT NULL AND (
      auth.uid()::text = sender_id OR
      sender_id IS NULL OR
      -- Allow if the user is creating a notification (like farmer to buyer)
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()::text
        AND profiles.user_type IN ('admin', 'super-admin', 'farmer', 'buyer')
      )
    )
  );

-- Check realtime settings
select
  schemaname,
  tablename,
  attname,
  type
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename = 'notifications';

-- Show current policies
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where tablename = 'notifications';