-- Fix purchase_code column type from array to text
-- First drop the column if it exists as array type
ALTER TABLE public.orders DROP COLUMN IF EXISTS purchase_code;

-- Add it back as text type with unique constraint
ALTER TABLE public.orders ADD COLUMN purchase_code TEXT UNIQUE;

-- Create index for purchase_code lookups
CREATE INDEX IF NOT EXISTS idx_orders_purchase_code ON public.orders(purchase_code);