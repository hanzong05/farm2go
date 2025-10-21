-- Create function to create order with automatic stock management
-- This function handles both order creation and stock updates in a single transaction

CREATE OR REPLACE FUNCTION create_order_with_transaction(
  p_buyer_id UUID,
  p_farmer_id UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_total_price NUMERIC,
  p_delivery_address TEXT,
  p_notes TEXT,
  p_payment_method TEXT
) RETURNS JSON AS $$
DECLARE
  v_order_id UUID;
  v_transaction_id UUID;
  v_purchase_code TEXT;
  v_current_stock INTEGER;
  v_order JSON;
  v_transaction JSON;
BEGIN
  -- Check current stock
  SELECT quantity_available INTO v_current_stock
  FROM products
  WHERE id = p_product_id;

  -- Ensure sufficient stock
  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_current_stock, p_quantity;
  END IF;

  -- Generate purchase code
  v_purchase_code := 'PO-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || substr(md5(random()::text), 1, 9);

  -- Create the order
  INSERT INTO orders (
    buyer_id,
    farmer_id,
    product_id,
    quantity,
    total_price,
    status,
    delivery_address,
    notes,
    purchase_code
  ) VALUES (
    p_buyer_id,
    p_farmer_id,
    p_product_id,
    p_quantity,
    p_total_price,
    'pending',
    p_delivery_address,
    p_notes,
    v_purchase_code
  )
  RETURNING id INTO v_order_id;

  -- Create the transaction
  INSERT INTO transactions (
    order_id,
    amount,
    status,
    payment_method
  ) VALUES (
    v_order_id,
    p_total_price,
    'pending',
    p_payment_method
  )
  RETURNING id INTO v_transaction_id;

  -- Decrease product stock
  UPDATE products
  SET quantity_available = quantity_available - p_quantity
  WHERE id = p_product_id;

  -- Get the created order
  SELECT row_to_json(o.*) INTO v_order
  FROM orders o
  WHERE o.id = v_order_id;

  -- Get the created transaction
  SELECT row_to_json(t.*) INTO v_transaction
  FROM transactions t
  WHERE t.id = v_transaction_id;

  -- Return both order and transaction
  RETURN json_build_object(
    'order', v_order,
    'transaction', v_transaction
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to cancel order and restore stock
CREATE OR REPLACE FUNCTION cancel_order_with_stock_restore(
  p_order_id UUID,
  p_cancellation_reason TEXT
) RETURNS JSON AS $$
DECLARE
  v_order_status TEXT;
  v_product_id UUID;
  v_quantity INTEGER;
  v_order JSON;
BEGIN
  -- Get order details
  SELECT status, product_id, quantity
  INTO v_order_status, v_product_id, v_quantity
  FROM orders
  WHERE id = p_order_id;

  -- Check if order exists
  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Only allow cancelling pending orders
  IF v_order_status != 'pending' THEN
    RAISE EXCEPTION 'Can only cancel pending orders. Current status: %', v_order_status;
  END IF;

  -- Update order status to cancelled
  UPDATE orders
  SET
    status = 'cancelled',
    notes = CASE
      WHEN notes IS NULL THEN 'Cancellation reason: ' || p_cancellation_reason
      ELSE notes || E'\nCancellation reason: ' || p_cancellation_reason
    END,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Restore product stock
  UPDATE products
  SET quantity_available = quantity_available + v_quantity
  WHERE id = v_product_id;

  -- Update transaction status to failed
  UPDATE transactions
  SET status = 'failed', updated_at = NOW()
  WHERE order_id = p_order_id;

  -- Get the updated order
  SELECT row_to_json(o.*) INTO v_order
  FROM orders o
  WHERE o.id = p_order_id;

  RETURN v_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_order_with_transaction(UUID, UUID, UUID, INTEGER, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_order_with_stock_restore(UUID, TEXT) TO authenticated;
