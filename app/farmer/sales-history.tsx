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
import HeaderComponent from '../../components/HeaderComponent';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

const { width } = Dimensions.get('window');

type Profile = Database['public']['Tables']['profiles']['Row'];

// Database response types
interface DatabaseOrderItem {
  order_id: string;
  quantity: number;
  unit_price: number;
  products: {
    farmer_id: string;
    name: string;
    unit: string;
  } | null;
}

interface DatabaseOrder {
  id: string;
  buyer_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  delivery_date: string | null;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
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
    company_name: string | null;
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

export default function FarmerSalesHistoryScreen() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterSalesByPeriod();
  }, [sales, selectedPeriod]);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      if (!userData?.profile) {
        router.replace('/auth/login');
        return;
      }

      setProfile(userData.profile);
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
      // Get completed orders with items from this farmer's products
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

      const typedOrderItems = orderItems as DatabaseOrderItem[] | null;

      // Get unique order IDs
      const orderIds = [...new Set(typedOrderItems?.map(item => item.order_id) || [])];

      if (orderIds.length === 0) {
        setSales([]);
        return;
      }

      // Get all orders (not just delivered) to show current order status
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          buyer_id,
          total_amount,
          status,
          created_at,
          delivery_date,
          profiles!orders_buyer_id_fkey (
            first_name,
            last_name,
            company_name
          )
        `)
        .in('id', orderIds)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const typedOrdersData = ordersData as DatabaseOrder[] | null;

      // Combine orders with their items and calculate totals
      const salesWithItems: Sale[] = typedOrdersData?.map(order => {
        const items = typedOrderItems?.filter(item => item.order_id === order.id).map(item => ({
          order_id: item.order_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          product: {
            name: item.products?.name || '',
            unit: item.products?.unit || '',
          },
        })) || [];

        // Calculate farmer's revenue for this order (only their products)
        const farmerRevenue = items.reduce((sum, item) => sum + item.total_price, 0);

        return {
          id: order.id,
          buyer_id: order.buyer_id,
          total_amount: farmerRevenue, // Override with farmer's actual revenue
          status: order.status as Sale['status'],
          created_at: order.created_at,
          delivery_date: order.delivery_date,
          buyer_profile: order.profiles ? {
            first_name: order.profiles.first_name,
            last_name: order.profiles.last_name,
            company_name: order.profiles.company_name,
          } : undefined,
          order_items: items,
        };
      }) || [];

      setSales(salesWithItems);
    } catch (error) {
      console.error('Error loading sales:', error);
      throw error;
    }
  };

  const filterSalesByPeriod = () => {
    const now = new Date();
    let startDate: Date;

    switch (selectedPeriod) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterStartMonth, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        setFilteredSales(sales);
        return;
    }

    const filtered = sales.filter(sale =>
      new Date(sale.created_at) >= startDate
    );

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

  const getGrowthPercentage = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

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
    <View style={styles.saleCard}>
      <View style={styles.saleHeader}>
        <View style={styles.saleMainInfo}>
          <Text style={styles.saleId}>Sale #{sale.id.slice(-8)}</Text>
          <Text style={styles.saleDate}>{formatDate(sale.created_at)}</Text>
        </View>
        <View style={styles.saleAmountContainer}>
          <Text style={styles.saleAmount}>{formatPrice(sale.total_amount)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(sale.status) }]}>
            <Text style={styles.statusText}>{getStatusLabel(sale.status)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.buyerSection}>
        <Text style={styles.buyerIcon}>👤</Text>
        <View style={styles.buyerInfo}>
          <Text style={styles.buyerName}>
            {sale.buyer_profile?.company_name ||
             `${sale.buyer_profile?.first_name || ''} ${sale.buyer_profile?.last_name || ''}`.trim() ||
             'Unknown Buyer'}
          </Text>
        </View>
      </View>

      <View style={styles.saleItems}>
        <Text style={styles.itemsTitle}>Items Sold</Text>
        {sale.order_items?.map((item, index) => (
          <View key={index} style={styles.saleItem}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemQuantity}>{item.quantity} {item.product.unit}</Text>
              <Text style={styles.itemName}>{item.product.name}</Text>
            </View>
            <Text style={styles.itemPrice}>{formatPrice(item.total_price)}</Text>
          </View>
        )) || null}
      </View>

      <View style={styles.saleFooter}>
        <View style={styles.saleMetrics}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Items</Text>
            <Text style={styles.metricValue}>
              {sale.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Revenue</Text>
            <Text style={styles.metricValue}>{formatPrice(sale.total_amount)}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyIconContainer}>
          <Text style={styles.emptyIcon}>📈</Text>
        </View>
      </View>
      
      <Text style={styles.emptyTitle}>No Sales Data</Text>
      <Text style={styles.emptyDescription}>
        {selectedPeriod === 'all'
          ? 'You haven\'t made any sales yet. Start by adding products and promoting your farm!'
          : `No sales found for the selected time period.`}
      </Text>

      {selectedPeriod === 'all' && (
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

  const stats = getSalesStats();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading sales analytics...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        userType="farmer"
        currentRoute="/farmer/sales-history"
        showMessages={true}
        showNotifications={true}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
        {/* Enhanced Stats */}
       

        {/* Enhanced Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.sectionTitle}>Time Period</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContainer}
          >
            {TIME_PERIODS.map((period) => (
              <TouchableOpacity
                key={period.key}
                style={[
                  styles.filterButton,
                  selectedPeriod === period.key && styles.filterButtonActive
                ]}
                onPress={() => setSelectedPeriod(period.key)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedPeriod === period.key && styles.filterButtonTextActive
                ]}>
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Orders List */}
        <View style={styles.salesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Order History {filteredSales.length > 0 && `(${filteredSales.length})`}
            </Text>
          </View>

          {filteredSales.length === 0 ? (
            renderEmptyState()
          ) : (
            <View style={styles.salesList}>
              {filteredSales.map((sale) => (
                <View key={sale.id}>
                  {renderSaleCard({ item: sale })}
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
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
  },
  scrollContent: {
    paddingBottom: 40,
  },


  // Section Titles
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 20,
  },

  // Stats Section
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 36,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },


  // Filter Section
  filterSection: {
    paddingHorizontal: 20,
    marginBottom: 36,
  },
  filterContainer: {
    paddingRight: 20,
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  filterButtonActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
    elevation: 4,
    shadowOpacity: 0.15,
  },
  filterButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },

  // Sales Section
  salesSection: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    marginBottom: 24,
  },
  salesList: {
    gap: 20,
  },
  saleCard: {
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
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  saleMainInfo: {
    flex: 1,
    marginRight: 16,
  },
  saleId: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6,
    lineHeight: 26,
  },
  saleDate: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  saleAmountContainer: {
    alignItems: 'flex-end',
  },
  saleAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  buyerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  buyerIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  buyerInfo: {
    flex: 1,
  },
  buyerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  saleItems: {
    marginBottom: 20,
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  saleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 2,
  },
  itemName: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
  },
  saleFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16,
  },
  saleMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
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
  bottomSpacing: {
    height: 40,
  },
});