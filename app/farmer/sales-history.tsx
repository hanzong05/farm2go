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
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';
import NavBar from '../../components/NavBar';

const { width } = Dimensions.get('window');

type Profile = Database['public']['Tables']['profiles']['Row'];

interface Sale {
  id: string;
  buyer_id: string;
  total_amount: number;
  status: 'completed';
  created_at: string;
  delivery_date: string | null;
  buyer_profile?: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  };
  order_items?: Array<{
    id: string;
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

      // Get unique order IDs
      const orderIds = [...new Set(orderItems?.map(item => item.order_id) || [])];

      if (orderIds.length === 0) {
        setSales([]);
        return;
      }

      // Get completed orders only
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
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Combine orders with their items and calculate totals
      const salesWithItems = ordersData?.map(order => {
        const items = orderItems?.filter(item => item.order_id === order.id).map(item => ({
          id: item.order_id,
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
          ...order,
          total_amount: farmerRevenue, // Override with farmer's actual revenue
          buyer_profile: order.profiles,
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

  const renderStatsCard = (
    title: string,
    value: string | number,
    color: string,
    icon: string,
    subtitle?: string,
    growth?: number
  ) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Text style={[styles.statIcon, { color }]}>{icon}</Text>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      </View>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      {growth !== undefined && (
        <Text style={[
          styles.growthText,
          { color: growth >= 0 ? '#16a34a' : '#dc2626' }
        ]}>
          {growth >= 0 ? '—' : '˜'} {Math.abs(growth).toFixed(1)}%
        </Text>
      )}
    </View>
  );

  const renderSaleCard = ({ item: sale }: { item: Sale }) => (
    <View style={styles.saleCard}>
      <View style={styles.saleHeader}>
        <View style={styles.saleInfo}>
          <Text style={styles.saleId}>Sale #{sale.id.slice(-8)}</Text>
          <Text style={styles.saleDate}>{formatDate(sale.created_at)}</Text>
        </View>
        <Text style={styles.saleAmount}>{formatPrice(sale.total_amount)}</Text>
      </View>

      <View style={styles.buyerInfo}>
        <Text style={styles.buyerName}>
          {sale.buyer_profile?.company_name ||
           `${sale.buyer_profile?.first_name || ''} ${sale.buyer_profile?.last_name || ''}`.trim() ||
           'Unknown Buyer'}
        </Text>
      </View>

      <View style={styles.saleItems}>
        <Text style={styles.itemsTitle}>Items Sold:</Text>
        {sale.order_items?.map((item, index) => (
          <View key={index} style={styles.saleItem}>
            <Text style={styles.itemName}>
              {item.quantity} {item.product.unit} of {item.product.name}
            </Text>
            <Text style={styles.itemPrice}>{formatPrice(item.total_price)}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>=Ê</Text>
      <Text style={styles.emptyTitle}>No Sales Data</Text>
      <Text style={styles.emptyDescription}>
        {selectedPeriod === 'all'
          ? 'You haven\'t made any sales yet. Start by adding products and promoting your farm!'
          : `No sales found for the selected time period.`}
      </Text>
      {selectedPeriod === 'all' && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/farmer/products/add')}
        >
          <Text style={styles.addButtonText}>Add Products</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const stats = getSalesStats();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading sales history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavBar currentRoute="/farmer/sales-history" />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#16a34a"
            colors={['#16a34a']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            {renderStatsCard(
              'Total Sales',
              stats.totalSales,
              '#3b82f6',
              '=Ê'
            )}
            {renderStatsCard(
              'Total Revenue',
              formatPrice(stats.totalRevenue),
              '#16a34a',
              '=°'
            )}
          </View>
          <View style={styles.statsRow}>
            {renderStatsCard(
              'Average Order',
              formatPrice(stats.averageOrderValue),
              '#8b5cf6',
              '=È'
            )}
            {renderStatsCard(
              'Top Product',
              stats.topProduct,
              '#f59e0b',
              '<Æ'
            )}
          </View>
          <View style={styles.statsRow}>
            {renderStatsCard(
              'This Month',
              formatPrice(stats.thisMonthRevenue),
              '#10b981',
              '=Å',
              'Revenue',
              getGrowthPercentage(stats.thisMonthRevenue, stats.lastMonthRevenue)
            )}
          </View>
        </View>

        {/* Time Period Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {TIME_PERIODS.map((period) => (
            <TouchableOpacity
              key={period.key}
              style={[
                styles.filterButton,
                selectedPeriod === period.key && styles.filterButtonActive
              ]}
              onPress={() => setSelectedPeriod(period.key)}
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

        {/* Sales List */}
        <View style={styles.salesContainer}>
          <Text style={styles.sectionTitle}>
            Sales History ({filteredSales.length} sales)
          </Text>

          {filteredSales.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={filteredSales}
              renderItem={renderSaleCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.salesList}
            />
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
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    paddingTop: 16,
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

  // Stats
  statsContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  statTitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  statSubtitle: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  growthText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  // Filter
  filterContainer: {
    paddingVertical: 8,
    marginBottom: 16,
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
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },

  // Sales
  salesContainer: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  salesList: {
    gap: 16,
  },
  saleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  saleInfo: {
    flex: 1,
  },
  saleId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  saleDate: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  saleAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a',
  },
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
  saleItems: {
    gap: 8,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  saleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemName: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
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
    marginBottom: 24,
    lineHeight: 24,
  },
  addButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 40,
  },
});