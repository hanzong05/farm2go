import { supabase } from '../lib/supabase';
import {
  Order,
  Transaction,
  OrderWithDetails,
  CreateOrderData,
  CreateTransactionData,
  OrderStatus,
  TransactionStatus,
  validateOrderAmount,
  canAdvanceOrderStatus
} from '../types/orders';

// Order management functions
export const createOrder = async (buyerId: string, orderData: CreateOrderData): Promise<{ order: Order; transaction: Transaction }> => {
  try {
    console.log('🛒 Creating order for buyer:', buyerId);

    // Get product details first to calculate total
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', orderData.product_id)
      .single();

    if (productError || !product) {
      throw new Error('Product not found');
    }

    // Check availability
    if (product.quantity_available < orderData.quantity) {
      throw new Error('Insufficient product quantity available');
    }

    const totalPrice = product.price * orderData.quantity;

    // Start transaction
    const { data, error } = await supabase.rpc('create_order_with_transaction', {
      p_buyer_id: buyerId,
      p_farmer_id: product.farmer_id,
      p_product_id: orderData.product_id,
      p_quantity: orderData.quantity,
      p_total_price: totalPrice,
      p_delivery_address: orderData.delivery_address,
      p_notes: orderData.notes || null,
      p_payment_method: 'pending' // Default payment method
    });

    if (error) {
      console.error('Error creating order:', error);
      throw error;
    }

    // If the RPC function doesn't exist, fall back to manual transaction
    if (!data) {
      return await createOrderManually(buyerId, product.farmer_id, orderData, totalPrice);
    }

    return data;
  } catch (error) {
    console.error('Create order error:', error);
    throw error;
  }
};

// Fallback manual order creation
const createOrderManually = async (
  buyerId: string,
  farmerId: string,
  orderData: CreateOrderData,
  totalPrice: number
): Promise<{ order: Order; transaction: Transaction }> => {
  // Create order first
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      buyer_id: buyerId,
      farmer_id: farmerId,
      product_id: orderData.product_id,
      quantity: orderData.quantity,
      total_price: totalPrice,
      status: 'pending',
      delivery_address: orderData.delivery_address,
      notes: orderData.notes,
      purchase_code: `PO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    })
    .select()
    .single();

  if (orderError || !order) {
    throw new Error('Failed to create order');
  }

  // Then create transaction
  const { data: transaction, error: transactionError } = await supabase
    .from('transactions')
    .insert({
      order_id: order.id,
      amount: totalPrice,
      status: 'pending',
      payment_method: 'pending'
    })
    .select()
    .single();

  if (transactionError || !transaction) {
    // Cleanup: delete the order if transaction creation failed
    await supabase.from('orders').delete().eq('id', order.id);
    throw new Error('Failed to create transaction');
  }

  // Update product availability (manual approach)
  const { data: currentProduct } = await supabase
    .from('products')
    .select('quantity_available')
    .eq('id', orderData.product_id)
    .single();

  if (currentProduct) {
    await supabase
      .from('products')
      .update({
        quantity_available: Math.max(0, (currentProduct as any).quantity_available - orderData.quantity)
      })
      .eq('id', orderData.product_id);
  }

  return { order: order as Order, transaction: transaction as Transaction };
};

// Get orders for buyer with full details
export const getBuyerOrders = async (buyerId: string): Promise<OrderWithDetails[]> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        products:product_id (
          id,
          name,
          description,
          price,
          unit,
          category,
          image_url
        ),
        profiles:farmer_id (
          id,
          email,
          first_name,
          last_name,
          farm_name,
          barangay
        ),
        transactions (
          id,
          amount,
          status,
          payment_method,
          created_at,
          updated_at
        )
      `)
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map((order: any) => ({
      ...order,
      product: order.products,
      farmer_profile: order.profiles,
      transaction: order.transactions?.[0] // Get the first/main transaction
    })) as OrderWithDetails[];
  } catch (error) {
    console.error('Error fetching buyer orders:', error);
    throw error;
  }
};

// Get orders for farmer
export const getFarmerOrders = async (farmerId: string): Promise<OrderWithDetails[]> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        products:product_id (
          id,
          name,
          description,
          price,
          unit,
          category,
          image_url
        ),
        profiles:buyer_id (
          id,
          email,
          first_name,
          last_name,
          barangay
        ),
        transactions (
          id,
          amount,
          status,
          payment_method,
          created_at,
          updated_at
        )
      `)
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map((order: any) => ({
      ...order,
      product: order.products,
      farmer_profile: order.profiles, // This will be the buyer profile
      transaction: order.transactions?.[0]
    })) as OrderWithDetails[];
  } catch (error) {
    console.error('Error fetching farmer orders:', error);
    throw error;
  }
};

// Update order status
export const updateOrderStatus = async (orderId: string, newStatus: OrderStatus): Promise<Order> => {
  try {
    // Get current order and transaction status
    const { data: orderData, error: fetchError } = await supabase
      .from('orders')
      .select(`
        *,
        transactions (status)
      `)
      .eq('id', orderId)
      .single();

    if (fetchError || !orderData) {
      throw new Error('Order not found');
    }

    const transactionStatus = (orderData as any).transactions?.[0]?.status as TransactionStatus;

    // Validate status advancement
    if (!canAdvanceOrderStatus((orderData as any).status as OrderStatus, transactionStatus)) {
      throw new Error('Cannot advance order status: payment not completed');
    }

    const { data, error } = await supabase
      .from('orders')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as Order;
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
};

// Update transaction status
export const updateTransactionStatus = async (
  transactionId: string,
  newStatus: TransactionStatus,
  paymentMethod?: string
): Promise<Transaction> => {
  try {
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (paymentMethod) {
      updateData.payment_method = paymentMethod;
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // If payment is completed, check if we should advance order status
    if (newStatus === 'completed') {
      const { data: orderData } = await supabase
        .from('orders')
        .select('id, status')
        .eq('id', (data as any).order_id)
        .single();

      if (orderData && (orderData as any).status === 'pending') {
        await updateOrderStatus((orderData as any).id, 'confirmed');
      }
    }

    return data as Transaction;
  } catch (error) {
    console.error('Error updating transaction status:', error);
    throw error;
  }
};

// Get order by ID with full details
export const getOrderById = async (orderId: string): Promise<OrderWithDetails | null> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        products:product_id (
          id,
          name,
          description,
          price,
          unit,
          category,
          image_url
        ),
        farmer_profile:farmer_id (
          id,
          email,
          first_name,
          last_name,
          farm_name,
          barangay
        ),
        buyer_profile:buyer_id (
          id,
          email,
          first_name,
          last_name,
          barangay
        ),
        transactions (
          id,
          amount,
          status,
          payment_method,
          created_at,
          updated_at
        )
      `)
      .eq('id', orderId)
      .single();

    if (error) {
      throw error;
    }

    return {
      ...(data as any),
      product: (data as any).products,
      farmer_profile: (data as any).farmer_profile,
      transaction: (data as any).transactions?.[0]
    } as OrderWithDetails;
  } catch (error) {
    console.error('Error fetching order:', error);
    return null;
  }
};

// Cancel order (can only cancel pending orders)
export const cancelOrder = async (orderId: string, reason?: string): Promise<Order> => {
  try {
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      throw new Error('Order not found');
    }

    if ((order as any).status !== 'pending') {
      throw new Error('Can only cancel pending orders');
    }

    // Update order status to cancelled
    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        notes: reason ? `${(order as any).notes || ''}\nCancellation reason: ${reason}`.trim() : (order as any).notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Restore product quantity (manual approach)
    const { data: currentProduct } = await supabase
      .from('products')
      .select('quantity_available')
      .eq('id', (order as any).product_id)
      .single();

    if (currentProduct) {
      await supabase
        .from('products')
        .update({
          quantity_available: (currentProduct as any).quantity_available + (order as any).quantity
        })
        .eq('id', (order as any).product_id);
    }

    // Update transaction status to failed
    await supabase
      .from('transactions')
      .update({ status: 'failed' })
      .eq('order_id', orderId);

    return data as Order;
  } catch (error) {
    console.error('Error cancelling order:', error);
    throw error;
  }
};