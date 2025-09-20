import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/FontAwesome5';
import HeaderComponent from '../../components/HeaderComponent';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

const { width: screenWidth } = Dimensions.get('window');

type Profile = Database['public']['Tables']['profiles']['Row'];

interface User {
  id: string;
  email: string;
  created_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    user_type: 'farmer' | 'buyer' | 'admin' | 'super-admin';
    farm_name: string | null;
    phone: string | null;
    barangay: string | null;
  } | null;
  salesData?: {
    totalSales: number;
    totalLifetime: number;
    chartData: Array<{
      date: string;
      amount: number;
    }>;
  };
}

const colors = {
  primary: '#059669',
  primaryLight: '#34d399',
  secondary: '#10b981',
  white: '#ffffff',
  background: '#f8fafc',
  backgroundLight: '#f1f5f9',
  text: '#0f172a',
  textSecondary: '#64748b',
  textLight: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  shadow: 'rgba(15, 23, 42, 0.08)',
  shadowDark: 'rgba(15, 23, 42, 0.15)',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray300: '#cbd5e1',
};

export default function AdminUsers() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'farmer' | 'buyer'>('farmer');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (profile) {
      loadUsers(profile);
    }
  }, [activeTab]);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      console.log('🔍 Admin Page - User data:', userData);
      console.log('🔍 Admin Page - User type:', userData?.profile?.user_type);
      console.log('🔍 Admin Page - User barangay:', userData?.profile?.barangay);
      console.log('🔍 Admin Page - Full profile:', JSON.stringify(userData?.profile, null, 2));

      if (!userData?.profile || !['admin', 'super-admin'].includes(userData.profile.user_type)) {
        console.log('❌ Access denied - User type:', userData?.profile?.user_type);
        Alert.alert('Access Denied', `You do not have admin privileges. Current user type: ${userData?.profile?.user_type || 'none'}`);
        router.replace('/');
        return;
      }

      setProfile(userData.profile);
      await loadUsers(userData.profile);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const generateDateRange = (): string[] => {
    const dates: string[] = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7); // Last 7 days
    
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(current.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  };

  const fetchUserSalesData = async (userId: string): Promise<User['salesData']> => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7); // Last 7 days

      // Fetch all completed orders for lifetime total
      const { data: allOrders, error: allOrdersError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('buyer_id', userId)
        .in('status', ['completed', 'delivered']);

      if (allOrdersError) {
        console.error(`Error fetching all orders for user ${userId}:`, allOrdersError);
      }

      // Fetch orders for this user (last 7 days)
      const { data: orders, error } = await supabase
        .from('orders')
        .select('total_amount, created_at, status')
        .eq('buyer_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['completed', 'delivered']);

      if (error) {
        console.error(`Error fetching orders for user ${userId}:`, error);
        return { totalSales: 0, totalLifetime: 0, chartData: [] };
      }

      // Group orders by date
      const salesByDate: { [date: string]: number } = {};
      const dates = generateDateRange();

      // Initialize all dates with 0
      dates.forEach(date => {
        salesByDate[date] = 0;
      });

      // Add actual sales data
      orders?.forEach(order => {
        const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
        if (salesByDate.hasOwnProperty(orderDate)) {
          salesByDate[orderDate] += order.total_amount || 0;
        }
      });

      // Convert to chart data format
      const chartData = dates.map(date => ({
        date,
        amount: salesByDate[date] || 0
      }));

      const totalSales = chartData.reduce((sum, day) => sum + day.amount, 0);
      const totalLifetime = allOrders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

      return {
        totalSales,
        totalLifetime,
        chartData
      };
    } catch (error) {
      console.error(`Error fetching sales data for user ${userId}:`, error);
      return { totalSales: 0, totalLifetime: 0, chartData: [] };
    }
  };

  const loadUsers = async (adminProfile?: Profile) => {
    const currentProfile = adminProfile || profile;
    try {
      let query = supabase
        .from('profiles')
        .select(`
          id,
          email,
          first_name,
          last_name,
          user_type,
          farm_name,
          phone,
          barangay,
          created_at
        `)
        .eq('user_type', activeTab)
        .order('created_at', { ascending: false });

      if (currentProfile?.barangay) {
        console.log('📊 Admin barangay:', currentProfile.barangay);
        console.log('📊 Filtering users for barangay:', currentProfile.barangay);
        query = query.eq('barangay', currentProfile.barangay);
      } else {
        console.log('⚠️ Admin has no barangay set, showing all users');
      }

      const { data, error } = await query;

      console.log('📊 Load users response:', {
        success: !error,
        count: data?.length || 0,
        error: error,
        adminBarangay: currentProfile?.barangay,
        firstFewUsers: data?.slice(0, 3).map(u => ({
          name: `${u.first_name} ${u.last_name}`,
          barangay: u.barangay,
          user_type: u.user_type
        }))
      });

      if (error) {
        console.error('❌ Error loading users:', error);
        throw error;
      }

      // Convert to User format
      let usersData: User[] = data?.map(profile => ({
        id: profile.id,
        email: profile.email || '',
        created_at: profile.created_at || '',
        profiles: {
          first_name: profile.first_name,
          last_name: profile.last_name,
          user_type: profile.user_type as 'farmer' | 'buyer' | 'admin' | 'super-admin',
          farm_name: profile.farm_name,
          phone: profile.phone,
          barangay: profile.barangay,
        },
      })) || [];

      // Fetch real sales data for each user
      console.log('📊 Fetching sales data for users...');
      const usersWithSalesData = await Promise.all(
        usersData.map(async (user) => {
          const salesData = await fetchUserSalesData(user.id);
          return {
            ...user,
            salesData
          };
        })
      );

      usersData = usersWithSalesData;

      // Additional client-side filtering to ensure barangay match
      if (currentProfile?.barangay) {
        const beforeFilter = usersData.length;
        console.log(`🔍 Before client filter: Admin barangay="${currentProfile.barangay}"`);
        console.log('🔍 Users before filter:', usersData.map(u => ({
          name: `${u.profiles?.first_name} ${u.profiles?.last_name}`,
          barangay: u.profiles?.barangay,
          userType: u.profiles?.user_type
        })));

        usersData = usersData.filter(user => {
          const match = user.profiles?.barangay === currentProfile.barangay;
          if (!match) {
            console.log(`❌ Filtering out user: ${user.profiles?.first_name} ${user.profiles?.last_name} (barangay: "${user.profiles?.barangay}" != "${currentProfile.barangay}")`);
          }
          return match;
        });

        console.log(`🔍 Client-side filter: ${beforeFilter} -> ${usersData.length} users (admin barangay: ${currentProfile.barangay})`);

        // Log any users that don't match for debugging
        const nonMatchingUsers = (data || []).filter(p => p.barangay !== currentProfile.barangay);
        if (nonMatchingUsers.length > 0) {
          console.log('⚠️ Found users with different barangays:', nonMatchingUsers.map(u => ({
            name: `${u.first_name} ${u.last_name}`,
            barangay: u.barangay,
            expected: currentProfile.barangay
          })));
        }
      }

      console.log('👥 Final processed users data:', usersData.length, 'users');
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers(); // Use current profile from state for refresh
    setRefreshing(false);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.profiles?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.profiles?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.profiles?.farm_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.profiles?.barangay?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case 'farmer': return colors.primary;
      case 'buyer': return colors.secondary;
      case 'admin': return colors.danger;
      case 'super-admin': return colors.warning;
      default: return colors.textSecondary;
    }
  };

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case 'farmer': return 'seedling';
      case 'buyer': return 'shopping-cart';
      case 'admin': return 'user-shield';
      case 'super-admin': return 'crown';
      default: return 'user';
    }
  };

  const formatCurrency = (amount: number): string => {
    return `₱${amount.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getChartConfig = () => ({
    backgroundColor: 'transparent',
    backgroundGradientFrom: colors.white,
    backgroundGradientTo: colors.white,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
    style: {
      borderRadius: 12,
    },
    propsForDots: {
      r: '2',
      strokeWidth: '1',
      stroke: colors.primary
    },
    fillShadowGradient: colors.primary,
    fillShadowGradientOpacity: 0.15,
  });

  const getTotalSales = () => {
    if (activeTab === 'buyer') {
      return filteredUsers.reduce((total, user) => total + (user.salesData?.totalLifetime || 0), 0);
    }
    return filteredUsers.reduce((total, user) => total + (user.salesData?.totalSales || 0), 0);
  };

  const renderUser = ({ item }: { item: User }) => {
    const chartData = {
      labels: item.salesData?.chartData.map(d => d.date.split(' ')[1]) || ['1', '2', '3', '4', '5', '6', '7'],
      datasets: [
        {
          data: item.salesData?.chartData.map(d => d.amount) || [0, 0, 0, 0, 0, 0, 0],
          color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };

    const hasValidData = item.salesData?.chartData && item.salesData.chartData.some(d => d.amount > 0);

    return (
      <View style={styles.userCard}>
        {/* User Header with Avatar */}
        <View style={styles.userHeader}>
          <View style={styles.userAvatarContainer}>
            <View style={[styles.userAvatar, { backgroundColor: getUserTypeColor(item.profiles?.user_type || '') }]}>
              <Icon 
                name={getUserTypeIcon(item.profiles?.user_type || '')} 
                size={16} 
                color={colors.white} 
              />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.profiles?.first_name} {item.profiles?.last_name}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.moreButton}>
            <Icon name="ellipsis-v" size={14} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* Sales/Spending Summary */}
        <View style={styles.salesSummary}>
          <View style={styles.salesAmount}>
            <Text style={styles.salesLabel}>{activeTab === 'buyer' ? '7-Day Spending' : '7-Day Sales'}</Text>
            <Text style={styles.salesValue}>
              {formatCurrency(item.salesData?.totalSales || 0)}
            </Text>
            {activeTab === 'buyer' && (
              <>
                <Text style={styles.lifetimeLabel}>Total Lifetime</Text>
                <Text style={styles.lifetimeValue}>
                  {formatCurrency(item.salesData?.totalLifetime || 0)}
                </Text>
              </>
            )}
          </View>
          <View style={[styles.userTypeBadge, { backgroundColor: getUserTypeColor(item.profiles?.user_type || '') + '15' }]}>
            <Text style={[styles.userTypeText, { color: getUserTypeColor(item.profiles?.user_type || '') }]}>
              {item.profiles?.user_type?.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Sales Chart */}
        {hasValidData ? (
          <View style={styles.chartContainer}>
            <LineChart
              data={chartData}
              width={screenWidth * 0.42}
              height={80}
              chartConfig={getChartConfig()}
              bezier
              style={styles.chart}
              withInnerLines={false}
              withOuterLines={false}
              withVerticalLines={false}
              withHorizontalLines={false}
              fromZero={true}
              segments={2}
              withDots={true}
              withVerticalLabels={false}
              withHorizontalLabels={false}
            />
          </View>
        ) : (
          <View style={styles.noDataContainer}>
            <Icon name="chart-line" size={20} color={colors.textLight} />
            <Text style={styles.noDataText}>No sales data</Text>
          </View>
        )}

        {/* User Details */}
        <View style={styles.userDetails}>
          {item.profiles?.farm_name && (
            <View style={styles.detailRow}>
              <Icon name="home" size={10} color={colors.textSecondary} />
              <Text style={styles.userDetail} numberOfLines={1}>{item.profiles.farm_name}</Text>
            </View>
          )}
          {item.profiles?.barangay && (
            <View style={styles.detailRow}>
              <Icon name="map-marker-alt" size={10} color={colors.textSecondary} />
              <Text style={styles.userDetail} numberOfLines={1}>{item.profiles.barangay}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Icon name="calendar" size={10} color={colors.textLight} />
            <Text style={styles.userDate} numberOfLines={1}>
              {new Date(item.created_at).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: '2-digit'
              })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <HeaderComponent
          profile={profile}
          userType="admin"
          currentRoute="/admin/users"
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading users...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        userType="admin"
        currentRoute="/admin/users"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search users..."
      />

      <View style={styles.content}>
        {/* Enhanced Header */}
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <Text style={styles.title}>User Management</Text>
            <View style={styles.locationContainer}>
              <Icon name="map-marker-alt" size={12} color={colors.textSecondary} />
              <Text style={styles.barangayInfo}>
                {profile?.barangay ? profile.barangay : 'All Barangays'}
              </Text>
            </View>
          </View>
          
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{filteredUsers.length}</Text>
              <Text style={styles.statLabel}>Total {activeTab}s</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatCurrency(getTotalSales()).replace('₱', '₱')}</Text>
              <Text style={styles.statLabel}>{activeTab === 'buyer' ? 'Total Spending' : 'Total Sales'}</Text>
            </View>
          </View>
        </View>

        {/* Enhanced Tab Navigation */}
        <View style={styles.tabWrapper}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'farmer' && styles.activeTab]}
              onPress={() => setActiveTab('farmer')}
            >
              <Icon
                name="seedling"
                size={16}
                color={activeTab === 'farmer' ? colors.white : colors.textSecondary}
              />
              <Text style={[
                styles.tabText,
                activeTab === 'farmer' && styles.activeTabText
              ]}>
                Farmers
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'buyer' && styles.activeTab]}
              onPress={() => setActiveTab('buyer')}
            >
              <Icon
                name="shopping-cart"
                size={16}
                color={activeTab === 'buyer' ? colors.white : colors.textSecondary}
              />
              <Text style={[
                styles.tabText,
                activeTab === 'buyer' && styles.activeTabText
              ]}>
                Buyers
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Users Grid */}
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Icon name="users" size={48} color={colors.textLight} />
              </View>
              <Text style={styles.emptyTitle}>No {activeTab}s found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery 
                  ? `Try adjusting your search terms` 
                  : `No ${activeTab}s registered in this area yet`
                }
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  titleSection: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barangayInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statsCard: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  tabWrapper: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    borderRadius: 16,
    padding: 4,
    elevation: 1,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  activeTab: {
    backgroundColor: colors.primary,
    elevation: 2,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.white,
    fontWeight: '700',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  userCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    elevation: 3,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    width: (screenWidth - 48) / 2,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  userAvatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  moreButton: {
    padding: 6,
    borderRadius: 8,
  },
  salesSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.gray50,
    borderRadius: 12,
  },
  salesAmount: {
    flex: 1,
  },
  salesLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  salesValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  lifetimeLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 2,
  },
  lifetimeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  userTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  userTypeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: colors.gray50,
    borderRadius: 12,
    paddingVertical: 8,
  },
  chart: {
    borderRadius: 12,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  noDataText: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '500',
    marginTop: 8,
  },
  userDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userDetail: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  userDate: {
    fontSize: 11,
    color: colors.textLight,
    fontWeight: '500',
    flex: 1,
  },
  emptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});