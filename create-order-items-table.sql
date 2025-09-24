-- Create order_items table with proper relationships
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (quantity * price) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_created_at ON order_items(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for order_items

-- Allow users to view order items for their own orders
CREATE POLICY "Users can view their own order items" ON order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Allow farmers to view order items for orders of their products
CREATE POLICY "Farmers can view order items for their products" ON order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = order_items.product_id
    AND products.farmer_id = auth.uid()
  )
);

-- Allow admins to view all order items
CREATE POLICY "Admins can view all order items" ON order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type IN ('admin', 'super-admin')
  )
);

-- Allow authenticated users to insert order items (when placing orders)
CREATE POLICY "Users can insert order items" ON order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Allow users to update their own order items (before order is confirmed)
CREATE POLICY "Users can update their own order items" ON order_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
    AND orders.status IN ('pending', 'draft')
  )
);

-- Allow users to delete their own order items (before order is confirmed)
CREATE POLICY "Users can delete their own order items" ON order_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
    AND orders.status IN ('pending', 'draft')
  )
);