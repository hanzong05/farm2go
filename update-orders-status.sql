-- Add cancellation_requested status to orders table
-- Run this in your Supabase SQL Editor

-- First, check if there's a constraint on the status column
-- If there is, we need to update it to include the new status

-- Option 1: If there's a check constraint, drop and recreate it
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add a new check constraint that includes cancellation_requested
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
CHECK (status IN (
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'ready',
    'delivered',
    'cancelled',
    'cancellation_requested'
));

-- Option 2: If the status column is an enum, we need to add the new value
-- First check what type the status column is
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'status';

-- If it shows 'USER-DEFINED' type, it's an enum and needs different handling
-- In that case, run this instead:
-- ALTER TYPE order_status_enum ADD VALUE 'cancellation_requested';

SELECT 'Orders status constraint updated to include cancellation_requested' as result;