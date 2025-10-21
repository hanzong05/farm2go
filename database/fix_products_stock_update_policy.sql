-- Create database function to update product stock securely
-- This function bypasses RLS and can be called by authenticated users

-- Function to decrease stock (when order is placed)
CREATE OR REPLACE FUNCTION decrease_product_stock(
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS JSON AS $$
DECLARE
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  v_result JSON;
BEGIN
  -- Get current stock
  SELECT quantity_available INTO v_current_stock
  FROM products
  WHERE id = p_product_id;

  -- Check if product exists
  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  -- Check sufficient stock
  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_current_stock, p_quantity;
  END IF;

  -- Calculate new stock
  v_new_stock := GREATEST(0, v_current_stock - p_quantity);

  -- Update stock
  UPDATE products
  SET quantity_available = v_new_stock,
      updated_at = NOW()
  WHERE id = p_product_id;

  -- Return result
  SELECT json_build_object(
    'product_id', p_product_id,
    'old_stock', v_current_stock,
    'new_stock', v_new_stock,
    'quantity_decreased', p_quantity
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increase stock (when order is cancelled)
CREATE OR REPLACE FUNCTION increase_product_stock(
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS JSON AS $$
DECLARE
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  v_result JSON;
BEGIN
  -- Get current stock
  SELECT quantity_available INTO v_current_stock
  FROM products
  WHERE id = p_product_id;

  -- Check if product exists
  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  -- Calculate new stock
  v_new_stock := v_current_stock + p_quantity;

  -- Update stock
  UPDATE products
  SET quantity_available = v_new_stock,
      updated_at = NOW()
  WHERE id = p_product_id;

  -- Return result
  SELECT json_build_object(
    'product_id', p_product_id,
    'old_stock', v_current_stock,
    'new_stock', v_new_stock,
    'quantity_increased', p_quantity
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION decrease_product_stock(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increase_product_stock(UUID, INTEGER) TO authenticated;
