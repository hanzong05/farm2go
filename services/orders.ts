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

    // Try using RPC function first
    try {
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

      // If RPC succeeded and has data, return it
      if (!error && data) {
        console.log('✅ Order created via RPC function with automatic stock decrease');
        return data;
      }

      // If RPC failed or no data, fall back to manual
      console.log('⚠️ RPC function unavailable or failed, using manual order creation');
    } catch (rpcError) {
      console.log('⚠️ RPC error, falling back to manual creation:', rpcError);
    }

    // Fallback to manual order creation with stock management
    return await createOrderManually(buyerId, product.farmer_id, orderData, totalPrice);
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
  console.log('📦 Updating product stock...');
  const { data: currentProduct } = await supabase
    .from('products')
    .select('quantity_available')
    .eq('id', orderData.product_id)
    .single();

  if (currentProduct) {
    const oldStock = (currentProduct as any).quantity_available;
    const newStock = Math.max(0, oldStock - orderData.quantity);

    console.log(`📦 Stock update: ${oldStock} → ${newStock} (ordered: ${orderData.quantity})`);

    const { error: stockError } = await supabase
      .from('products')
      .update({
        quantity_available: newStock
      })
      .eq('id', orderData.product_id);

    if (stockError) {
      console.error('❌ Failed to update stock:', stockError);
    } else {
      console.log('✅ Stock updated successfully');
    }
  } else {
    console.error('❌ Product not found for stock update');
  }

  return { order: order as Order, transaction: transaction as Transaction };
};

// Get orders for buyer with full details
export const getBuyerOrders = async (buyerId: string): Promise<OrderWithDetails[]> => {
  try {
    console.log('🔍 Fetching orders for buyer:', buyerId);

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
      console.error('❌ Database error:', error);
      throw error;
    }

    console.log('✅ Raw data from database:', data);
    console.log('✅ Number of orders returned:', data?.length || 0);

    if (data && data.length > 0) {
      console.log('✅ Sample order structure:', JSON.stringify(data[0], null, 2));
    }

    const mappedOrders = (data || []).map((order: any) => ({
      ...order,
      product: order.products,
      farmer_profile: order.profiles,
      transaction: order.transactions?.[0], // Get the first/main transaction
      // Create order_items array for the modal to consume
      order_items: order.products ? [{
        order_id: order.id,
        quantity: order.quantity,
        unit_price: order.products.price || 0,
        product: {
          name: order.products.name || '',
          unit: order.products.unit || '',
          image_url: order.products.image_url || null,
        },
      }] : []
    }));

    console.log('✅ Mapped orders:', mappedOrders);
    console.log('✅ Sample mapped order:', JSON.stringify(mappedOrders[0], null, 2));

    return mappedOrders as OrderWithDetails[];
  } catch (error) {
    console.error('❌ Error fetching buyer orders:', error);
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
      transaction: order.transactions?.[0],
      // Create order_items array for the modal to consume
      order_items: order.products ? [{
        order_id: order.id,
        quantity: order.quantity,
        unit_price: order.products.price || 0,
        product: {
          name: order.products.name || '',
          unit: order.products.unit || '',
          image_url: order.products.image_url || null,
        },
      }] : []
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

    const order = data as any;
    return {
      ...order,
      product: order.products,
      farmer_profile: order.farmer_profile,
      transaction: order.transactions?.[0],
      // Create order_items array for the modal to consume
      order_items: order.products ? [{
        order_id: order.id,
        quantity: order.quantity,
        unit_price: order.products.price || 0,
        product: {
          name: order.products.name || '',
          unit: order.products.unit || '',
          image_url: order.products.image_url || null,
        },
      }] : []
    } as OrderWithDetails;
  } catch (error) {
    console.error('Error fetching order:', error);
    return null;
  }
};

// Cancel order (can only cancel pending orders)
export const cancelOrder = async (orderId: string, reason?: string): Promise<Order> => {
  try {
    // Try using the database function first
    const { data, error } = await supabase.rpc('cancel_order_with_stock_restore', {
      p_order_id: orderId,
      p_cancellation_reason: reason || 'No reason provided'
    });

    if (error) {
      console.error('RPC error, falling back to manual cancellation:', error);
      return await cancelOrderManually(orderId, reason);
    }

    return data as Order;
  } catch (error) {
    console.error('Error cancelling order:', error);
    throw error;
  }
};

// Manual fallback for order cancellation
const cancelOrderManually = async (orderId: string, reason?: string): Promise<Order> => {
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

  // Restore product quantity
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
};

// Real-time subscriptions for orders

// Subscribe to order updates for a specific user (buyer or farmer)
export const subscribeToUserOrders = (
  userId: string,
  userType: 'buyer' | 'farmer',
  callback: (order: Order, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void
) => {
  const filter = userType === 'buyer' ? `buyer_id.eq.${userId}` : `farmer_id.eq.${userId}`;

  const channel = supabase.channel(`orders_${userType}_${userId}`);

  ['INSERT', 'UPDATE', 'DELETE'].forEach(event => {
    channel.on(
      'postgres_changes',
      {
        event: event as any,
        schema: 'public',
        table: 'orders',
        filter
      },
      (payload) => {
        console.log(`📋 Order ${event.toLowerCase()} received:`, payload);
        callback(payload.new as Order, event as any);
      }
    );
  });

  return channel.subscribe((status) => {
    console.log(`📋 Orders subscription status for ${userType} ${userId}:`, status);
  });
};

// Subscribe to transaction updates for orders
export const subscribeToTransactionUpdates = (
  callback: (transaction: Transaction, eventType: 'INSERT' | 'UPDATE') => void,
  orderId?: string
) => {
  const channel = supabase.channel(`transactions_${orderId || 'all'}`);

  ['INSERT', 'UPDATE'].forEach(event => {
    channel.on(
      'postgres_changes',
      {
        event: event as any,
        schema: 'public',
        table: 'transactions',
        filter: orderId ? `order_id.eq.${orderId}` : undefined
      },
      (payload) => {
        console.log(`💳 Transaction ${event.toLowerCase()} received:`, payload);
        callback(payload.new as Transaction, event as any);
      }
    );
  });

  return channel.subscribe((status) => {
    console.log('💳 Transactions subscription status:', status);
  });
};

// Subscribe to specific order updates
export const subscribeToOrder = (
  orderId: string,
  callback: (order: Order, eventType: 'UPDATE') => void
) => {
  return supabase
    .channel(`order_${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id.eq.${orderId}`
      },
      (payload) => {
        console.log(`📋 Specific order ${orderId} updated:`, payload);
        callback(payload.new as Order, 'UPDATE');
      }
    )
    .subscribe((status) => {
      console.log(`📋 Order ${orderId} subscription status:`, status);
    });
};