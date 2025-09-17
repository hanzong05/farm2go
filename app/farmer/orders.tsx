import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';
import NavBar from '../../components/NavBar';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface Order {
  id: string;
  buyer_id: string;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  created_at: string;
  delivery_date: string | null;
  delivery_address: string | null;
  notes: string | null;
  buyer_profile?: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    company_name: string | null;
  };
  order_items?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    product: {
      name: string;
      unit: string;
    };
  }>;
}

const ORDER_STATUSES = [
  { key: 'all', label: 'All Orders', color: '#6b7280' },
  { key: 'pending', label: 'Pending', color: '#f59e0b' },
  { key: 'confirmed', label: 'Confirmed', color: '#3b82f6' },
  { key: 'preparing', label: 'Preparing', color: '#8b5cf6' },
  { key: 'ready', label: 'Ready', color: '#10b981' },
  { key: 'completed', label: 'Completed', color: '#059669' },
  { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
];

export default function FarmerOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, selectedStatus]);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      if (!userData?.profile) {
        router.replace('/auth/login');
        return;
      }

      setProfile(userData.profile);
      await loadOrders(userData.user.id);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (farmerId: string) => {
    try {
      // First get orders that contain products from this farmer
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          order_id,
          quantity,
          unit_price,
          products!inner (
            farmer_id,
            name,
            unit
          )
        `)
        .eq('products.farmer_id', farmerId);

      if (itemsError) throw itemsError;

      // Get unique order IDs
      const orderIds = [...new Set(orderItems?.map(item => item.order_id) || [])];

      if (orderIds.length === 0) {
        setOrders([]);
        return;
      }

      // Get order details
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          buyer_id,
          total_amount,
          status,
          created_at,
          delivery_date,
          delivery_address,
          notes,
          profiles!orders_buyer_id_fkey (
            first_name,
            last_name,
            phone,
            company_name
          )
        `)
        .in('id', orderIds)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Combine orders with their items
      const ordersWithItems = ordersData?.map(order => ({
        ...order,
        buyer_profile: order.profiles,
        order_items: orderItems?.filter(item => item.order_id === order.id).map(item => ({
          id: item.order_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          product: {
            name: item.products?.name || '',
            unit: item.products?.unit || '',
          },
        })),
      })) || [];

      setOrders(ordersWithItems);
    } catch (error) {
      console.error('Error loading orders:', error);
      throw error;
    }
  };

  const filterOrders = () => {
    if (selectedStatus === 'all') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter(order => order.status === selectedStatus));
    }
  };

  const onRefresh = async () => {
    if (!profile) return;
    setRefreshing(true);
    try {
      const userData = await getUserWithProfile();
      if (userData?.user) {
        await loadOrders(userData.user.id);
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // Update local state
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, status: newStatus as any } : order
        )
      );

      Alert.alert('Success', 'Order status updated successfully');
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(price);
  };

  const getStatusColor = (status: string) => {
    const statusObj = ORDER_STATUSES.find(s => s.key === status);
    return statusObj?.color || '#6b7280';
  };

  const renderOrderCard = ({ item: order }: { item: Order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderId}>Order #{order.id.slice(-8)}</Text>
          <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
          <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.buyerInfo}>
        <Text style={styles.buyerName}>
          {order.buyer_profile?.company_name ||
           `${order.buyer_profile?.first_name || ''} ${order.buyer_profile?.last_name || ''}`.trim() ||
           'Unknown Buyer'}
        </Text>
        {order.buyer_profile?.phone && (
          <Text style={styles.buyerPhone}>{order.buyer_profile.phone}</Text>
        )}
      </View>

      <View style={styles.orderItems}>
        <Text style={styles.itemsTitle}>Items:</Text>
        {order.order_items?.map((item, index) => (
          <Text key={index} style={styles.itemText}>
            " {item.quantity} {item.product.unit} of {item.product.name}
          </Text>
        ))}
      </View>

      <View style={styles.orderFooter}>
        <Text style={styles.totalAmount}>{formatPrice(order.total_amount)}</Text>

        {order.status === 'pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.confirmButton]}
              onPress={() => updateOrderStatus(order.id, 'confirmed')}
            >
              <Text style={styles.actionButtonText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => updateOrderStatus(order.id, 'cancelled')}
            >
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {order.status === 'confirmed' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.preparingButton]}
            onPress={() => updateOrderStatus(order.id, 'preparing')}
          >
            <Text style={styles.actionButtonText}>Start Preparing</Text>
          </TouchableOpacity>
        )}

        {order.status === 'preparing' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.readyButton]}
            onPress={() => updateOrderStatus(order.id, 'ready')}
          >
            <Text style={styles.actionButtonText}>Mark Ready</Text>
          </TouchableOpacity>
        )}

        {order.status === 'ready' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => updateOrderStatus(order.id, 'completed')}
          >
            <Text style={styles.actionButtonText}>Complete</Text>
          </TouchableOpacity>
        )}
      </View>

      {order.delivery_address && (
        <View style={styles.deliveryInfo}>
          <Text style={styles.deliveryLabel}>Delivery Address:</Text>
          <Text style={styles.deliveryText}>{order.delivery_address}</Text>
        </View>
      )}

      {order.notes && (
        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>Notes:</Text>
          <Text style={styles.notesText}>{order.notes}</Text>
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>=æ</Text>
      <Text style={styles.emptyTitle}>No Orders Found</Text>
      <Text style={styles.emptyDescription}>
        {selectedStatus === 'all'
          ? 'You haven\'t received any orders yet. Keep your products updated to attract buyers!'
          : `No ${selectedStatus} orders at the moment.`}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavBar currentRoute="/farmer/orders" />

      <View style={styles.content}>
        {/* Status Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {ORDER_STATUSES.map((status) => (
            <TouchableOpacity
              key={status.key}
              style={[
                styles.filterButton,
                selectedStatus === status.key && [
                  styles.filterButtonActive,
                  { backgroundColor: status.color }
                ]
              ]}
              onPress={() => setSelectedStatus(status.key)}
            >
              <Text style={[
                styles.filterButtonText,
                selectedStatus === status.key && styles.filterButtonTextActive
              ]}>
                {status.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Orders List */}
        <FlatList
          data={filteredOrders}
          renderItem={renderOrderCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.ordersList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#16a34a"
              colors={['#16a34a']}
            />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },

  // Filter
  filterContainer: {
    paddingVertical: 16,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonActive: {
    borderColor: 'transparent',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },

  // Orders List
  ordersList: {
    padding: 16,
    paddingTop: 0,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  orderDate: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  // Buyer Info
  buyerInfo: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  buyerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  buyerPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },

  // Order Items
  orderItems: {
    marginBottom: 12,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },

  // Order Footer
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
  },
  cancelButton: {
    backgroundColor: '#dc2626',
  },
  preparingButton: {
    backgroundColor: '#8b5cf6',
  },
  readyButton: {
    backgroundColor: '#10b981',
  },
  completeButton: {
    backgroundColor: '#059669',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Additional Info
  deliveryInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  deliveryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  deliveryText: {
    fontSize: 14,
    color: '#6b7280',
  },
  notesSection: {
    marginTop: 12,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});