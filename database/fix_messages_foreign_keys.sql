-- Fix foreign key relationships in messages table
-- The issue is that messages table references auth.users but we need profiles

-- Note: Run this ONLY if you want to change foreign keys to profiles
-- Alternative: Keep auth.users foreign keys but ensure RLS works properly

-- Option 1: Change foreign keys to profiles (recommended)
/*
-- First, drop existing foreign key constraints
ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;

-- Add new foreign key constraints to profiles table
ALTER TABLE public.messages
ADD CONSTRAINT messages_sender_id_fkey
FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.messages
ADD CONSTRAINT messages_receiver_id_fkey
FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
*/

-- Option 2: Fix RLS policies to work with auth.users foreign keys (current approach)
-- The current foreign keys point to auth.users which is fine
-- RLS policies use auth.uid() which should work

-- Make sure RLS policies are correct
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND sender_id != receiver_id
        AND auth.uid() IS NOT NULL
    );

-- Ensure users can read their messages
DROP POLICY IF EXISTS "Users can read their own messages" ON public.messages;
CREATE POLICY "Users can read their own messages" ON public.messages
    FOR SELECT USING (
        auth.uid() = sender_id
        OR auth.uid() = receiver_id
    );

-- Debug: Check if auth.uid() is working
-- You can test this by running: SELECT auth.uid(); in SQL editor