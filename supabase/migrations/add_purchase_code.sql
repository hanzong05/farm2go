-- Add purchase_code column to orders table
ALTER TABLE public.orders ADD COLUMN purchase_code TEXT UNIQUE;

-- Create index for purchase_code lookups
CREATE INDEX idx_orders_purchase_code ON public.orders(purchase_code);

-- Update existing orders to have purchase codes (optional, for existing data)
-- Note: This should be run carefully in production
UPDATE public.orders
SET purchase_code = 'FG-' || EXTRACT(YEAR FROM created_at) || '-' ||
    SUBSTR(MD5(id::text), 1, 6)
WHERE purchase_code IS NULL;