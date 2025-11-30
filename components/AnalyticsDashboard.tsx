import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import {
  AnalyticsData,
  getAnalyticsData,
  ProductAnalytics,
  UserAnalytics
} from '../services/analytics';
import BarChart from './charts/BarChart';
import PieChart from './charts/PieChart';

// Icon Components - Replace with your icon library (react-native-vector-icons, etc.)
const Icon = ({ name, size = 24, color = '#000' }: { name: string; size?: number; color?: string }) => {
  const iconMap: { [key: string]: string } = {
    'shopping-bag': '⊞',
    'trending-up': '↑',
    'trending-down': '↓',
    'check': '✓',
    'x': '✕',
    'bar-chart': '▪',
    'pie-chart': '◯',
    'list': '≡',
    'users': '👥',
    'box': '⊞',
    'leaf': '🌿',
    'trending': '📈',
    'settings': '⚙',
  };
  
  return <Text style={{ fontSize: size, color }}>{iconMap[name] || '•'}</Text>;
};

const { width } = Dimensions.get('window');
const isDesktop = width >= 1024;
const isMobile = width < 768;

interface AnalyticsDashboardProps {
  userType: 'buyer' | 'farmer' | 'admin' | 'super-admin';
  userId: string;
  barangay?: string;
}

const GRID_COLS = isDesktop ? 4 : isMobile ? 1 : 2;
const GAP = isMobile ? 16 : 20;
const CARD_WIDTH = (width - (GRID_COLS + 1) * GAP - (isDesktop ? 96 : isMobile ? 32 : 56)) / GRID_COLS;

export default function AnalyticsDashboard({
  userType,
  userId,
  barangay,
}: AnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [productAnalytics, setProductAnalytics] = useState<ProductAnalytics | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);

  useEffect(() => {
    loadAnalytics();
    loadProductsAndUsers();
  }, [userType, userId, barangay]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const analyticsData = await getAnalyticsData(userType, userId, barangay);
      setData(analyticsData);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const loadProductsAndUsers = async () => {
    try {
      if (userType === 'farmer') {
        const { data: productsData } = await supabase
          .from('products')
          .select('id, name')
          .eq('farmer_id', userId)
          .eq('status', 'approved');
        setProducts(productsData || []);
      } else if (userType === 'admin' || userType === 'super-admin') {
        const { data: productsData } = await supabase
          .from('products')
          .select('id, name')
          .eq('status', 'approved')
          .limit(50);
        setProducts(productsData || []);
      }

      if (userType === 'admin') {
        const { data: usersData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, user_type')
          .eq('barangay', barangay!)
          .in('user_type', ['farmer', 'buyer']);
        const formattedUsers = (usersData as any)?.map((u: any) => ({
          id: u.id,
          name: `${u.first_name} ${u.last_name}`,
          type: u.user_type,
        })) || [];
        setUsers(formattedUsers);
      } else if (userType === 'super-admin') {
        const { data: usersData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, user_type')
          .in('user_type', ['farmer', 'buyer'])
          .limit(100);
        const formattedUsers = (usersData as any)?.map((u: any) => ({
          id: u.id,
          name: `${u.first_name} ${u.last_name}`,
          type: u.user_type,
        })) || [];
        setUsers(formattedUsers);
      }
    } catch (err) {
      console.error('Error loading products and users:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  // Card Components
  const StatWidget = ({
    title,
    value,
    iconName,
    color,
    subtitle,
    trend,
    span = 1,
  }: {
    title: string;
    value: string | number;
    iconName: string;
    color: string;
    subtitle?: string;
    trend?: { direction: 'up' | 'down'; percentage: number };
    span?: number;
  }) => {
    // On mobile, all cards take full width regardless of span
    const cardWidth = isMobile ? CARD_WIDTH : (span === 2 ? CARD_WIDTH * 2 + GAP : CARD_WIDTH);

    return (
      <View
        style={[
          styles.card,
          {
            width: cardWidth,
            minHeight: 160,
          },
          styles.statWidget,
        ]}
      >
      <View style={styles.cardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: color + '20' }]}>
          <Icon name={iconName} size={24} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {trend && (
            <View style={styles.trendBadge}>
              <Text
                style={[
                  styles.trendText,
                  { color: trend.direction === 'up' ? '#059669' : '#dc2626' },
                ]}
              >
                {trend.direction === 'up' ? '↑' : '↓'} {trend.percentage}%
              </Text>
            </View>
          )}
        </View>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
    );
  };

  const ChartCard = ({
    title,
    children,
    span = 2,
    height = 280,
  }: {
    title: string;
    children: React.ReactNode;
    span?: number;
    height?: number;
  }) => {
    // On mobile, all cards take full width regardless of span
    const cardWidth = isMobile
      ? CARD_WIDTH
      : (span === 2 ? CARD_WIDTH * 2 + GAP : span === 3 ? CARD_WIDTH * 3 + GAP * 2 : CARD_WIDTH);

    return (
      <View
        style={[
          styles.card,
          {
            width: cardWidth,
            minHeight: height + 100,
          },
        ]}
      >
      <View style={styles.cardHeaderTop}>
        <Text style={styles.cardTitle}>{title}</Text>
        <TouchableOpacity style={styles.moreButton}>
          <Text style={styles.moreText}>⋯</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.chartContentContainer, { height, width: '100%' }]}>
        {children}
      </View>
    </View>
    );
  };

  const ListCard = ({
    title,
    items,
    span = 1,
  }: {
    title: string;
    items: Array<{ rank: number; name: string; value: string; amount: string }>;
    span?: number;
  }) => {
    // On mobile, all cards take full width regardless of span
    const cardWidth = isMobile ? CARD_WIDTH : (span === 2 ? CARD_WIDTH * 2 + GAP : CARD_WIDTH);

    return (
      <View
        style={[
          styles.card,
          {
            width: cardWidth,
            minHeight: 320,
          },
        ]}
      >
      <View style={styles.cardHeaderTop}>
        <Text style={styles.cardTitle}>{title}</Text>
        <TouchableOpacity style={styles.moreButton}>
          <Text style={styles.moreText}>⋯</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.listContainer}>
        {items.slice(0, 5).map((item, idx) => (
          <View key={idx} style={styles.listItem}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{item.rank}</Text>
            </View>
            <View style={styles.listInfo}>
              <Text style={styles.listName}>{item.name}</Text>
              <Text style={styles.listValue}>{item.value}</Text>
            </View>
            <Text style={styles.listAmount}>{item.amount}</Text>
          </View>
        ))}
      </View>
    </View>
    );
  };

  const ProgressCard = ({
    title,
    items,
  }: {
    title: string;
    items: Array<{ label: string; value: number; color: string }>;
  }) => {
    // On mobile, all cards take full width
    const cardWidth = isMobile ? CARD_WIDTH : CARD_WIDTH * 2 + GAP;

    return (
      <View style={[styles.card, { width: cardWidth, minHeight: 280 }]}>
      <View style={styles.cardHeaderTop}>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.progressContainer}>
        {items.map((item, idx) => (
          <View key={idx} style={styles.progressItem}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>{item.label}</Text>
              <Text style={styles.progressValue}>{item.value}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${item.value}%`, backgroundColor: item.color },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
    );
  };

  const renderBuyerDashboard = () => {
    if (!data?.buyer) return null;

    return (
      <View style={styles.grid}>
        {/* Row 1: Key Metrics */}
        <StatWidget
          title="Total Orders"
          value={data.buyer.totalOrders}
          iconName="shopping-bag"
          color="#2563eb"
          subtitle={`${data.buyer.pendingOrders} pending`}
          trend={{ direction: 'up', percentage: 12 }}
          span={1}
        />
        <StatWidget
          title="Total Spent"
          value={formatCurrency(data.buyer.totalSpent)}
          iconName="trending-up"
          color="#059669"
          trend={{ direction: 'up', percentage: 8 }}
          span={1}
        />
        <StatWidget
          title="Completed"
          value={data.buyer.completedOrders}
          iconName="check"
          color="#7c3aed"
          span={1}
        />
        <StatWidget
          title="Cancelled"
          value={data.buyer.cancelledOrders}
          iconName="x"
          color="#dc2626"
          span={1}
        />

        {/* Most Bought Crop */}
        {data.buyer.mostBoughtCrop && (
          <StatWidget
            title="Most Bought Crop"
            value={data.buyer.mostBoughtCrop.name}
            iconName="leaf"
            color="#f59e0b"
            subtitle={`${data.buyer.mostBoughtCrop.percentage}% of orders • ${formatCurrency(data.buyer.mostBoughtCrop.totalSpent)}`}
            span={2}
          />
        )}

        {/* Row 2: Main Charts */}
        <ChartCard title="Order Status Distribution" span={2} height={500}>
          <PieChart
            data={Object.entries(data.buyer.ordersByStatus).map(([status, count]) => ({
              label: status,
              value: count,
              color: getStatusColor(status),
            }))}
            size={180}
          />
        </ChartCard>

        <ListCard
          title="Top Products"
          span={2}
          items={data.buyer.topProducts.map((p, idx) => ({
            rank: idx + 1,
            name: p.name,
            value: `${p.count} orders`,
            amount: formatCurrency(p.totalSpent),
          }))}
        />

        {/* Row 3: Detailed View */}
        <ChartCard title="Top Purchases" span={2} height={220}>
          <BarChart
            data={data.buyer.topProducts.slice(0, 5).map(product => ({
              label: product.name.substring(0, 8),
              value: product.totalSpent,
              color: '#2563eb',
            }))}
            height={180}
            showValues={true}
          />
        </ChartCard>

        <ProgressCard
          title="Order Status"
          items={Object.entries(data.buyer.ordersByStatus).map(([status, count]) => ({
            label: status.charAt(0).toUpperCase() + status.slice(1),
            value: Math.round((count / data.buyer!.totalOrders) * 100),
            color: getStatusColor(status),
          }))}
        />
      </View>
    );
  };

  const renderFarmerDashboard = () => {
    if (!data?.farmer) return null;

    return (
      <View style={styles.grid}>
        {/* Row 1: KPIs */}
        <StatWidget
          title="Total Products"
          value={data.farmer.totalProducts}
          iconName="box"
          color="#059669"
          subtitle={`${data.farmer.activeProducts} active`}
          span={1}
        />
        <StatWidget
          title="Total Revenue"
          value={formatCurrency(data.farmer.totalRevenue)}
          iconName="trending-up"
          color="#f59e0b"
          trend={{ direction: 'up', percentage: 15 }}
          span={1}
        />
        <StatWidget
          title="Orders"
          value={data.farmer.totalOrders}
          iconName="shopping-bag"
          color="#2563eb"
          subtitle={`${data.farmer.pendingOrders} pending`}
          span={1}
        />
        <StatWidget
          title="Completed"
          value={data.farmer.completedOrders}
          iconName="check"
          color="#7c3aed"
          span={1}
        />

        {/* Top Revenue & Top Sold Crop */}
        {data.farmer.topRevenueCrop && (
          <StatWidget
            title="Top Revenue Crop"
            value={data.farmer.topRevenueCrop.name}
            iconName="trending-up"
            color="#10b981"
            subtitle={`${formatCurrency(data.farmer.topRevenueCrop.revenue)} • ${data.farmer.topRevenueCrop.quantity} ${data.farmer.topRevenueCrop.unit} sold`}
            span={1}
          />
        )}
        {data.farmer.topSoldCrop && (
          <StatWidget
            title="Most Sold Crop"
            value={data.farmer.topSoldCrop.name}
            iconName="leaf"
            color="#8b5cf6"
            subtitle={`${data.farmer.topSoldCrop.quantity} ${data.farmer.topSoldCrop.unit} • ${formatCurrency(data.farmer.topSoldCrop.revenue)}`}
            span={1}
          />
        )}

        {/* Row 2: Main Metrics */}
        <ChartCard title="Revenue by Product" span={2} height={240}>
          <BarChart
            data={data.farmer.topProducts.slice(0, 6).map(product => ({
              label: product.name.substring(0, 8),
              value: product.revenue,
              color: '#059669',
            }))}
            height={200}
            horizontal={false}
          />
        </ChartCard>

        <ListCard
          title="Top Performing Products"
          span={2}
          items={data.farmer.topProducts.slice(0, 5).map((p, idx) => ({
            rank: idx + 1,
            name: p.name,
            value: `${p.soldQuantity} ${p.unit}`,
            amount: formatCurrency(p.revenue),
          }))}
        />

        {/* Row 3: Categories & Status */}
        <ChartCard title="Product Categories" span={2} height={520}>
          <PieChart
            data={Object.entries(data.farmer.productsByCategory).map(([category, count]) => ({
              label: category,
              value: count,
              color: getCategoryColor(category),
            }))}
            size={200}
          />
        </ChartCard>

        <ProgressCard
          title="Order Status"
          items={Object.entries(data.farmer.ordersByStatus).map(([status, count]) => ({
            label: status.charAt(0).toUpperCase() + status.slice(1),
            value: Math.round((count / data.farmer!.totalOrders) * 100),
            color: getStatusColor(status),
          }))}
        />
      </View>
    );
  };

  const renderAdminDashboard = () => {
    if (!data?.admin) return null;

    return (
      <View style={styles.grid}>
        {/* Row 1: Overview Stats */}
        <StatWidget
          title="Total Users"
          value={data.admin.totalUsers}
          iconName="users"
          color="#2563eb"
          subtitle={`${data.admin.farmers} farmers`}
          span={1}
        />
        <StatWidget
          title="Total Orders"
          value={data.admin.totalOrders}
          iconName="shopping-bag"
          color="#059669"
          subtitle={`${data.admin.pendingOrders} pending`}
          span={1}
        />
        <StatWidget
          title="Products"
          value={data.admin.totalProducts}
          iconName="box"
          color="#7c3aed"
          subtitle={`${data.admin.activeProducts} active`}
          span={1}
        />
        <StatWidget
          title="Revenue"
          value={formatCurrency(data.admin.totalRevenue)}
          iconName="trending-up"
          color="#f59e0b"
          trend={{ direction: 'up', percentage: 22 }}
          span={1}
        />

        {/* Top Crop This Month */}
        {data.admin.topCropThisMonth && (
          <StatWidget
            title="Top Crop This Month"
            value={data.admin.topCropThisMonth.name}
            iconName="trending"
            color="#10b981"
            subtitle={`${formatCurrency(data.admin.topCropThisMonth.revenue)} • ${data.admin.topCropThisMonth.orderCount} orders`}
            span={1}
          />
        )}

        {/* Highest Crop Bought */}
        {data.admin.highestCropBought && (
          <StatWidget
            title="Highest Crop Sold"
            value={data.admin.highestCropBought.name}
            iconName="bar-chart"
            color="#8b5cf6"
            subtitle={`${data.admin.highestCropBought.quantity} units • Seller: ${data.admin.highestCropBought.sellerName}`}
            span={1}
          />
        )}

        {/* Highest Crop in Barangay */}
        {data.admin.highestCropInBarangay && (
          <StatWidget
            title="Most Popular in Barangay"
            value={data.admin.highestCropInBarangay.name}
            iconName="leaf"
            color="#f59e0b"
            subtitle={`${data.admin.highestCropInBarangay.quantity} units • ${data.admin.highestCropInBarangay.orderCount} orders`}
            span={1}
          />
        )}

        {/* Row 2: Charts */}
        <ChartCard title="Top Farmers by Revenue" span={2} height={240}>
          <BarChart
            data={data.admin.topFarmers.slice(0, 5).map(farmer => ({
              label: farmer.name.split(' ')[0],
              value: farmer.revenue,
              color: '#059669',
            }))}
            height={200}
            horizontal={true}
          />
        </ChartCard>

        <ListCard
          title="Top Farmers"
          span={2}
          items={data.admin.topFarmers.slice(0, 5).map((f, idx) => ({
            rank: idx + 1,
            name: f.name,
            value: f.farmName || 'No farm',
            amount: formatCurrency(f.revenue),
          }))}
        />

        {/* Row 3: Products & Status */}
        <ChartCard title="Popular Products" span={2} height={240}>
          <BarChart
            data={data.admin.topProducts.slice(0, 6).map(product => ({
              label: product.name.substring(0, 8),
              value: product.revenue,
              color: '#2563eb',
            }))}
            height={200}
          />
        </ChartCard>

        <ProgressCard
          title="Order Status Distribution"
          items={Object.entries(data.admin.ordersByStatus).map(([status, count]) => ({
            label: status.charAt(0).toUpperCase() + status.slice(1),
            value: Math.round((count / data.admin!.totalOrders) * 100),
            color: getStatusColor(status),
          }))}
        />
      </View>
    );
  };

  const renderSuperAdminDashboard = () => {
    if (!data?.superAdmin) return null;

    return (
      <View style={styles.grid}>
        {/* Row 1: Platform KPIs */}
        <StatWidget
          title="Total Users"
          value={data.superAdmin.totalUsers}
          iconName="users"
          color="#2563eb"
          subtitle={`${data.superAdmin.farmers} farmers`}
          trend={{ direction: 'up', percentage: 18 }}
          span={1}
        />
        <StatWidget
          title="Total Orders"
          value={data.superAdmin.totalOrders}
          iconName="shopping-bag"
          color="#059669"
          subtitle={`${data.superAdmin.completedOrders} completed`}
          span={1}
        />
        <StatWidget
          title="Products"
          value={data.superAdmin.totalProducts}
          iconName="box"
          color="#7c3aed"
          subtitle={`${data.superAdmin.activeProducts} active`}
          span={1}
        />
        <StatWidget
          title="Platform Revenue"
          value={formatCurrency(data.superAdmin.totalRevenue)}
          iconName="trending-up"
          color="#f59e0b"
          trend={{ direction: 'up', percentage: 28 }}
          span={1}
        />

        {/* Top Crop This Month */}
        {data.superAdmin.topCropThisMonth && (
          <StatWidget
            title="Top Crop This Month"
            value={data.superAdmin.topCropThisMonth.name}
            iconName="trending"
            color="#10b981"
            subtitle={`${formatCurrency(data.superAdmin.topCropThisMonth.revenue)} • ${data.superAdmin.topCropThisMonth.orderCount} orders`}
            span={1}
          />
        )}

        {/* Highest Crop Bought Platform-Wide */}
        {data.superAdmin.highestCropBought && (
          <StatWidget
            title="Most Sold Crop"
            value={data.superAdmin.highestCropBought.name}
            iconName="leaf"
            color="#8b5cf6"
            subtitle={`${data.superAdmin.highestCropBought.quantity} units • Seller: ${data.superAdmin.highestCropBought.sellerName}`}
            span={1}
          />
        )}

        {/* Row 2: Main Insights */}
        <ChartCard title="Barangay Performance" span={2} height={240}>
          <BarChart
            data={data.superAdmin.barangayStats.slice(0, 6).map(barangay => ({
              label: barangay.name.substring(0, 8),
              value: barangay.revenue,
              color: '#f59e0b',
            }))}
            height={200}
            horizontal={true}
          />
        </ChartCard>

        <ListCard
          title="Top Barangays"
          span={2}
          items={data.superAdmin.barangayStats.slice(0, 5).map((b, idx) => ({
            rank: idx + 1,
            name: b.name,
            value: `${b.farmers} farmers`,
            amount: formatCurrency(b.revenue),
          }))}
        />

        {/* Row 3: Products & Stats */}
        <ChartCard title="Top Products Platform-Wide" span={2} height={240}>
          <BarChart
            data={data.superAdmin.topProducts.slice(0, 6).map(product => ({
              label: product.name.substring(0, 8),
              value: product.revenue,
              color: '#2563eb',
            }))}
            height={200}
          />
        </ChartCard>
      </View>
    );
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'pending':
        return '#f59e0b';
      case 'confirmed':
        return '#2563eb';
      case 'processing':
        return '#7c3aed';
      case 'ready':
        return '#059669';
      case 'delivered':
        return '#059669';
      case 'cancelled':
        return '#dc2626';
      default:
        return '#9ca3af';
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category.toLowerCase()) {
      case 'vegetables':
        return '#059669';
      case 'fruits':
        return '#f59e0b';
      case 'grains':
        return '#7c3aed';
      case 'herbs':
        return '#0891b2';
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <Text style={styles.headerSubtitle}>
          {userType === 'super-admin'
            ? 'Platform Analytics'
            : userType === 'admin'
            ? `${barangay || 'Barangay'} Overview`
            : userType === 'farmer'
            ? 'Your Farm Metrics'
            : 'Shopping Analytics'}
        </Text>
      </View>

      {userType === 'buyer' && renderBuyerDashboard()}
      {userType === 'farmer' && renderFarmerDashboard()}
      {userType === 'admin' && renderAdminDashboard()}
      {userType === 'super-admin' && renderSuperAdminDashboard()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  contentContainer: {
    padding: isDesktop ? 48 : isMobile ? 20 : 28,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f9fafb',
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    fontWeight: '500',
  },
  header: {
    marginBottom: 40,
  },
  headerTitle: {
    fontSize: isDesktop ? 44 : 36,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: -1.2,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '400',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  moreButton: {
    padding: 8,
    marginRight: -8,
  },
  moreText: {
    fontSize: 20,
    color: '#9ca3af',
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  statSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '400',
  },
  trendBadge: {
    marginTop: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statWidget: {
    justifyContent: 'space-between',
  },
  chartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  chartContentContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  listContainer: {
    gap: 0,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  listValue: {
    fontSize: 12,
    color: '#6b7280',
  },
  listAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  progressContainer: {
    gap: 20,
  },
  progressItem: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
});