-- First, let's check if the tables exist and see their structure
-- You can run these queries individually to debug

-- Check if orders table exists
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if order_items table exists
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'order_items' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check existing foreign key constraints
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND (tc.table_name = 'orders' OR tc.table_name = 'order_items');

-- If order_items table exists but doesn't have foreign key to orders, create it
-- Uncomment the lines below after checking the table structures:

-- ALTER TABLE order_items
-- ADD CONSTRAINT fk_order_items_order_id
-- FOREIGN KEY (order_id) REFERENCES orders(id)
-- ON DELETE CASCADE;

-- If the tables don't exist, create them with proper relationships
-- CREATE TABLE orders (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
--   farmer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
--   total_amount DECIMAL(10,2) NOT NULL,
--   status VARCHAR(50) DEFAULT 'pending',
--   created_at TIMESTAMPTZ DEFAULT NOW(),
--   updated_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- CREATE TABLE order_items (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
--   product_id UUID REFERENCES products(id) ON DELETE CASCADE,
--   quantity INTEGER NOT NULL,
--   price DECIMAL(10,2) NOT NULL,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );