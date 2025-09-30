import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import ConfirmationModal from '../../components/ConfirmationModal';
import FilterSidebar from '../../components/FilterSidebar';
import HeaderComponent from '../../components/HeaderComponent';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { notifyOrderStatusChange } from '../../services/notifications';
import { subscribeToUserOrders } from '../../services/orders';
import { Database } from '../../types/database';
import { Order } from '../../types/orders';
import { applyFilters } from '../../utils/filterConfigs';

const { width } = Dimensions.get('window');

// Responsive breakpoints
const isTablet = width >= 768;
const isDesktop = width >= 1024;

type Profile = Database['public']['Tables']['profiles']['Row'];

// Database response types
interface DatabaseOrder {
  id: string;
  buyer_id: string;
  farmer_id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  status: string;
  delivery_address: string;
  notes: string | null;
  created_at: string;
  products: {
    name: string;
    unit: string;
    price: number;
  } | null;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
}

interface Order {
  id: string;
  buyer_id: string;
  farmer_id?: string;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled';
  created_at: string;
  delivery_date: string | null;
  delivery_address: string | null;
  notes: string | null;
  buyer_profile?: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  };
  farmer_profile?: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    farm_name: string | null;
  };
  order_items?: Array<{
    order_id: string;
    quantity: number;
    unit_price: number;
    product: {
      name: string;
      unit: string;
    };
  }>;
}

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'processing', label: 'Processing' },
  { key: 'ready', label: 'Ready' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

const CATEGORY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'vegetables', label: 'Vegetables' },
  { key: 'fruits', label: 'Fruits' },
  { key: 'grains', label: 'Grains' },
  { key: 'herbs', label: 'Herbs' },
];

const AMOUNT_RANGES = [
  { key: 'all', label: 'All Amounts', min: 0, max: 10000 },
  { key: 'low', label: '₱0 - ₱500', min: 0, max: 500 },
  { key: 'medium', label: '₱500 - ₱1,500', min: 500, max: 1500 },
  { key: 'high', label: '₱1,500 - ₱3,000', min: 1500, max: 3000 },
  { key: 'premium', label: '₱3,000+', min: 3000, max: 10000 },
];

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest First' },
  { key: 'oldest', label: 'Oldest First' },
  { key: 'amount-high', label: 'Amount: High to Low' },
  { key: 'amount-low', label: 'Amount: Low to High' },
  { key: 'status', label: 'Status' },
];

export default function FarmerOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeTab, setActiveTab] = useState<'received' | 'placed'>('received');
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    isDestructive: boolean;
    confirmText: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    isDestructive: false,
    confirmText: '',
    onConfirm: () => {},
  });

  const [selectedStatus, setSelectedStatus] = useState('all');

  // Filter state
  const [filterState, setFilterState] = useState({
    category: 'all',
    amountRange: 'all',
    dateRange: 'month',
    sortBy: 'newest'
  });

  useEffect(() => {
    loadData();

    // Set up real-time order subscription
    let subscription: any = null;

    const setupRealtimeSubscription = async () => {
      try {
        const userData = await getUserWithProfile();
        if (userData?.user?.id) {
          console.log('🔄 Setting up real-time order subscription for farmer:', userData.user.id);

          subscription = subscribeToUserOrders(
            userData.user.id,
            'farmer',
            (updatedOrder: Order, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => {
              console.log(`🔄 Farmer order ${eventType}:`, updatedOrder);

              // Update the orders state based on the event type
              if (eventType === 'INSERT') {
                // New order created, reload data to get full details
                loadData();
              } else if (eventType === 'UPDATE') {
                // Order updated, update the specific order in state
                setOrders(prevOrders =>
                  prevOrders.map(order =>
                    order.id === updatedOrder.id
                      ? { ...order, status: updatedOrder.status }
                      : order
                  )
                );
                console.log('✅ Farmer order updated in real-time:', updatedOrder);
              } else if (eventType === 'DELETE') {
                // Order deleted, remove from state
                setOrders(prevOrders =>
                  prevOrders.filter(order => order.id !== updatedOrder.id)
                );
              }
            }
          );
        }
      } catch (error) {
        console.error('❌ Failed to setup real-time subscription:', error);
      }
    };

    setupRealtimeSubscription();

    // Cleanup function
    return () => {
      if (subscription) {
        console.log('🛑 Cleaning up farmer order subscription');
        subscription.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, myOrders, selectedStatus, filterState, searchQuery, activeTab]);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      if (!userData?.profile) {
        router.replace('/auth/login');
        return;
      }

      setProfile(userData.profile);
      await Promise.all([
        loadOrders(userData.user.id),
        loadMyOrders(userData.user.id)
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (farmerId: string) => {
    try {
      // Get orders directly for this farmer with product and buyer information
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          buyer_id,
          farmer_id,
          product_id,
          quantity,
          total_price,
          status,
          delivery_address,
          notes,
          created_at,
          products (
            name,
            unit,
            price
          ),
          profiles!orders_buyer_id_fkey (
            first_name,
            last_name,
            phone
          )
        `)
        .eq('farmer_id', farmerId);

      if (ordersError) throw ordersError;

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      // Transform orders into the expected format
      const ordersWithItems: Order[] = (ordersData as DatabaseOrder[]).map(order => ({
        id: order.id,
        buyer_id: order.buyer_id,
        farmer_id: order.farmer_id, // Add the missing farmer_id field
        total_amount: order.total_price,
        status: order.status as Order['status'],
        created_at: order.created_at,
        delivery_date: null, // Not in current schema
        delivery_address: order.delivery_address,
        notes: order.notes,
        buyer_profile: order.profiles ? {
          first_name: order.profiles.first_name,
          last_name: order.profiles.last_name,
          phone: order.profiles.phone,
        } : undefined,
        order_items: [{
          order_id: order.id,
          quantity: order.quantity,
          unit_price: order.products?.price || 0,
          product: {
            name: order.products?.name || '',
            unit: order.products?.unit || '',
          },
        }],
      }));

      setOrders(ordersWithItems);
    } catch (error) {
      console.error('Error loading orders:', error);
      throw error;
    }
  };

  const loadMyOrders = async (userId: string) => {
    try {
      // Get orders placed by this farmer (as a buyer) with farmer and product information
      const { data: myOrdersData, error: myOrdersError } = await supabase
        .from('orders')
        .select(`
          id,
          buyer_id,
          farmer_id,
          product_id,
          quantity,
          total_price,
          status,
          delivery_address,
          notes,
          created_at,
          products (
            name,
            unit,
            price
          ),
          profiles!orders_farmer_id_fkey (
            first_name,
            last_name,
            phone,
            farm_name
          )
        `)
        .eq('buyer_id', userId);

      if (myOrdersError) throw myOrdersError;

      if (!myOrdersData || myOrdersData.length === 0) {
        setMyOrders([]);
        return;
      }

      // Transform orders into the expected format
      const myOrdersWithItems: Order[] = (myOrdersData as DatabaseOrder[]).map(order => ({
        id: order.id,
        buyer_id: order.buyer_id,
        farmer_id: order.farmer_id,
        total_amount: order.total_price,
        status: order.status as Order['status'],
        created_at: order.created_at,
        delivery_date: null,
        delivery_address: order.delivery_address,
        notes: order.notes,
        farmer_profile: order.profiles ? {
          first_name: order.profiles.first_name,
          last_name: order.profiles.last_name,
          phone: order.profiles.phone,
          farm_name: order.profiles.farm_name,
        } : undefined,
        order_items: [{
          order_id: order.id,
          quantity: order.quantity,
          unit_price: order.products?.price || 0,
          product: {
            name: order.products?.name || '',
            unit: order.products?.unit || '',
          },
        }],
      }));

      setMyOrders(myOrdersWithItems);
    } catch (error) {
      console.error('Error loading my orders:', error);
      throw error;
    }
  };

  const filterOrders = () => {
    const sourceOrders = activeTab === 'received' ? orders : myOrders;
    let filtered = sourceOrders;

    // Filter by status first
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(order => order.status === selectedStatus);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(order => {
        const orderId = order.id.slice(-8).toLowerCase();
        if (activeTab === 'received') {
          const buyerName = (`${order.buyer_profile?.first_name || ''} ${order.buyer_profile?.last_name || ''}`.trim() ||
            'unknown buyer').toLowerCase();
          const phone = order.buyer_profile?.phone?.toLowerCase() || '';
          const address = order.delivery_address?.toLowerCase() || '';
          const notes = order.notes?.toLowerCase() || '';

          return orderId.includes(searchLower) ||
                 buyerName.includes(searchLower) ||
                 phone.includes(searchLower) ||
                 address.includes(searchLower) ||
                 notes.includes(searchLower);
        } else {
          // For placed orders, search by farmer name and product names
          const farmerName = (`${order.farmer_profile?.first_name || ''} ${order.farmer_profile?.last_name || ''}`.trim() ||
            'unknown farmer').toLowerCase();
          const productNames = (order.order_items || []).map(item => item.product.name.toLowerCase()).join(' ');
          const address = order.delivery_address?.toLowerCase() || '';
          const notes = order.notes?.toLowerCase() || '';

          return orderId.includes(searchLower) ||
                 farmerName.includes(searchLower) ||
                 productNames.includes(searchLower) ||
                 address.includes(searchLower) ||
                 notes.includes(searchLower);
        }
      });
    }

    // Apply other filters using the utility function
    filtered = applyFilters(filtered, filterState, {
      dateKey: 'created_at',
      amountKey: 'total_amount'
    });

    setFilteredOrders(filtered);
  };

  const onRefresh = async () => {
    if (!profile) return;
    setRefreshing(true);
    try {
      const userData = await getUserWithProfile();
      if (userData?.user) {
        await Promise.all([
          loadOrders(userData.user.id),
          loadMyOrders(userData.user.id)
        ]);
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOrderStatusUpdate = (order: Order, newStatus: Order['status']) => {
    const buyerName = order.buyer_profile
      ? `${order.buyer_profile.first_name} ${order.buyer_profile.last_name}`.trim()
      : 'the customer';

    const statusLabels = {
      'confirmed': 'Accept',
      'cancelled': 'Decline',
      'processing': 'Start Preparing',
      'ready': 'Mark as Ready',
      'delivered': 'Complete Delivery'
    };

    const statusMessages = {
      'confirmed': 'accept this order',
      'cancelled': 'decline this order',
      'processing': 'start preparing this order',
      'ready': 'mark this order as ready for pickup/delivery',
      'delivered': 'complete delivery of this order'
    };

    const label = statusLabels[newStatus] || 'Update';
    const action = statusMessages[newStatus] || 'update this order';
    const isDestructive = newStatus === 'cancelled';

    setConfirmModal({
      visible: true,
      title: `${label} Order?`,
      message: `Are you sure you want to ${action} from ${buyerName}? This will notify the customer of the status change.`,
      isDestructive,
      confirmText: `Yes, ${label}`,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        await updateOrderStatus(order.id, newStatus);
      }
    });
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      // Get order details before update for notifications
      const currentOrder = orders.find(o => o.id === orderId);
      if (!currentOrder) {
        Alert.alert('Error', 'Order not found');
        return;
      }

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Send notifications about order status change
      try {
        console.log('🔍 Order data for notification:', {
          orderId,
          buyerId: currentOrder.buyer_id,
          farmerId: currentOrder.farmer_id,
          hasOrder: !!currentOrder
        });

        // Only send notification if we have a valid profile ID
        if (profile?.id) {
          await notifyOrderStatusChange(
            orderId,
            newStatus,
            currentOrder.buyer_id,
            currentOrder.farmer_id,
            {
              totalAmount: currentOrder.total_amount,
              itemCount: currentOrder.order_items?.length || 0,
              farmerName: `${profile?.first_name} ${profile?.last_name}`,
              buyerName: currentOrder.buyer_profile ? `${currentOrder.buyer_profile.first_name} ${currentOrder.buyer_profile.last_name}` : undefined
            },
            profile.id
          );
        } else {
          console.warn('⚠️ Skipping notification: profile.id is not available');
        }

        console.log('✅ Order status change notification sent');
      } catch (notifError) {
        console.error('⚠️ Failed to send order notification:', notifError);
        // Don't fail the status update if notifications fail
      }

      // Update local state
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      Alert.alert('Success', 'Order status updated successfully');
    } catch (error) {
      console.error('Error updating order status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update order status';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleOrderPress = (order: Order) => {
    setSelectedOrder(order);
    setShowActionModal(true);
  };

  const handleActionModalClose = () => {
    setSelectedOrder(null);
    setShowActionModal(false);
  };

  const handleOrderAction = async (action: 'confirm' | 'cancel' | 'ready') => {
    if (!selectedOrder) return;

    let newStatus: Order['status'];
    switch (action) {
      case 'confirm':
        newStatus = 'confirmed';
        break;
      case 'cancel':
        newStatus = 'cancelled';
        break;
      case 'ready':
        newStatus = 'ready';
        break;
      default:
        return;
    }

    handleActionModalClose(); // Close the action modal first
    handleOrderStatusUpdate(selectedOrder, newStatus); // Then show confirmation
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
    const statusColors = {
      'all': '#6b7280',
      'pending': '#f59e0b',
      'confirmed': '#3b82f6',
      'processing': '#8b5cf6',
      'ready': '#10b981',
      'delivered': '#059669',
      'cancelled': '#dc2626',
    };
    return statusColors[status as keyof typeof statusColors] || '#6b7280';
  };

  // Create filter sections for the FilterSidebar component
  const getFilterSections = () => {
    const sourceOrders = activeTab === 'received' ? orders : myOrders;
    return [
      {
        key: 'category',
        title: 'Categories',
        type: 'category' as const,
        options: CATEGORY_FILTERS.map(category => ({
          key: category.key,
          label: category.label,
          count: category.key === 'all'
            ? sourceOrders.length
            : sourceOrders.filter(o => {
                // Since farmer orders don't have product categories in the current structure,
                // we'll use a placeholder count
                return true;
              }).length
        }))
      },
      {
        key: 'amountRange',
        title: 'Amount Range',
        type: 'range' as const,
        options: AMOUNT_RANGES.map(range => ({
          key: range.key,
          label: range.label,
          min: range.min,
          max: range.max
        }))
      },
      {
        key: 'sortBy',
        title: 'Sort By',
        type: 'sort' as const,
        options: SORT_OPTIONS.map(sort => ({
          key: sort.key,
          label: sort.label
        }))
      }
    ];
  };

  // Handle filter changes
  const handleFilterChange = (key: string, value: any) => {
    setFilterState(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const renderOrderCard = ({ item: order, isCompact = false }: { item: Order; isCompact?: boolean }) => {
    const statusColor = getStatusColor(order.status);

    return (
      <TouchableOpacity
        style={[
          styles.orderCard,
          isDesktop && styles.orderCardDesktop,
          isCompact && styles.orderCardCompact
        ]}
        onPress={() => handleOrderPress(order)}
        activeOpacity={0.8}
      >
        <View style={[
          styles.orderHeader,
          isDesktop && styles.orderHeaderDesktop
        ]}>
          <View style={styles.orderMainInfo}>
            <Text style={[
              styles.orderId,
              isCompact && styles.orderIdCompact
            ]}>Order #{order.id.slice(-8)}</Text>
            <Text style={[
              styles.orderDate,
              isCompact && styles.orderDateCompact
            ]}>{formatDate(order.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>
              {order.status === 'pending' ? 'NEW' :
               order.status === 'confirmed' ? 'CONFIRMED' :
               order.status === 'processing' ? 'PROCESSING' :
               order.status === 'ready' ? 'READY' :
               order.status === 'delivered' ? 'DELIVERED' : 'CANCELLED'}
            </Text>
          </View>
        </View>

        <View style={[
          styles.buyerSection,
          isDesktop && styles.buyerSectionDesktop
        ]}>
          {activeTab === 'received' ? (
            <>
              <Text style={[
                styles.sectionLabel,
                isCompact && styles.sectionLabelCompact
              ]}>Customer:</Text>
              <Text style={[
                styles.buyerName,
                isCompact && styles.buyerNameCompact
              ]}>
{`${order.buyer_profile?.first_name || ''} ${order.buyer_profile?.last_name || ''}`.trim() ||
                 'Unknown Buyer'}
              </Text>
              {order.buyer_profile?.phone && (
                <View style={styles.buyerPhoneContainer}>
                  <Icon name="phone" size={12} color="#64748b" style={{marginRight: 6}} />
                  <Text style={[
                    styles.buyerPhone,
                    isCompact && styles.buyerPhoneCompact
                  ]}>{order.buyer_profile.phone}</Text>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={[
                styles.sectionLabel,
                isCompact && styles.sectionLabelCompact
              ]}>Farmer:</Text>
              <Text style={[
                styles.buyerName,
                isCompact && styles.buyerNameCompact
              ]}>
{order.farmer_profile?.farm_name ||
                 `${order.farmer_profile?.first_name || ''} ${order.farmer_profile?.last_name || ''}`.trim() ||
                 'Unknown Farmer'}
              </Text>
              {order.farmer_profile?.phone && (
                <View style={styles.buyerPhoneContainer}>
                  <Icon name="phone" size={12} color="#64748b" style={{marginRight: 6}} />
                  <Text style={[
                    styles.buyerPhone,
                    isCompact && styles.buyerPhoneCompact
                  ]}>{order.farmer_profile.phone}</Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={[
          styles.orderDetails,
          isDesktop && styles.orderDetailsDesktop
        ]}>
          <View style={styles.orderItems}>
            <Text style={[
              styles.itemsTitle,
              isCompact && styles.itemsTitleCompact
            ]}>Items Ordered:</Text>
            {order.order_items?.map((item, index) => (
              <View key={index} style={[
                styles.orderItem,
                isCompact && styles.orderItemCompact
              ]}>
                <Text style={[
                  styles.itemQuantity,
                  isCompact && styles.itemQuantityCompact
                ]}>{item.quantity} {item.product.unit}</Text>
                <Text style={[
                  styles.itemName,
                  isCompact && styles.itemNameCompact
                ]}>{item.product.name}</Text>
                <Text style={[
                  styles.itemPrice,
                  isCompact && styles.itemPriceCompact
                ]}>{formatPrice(item.unit_price)}</Text>
              </View>
            )) || null}
          </View>

          <View style={[
            styles.orderAmount,
            isCompact && styles.orderAmountCompact
          ]}>
            <Text style={[
              styles.amountLabel,
              isCompact && styles.amountLabelCompact
            ]}>Total Amount</Text>
            <Text style={[
              styles.amountValue,
              isCompact && styles.amountValueCompact
            ]}>{formatPrice(order.total_amount)}</Text>
          </View>
        </View>

        {/* Action Buttons - Only show for received orders */}
        {activeTab === 'received' && (
          <View style={[
            styles.actionSection,
            isDesktop && styles.actionSectionDesktop
          ]}>
            {order.status === 'pending' && (
              <View style={[
                styles.actionButtons,
                isDesktop && styles.actionButtonsDesktop
              ]}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.confirmButton]}
                  onPress={() => handleOrderStatusUpdate(order, 'confirmed')}
                  activeOpacity={0.8}
                >
                  <View style={styles.actionButtonContent}>
                    <Icon name="check" size={14} color="#ffffff" style={{marginRight: 6}} />
                    <Text style={styles.actionButtonText}>Accept</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => handleOrderStatusUpdate(order, 'cancelled')}
                  activeOpacity={0.8}
                >
                  <View style={styles.actionButtonContent}>
                    <Icon name="times" size={14} color="#ffffff" style={{marginRight: 6}} />
                    <Text style={styles.actionButtonText}>Decline</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {order.status === 'confirmed' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.processingButton]}
                onPress={() => handleOrderStatusUpdate(order, 'processing')}
                activeOpacity={0.8}
              >
                <View style={styles.actionButtonContent}>
                  <Icon name="utensils" size={14} color="#ffffff" style={{marginRight: 6}} />
                  <Text style={styles.actionButtonText}>Start Preparing</Text>
                </View>
              </TouchableOpacity>
            )}

            {order.status === 'processing' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.readyButton]}
                onPress={() => handleOrderStatusUpdate(order, 'ready')}
                activeOpacity={0.8}
              >
                <View style={styles.actionButtonContent}>
                  <Icon name="check-circle" size={14} color="#ffffff" style={{marginRight: 6}} />
                  <Text style={styles.actionButtonText}>Mark Ready</Text>
                </View>
              </TouchableOpacity>
            )}

            {order.status === 'ready' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.completeButton]}
                onPress={() => handleOrderStatusUpdate(order, 'delivered')}
                activeOpacity={0.8}
              >
                <View style={styles.actionButtonContent}>
                  <Icon name="truck" size={14} color="#ffffff" style={{marginRight: 6}} />
                  <Text style={styles.actionButtonText}>Complete Delivery</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Additional Info */}
        {order.delivery_address && (
          <View style={styles.additionalInfo}>
            <View style={styles.infoRow}>
              <Icon name="map-marker-alt" size={16} color="#64748b" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Delivery Address</Text>
                <Text style={styles.infoText}>{order.delivery_address}</Text>
              </View>
            </View>
          </View>
        )}

        {order.notes && (
          <View style={styles.additionalInfo}>
            <View style={styles.infoRow}>
              <Icon name="file-text" size={16} color="#64748b" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Special Notes</Text>
                <Text style={styles.infoText}>{order.notes}</Text>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={[
      styles.emptyContainer,
      isDesktop && styles.emptyContainerDesktop
    ]}>
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyIconContainer}>
          <Icon name={activeTab === 'received' ? 'file-text' : 'shopping-cart'} size={60} color="#10b981" />
        </View>
      </View>

      <Text style={styles.emptyTitle}>No Orders Found</Text>
      <Text style={styles.emptyDescription}>
{activeTab === 'received' ? (
          selectedStatus === 'all'
            ? 'You haven\'t received any orders yet. Keep your products updated to attract buyers!'
            : `No ${selectedStatus} orders received at the moment.`
        ) : (
          selectedStatus === 'all'
            ? 'You haven\'t placed any orders yet. Browse the marketplace to order from other farmers!'
            : `No ${selectedStatus} orders placed at the moment.`
        )}
      </Text>

      {selectedStatus === 'all' && (
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push(activeTab === 'received' ? '/farmer/products/add' : '/')}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaIcon}>{activeTab === 'received' ? '+' : '🛒'}</Text>
          <Text style={styles.ctaText}>{activeTab === 'received' ? 'Add Products' : 'Browse Marketplace'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderActionModal = () => {
    if (!selectedOrder) return null;

    const canConfirm = selectedOrder.status === 'pending';
    const canCancel = selectedOrder.status === 'pending' || selectedOrder.status === 'confirmed';
    const canSetReady = selectedOrder.status === 'confirmed';

    return (
      <Modal
        visible={showActionModal}
        animationKeyframesType="fade"
        transparent={true}
        onRequestClose={handleActionModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Actions</Text>
              <Text style={styles.modalOrderId}>Order #{selectedOrder.id.slice(-8)}</Text>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalDescription}>
                Choose an action for this order:
              </Text>

              <View style={styles.modalActions}>
                {canConfirm && (
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalConfirmButton]}
                    onPress={() => handleOrderAction('confirm')}
                    activeOpacity={0.8}
                  >
                    <Icon name="check" size={16} color="#ffffff" style={{marginRight: 8}} />
                    <Text style={styles.modalButtonText}>Confirm Order</Text>
                  </TouchableOpacity>
                )}

                {canSetReady && (
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalReadyButton]}
                    onPress={() => handleOrderAction('ready')}
                    activeOpacity={0.8}
                  >
                    <Icon name="check-circle" size={16} color="#ffffff" style={{marginRight: 8}} />
                    <Text style={styles.modalButtonText}>Mark Ready</Text>
                  </TouchableOpacity>
                )}

                {canCancel && (
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={() => handleOrderAction('cancel')}
                    activeOpacity={0.8}
                  >
                    <Icon name="times" size={16} color="#ffffff" style={{marginRight: 8}} />
                    <Text style={styles.modalButtonText}>Cancel Order</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={handleActionModalClose}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading orders dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        userType="farmer"
        currentRoute="/farmer/orders"
        showMessages={true}
        showNotifications={true}
        showSearch={true}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search orders..."
        showFilterButton={!isDesktop}
        onFilterPress={() => setShowSidebar(!showSidebar)}
      />

      {/* Main Tab Navigation */}
      <View style={styles.mainTabBar}>
        <TouchableOpacity
          style={[
            styles.mainTab,
            activeTab === 'received' && styles.activeMainTab
          ]}
          onPress={() => setActiveTab('received')}
        >
          <Text style={[
            styles.mainTabText,
            activeTab === 'received' && styles.activeMainTabText
          ]}>
            Orders Received
          </Text>
          {activeTab === 'received' && <View style={styles.mainTabIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.mainTab,
            activeTab === 'placed' && styles.activeMainTab
          ]}
          onPress={() => setActiveTab('placed')}
        >
          <Text style={[
            styles.mainTabText,
            activeTab === 'placed' && styles.activeMainTabText
          ]}>
            My Orders
          </Text>
          {activeTab === 'placed' && <View style={styles.mainTabIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Status Tab Bar */}
      <View style={styles.tabBar}>
        {STATUS_FILTERS.map((status) => (
          <TouchableOpacity
            key={status.key}
            style={[
              styles.tab,
              selectedStatus === status.key && styles.activeTab
            ]}
            onPress={() => setSelectedStatus(status.key)}
          >
            <Text style={[
              styles.tabText,
              selectedStatus === status.key && styles.activeTabText
            ]}>
              {status.label}
            </Text>
            {selectedStatus === status.key && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Main Content with Sidebar */}
      <View style={styles.mainContent}>
        {/* Desktop Sidebar */}
        {isDesktop && (
          <FilterSidebar
            sections={getFilterSections()}
            filterState={filterState}
            onFilterChange={handleFilterChange}
            width={240}
          />
        )}

        {/* Orders List */}
        <View style={[styles.ordersContainer, isDesktop && styles.ordersContainerWithSidebar]}>
          <ScrollView
            style={styles.scrollView}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#10b981"
                colors={['#10b981']}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {filteredOrders.length === 0 ? (
              renderEmptyState()
            ) : (
              <View style={styles.ordersList}>
                {filteredOrders.map((order) => (
                  <View key={order.id}>
                    {renderOrderCard({ item: order })}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {renderActionModal()}

      {/* Mobile Sidebar Modal */}
      {!isDesktop && (
        <FilterSidebar
          sections={getFilterSections()}
          filterState={filterState}
          onFilterChange={handleFilterChange}
          showMobile={showSidebar}
          onCloseMobile={() => setShowSidebar(false)}
          title="Filters"
        />
      )}

      <ConfirmationModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },

  // Main Tab Bar (Order type selection)
  mainTabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  mainTab: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    position: 'relative',
  },
  activeMainTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#10b981',
  },
  mainTabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
  },
  activeMainTabText: {
    color: '#10b981',
    fontWeight: '700',
  },
  mainTabIndicator: {
    position: 'absolute',
    bottom: -1,
    height: 3,
    width: '80%',
    backgroundColor: '#10b981',
    borderRadius: 2,
  },

  // Status Tab Bar (Status filter)
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    position: 'relative',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#10b981',
  },
  tabText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#10b981',
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    height: 2,
    width: '100%',
    backgroundColor: '#10b981',
  },

  // Main Content Layout
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  ordersContainer: {
    flex: 1,
  },
  ordersContainerWithSidebar: {
    flex: 1,
    marginLeft: 0,
  },

  // Scroll View
  scrollView: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  ordersList: {
    padding: 12,
    gap: 8,
  },


  // Order Card Styles
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },

  orderCardDesktop: {
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },

  orderCardCompact: {
    padding: 16,
    borderRadius: 12,
  },

  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },

  orderHeaderDesktop: {
    marginBottom: 16,
  },

  orderMainInfo: {
    flex: 1,
    marginRight: 16,
  },

  orderId: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6,
    lineHeight: 26,
  },

  orderIdCompact: {
    fontSize: 18,
    lineHeight: 22,
  },

  orderDate: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  orderDateCompact: {
    fontSize: 12,
  },

  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  statusText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },

  buyerSection: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },

  buyerSectionDesktop: {
    padding: 12,
    marginBottom: 16,
  },

  buyerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },

  buyerNameCompact: {
    fontSize: 16,
    marginBottom: 4,
  },

  buyerPhone: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  buyerPhoneCompact: {
    fontSize: 12,
  },

  orderDetails: {
    marginBottom: 20,
  },

  orderDetailsDesktop: {
    marginBottom: 16,
  },

  orderItems: {
    marginBottom: 20,
  },

  itemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },

  itemsTitleCompact: {
    fontSize: 14,
    marginBottom: 8,
  },

  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    marginBottom: 8,
  },

  orderItemCompact: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
  },

  itemQuantity: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
    width: 80,
  },

  itemQuantityCompact: {
    fontSize: 12,
    width: 60,
  },

  itemName: {
    fontSize: 14,
    color: '#0f172a',
    flex: 1,
    fontWeight: '500',
  },

  itemNameCompact: {
    fontSize: 12,
  },

  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  itemPriceCompact: {
    fontSize: 12,
  },

  orderAmount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },

  orderAmountCompact: {
    padding: 12,
  },

  amountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },

  amountLabelCompact: {
    fontSize: 14,
  },

  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
  },

  amountValueCompact: {
    fontSize: 18,
  },

  actionSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },

  actionSectionDesktop: {
    marginTop: 16,
    paddingTop: 16,
  },

  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },

  actionButtonsDesktop: {
    gap: 8,
  },

  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  confirmButton: {
    backgroundColor: '#3b82f6',
  },

  cancelButton: {
    backgroundColor: '#dc2626',
  },

  processingButton: {
    backgroundColor: '#8b5cf6',
  },

  readyButton: {
    backgroundColor: '#10b981',
  },

  completeButton: {
    backgroundColor: '#059669',
  },

  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  buyerPhoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  sectionLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  sectionLabelCompact: {
    fontSize: 11,
    marginBottom: 2,
  },

  additionalInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },

  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },

  infoContent: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },

  infoText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },

  emptyContainerDesktop: {
    paddingVertical: 80,
  },

  emptyIllustration: {
    marginBottom: 32,
  },

  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#bbf7d0',
  },

  emptyIcon: {
    fontSize: 60,
  },

  emptyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
    textAlign: 'center',
  },

  emptyDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 20,
  },

  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 36,
    paddingVertical: 20,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },

  ctaIcon: {
    fontSize: 22,
    color: '#ffffff',
    marginRight: 12,
    fontWeight: 'bold',
  },

  ctaText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },

  modalHeader: {
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },

  modalOrderId: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  modalContent: {
    padding: 24,
  },

  modalDescription: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 24,
    textAlign: 'center',
  },

  modalActions: {
    gap: 12,
    marginBottom: 24,
  },

  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  modalConfirmButton: {
    backgroundColor: '#3b82f6',
  },

  modalReadyButton: {
    backgroundColor: '#10b981',
  },

  modalCancelButton: {
    backgroundColor: '#dc2626',
  },

  modalButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },

  modalCloseButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },

  modalCloseButtonText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
});