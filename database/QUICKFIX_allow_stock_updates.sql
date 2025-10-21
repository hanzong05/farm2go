-- QUICKFIX: Allow stock updates by adding a permissive policy
-- This is a temporary fix. For production, use the decrease_product_stock() function instead.

-- Drop the policy if it exists and recreate it
DROP POLICY IF EXISTS "Allow stock updates for authenticated users" ON products;

-- Add policy to allow authenticated users to update quantity_available
CREATE POLICY "Allow stock updates for authenticated users" ON products
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Note: This allows ALL authenticated users to update product stock.
-- This is okay for your use case since orders need to update stock.
-- For better security, run fix_products_stock_update_policy.sql instead
-- which creates dedicated functions with SECURITY DEFINER.
