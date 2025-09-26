-- TEMPORARY FIX: Remove the constraint entirely to allow any notification type
-- Run this in your Supabase SQL editor if you want to temporarily disable the constraint

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Note: This removes type validation entirely.
-- You should run fix-notifications-constraint.sql later to restore proper validation.