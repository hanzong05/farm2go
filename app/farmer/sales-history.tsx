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
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';
import { applyFilters, getFarmerSalesFilters } from '../../utils/filterConfigs';

const { width } = Dimensions.get('window');

// Responsive breakpoints
const isTablet = width >= 768;
const isDesktop = width >= 1024;

// Remove unused width variable

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
  } | null;
}

interface Sale {
  id: string;
  buyer_id: string;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled';
  created_at: string;
  delivery_date: string | null;
  buyer_profile?: {
    first_name: string | null;
    last_name: string | null;
  };
  order_items?: Array<{
    order_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    product: {
      name: string;
      unit: string;
    };
  }>;
}

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  averageOrderValue: number;
  topProduct: string;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
}

const TIME_PERIODS = [
  { key: 'all', label: 'All Time' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
];

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'delivered', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const CATEGORY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'vegetables', label: 'Vegetables' },
  { key: 'fruits', label: 'Fruits' },
  { key: 'grains', label: 'Grains' },
  { key: 'herbs', label: 'Herbs' },
];

export default function FarmerSalesHistoryScreen() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);

  // Filter state
  const [filterState, setFilterState] = useState({
    status: 'all',
    category: 'all',
    dateRange: 'month',
    sortBy: 'newest'
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterSalesByPeriod();
  }, [sales, filterState]);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      if (!userData?.profile) {
        router.replace('/auth/login');
        return;
      }

      setProfile(userData.profile);
      console.log('🔍 User data:', { userId: userData.user.id, profileId: userData.profile.id });
      await loadSales(userData.user.id);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load sales history');
    } finally {
      setLoading(false);
    }
  };

  const loadSales = async (farmerId: string) => {
    try {
      console.log('🔍 Loading sales for farmer:', farmerId);

      // Get all orders for this farmer with product and buyer information
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
            last_name
          )
        `)
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false });

      console.log('🔍 Orders query result:', { ordersData, ordersError });

      if (ordersError) throw ordersError;

      const typedOrdersData = ordersData as DatabaseOrder[] | null;

      if (!typedOrdersData || typedOrdersData.length === 0) {
        console.log('🔍 No orders found for farmer');
        setSales([]);
        return;
      }

      // Transform orders into sales format
      const salesWithItems: Sale[] = typedOrdersData.map(order => {
        // Create a single order item since each order is for one product
        const items = [{
          order_id: order.id,
          quantity: order.quantity,
          unit_price: order.products?.price || 0,
          total_price: order.total_price,
          product: {
            name: order.products?.name || '',
            unit: order.products?.unit || '',
          },
        }];

        return {
          id: order.id,
          buyer_id: order.buyer_id,
          total_amount: order.total_price,
          status: order.status as Sale['status'],
          created_at: order.created_at,
          delivery_date: order.delivery_address, // Using delivery_address as delivery info
          buyer_profile: order.profiles ? {
            first_name: order.profiles.first_name,
            last_name: order.profiles.last_name,
          } : undefined,
          order_items: items,
        };
      });

      console.log('🔍 Final sales processed:', salesWithItems.length, 'sales found');
      console.log('🔍 Sales data sample:', JSON.stringify(salesWithItems.slice(0, 2), null, 2));

      setSales(salesWithItems);
    } catch (error) {
      console.error('Error loading sales:', error);
      throw error;
    }
  };

  const filterSalesByPeriod = () => {
    // Apply filters using the utility function
    const filtered = applyFilters(sales, filterState, {
      statusKey: 'status',
      dateKey: 'created_at',
      amountKey: 'total_amount',
      customFilters: {
        category: (sale, value) => {
          if (value === 'all') return true;
          return sale.order_items?.some(item =>
            item.product.name.toLowerCase().includes(value.toLowerCase())
          ) || false;
        }
      }
    });

    setFilteredSales(filtered);
  };

  const onRefresh = async () => {
    if (!profile) return;
    setRefreshing(true);
    try {
      const userData = await getUserWithProfile();
      if (userData?.user) {
        await loadSales(userData.user.id);
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getSalesStats = (): SalesStats => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthSales = sales.filter(sale =>
      new Date(sale.created_at) >= thisMonth
    );

    const lastMonthSales = sales.filter(sale => {
      const saleDate = new Date(sale.created_at);
      return saleDate >= lastMonth && saleDate <= lastMonthEnd;
    });

    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const averageOrderValue = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

    // Find top-selling product
    const productSales: { [key: string]: number } = {};
    filteredSales.forEach(sale => {
      sale.order_items?.forEach(item => {
        productSales[item.product.name] = (productSales[item.product.name] || 0) + item.quantity;
      });
    });

    const topProduct = Object.keys(productSales).reduce((a, b) =>
      productSales[a] > productSales[b] ? a : b, 'None'
    );

    return {
      totalSales: filteredSales.length,
      totalRevenue,
      averageOrderValue,
      topProduct,
      thisMonthRevenue: thisMonthSales.reduce((sum, sale) => sum + sale.total_amount, 0),
      lastMonthRevenue: lastMonthSales.reduce((sum, sale) => sum + sale.total_amount, 0),
    };
  };

  // Handle filter changes
  const handleFilterChange = (key: string, value: any) => {
    setFilterState(prev => ({
      ...prev,
      [key]: value
    }));
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

  // Removed unused getGrowthPercentage function

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'confirmed': return '#3b82f6';
      case 'processing': return '#8b5cf6';
      case 'ready': return '#10b981';
      case 'delivered': return '#059669';
      case 'cancelled': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'PENDING';
      case 'confirmed': return 'CONFIRMED';
      case 'processing': return 'PROCESSING';
      case 'ready': return 'READY';
      case 'delivered': return 'DELIVERED';
      case 'cancelled': return 'CANCELLED';
      default: return 'UNKNOWN';
    }
  };


  const renderSaleCard = ({ item: sale }: { item: Sale }) => (
    <View style={styles.orderCard}>
      {/* Buyer Header */}
      <View style={styles.buyerHeader}>
        <View style={styles.buyerInfo}>
          <View style={styles.buyerIconContainer}>
            <Text style={styles.buyerIcon}>👤</Text>
          </View>
          <Text style={styles.buyerName}>
            {`${sale.buyer_profile?.first_name || ''} ${sale.buyer_profile?.last_name || ''}`.trim() ||
             'Unknown Buyer'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(sale.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(sale.status)}</Text>
        </View>
      </View>

      {/* Products Grid */}
      <View style={styles.productsSection}>
        {sale.order_items?.map((item, index) => (
          <View key={index} style={styles.productItem}>
            <View style={styles.productImageContainer}>
              <Text style={styles.productImage}>🥬</Text>
            </View>
            <View style={styles.productDetails}>
              <Text style={styles.productName} numberOfLines={2}>{item.product.name}</Text>
              <Text style={styles.productVariation}>Unit: {item.product.unit}</Text>
              <Text style={styles.productPrice}>x{item.quantity} = {formatPrice(item.total_price)}</Text>
            </View>
          </View>
        )) || []}
      </View>

      {/* Order Summary */}
      <View style={styles.orderSummary}>
        <View style={styles.summaryRow}>
          <Text style={styles.itemCount}>{sale.order_items?.length || 0} item(s)</Text>
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total Revenue: </Text>
            <Text style={styles.totalPrice}>{formatPrice(sale.total_amount)}</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Contact Buyer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryActionButton}>
          <Text style={styles.primaryButtonText}>Order Details</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Invoice</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyIconContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
        </View>
      </View>

      <Text style={styles.emptyTitle}>No Orders Found</Text>
      <Text style={styles.emptyDescription}>
        {filterState.status === 'all'
          ? 'You haven\'t received any orders yet. Start by adding products and promoting your farm!'
          : `No orders found for the selected status.`}
      </Text>

      {filterState.status === 'all' && (
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

  // Removed unused stats variable

  // Get filter configuration
  const filterSections = getFarmerSalesFilters(sales);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading sales analytics...</Text>
      </View>
    );
  }

  // Desktop Layout
  if (isDesktop) {
    return (
      <View style={styles.container}>
        <HeaderComponent
          profile={profile}
          userType="farmer"
          currentRoute="/farmer/sales-history"
          showMessages={true}
          showNotifications={true}
          showFilterButton={!isDesktop}
          onFilterPress={() => setShowSidebar(!showSidebar)}
        />

        <View style={styles.desktopLayout}>
          {/* Filter Sidebar */}
          <FilterSidebar
            sections={filterSections}
            filterState={filterState}
            onFilterChange={handleFilterChange}
            title="Sales Filters"
          />

          {/* Main Content */}
          <ScrollView
            style={styles.mainContent}
            contentContainerStyle={styles.mainScrollContent}
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
            {/* Sales Header */}
            <View style={styles.salesHeader}>
              <Text style={styles.salesTitle}>
                Sales History ({filteredSales.length} sales)
              </Text>
            </View>

            {/* Sales List */}
            {filteredSales.length === 0 ? (
              renderEmptyState()
            ) : (
              <View style={styles.ordersList}>
                {filteredSales.map((sale) => (
                  <View key={sale.id}>
                    {renderSaleCard({ item: sale })}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    );
  }

  // Mobile/Tablet Layout
  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        userType="farmer"
        currentRoute="/farmer/sales-history"
        showMessages={true}
        showNotifications={true}
        showFilterButton={!isDesktop}
        onFilterPress={() => setShowSidebar(!showSidebar)}
      />

      {/* Mobile Filter Sidebar */}
      <FilterSidebar
        sections={filterSections}
        filterState={filterState}
        onFilterChange={handleFilterChange}
        title="Sales Filters"
        showMobile={showSidebar}
        onCloseMobile={() => setShowSidebar(false)}
      />

      {/* Orders List */}
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
        {filteredSales.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.ordersList}>
            {filteredSales.map((sale) => (
              <View key={sale.id}>
                {renderSaleCard({ item: sale })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // Desktop Layout
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
  },

  // Main Content
  mainContent: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  mainScrollContent: {
    padding: 20,
  },

  salesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },

  salesTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
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
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },

  // Buyer Header
  buyerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  buyerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  buyerIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ee4d2d',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  buyerIcon: {
    fontSize: 10,
    color: '#ffffff',
  },
  buyerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },

  // Products Section
  productsSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  productItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  productImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  productImage: {
    fontSize: 32,
  },
  productDetails: {
    flex: 1,
    justifyContent: 'space-between',
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
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    color: '#ee4d2d',
    fontWeight: '600',
  },

  // Order Summary
  orderSummary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCount: {
    fontSize: 13,
    color: '#666',
  },
  totalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 13,
    color: '#666',
  },
  totalPrice: {
    fontSize: 16,
    color: '#ee4d2d',
    fontWeight: 'bold',
  },

  // Action Buttons
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#dee2e6',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  primaryActionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#ee4d2d',
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

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyIllustration: {
    marginBottom: 32,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#dee2e6',
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
  },
  ctaIcon: {
    fontSize: 14,
    color: '#ffffff',
    marginRight: 6,
    fontWeight: 'bold',
  },
  ctaText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
});