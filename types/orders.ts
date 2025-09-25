// Order and Transaction Types based on actual database schema

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface Order {
  id: string;
  buyer_id: string;
  farmer_id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  status: OrderStatus;
  delivery_address: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  purchase_code?: string;
}

export interface Transaction {
  id: string;
  order_id: string;
  amount: number;
  status: TransactionStatus;
  payment_method?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  farmer_id: string;
  name: string;
  description?: string;
  price: number;
  unit: string;
  quantity_available: number;
  category: string;
  image_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  phone?: string;
  user_type: 'farmer' | 'buyer';
  barangay?: string;
  farm_name?: string;
  farm_size?: string;
  created_at: string;
  updated_at: string;
}

// Combined interfaces for UI display
export interface OrderWithDetails extends Order {
  product: Product;
  farmer_profile: Profile;
  transaction?: Transaction;
}

export interface OrderSummary {
  orders: OrderWithDetails[];
  totalOrders: number;
  totalSpent: number;
  pendingPayments: number;
  completedDeliveries: number;
}

// Order creation interfaces
export interface CreateOrderData {
  product_id: string;
  quantity: number;
  delivery_address: string;
  notes?: string;
}

export interface CreateTransactionData {
  order_id: string;
  amount: number;
  payment_method: string;
}

// Status flows
export const ORDER_STATUS_FLOW: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered'];
export const TRANSACTION_STATUS_FLOW: TransactionStatus[] = ['pending', 'completed'];

// Status display configurations
export const ORDER_STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#f59e0b', bgColor: '#fef3c7' },
  confirmed: { label: 'Confirmed', color: '#3b82f6', bgColor: '#dbeafe' },
  shipped: { label: 'Shipped', color: '#8b5cf6', bgColor: '#e9d5ff' },
  delivered: { label: 'Delivered', color: '#10b981', bgColor: '#d1fae5' },
  cancelled: { label: 'Cancelled', color: '#ef4444', bgColor: '#fee2e2' }
};

export const TRANSACTION_STATUS_CONFIG = {
  pending: { label: 'Payment Pending', color: '#f59e0b', bgColor: '#fef3c7' },
  completed: { label: 'Paid', color: '#10b981', bgColor: '#d1fae5' },
  failed: { label: 'Payment Failed', color: '#ef4444', bgColor: '#fee2e2' }
};

// Validation functions
export const validateOrderAmount = (orderTotal: number, transactionAmount: number): boolean => {
  return transactionAmount <= orderTotal;
};

export const canAdvanceOrderStatus = (currentStatus: OrderStatus, transactionStatus?: TransactionStatus): boolean => {
  // Can't advance order status if payment is not completed (except for cancellation)
  if (currentStatus !== 'cancelled' && transactionStatus !== 'completed') {
    return false;
  }
  return true;
};

export const getNextOrderStatus = (currentStatus: OrderStatus): OrderStatus | null => {
  const currentIndex = ORDER_STATUS_FLOW.indexOf(currentStatus);
  if (currentIndex === -1 || currentIndex === ORDER_STATUS_FLOW.length - 1) {
    return null;
  }
  return ORDER_STATUS_FLOW[currentIndex + 1];
};