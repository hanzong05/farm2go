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
import FilterSidebar from '../../components/FilterSidebar';
import HeaderComponent from '../../components/HeaderComponent';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';
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
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

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
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, selectedStatus, filterState, searchQuery]);

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

  const filterOrders = () => {
    let filtered = orders;

    // Filter by status first
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(order => order.status === selectedStatus);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(order => {
        const orderId = order.id.slice(-8).toLowerCase();
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
        await loadOrders(userData.user.id);
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
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

    await updateOrderStatus(selectedOrder.id, newStatus);
    handleActionModalClose();
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
          : orders.filter(o => {
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

        {/* Action Buttons */}
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
                onPress={() => updateOrderStatus(order.id, 'confirmed')}
                activeOpacity={0.8}
              >
                <View style={styles.actionButtonContent}>
                <Icon name="check" size={14} color="#ffffff" style={{marginRight: 6}} />
                <Text style={styles.actionButtonText}>Accept</Text>
              </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => updateOrderStatus(order.id, 'cancelled')}
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
              onPress={() => updateOrderStatus(order.id, 'processing')}
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
              onPress={() => updateOrderStatus(order.id, 'ready')}
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
              onPress={() => updateOrderStatus(order.id, 'delivered')}
              activeOpacity={0.8}
            >
              <View style={styles.actionButtonContent}>
                <Icon name="truck" size={14} color="#ffffff" style={{marginRight: 6}} />
                <Text style={styles.actionButtonText}>Complete Delivery</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

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
          <Icon name="file-text" size={60} color="#10b981" />
        </View>
      </View>
      
      <Text style={styles.emptyTitle}>No Orders Found</Text>
      <Text style={styles.emptyDescription}>
        {selectedStatus === 'all'
          ? 'You haven\'t received any orders yet. Keep your products updated to attract buyers!'
          : `No ${selectedStatus} orders at the moment.`}
      </Text>

      {selectedStatus === 'all' && (
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/farmer/products/add')}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaIcon}>+</Text>
          <Text style={styles.ctaText}>Add Products</Text>
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
        animationType="fade"
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