import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ConfirmationModal from '../../components/ConfirmationModal';
import FilterSidebar from '../../components/FilterSidebar';
import HeaderComponent from '../../components/HeaderComponent';
import MapDirectionsModal from '../../components/MapDirectionsModal';
import OrderDetailsModal from '../../components/OrderDetailsModal';
import OrderQRCodeModal from '../../components/OrderQRCodeModal';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { notifyBarangayAdmins, notifyOrderStatusChange } from '../../services/notifications';
import { getBuyerOrders, subscribeToUserOrders } from '../../services/orders';
import { Database } from '../../types/database';
import { ORDER_STATUS_CONFIG, OrderWithDetails, Order } from '../../types/orders';

const { width } = Dimensions.get('window');

type Profile = Database['public']['Tables']['profiles']['Row'];

// Status filters for the UI
const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancellation_requested', label: 'Cancellation Requested' },
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

const isDesktop = width >= 1024;

export default function BuyerMyOrdersScreen() {
  const navigation = useNavigation();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showSidebar, setShowSidebar] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const fadeAnim = new Animated.Value(0);
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

  // Filter state
  const [filterState, setFilterState] = useState({
    category: 'all',
    amountRange: 'all',
    dateRange: 'all',
    sortBy: 'newest'
  });

  useEffect(() => {
    loadData();

    // Fade in animationKeyframes
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Set up real-time order subscription
    let subscription: any = null;

    const setupRealtimeSubscription = async () => {
      try {
        const userData = await getUserWithProfile();
        if (userData?.user?.id) {
          console.log('🔄 Setting up real-time order subscription for buyer:', userData.user.id);

          subscription = subscribeToUserOrders(
            userData.user.id,
            'buyer',
            (updatedOrder: Order, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => {
              console.log(`🔄 Buyer order ${eventType}:`, updatedOrder);

              // Update the orders state based on the event type
              if (eventType === 'INSERT') {
                // New order created, reload data to get full details
                loadData();
              } else if (eventType === 'UPDATE') {
                // Order updated, update the specific order in state
                setOrders(prevOrders =>
                  prevOrders.map(order =>
                    order.id === updatedOrder.id
                      ? { ...order, ...updatedOrder }
                      : order
                  )
                );
                console.log('✅ Buyer order updated in real-time:', updatedOrder);
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
        console.log('🛑 Cleaning up buyer order subscription');
        subscription.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, selectedStatus, filterState]);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      console.log('User data:', userData);

      if (!userData?.profile) {
        console.warn('No user profile found, but keeping user logged in');
        Alert.alert(
          'Profile Not Found',
          'Unable to load your profile. Please try refreshing or contact support if the issue persists.',
          [
            {
              text: 'Retry',
              onPress: () => loadData()
            },
            {
              text: 'OK',
              style: 'cancel'
            }
          ]
        );
        return;
      }

      console.log('Setting profile and loading orders for user:', userData.user.id);
      setProfile(userData.profile);
      await loadOrders(userData.user.id);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (buyerId: string) => {
    try {
      console.log('📦 Loading orders for buyer:', buyerId);
      const ordersData = await getBuyerOrders(buyerId);
      console.log('📦 Orders loaded:', ordersData.length);
      console.log('📦 Orders data:', JSON.stringify(ordersData, null, 2));

      if (ordersData.length === 0) {
        console.warn('⚠️ No orders found for buyer:', buyerId);
      }

      setOrders(ordersData);
    } catch (error) {
      console.error('❌ Error loading orders:', error);
      Alert.alert('Error', `Failed to load orders: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  const filterOrders = () => {
    console.log('🔍 Starting filter with', orders.length, 'orders');
    console.log('🔍 Selected status:', selectedStatus);
    console.log('🔍 Filter state:', JSON.stringify(filterState));
    console.log('🔍 Sample order:', orders[0]);

    let filtered = orders;

    // Filter by status
    if (selectedStatus !== 'all') {
      console.log('🔍 Filtering by status:', selectedStatus);
      filtered = filtered.filter(order => {
        const match = order.status === selectedStatus;
        console.log(`  Order ${order.id} status: ${order.status}, match: ${match}`);
        return match;
      });
      console.log('🔍 After status filter:', filtered.length, 'orders');
    }

    // Apply other filters using the utility function
    try {
      const { applyFilters } = require('../../utils/filterConfigs');
      console.log('🔍 Applying utility filters with config:', {
        categoryKey: 'product.category',
        priceKey: 'total_price',
        dateKey: 'created_at',
      });
      filtered = applyFilters(filtered, filterState, {
        categoryKey: 'product.category',
        priceKey: 'total_price',
        dateKey: 'created_at',
      });
      console.log('🔍 After additional filters:', filtered.length, 'orders');
    } catch (error) {
      console.error('❌ Error applying filters:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Error stack:', error.stack);
    }

    console.log('🔍 Final filtered count:', filtered.length);
    console.log('🔍 Final filtered orders:', filtered);
    setFilteredOrders(filtered);
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

  const getStatusConfig = (status: string) => {
    const config = ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG];
    return config ? { color: config.color, bgColor: config.bgColor } : { color: '#6b7280', bgColor: '#f3f4f6' };
  };

  // Handle cancellation request
  const handleCancellationRequest = async (order: OrderWithDetails) => {
    if (!profile) return;

    const productName = order.product?.name || 'this product';
    const totalPrice = order.total_price || 0;

    setConfirmModal({
      visible: true,
      title: 'Request Cancellation?',
      message: `Are you sure you want to request cancellation for your order of "${productName}" (₱${totalPrice.toLocaleString()})? This will notify the farmer and admin.`,
      isDestructive: true,
      confirmText: 'Request Cancellation',
      onConfirm: () => {
        processCancellationRequest(order);
        setConfirmModal(prev => ({ ...prev, visible: false }));
      }
    });
  };

  const processCancellationRequest = async (order: OrderWithDetails) => {
    if (!profile) {
      Alert.alert('Error', 'User profile not available');
      return;
    }

    try {
      console.log('🚫 Processing cancellation request for order:', order.id);

      // Update order status to 'cancellation_requested' (fallback to 'cancelled' if not supported)
      let statusToUpdate = 'cancellation_requested';
      let notesUpdate = order.notes ? `${order.notes}\n[CANCELLATION REQUESTED BY BUYER]` : '[CANCELLATION REQUESTED BY BUYER]';

      // First try with cancellation_requested
      let { error: updateError } = await (supabase as any)
        .from('orders')
        .update({
          status: statusToUpdate,
          notes: notesUpdate,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      // If failed due to constraint, try with 'pending' status and rely on notes
      if (updateError && updateError.code === '23514') {
        console.log('⚠️ cancellation_requested not supported, using pending status with special notes');
        statusToUpdate = 'pending';
        notesUpdate = order.notes ? `${order.notes}\n[BUYER REQUESTED CANCELLATION - PENDING FARMER RESPONSE]` : '[BUYER REQUESTED CANCELLATION - PENDING FARMER RESPONSE]';

        const { error: fallbackError } = await (supabase as any)
          .from('orders')
          .update({
            status: statusToUpdate,
            notes: notesUpdate,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        updateError = fallbackError;
      }

      if (updateError) {
        console.error('❌ Error updating order status:', updateError);
        console.error('❌ Error code:', updateError.code);
        console.error('❌ Error message:', updateError.message);
        console.error('❌ Error details:', updateError.details);
        console.error('❌ Error hint:', updateError.hint);
        console.error('❌ Full error object:', JSON.stringify(updateError, null, 2));

        let errorMessage = 'Failed to request cancellation. Please try again.';
        if (updateError.code === '23514') {
          errorMessage = 'The cancellation_requested status is not supported. Please contact admin to update the system.';
        } else if (updateError.message) {
          errorMessage = `Database error: ${updateError.message}`;
        }

        Alert.alert('Error', errorMessage);
        return;
      }

      // Send notifications
      try {
        console.log('🔔 Starting notification process...');
        console.log('🔔 Order details:', {
          orderId: order.id,
          farmerId: order.farmer_profile?.id,
          farmerName: order.farmer_profile?.first_name,
          buyerName: `${profile.first_name} ${profile.last_name}`,
          barangay: order.farmer_profile?.barangay
        });

        // Notify farmer about cancellation request
        console.log('🔔 Notifying farmer...');
        await notifyOrderStatusChange(
          order.id,
          'cancellation_requested',
          profile.id, // buyerId
          order.farmer_profile?.id || '', // farmerId
          {
            buyerName: `${profile.first_name} ${profile.last_name}`,
            farmerName: order.farmer_profile?.first_name ? `${order.farmer_profile.first_name} ${order.farmer_profile.last_name}` : 'Farmer',
            totalAmount: order.total_price
          },
          profile.id // updatedBy (buyer requested the cancellation)
        );
        console.log('✅ Farmer notification sent');

        // Notify barangay admins about cancellation request
        if (order.farmer_profile?.barangay) {
          console.log('🔔 Notifying barangay admins for barangay:', order.farmer_profile.barangay);
          await notifyBarangayAdmins(
            order.farmer_profile.barangay,
            'Order Cancellation Request',
            `${profile.first_name} ${profile.last_name} has requested cancellation for order ${order.id} (${order.product?.name}) worth ₱${order.total_price.toFixed(2)}.`,
            profile.id,
            {
              orderId: order.id,
              buyerId: profile.id,
              farmerId: order.farmer_profile?.id,
              productName: order.product?.name,
              totalAmount: order.total_price,
              action: 'cancellation_requested'
            }
          );
          console.log('✅ Barangay admin notifications sent');
        } else {
          console.log('⚠️ No barangay information available for admin notifications');
        }

        console.log('✅ All cancellation request notifications completed');
      } catch (notifError) {
        console.error('❌ Failed to send cancellation notifications:', notifError);
        console.error('❌ Notification error details:', JSON.stringify(notifError, null, 2));

        // Show user that notifications failed but order update succeeded
        Alert.alert(
          'Partial Success',
          'Your cancellation request has been recorded, but we had trouble sending notifications. The farmer will still see your request.',
          [{ text: 'OK' }]
        );
      }

      Alert.alert(
        'Cancellation Requested',
        'Your cancellation request has been sent to the farmer and admin. You will be notified of their decision.',
        [{ text: 'OK' }]
      );

      // Refresh orders to show updated status
      await onRefresh();

    } catch (error) {
      console.error('❌ Error requesting cancellation:', error);
      Alert.alert('Error', 'Failed to request cancellation. Please try again.');
    }
  };

  // Create filter sections for the FilterSidebar component
  const getFilterSections = () => [
    {
      key: 'category',
      title: 'Categories',
      type: 'category' as const,
      options: CATEGORY_FILTERS.map(category => ({
        key: category.key,
        label: category.label,
        count: category.key === 'all'
          ? orders.length
          : orders.filter(o => o.product?.category?.toLowerCase() === category.key.toLowerCase()).length
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

  // Handle filter changes
  const handleFilterChange = (key: string, value: any) => {
    setFilterState(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleShowQRCode = (order: OrderWithDetails) => {
    setSelectedOrder(order);
    setShowQRModal(true);
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setSelectedOrder(null);
  };

  const handleShowOrderDetails = (order: OrderWithDetails) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  const handleCloseDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedOrder(null);
  };

  const handleShowDirections = (order: OrderWithDetails) => {
    if (!order.delivery_address) {
      Alert.alert('No Address', 'This order does not have a delivery address.');
      return;
    }
    setSelectedOrder(order);
    setShowMapModal(true);
  };

  const handleCloseMapModal = () => {
    setShowMapModal(false);
    setSelectedOrder(null);
  };

  const renderOrderTracker = (currentStatus: string) => {
    const steps = [
      { key: 'pending', label: 'Order Placed', icon: '📋' },
      { key: 'confirmed', label: 'Confirmed', icon: '✅' },
      { key: 'processing', label: 'Processing', icon: '👨‍🍳' },
      { key: 'ready', label: 'Ready', icon: '📦' },
      { key: 'delivered', label: 'Delivered', icon: '🚚' }
    ];

    // Handle cancelled status
    if (currentStatus === 'cancelled') {
      return (
        <View style={styles.trackerContainer}>
          <View style={styles.cancelledTracker}>
            <Text style={styles.cancelledIcon}>❌</Text>
            <Text style={styles.cancelledText}>Order Cancelled</Text>
          </View>
        </View>
      );
    }

    const currentIndex = steps.findIndex(step => step.key === currentStatus);

    return (
      <View style={styles.trackerContainer}>
        <View style={styles.tracker}>
          {steps.map((step, index) => {
            const isActive = index <= currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <View key={step.key} style={styles.stepContainer}>
                <View style={styles.stepRow}>
                  <View style={[
                    styles.stepCircle,
                    isActive ? styles.stepCircleActive : styles.stepCircleInactive
                  ]}>
                    <Text style={[
                      styles.stepIcon,
                      isActive ? styles.stepIconActive : styles.stepIconInactive
                    ]}>
                      {step.icon}
                    </Text>
                  </View>

                  {index < steps.length - 1 && (
                    <View style={[
                      styles.stepLine,
                      isActive ? styles.stepLineActive : styles.stepLineInactive
                    ]} />
                  )}
                </View>

                <Text style={[
                  styles.stepLabel,
                  isCurrent ? styles.stepLabelCurrent : isActive ? styles.stepLabelActive : styles.stepLabelInactive
                ]}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };


  const renderOrderCard = ({ item: order }: { item: OrderWithDetails }) => {
    const statusConfig = getStatusConfig(order.status);
    const getStatusText = (status: string) => {
      switch (status) {
        case 'pending': return 'ORDER PLACED';
        case 'confirmed': return 'CONFIRMED';
        case 'processing': return 'PROCESSING';
        case 'ready': return 'READY FOR PICKUP';
        case 'delivered': return 'DELIVERED';
        case 'cancelled': return 'CANCELLED';
        default: return status.toUpperCase();
      }
    };

    const getDeliveryText = (status: string) => {
      switch (status) {
        case 'pending': return 'Processing order';
        case 'confirmed': return 'Order confirmed by farmer';
        case 'processing': return 'Preparing your order';
        case 'ready': return 'Ready for pickup/delivery';
        case 'delivered': return 'Order delivered';
        case 'cancelled': return 'Order cancelled';
        default: return 'Status update';
      }
    };

    return (
      <View style={styles.orderCard}>
        {/* Order Header */}
        <View style={styles.orderHeader}>
          <View style={styles.orderLeftInfo}>
            <Text style={styles.orderStatusText}>{getStatusText(order.status)}</Text>
            <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
          </View>
          <View style={styles.orderRightInfo}>
            <Text style={styles.orderTotal}>TOTAL</Text>
            <Text style={styles.orderAmount}>{formatPrice(order.total_price)}</Text>
          </View>
        </View>

        {/* Delivery Status */}
        <View style={styles.deliveryStatus}>
          <Text style={[styles.deliveryText, { color: statusConfig.color }]}>
            {getDeliveryText(order.status)}
          </Text>
        </View>

        {/* Order Progress Tracker */}
        {renderOrderTracker(order.status)}

        {/* Product Info */}
        <View style={styles.productSection}>
          {order.product && (
            <View key={order.id} style={styles.productRow}>
              <View style={styles.productImageContainer}>
                {order.product.image_url ? (
                  <Image
                    source={{ uri: order.product.image_url }}
                    style={styles.productImageStyle}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.productIcon}>🥬</Text>
                )}
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{order.product.name}</Text>
                <Text style={styles.productDetails}>Qty: {order.quantity} {order.product.unit}</Text>
                <Text style={styles.productPrice}>{formatPrice(order.product.price)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Delivery Address */}
        {order.delivery_address && (
          <View style={styles.shipToSection}>
            <Text style={styles.shipToLabel}>SHIP TO</Text>
            <Text style={styles.shipToAddress}>{order.delivery_address}</Text>
          </View>
        )}

        {/* Order ID */}
        <View style={styles.orderIdSection}>
          <Text style={styles.orderIdLabel}>ORDER # {order.id.slice(-12).toUpperCase()}</Text>
          <View style={styles.orderActions}>
            <TouchableOpacity
              style={styles.detailsButton}
              onPress={() => handleShowOrderDetails(order)}
              activeOpacity={0.8}
            >
              <Text style={styles.detailsButtonText}>View order details</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.trackButton, { backgroundColor: statusConfig.color }]}
            onPress={() => handleShowQRCode(order)}
            activeOpacity={0.8}
          >
            <Text style={styles.trackButtonText}>Show QR Code</Text>
          </TouchableOpacity>

          {order.delivery_address && (
            <TouchableOpacity
              style={[styles.directionsButton]}
              onPress={() => handleShowDirections(order)}
              activeOpacity={0.8}
            >
              <Text style={styles.directionsButtonText}>📍 Directions</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Cancellation Button Row */}
        {order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'cancellation_requested' && !order.notes?.includes('CANCELLATION REQUESTED') && (
          <View style={styles.cancelButtonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              activeOpacity={0.8}
              onPress={() => handleCancellationRequest(order)}
            >
              <Text style={styles.cancelButtonText}>Request cancellation</Text>
            </TouchableOpacity>
          </View>
        )}
        {(order.status === 'cancellation_requested' || order.notes?.includes('CANCELLATION REQUESTED')) && (
          <View style={styles.cancelButtonRow}>
            <View style={styles.cancelRequestedBadge}>
              <Text style={styles.cancelRequestedText}>Cancellation Requested</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyIconContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
        </View>
      </View>
      
      <Text style={styles.emptyTitle}>No Orders Yet</Text>
      <Text style={styles.emptyDescription}>
        {selectedStatus === 'all'
          ? 'Start shopping to see your orders here. Browse fresh products from local farmers!'
          : `No ${selectedStatus} orders at the moment.`}
      </Text>

      {selectedStatus === 'all' && (
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => navigation.navigate('Marketplace' as never)}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaIcon}>🛒</Text>
          <Text style={styles.ctaText}>Start Shopping</Text>
        </TouchableOpacity>
      )}
    </View>
  );


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading your orders...</Text>
      </View>
    );
  }

  console.log('🎨 RENDERING - Orders count:', orders.length);
  console.log('🎨 RENDERING - Filtered orders count:', filteredOrders.length);
  console.log('🎨 RENDERING - Loading:', loading);
  console.log('🎨 RENDERING - Selected status:', selectedStatus);

  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        userType="buyer"
        currentRoute="/buyer/my-orders"
        showMessages={true}
        showNotifications={true}
        showFilterButton={!isDesktop}
        onFilterPress={() => setShowSidebar(!showSidebar)}
      />

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
              (() => {
                console.log('🎨 RENDERING - Showing empty state because filteredOrders.length is 0');
                return renderEmptyState();
              })()
            ) : (
              (() => {
                console.log('🎨 RENDERING - Showing', filteredOrders.length, 'order cards');
                return (
                  <View style={styles.ordersList}>
                    {filteredOrders.map((order, index) => {
                      console.log(`🎨 RENDERING - Order ${index + 1}:`, order.id, order.status);
                      return (
                        <View key={order.id}>
                          {renderOrderCard({ item: order })}
                        </View>
                      );
                    })}
                  </View>
                );
              })()
            )}
          </ScrollView>
        </View>
      </View>

      {/* QR Code Modal */}
      {selectedOrder && (
        <OrderQRCodeModal
          visible={showQRModal}
          onClose={handleCloseQRModal}
          order={selectedOrder as any}
        />
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          visible={showDetailsModal}
          onClose={handleCloseDetailsModal}
          order={selectedOrder as any}
        />
      )}

      {/* Map Directions Modal */}
      {selectedOrder && (
        <MapDirectionsModal
          visible={showMapModal}
          onClose={handleCloseMapModal}
          deliveryAddress={selectedOrder.delivery_address || ''}
          orderInfo={{
            orderId: selectedOrder.id,
            productName: selectedOrder.product?.name || 'Unknown Product',
            status: selectedOrder.status,
          }}
        />
      )}

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

  // Status Tab Bar (Main horizontal tabs)
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
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
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  orderLeftInfo: {
    flex: 1,
  },
  orderStatusText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  orderRightInfo: {
    alignItems: 'flex-end',
  },
  orderTotal: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  deliveryStatus: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  deliveryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  productSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  productImageStyle: {
    width: '100%',
    height: '100%',
  },
  productIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  productIcon: {
    fontSize: 24,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  productDetails: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  orderDetails: {
    marginBottom: 20,
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
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  itemQuantityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  itemQuantity: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  itemUnit: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '500',
  },
  itemName: {
    fontSize: 14,
    color: '#0f172a',
    flex: 1,
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  amountContent: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
  },
  amountIcon: {
    fontSize: 24,
  },
  
  // Status Timeline
  statusTimeline: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 16,
  },
  timelineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timelineStep: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  timelineNodeActive: {
    borderColor: '#10b981',
  },
  timelineNodeCurrent: {
    borderWidth: 3,
  },
  timelineNodeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
  },
  timelineNodeTextActive: {
    color: '#ffffff',
  },
  timelineLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
  },
  timelineLineActive: {
    backgroundColor: '#10b981',
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  timelineLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },

  // Additional Info
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
    fontSize: 16,
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

  shipToSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  shipToLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  shipToAddress: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  orderIdSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  orderIdLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  orderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  detailsButtonText: {
    fontSize: 12,
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  trackButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  directionsButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionsButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  cancelButtonRow: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  cancelRequestedBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelRequestedText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
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

  // Order Tracker Styles
  trackerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  tracker: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  stepCircleActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  stepCircleInactive: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  stepIcon: {
    fontSize: 16,
  },
  stepIconActive: {
    color: '#ffffff',
  },
  stepIconInactive: {
    color: '#94a3b8',
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginLeft: 8,
  },
  stepLineActive: {
    backgroundColor: '#10b981',
  },
  stepLineInactive: {
    backgroundColor: '#e2e8f0',
  },
  stepLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  stepLabelCurrent: {
    color: '#10b981',
    fontWeight: '600',
  },
  stepLabelActive: {
    color: '#475569',
    fontWeight: '500',
  },
  stepLabelInactive: {
    color: '#94a3b8',
    fontWeight: '400',
  },

  // Cancelled Order Tracker
  cancelledTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cancelledIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  cancelledText: {
    fontSize: 16,
    color: '#dc2626',
    fontWeight: '600',
  },
});