import { supabase } from '../lib/supabase';

type NotificationType =
  | 'user_approved' | 'user_rejected' | 'user_deleted'
  | 'product_approved' | 'product_rejected' | 'product_deleted'
  | 'product_created' | 'product_updated' | 'product_low_stock'
  | 'verification_approved' | 'verification_rejected'
  | 'order_created' | 'order_confirmed' | 'order_processing' | 'order_ready'
  | 'order_completed' | 'order_cancelled' | 'order_status_changed'
  | 'order_cancellation_requested'
  | 'payment_received' | 'payment_pending'
  | 'admin_action' | 'system_message';

interface CreateNotificationParams {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionData?: Record<string, any>;
  senderId?: string;
}

// Create notification in database
export const createNotification = async (params: CreateNotificationParams) => {
  try {
    console.log('📧 Creating notification:', params);

    // Check if we should skip database insertion for testing
    if (process.env.SKIP_NOTIFICATIONS === 'true') {
      console.log('⚠️ Notifications disabled via SKIP_NOTIFICATIONS env var');
      return {
        id: 'mock-' + Date.now(),
        recipient_id: params.recipientId,
        type: params.type,
        title: params.title,
        message: params.message,
        created_at: new Date().toISOString(),
        is_read: false
      };
    }

    // Enhanced debugging for notification creation
    console.log('🔍 Creating notification with params:', {
      recipientId: params.recipientId,
      type: params.type,
      title: params.title,
      message: params.message.substring(0, 50) + '...',
      senderId: params.senderId,
      hasActionData: !!params.actionData
    });

    const notificationData = {
      recipient_id: params.recipientId,
      type: params.type,
      title: params.title,
      message: params.message,
      action_url: params.actionUrl || null,
      action_data: params.actionData || null,
      sender_id: params.senderId || null,
      created_at: new Date().toISOString(),
      read_at: null,
      is_read: false,
    };

    console.log('📝 Inserting notification data:', notificationData);

    const { data, error } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error creating notification:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error details:', error.details);
      console.error('❌ Error hint:', error.hint);

      // Check if it's a constraint violation
      if (error.code === '23514' && error.message?.includes('notifications_type_check')) {
        console.error('💡 Fix: Update database constraint or check notification type values');
        console.error('💡 Notification type that failed:', params.type);
      }

      // Check if it's an RLS policy violation
      if (error.code === '42501' && error.message?.includes('row-level security policy')) {
        console.error('💡 Fix: Update RLS policies for notifications table');
        console.error('💡 Run: fix-notifications-rls.sql in Supabase SQL Editor');

        // Don't attempt fallback for RLS errors - they need proper database fix
        console.error('🚨 RLS policy is preventing notification creation');
      }

      throw error;
    }

    if (!data) {
      console.error('❌ No data returned from notification insert');
      throw new Error('No data returned from notification insert');
    }

    console.log('✅ Notification created successfully:', data.id);
    console.log('✅ Full notification data:', data);

    // Immediately broadcast the notification for real-time delivery
    try {
      await broadcastNotification(params.recipientId, data);
      console.log('📡 Notification broadcasted for immediate delivery');
    } catch (broadcastError) {
      console.warn('⚠️ Failed to broadcast notification, relying on postgres changes:', broadcastError);
    }

    return data;
  } catch (error) {
    console.error('❌ Failed to create notification:', error);
    console.error('❌ Full error object:', JSON.stringify(error, null, 2));
    throw error;
  }
};

// Notify user about admin actions
export const notifyUserAction = async (
  userId: string,
  action: 'approved' | 'rejected' | 'deleted',
  entityType: 'account' | 'product' | 'verification',
  entityName: string,
  adminId: string,
  reason?: string
) => {
  const actionMessages = {
    approved: {
      account: {
        title: '✅ Account Approved',
        message: `Your account has been approved by an administrator. You can now access all features.`
      },
      product: {
        title: '✅ Product Approved',
        message: `Your product "${entityName}" has been approved and is now live in the marketplace.`
      },
      verification: {
        title: '✅ Verification Approved',
        message: `Your verification documents have been approved. Your account is now fully verified.`
      }
    },
    rejected: {
      account: {
        title: '❌ Account Rejected',
        message: `Your account has been rejected by an administrator.${reason ? ` Reason: ${reason}` : ''}`
      },
      product: {
        title: '❌ Product Rejected',
        message: `Your product "${entityName}" has been rejected.${reason ? ` Reason: ${reason}` : ''}`
      },
      verification: {
        title: '❌ Verification Rejected',
        message: `Your verification documents have been rejected.${reason ? ` Reason: ${reason}` : ''}`
      }
    },
    deleted: {
      account: {
        title: '🗑️ Account Deleted',
        message: `Your account has been deleted by an administrator.${reason ? ` Reason: ${reason}` : ''}`
      },
      product: {
        title: '🗑️ Product Deleted',
        message: `Your product "${entityName}" has been deleted by an administrator.${reason ? ` Reason: ${reason}` : ''}`
      },
      verification: {
        title: '🗑️ Verification Deleted',
        message: `Your verification has been deleted by an administrator.${reason ? ` Reason: ${reason}` : ''}`
      }
    }
  };

  const { title, message } = actionMessages[action][entityType];

  // Map entity types and actions to valid notification types
  let notificationType: NotificationType;

  if (entityType === 'account') {
    // Account notifications use 'user_' prefix
    notificationType = `user_${action}` as NotificationType;
  } else if (entityType === 'verification') {
    // Verification notifications
    notificationType = `verification_${action}` as NotificationType;
  } else if (entityType === 'product') {
    // Product notifications
    notificationType = `product_${action}` as NotificationType;
  } else {
    // Fallback to system message for unknown types
    console.warn('⚠️ Unknown entity type for notification:', entityType, 'using system_message');
    notificationType = 'system_message';
  }

  console.log('🔍 Debug: Generated notification type:', notificationType, 'for entityType:', entityType, 'action:', action);

  return await createNotification({
    recipientId: userId,
    type: notificationType,
    title,
    message,
    senderId: adminId,
    actionData: {
      action,
      entityType,
      entityName,
      reason
    }
  });
};

// Notify all admins about important actions
export const notifyAllAdmins = async (
  title: string,
  message: string,
  senderId: string,
  actionData?: Record<string, any>
) => {
  try {
    console.log('📧 Notifying all admins:', { title, message });

    // Get all admin and super-admin users
    const { data: adminProfiles, error } = await supabase
      .from('profiles')
      .select('id')
      .in('user_type', ['admin', 'super-admin']);

    if (error) {
      console.error('❌ Error fetching admin profiles:', error);
      return;
    }

    if (!adminProfiles || adminProfiles.length === 0) {
      console.log('ℹ️ No admin users found to notify');
      return;
    }

    // Create notifications for all admins except the sender
    const notifications = adminProfiles
      .filter(profile => profile.id !== senderId)
      .map(profile => ({
        recipient_id: profile.id,
        type: 'admin_action' as NotificationType,
        title,
        message,
        sender_id: senderId,
        action_data: actionData || null,
        created_at: new Date().toISOString(),
        read_at: null,
        is_read: false,
      }));

    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('❌ Error creating admin notifications:', insertError);
      } else {
        console.log(`✅ Created ${notifications.length} admin notifications`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to notify admins:', error);
  }
};

// Notify admins in the same barangay as the farmer about order activities
export const notifyBarangayAdmins = async (
  farmerBarangay: string,
  title: string,
  message: string,
  senderId: string,
  actionData?: Record<string, any>
) => {
  try {
    console.log('🏘️ Notifying barangay admins in:', farmerBarangay, { title, message });

    // Get admin users in the same barangay as the farmer
    const { data: barangayAdminProfiles, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, barangay')
      .in('user_type', ['admin', 'super-admin'])
      .eq('barangay', farmerBarangay);

    if (error) {
      console.error('❌ Error fetching barangay admin profiles:', error);
      return;
    }

    if (!barangayAdminProfiles || barangayAdminProfiles.length === 0) {
      console.log(`ℹ️ No admin users found in barangay: ${farmerBarangay}`);
      return;
    }

    // Create notifications for barangay admins except the sender
    const notifications = barangayAdminProfiles
      .filter(profile => profile.id !== senderId)
      .map(profile => ({
        recipient_id: profile.id,
        type: 'admin_action' as NotificationType,
        title: `🏘️ ${title}`,
        message: `[${farmerBarangay}] ${message}`,
        sender_id: senderId,
        action_data: {
          ...actionData,
          barangay: farmerBarangay,
          notification_type: 'barangay_specific'
        },
        created_at: new Date().toISOString(),
        read_at: null,
        is_read: false,
      }));

    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('❌ Error creating barangay admin notifications:', insertError);
      } else {
        console.log(`✅ Created ${notifications.length} barangay admin notifications for ${farmerBarangay}`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to notify barangay admins:', error);
  }
};

// Notify farmers about relevant admin actions
export const notifyFarmersAboutAction = async (
  title: string,
  message: string,
  senderId: string,
  actionData?: Record<string, any>
) => {
  try {
    console.log('📧 Notifying farmers:', { title, message });

    // Get all farmer users
    const { data: farmerProfiles, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_type', 'farmer');

    if (error) {
      console.error('❌ Error fetching farmer profiles:', error);
      return;
    }

    if (!farmerProfiles || farmerProfiles.length === 0) {
      console.log('ℹ️ No farmer users found to notify');
      return;
    }

    // Create notifications for all farmers
    const notifications = farmerProfiles.map(profile => ({
      recipient_id: profile.id,
      type: 'system_message' as NotificationType,
      title,
      message,
      sender_id: senderId,
      action_data: actionData || null,
      created_at: new Date().toISOString(),
      read_at: null,
      is_read: false,
    }));

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('❌ Error creating farmer notifications:', insertError);
    } else {
      console.log(`✅ Created ${notifications.length} farmer notifications`);
    }
  } catch (error) {
    console.error('❌ Failed to notify farmers:', error);
  }
};

// Get notifications for a user with real-time subscription (Enhanced)
export const subscribeToNotifications = (
  userId: string,
  onNotification: (notification: any) => void
) => {
  console.log('🔔 Setting up enhanced real-time notification subscription for user:', userId);

  const channelName = `notifications_${userId}_${Date.now()}`;

  const subscription = supabase
    .channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: userId },
        private: false
      }
    })
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`
      },
      (payload) => {
        console.log('🔔 New notification received via postgres_changes:', payload.new);
        onNotification(payload.new);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`
      },
      (payload) => {
        console.log('🔔 Notification updated via postgres_changes:', payload.new);
        // Don't trigger callback for updates (like marking as read)
      }
    )
    .on('presence', { event: 'sync' }, () => {
      console.log('👥 Presence synced for notifications');
    })
    .on('broadcast', { event: 'notification' }, (payload) => {
      console.log('🔔 Notification received via broadcast:', payload);
      onNotification(payload.payload);
    })
    .subscribe((status, err) => {
      console.log('📡 Notification subscription status:', status);
      if (err) {
        console.error('❌ Notification subscription error:', err);
      }
    });

  return subscription;
};

// Enhanced broadcast function for immediate notifications
export const broadcastNotification = async (
  recipientId: string,
  notification: any
) => {
  try {
    console.log('📡 Broadcasting notification to recipient:', recipientId);

    const channelName = `notifications_${recipientId}`;

    const broadcastResult = await supabase
      .channel(channelName)
      .send({
        type: 'broadcast',
        event: 'notification',
        payload: notification
      });

    console.log('📡 Broadcast result:', broadcastResult);
    return broadcastResult;
  } catch (error) {
    console.error('❌ Failed to broadcast notification:', error);
  }
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId);

    if (error) {
      console.error('❌ Error marking notification as read:', error);
      throw error;
    }

    console.log('✅ Notification marked as read:', notificationId);
  } catch (error) {
    console.error('❌ Failed to mark notification as read:', error);
    throw error;
  }
};

// Get unread notification count
export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('❌ Error getting unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('❌ Failed to get unread count:', error);
    return 0;
  }
};

// Notify about product creation
export const notifyProductCreated = async (
  productId: string,
  productName: string,
  farmerId: string,
  adminIds: string[] = []
) => {
  try {
    console.log('📦 Notifying about product creation:', productName);

    // Notify farmer about their product being added
    await createNotification({
      recipientId: farmerId,
      type: 'product_created',
      title: '✅ Product Added Successfully',
      message: `Your product "${productName}" has been added to the marketplace and is pending admin approval.`,
      actionUrl: `/farmer/my-products`,
      actionData: {
        productId,
        productName,
        action: 'product_created'
      }
    });

    // Notify admins about new product needing approval
    for (const adminId of adminIds) {
      await createNotification({
        recipientId: adminId,
        type: 'admin_action',
        title: '📦 New Product Pending Approval',
        message: `A new product "${productName}" has been submitted and requires admin approval.`,
        actionUrl: `/admin/products`,
        senderId: farmerId,
        actionData: {
          productId,
          productName,
          farmerId,
          action: 'product_needs_approval'
        }
      });
    }
  } catch (error) {
    console.error('❌ Failed to notify about product creation:', error);
  }
};

// Notify about order creation
export const notifyOrderCreated = async (
  orderId: string,
  buyerId: string,
  farmerId: string,
  orderDetails: {
    totalAmount: number;
    itemCount: number;
    buyerName?: string;
    farmerName?: string;
    productName?: string;
    farmerBarangay?: string;
  }
) => {
  try {
    console.log('🛒 Notifying about order creation:', orderId);

    // Notify buyer about order confirmation
    await createNotification({
      recipientId: buyerId,
      type: 'order_created',
      title: '🛒 Order Placed Successfully',
      message: `Your order for ${orderDetails.itemCount} item(s) totaling ₱${orderDetails.totalAmount.toFixed(2)} has been placed and sent to the farmer.`,
      actionUrl: `/buyer/my-orders`,
      actionData: {
        orderId,
        totalAmount: orderDetails.totalAmount,
        itemCount: orderDetails.itemCount,
        action: 'order_created'
      }
    });

    // Notify farmer about new order
    await createNotification({
      recipientId: farmerId,
      type: 'order_created',
      title: '📦 New Order Received',
      message: `You have a new order from ${orderDetails.buyerName || 'a buyer'} for ${orderDetails.itemCount} item(s) worth ₱${orderDetails.totalAmount.toFixed(2)}.`,
      actionUrl: `/farmer/orders`,
      senderId: buyerId,
      actionData: {
        orderId,
        buyerId,
        totalAmount: orderDetails.totalAmount,
        itemCount: orderDetails.itemCount,
        action: 'new_order_received'
      }
    });

    // Notify barangay admins about the order activity
    if (orderDetails.farmerBarangay) {
      await notifyBarangayAdmins(
        orderDetails.farmerBarangay,
        'New Order Activity',
        `${orderDetails.buyerName || 'A buyer'} placed an order with farmer ${orderDetails.farmerName || 'in your barangay'} for ${orderDetails.productName || orderDetails.itemCount + ' item(s)'} worth ₱${orderDetails.totalAmount.toFixed(2)}.`,
        buyerId, // Buyer is the sender
        {
          orderId,
          buyerId,
          farmerId,
          totalAmount: orderDetails.totalAmount,
          itemCount: orderDetails.itemCount,
          productName: orderDetails.productName,
          action: 'barangay_order_activity'
        }
      );
    }
  } catch (error) {
    console.error('❌ Failed to notify about order creation:', error);
  }
};

// Notify about order status change
export const notifyOrderStatusChange = async (
  orderId: string,
  newStatus: string,
  buyerId: string,
  farmerId: string,
  orderDetails: {
    totalAmount?: number;
    itemCount?: number;
    farmerName?: string;
    buyerName?: string;
  },
  updatedBy: string
) => {
  try {
    console.log('📋 Notifying about order status change:', { orderId, newStatus });

    const statusMessages = {
      'confirmed': {
        buyer: '✅ Order Confirmed',
        farmer: '✅ Order Confirmed',
        buyerMsg: `Your order has been confirmed by ${orderDetails.farmerName || 'the farmer'} and is being prepared.`,
        farmerMsg: `You confirmed the order from ${orderDetails.buyerName || 'the buyer'}.`
      },
      'processing': {
        buyer: '⚡ Order Being Prepared',
        farmer: '⚡ Order In Progress',
        buyerMsg: `Your order is being prepared by ${orderDetails.farmerName || 'the farmer'}.`,
        farmerMsg: `Order from ${orderDetails.buyerName || 'the buyer'} is now being processed.`
      },
      'ready': {
        buyer: '🎉 Order Ready for Pickup',
        farmer: '📦 Order Ready',
        buyerMsg: `Your order is ready for pickup! Please collect it from ${orderDetails.farmerName || 'the farmer'}.`,
        farmerMsg: `Order for ${orderDetails.buyerName || 'the buyer'} is ready for pickup.`
      },
      'completed': {
        buyer: '✅ Order Completed',
        farmer: '✅ Order Completed',
        buyerMsg: `Your order has been completed. Thank you for supporting local farmers!`,
        farmerMsg: `Order from ${orderDetails.buyerName || 'the buyer'} has been completed.`
      },
      'cancelled': {
        buyer: '❌ Order Cancelled',
        farmer: '❌ Order Cancelled',
        buyerMsg: `Your order has been cancelled. If you have any questions, please contact the farmer.`,
        farmerMsg: `Order from ${orderDetails.buyerName || 'the buyer'} has been cancelled.`
      },
      'cancellation_requested': {
        buyer: '⏳ Cancellation Requested',
        farmer: '🚫 Cancellation Requested',
        buyerMsg: `Your cancellation request has been sent to ${orderDetails.farmerName || 'the farmer'} for review.`,
        farmerMsg: `${orderDetails.buyerName || 'A buyer'} has requested to cancel their order. Please review and respond.`
      }
    };

    const messages = statusMessages[newStatus as keyof typeof statusMessages];
    if (!messages) return;

    // Notify buyer
    await createNotification({
      recipientId: buyerId,
      type: 'order_status_changed',
      title: messages.buyer,
      message: messages.buyerMsg,
      actionUrl: `/buyer/my-orders`,
      senderId: updatedBy,
      actionData: {
        orderId,
        newStatus,
        action: 'order_status_changed'
      }
    });

    // Notify farmer (only if not the one who made the change)
    if (updatedBy !== farmerId) {
      await createNotification({
        recipientId: farmerId,
        type: 'order_status_changed',
        title: messages.farmer,
        message: messages.farmerMsg,
        actionUrl: `/farmer/orders`,
        senderId: updatedBy,
        actionData: {
          orderId,
          newStatus,
          action: 'order_status_changed'
        }
      });
    }
  } catch (error) {
    console.error('❌ Failed to notify about order status change:', error);
  }
};

// Notify about low stock
export const notifyLowStock = async (
  farmerId: string,
  productName: string,
  currentStock: number,
  lowStockThreshold: number
) => {
  try {
    console.log('📉 Notifying about low stock:', productName);

    await createNotification({
      recipientId: farmerId,
      type: 'product_low_stock',
      title: '⚠️ Low Stock Alert',
      message: `Your product "${productName}" is running low (${currentStock} units left, threshold: ${lowStockThreshold}).`,
      actionUrl: `/farmer/inventory`,
      actionData: {
        productName,
        currentStock,
        lowStockThreshold,
        action: 'low_stock_alert'
      }
    });
  } catch (error) {
    console.error('❌ Failed to notify about low stock:', error);
  }
};

// Get all notifications for a user
export const getUserNotifications = async (
  userId: string,
  limit: number = 50,
  offset: number = 0
) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        sender:profiles!notifications_sender_id_fkey(first_name, last_name)
      `)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Error fetching notifications:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('❌ Failed to fetch notifications:', error);
    return [];
  }
};