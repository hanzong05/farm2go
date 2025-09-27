import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import FilterSidebar from '../../components/FilterSidebar';
import HeaderComponent from '../../components/HeaderComponent';
import { getUserWithProfile } from '../../services/auth';
import { getBuyerOrders } from '../../services/orders';
import { Database } from '../../types/database';
import { ORDER_STATUS_CONFIG, OrderWithDetails, TRANSACTION_STATUS_CONFIG } from '../../types/orders';
import { applyFilters } from '../../utils/filterConfigs';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface PurchaseStats {
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  favoriteCategory: string;
  thisMonthSpent: number;
  lastMonthSpent: number;
  uniqueFarmers: number;
  pendingPayments: number;
  completedDeliveries: number;
}

const TIME_PERIODS = [
  { key: 'all', label: 'All Time' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
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

const { width } = Dimensions.get('window');
const isDesktop = width >= 1024;

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'shipped', label: 'Shipped' },
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

export default function BuyerPurchaseHistoryScreen() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showSidebar, setShowSidebar] = useState(false);

  // Filter state
  const [filterState, setFilterState] = useState({
    category: 'all',
    amountRange: 'all',
    dateRange: 'month',
    sortBy: 'newest'
  });
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterOrdersByPeriod();
  }, [orders, selectedStatus, filterState]);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      if (!userData?.profile) {
        // Don't force logout - just show error state
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

      setProfile(userData.profile);
      await loadOrders(userData.user.id);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert(
        'Error',
        'Failed to load purchase history. Please try again.',
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
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (buyerId: string) => {
    try {
      const ordersData = await getBuyerOrders(buyerId);
      setOrders(ordersData);
    } catch (error) {
      console.error('Error loading orders:', error);
      throw error;
    }
  };

  const filterOrdersByPeriod = () => {
    let filtered = orders;

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(order =>
        order.status === selectedStatus
      );
    }

    // Apply other filters using the utility function
    filtered = applyFilters(filtered, filterState, {
      categoryKey: 'product.category',
      priceKey: 'total_price',
      dateKey: 'created_at',
    });

    setFilteredOrders(filtered);
  };

  // Handle filter changes
  const handleFilterChange = (key: string, value: any) => {
    setFilterState(prev => ({
      ...prev,
      [key]: value
    }));
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

  const getOrderStats = (): PurchaseStats => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthOrders = orders.filter(order =>
      new Date(order.created_at) >= thisMonth
    );

    const lastMonthOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= lastMonth && orderDate <= lastMonthEnd;
    });

    const totalSpent = filteredOrders.reduce((sum, order) => sum + order.total_price, 0);
    const averageOrderValue = filteredOrders.length > 0 ? totalSpent / filteredOrders.length : 0;

    // Find favorite category
    const categoryOrders: { [key: string]: number } = {};
    filteredOrders.forEach(order => {
      if (order.product?.category) {
        categoryOrders[order.product.category] = (categoryOrders[order.product.category] || 0) + order.quantity;
      }
    });

    const favoriteCategory = Object.keys(categoryOrders).reduce((a, b) =>
      categoryOrders[a] > categoryOrders[b] ? a : b, 'None'
    );

    // Count unique farmers
    const uniqueFarmers = new Set(orders.map(o => o.farmer_id)).size;

    // Count pending payments and completed deliveries
    const pendingPayments = orders.filter(o => o.transaction?.status === 'pending').length;
    const completedDeliveries = orders.filter(o => o.status === 'delivered').length;

    return {
      totalOrders: filteredOrders.length,
      totalSpent,
      averageOrderValue,
      favoriteCategory,
      thisMonthSpent: thisMonthOrders.reduce((sum, order) => sum + order.total_price, 0),
      lastMonthSpent: lastMonthOrders.reduce((sum, order) => sum + order.total_price, 0),
      uniqueFarmers,
      pendingPayments,
      completedDeliveries,
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(price);
  };

  const getStatusDisplay = (status: string) => {
    const config = ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG];
    if (config) {
      return { text: config.label.toUpperCase(), color: config.color };
    }
    return { text: status.toUpperCase(), color: '#6b7280' };
  };

  const getPaymentStatusDisplay = (status?: string) => {
    if (!status) return { text: 'NO PAYMENT', color: '#6b7280' };
    const config = TRANSACTION_STATUS_CONFIG[status as keyof typeof TRANSACTION_STATUS_CONFIG];
    if (config) {
      return { text: config.label.toUpperCase(), color: config.color };
    }
    return { text: status.toUpperCase(), color: '#6b7280' };
  };

  const renderOrderCard = ({ item: order }: { item: OrderWithDetails }) => (
    <View style={styles.orderCard}>
      {/* Shop Header */}
      <View style={styles.shopHeader}>
        <View style={styles.shopInfo}>
          <View style={styles.shopIconContainer}>
            <Text style={styles.shopIcon}>🌾</Text>
          </View>
          <Text style={styles.shopName}>
            {order.farmer_profile?.farm_name ||
             `${order.farmer_profile?.first_name || ''} ${order.farmer_profile?.last_name || ''}`.trim() ||
             'Unknown Farm'}
          </Text>
          <Text style={styles.shopLocation}>
            {order.farmer_profile?.barangay || 'Local Farm'}
          </Text>
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusDisplay(order.status).color }]}>
            <Text style={styles.statusText}>{getStatusDisplay(order.status).text}</Text>
          </View>
          {order.transaction && (
            <View style={[styles.paymentBadge, { backgroundColor: getPaymentStatusDisplay(order.transaction.status).color }]}>
              <Text style={styles.statusText}>{getPaymentStatusDisplay(order.transaction.status).text}</Text>
            </View>
          )}
          <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
        </View>
      </View>

      {/* Product Details */}
      <View style={styles.productsSection}>
        <View style={styles.productItem}>
          <View style={styles.productImageContainer}>
            <Text style={styles.productImage}>🥬</Text>
          </View>
          <View style={styles.productDetails}>
            <Text style={styles.productName} numberOfLines={2}>{order.product?.name || 'Unknown Product'}</Text>
            <Text style={styles.productVariation}>Category: {order.product?.category || 'N/A'}</Text>
            <Text style={styles.productQuantity}>Quantity: {order.quantity} {order.product?.unit || 'pcs'}</Text>
            <Text style={styles.productNote}>Order ID: {order.purchase_code || order.id.slice(0, 8)}</Text>
          </View>
          <View style={styles.productPriceContainer}>
            <Text style={styles.productPrice}>{formatPrice(order.product?.price || 0)}</Text>
            <Text style={styles.productTotal}>Total: {formatPrice(order.total_price)}</Text>
          </View>
        </View>
      </View>

      {/* Order Summary */}
      <View style={styles.orderSummary}>
        <View style={styles.summaryRow}>
          <Text style={styles.itemCount}>1 item • Order Total:</Text>
          <Text style={styles.totalPrice}>{formatPrice(order.total_price)}</Text>
        </View>
        {order.delivery_address && (
          <View style={styles.deliveryInfo}>
            <Text style={styles.deliveryLabel}>Delivery to:</Text>
            <Text style={styles.deliveryAddress} numberOfLines={2}>{order.delivery_address}</Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Contact Seller</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryActionButton}>
          <Text style={styles.primaryButtonText}>Buy Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ratingButton}>
          <Text style={styles.ratingButtonText}>⭐ Rate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
      key: 'dateRange',
      title: 'Date Range',
      type: 'range' as const,
      options: TIME_PERIODS.map(period => ({
        key: period.key,
        label: period.label
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

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyIconContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
        </View>
      </View>

      <Text style={styles.emptyTitle}>No Orders Found</Text>
      <Text style={styles.emptyDescription}>
        {selectedStatus === 'all'
          ? 'You haven\'t made any orders yet. Start shopping to support local farmers!'
          : `No orders found for the selected filters.`}
      </Text>

      {selectedStatus === 'all' && filterState.category === 'all' && filterState.amountRange === 'all' && (
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/')}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaIcon}>🛍️</Text>
          <Text style={styles.ctaText}>Start Shopping</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <HeaderComponent
          profile={profile}
          userType="buyer"
          currentRoute="/buyer/purchase-history"
          showMessages={true}
          showNotifications={true}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading purchase history...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        userType="buyer"
        currentRoute="/buyer/purchase-history"
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
                tintColor="#ee4d2d"
                colors={['#ee4d2d']}
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
    borderBottomColor: '#ee4d2d',
  },
  tabText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#ee4d2d',
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    height: 2,
    width: '100%',
    backgroundColor: '#ee4d2d',
  },

  // Scroll View
  scrollView: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // Orders List
  ordersList: {
    padding: 12,
    gap: 8,
  },

  // Authentic Shopee Order Card
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },

  // Shop Header
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#ffffff',
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shopIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  shopIcon: {
    fontSize: 12,
    color: '#ffffff',
  },
  shopName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  shopLocation: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 3,
    marginBottom: 4,
  },
  paymentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  orderDate: {
    fontSize: 11,
    color: '#999',
  },

  // Products Section
  productsSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  productImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 4,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  productImage: {
    fontSize: 24,
  },
  productDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 4,
  },
  productVariation: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  productQuantity: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  productNote: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  productTotal: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  productPriceContainer: {
    alignItems: 'flex-end',
  },
  productPrice: {
    fontSize: 14,
    color: '#ee4d2d',
    fontWeight: '600',
  },
  moreProductsContainer: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  moreProductsText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },

  // Order Summary
  orderSummary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#ffffff',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCount: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  totalPrice: {
    fontSize: 16,
    color: '#ee4d2d',
    fontWeight: 'bold',
  },
  deliveryInfo: {
    marginTop: 8,
  },
  deliveryLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  deliveryAddress: {
    fontSize: 12,
    color: '#333',
    marginTop: 2,
    lineHeight: 16,
  },

  // Action Buttons
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#dee2e6',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  primaryActionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#ee4d2d',
    alignItems: 'center',
  },
  ratingButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  primaryButtonText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  ratingButtonText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIllustration: {
    marginBottom: 24,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ee4d2d',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3.84,
  },
  ctaIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  ctaText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
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
});