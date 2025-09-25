-- Order and Transaction Management Setup
-- This script sets up the proper order and transaction flow as requested

-- First, let's ensure we have the proper enum types
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE product_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create RPC function for atomic order creation with transaction
CREATE OR REPLACE FUNCTION create_order_with_transaction(
    p_buyer_id UUID,
    p_farmer_id UUID,
    p_product_id UUID,
    p_quantity INTEGER,
    p_total_price NUMERIC,
    p_delivery_address TEXT,
    p_notes TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'pending'
) RETURNS JSON AS $$
DECLARE
    v_order_id UUID;
    v_transaction_id UUID;
    v_purchase_code TEXT;
    v_product_availability INTEGER;
    v_result JSON;
BEGIN
    -- Check product availability
    SELECT quantity_available INTO v_product_availability
    FROM products
    WHERE id = p_product_id;

    IF v_product_availability < p_quantity THEN
        RAISE EXCEPTION 'Insufficient product quantity. Available: %, Requested: %', v_product_availability, p_quantity;
    END IF;

    -- Generate purchase code
    v_purchase_code := 'PO-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || SUBSTR(MD5(RANDOM()::TEXT), 1, 8);

    -- Create order first
    INSERT INTO public.orders (
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
    ) RETURNING id INTO v_order_id;

    -- Create transaction
    INSERT INTO public.transactions (
        order_id,
        amount,
        status,
        payment_method
    ) VALUES (
        v_order_id,
        p_total_price,
        'pending',
        p_payment_method
    ) RETURNING id INTO v_transaction_id;

    -- Update product availability
    UPDATE products
    SET quantity_available = quantity_available - p_quantity,
        updated_at = NOW()
    WHERE id = p_product_id;

    -- Return the created order and transaction info
    SELECT json_build_object(
        'order', json_build_object(
            'id', v_order_id,
            'purchase_code', v_purchase_code,
            'status', 'pending'
        ),
        'transaction', json_build_object(
            'id', v_transaction_id,
            'status', 'pending'
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update order status with validation
CREATE OR REPLACE FUNCTION update_order_status_safe(
    p_order_id UUID,
    p_new_status order_status,
    p_user_id UUID
) RETURNS JSON AS $$
DECLARE
    v_current_order RECORD;
    v_transaction_status transaction_status;
    v_is_farmer BOOLEAN := FALSE;
    v_is_buyer BOOLEAN := FALSE;
    v_result JSON;
BEGIN
    -- Get current order details
    SELECT o.*, t.status as transaction_status
    INTO v_current_order
    FROM orders o
    LEFT JOIN transactions t ON t.order_id = o.id
    WHERE o.id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Check user permissions
    SELECT (farmer_id = p_user_id) INTO v_is_farmer FROM orders WHERE id = p_order_id;
    SELECT (buyer_id = p_user_id) INTO v_is_buyer FROM orders WHERE id = p_order_id;

    IF NOT v_is_farmer AND NOT v_is_buyer THEN
        RAISE EXCEPTION 'Unauthorized to update this order';
    END IF;

    -- Validate status transition
    IF p_new_status != 'cancelled' AND v_current_order.transaction_status != 'completed' THEN
        RAISE EXCEPTION 'Cannot advance order status: payment not completed';
    END IF;

    -- Buyers can only cancel pending orders
    IF v_is_buyer AND NOT v_is_farmer THEN
        IF p_new_status != 'cancelled' OR v_current_order.status != 'pending' THEN
            RAISE EXCEPTION 'Buyers can only cancel pending orders';
        END IF;
    END IF;

    -- Validate status progression for farmers
    IF v_is_farmer THEN
        CASE v_current_order.status
            WHEN 'pending' THEN
                IF p_new_status NOT IN ('confirmed', 'cancelled') THEN
                    RAISE EXCEPTION 'Pending orders can only be confirmed or cancelled';
                END IF;
            WHEN 'confirmed' THEN
                IF p_new_status NOT IN ('shipped', 'cancelled') THEN
                    RAISE EXCEPTION 'Confirmed orders can only be shipped or cancelled';
                END IF;
            WHEN 'shipped' THEN
                IF p_new_status NOT IN ('delivered', 'cancelled') THEN
                    RAISE EXCEPTION 'Shipped orders can only be delivered or cancelled';
                END IF;
            WHEN 'delivered' THEN
                RAISE EXCEPTION 'Delivered orders cannot be changed';
            WHEN 'cancelled' THEN
                RAISE EXCEPTION 'Cancelled orders cannot be changed';
        END CASE;
    END IF;

    -- Update order status
    UPDATE orders
    SET status = p_new_status,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- If cancelling, restore product quantity and fail transaction
    IF p_new_status = 'cancelled' THEN
        UPDATE products
        SET quantity_available = quantity_available + v_current_order.quantity,
            updated_at = NOW()
        WHERE id = v_current_order.product_id;

        UPDATE transactions
        SET status = 'failed',
            updated_at = NOW()
        WHERE order_id = p_order_id;
    END IF;

    SELECT json_build_object(
        'success', true,
        'order_id', p_order_id,
        'new_status', p_new_status
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update transaction status
CREATE OR REPLACE FUNCTION update_transaction_status_safe(
    p_transaction_id UUID,
    p_new_status transaction_status,
    p_payment_method TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_transaction RECORD;
    v_order_status order_status;
    v_result JSON;
BEGIN
    -- Get transaction details
    SELECT t.*, o.status as order_status, o.id as order_id
    INTO v_transaction
    FROM transactions t
    JOIN orders o ON o.id = t.order_id
    WHERE t.id = p_transaction_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found';
    END IF;

    -- Update transaction
    UPDATE transactions
    SET status = p_new_status,
        payment_method = COALESCE(p_payment_method, payment_method),
        updated_at = NOW()
    WHERE id = p_transaction_id;

    -- If payment completed and order is pending, confirm the order
    IF p_new_status = 'completed' AND v_transaction.order_status = 'pending' THEN
        UPDATE orders
        SET status = 'confirmed',
            updated_at = NOW()
        WHERE id = v_transaction.order_id;
    END IF;

    SELECT json_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'new_status', p_new_status,
        'order_auto_confirmed', (p_new_status = 'completed' AND v_transaction.order_status = 'pending')
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update order status when payment completes
CREATE OR REPLACE FUNCTION auto_confirm_order_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- If transaction status changed to completed, and order is pending, confirm it
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE orders
        SET status = 'confirmed',
            updated_at = NOW()
        WHERE id = NEW.order_id AND status = 'pending';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_confirm_order ON transactions;
CREATE TRIGGER trigger_auto_confirm_order
    AFTER UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION auto_confirm_order_on_payment();

-- Add updated_at triggers for both tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_transactions_updated_at ON transactions;
CREATE TRIGGER trigger_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION create_order_with_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION update_order_status_safe TO authenticated;
GRANT EXECUTE ON FUNCTION update_transaction_status_safe TO authenticated;

-- RLS policies for orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view orders they're involved in" ON orders
    FOR SELECT USING (
        buyer_id = auth.uid() OR
        farmer_id = auth.uid()
    );

CREATE POLICY "Buyers can create orders" ON orders
    FOR INSERT WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Farmers and buyers can update their orders" ON orders
    FOR UPDATE USING (
        farmer_id = auth.uid() OR
        buyer_id = auth.uid()
    );

-- RLS policies for transactions table
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transactions for their orders" ON transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = transactions.order_id
            AND (orders.buyer_id = auth.uid() OR orders.farmer_id = auth.uid())
        )
    );

CREATE POLICY "System can create transactions" ON transactions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update transactions" ON transactions
    FOR UPDATE USING (true);