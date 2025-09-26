-- Quick fix for notifications constraint violation
-- Run this in your Supabase SQL editor

-- Drop the existing constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the correct constraint with ALL notification types
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
CHECK (type IN (
    'user_approved', 'user_rejected', 'user_deleted',
    'product_approved', 'product_rejected', 'product_deleted',
    'product_created', 'product_updated', 'product_low_stock',
    'verification_approved', 'verification_rejected',
    'order_created', 'order_confirmed', 'order_processing', 'order_ready',
    'order_completed', 'order_cancelled', 'order_status_changed',
    'payment_received', 'payment_pending',
    'admin_action', 'system_message'
));