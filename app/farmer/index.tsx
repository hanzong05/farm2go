import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import HeaderComponent from '../../components/HeaderComponent';
import ResponsivePage, { ResponsiveCard, ResponsiveGrid, useResponsiveValue } from '../../components/ResponsivePage';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface DashboardStats {
  totalProducts: number;
  pendingOrders: number;
  monthlyRevenue: number;
  activeListings: number;
}

interface RecentActivity {
  id: string;
  type: 'order' | 'product' | 'payment';
  title: string;
  time: string;
  icon: string;
}

// Farm2Go color scheme
const colors = {
  primary: '#059669',
  secondary: '#10b981',
  white: '#ffffff',
  background: '#f0f9f4',
  surface: '#ffffff',
  text: '#0f172a',
  textSecondary: '#6b7280',
  border: '#d1fae5',
  shadow: 'rgba(0,0,0,0.1)',
};

export default function FarmerDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalProducts: 0,
    pendingOrders: 0,
    monthlyRevenue: 0,
    activeListings: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const userData = await getUserWithProfile();
      if (!userData?.profile) {
        router.replace('/auth/login');
        return;
      }

      setProfile(userData.profile);
      const farmerId = userData.user.id;

      // Load dashboard stats in parallel
      await Promise.all([
        loadDashboardStats(farmerId),
        loadRecentActivity(farmerId),
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardStats = async (farmerId: string) => {
    try {
      // Get total products
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('farmer_id', farmerId);

      // Get approved products (active listings)
      const { count: activeListings } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('farmer_id', farmerId)
        .eq('status', 'approved');

      // Get pending orders
      const { count: pendingOrders } = await (supabase as any)
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('farmer_id', farmerId)
        .eq('status', 'pending');

      // Get monthly revenue (completed orders from this month)
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: monthlyOrders } = await (supabase as any)
        .from('orders')
        .select('total_price')
        .eq('farmer_id', farmerId)
        .in('status', ['delivered'])
        .gte('created_at', firstDayOfMonth.toISOString());

      const monthlyRevenue = monthlyOrders?.reduce((sum: number, order: any) => {
        return sum + order.total_price;
      }, 0) || 0;

      setDashboardStats({
        totalProducts: totalProducts || 0,
        pendingOrders: pendingOrders || 0,
        monthlyRevenue,
        activeListings: activeListings || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  };

  const loadRecentActivity = async (farmerId: string) => {
    try {
      const activities: RecentActivity[] = [];

      // Get recent orders
      const { data: recentOrders } = await (supabase as any)
        .from('orders')
        .select(`
          id,
          status,
          created_at,
          profiles:buyer_id (
            first_name,
            last_name,
            company_name
          ),
          products (
            name
          )
        `)
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentOrders) {
        recentOrders.forEach((order: any) => {
          const buyerName = order.profiles?.company_name ||
                          `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim() ||
                          'Customer';

          activities.push({
            id: `order-${order.id}`,
            type: 'order',
            title: `New order from ${buyerName} for ${order.products?.name || 'product'}`,
            time: formatActivityTime(order.created_at),
            icon: '📦',
          });
        });
      }

      // Get recently approved products
      const { data: recentProducts } = await (supabase as any)
        .from('products')
        .select('id, name, status, created_at')
        .eq('farmer_id', farmerId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(2);

      if (recentProducts) {
        recentProducts.forEach((product: any) => {
          activities.push({
            id: `product-${product.id}`,
            type: 'product',
            title: `Product "${product.name}" approved`,
            time: formatActivityTime(product.created_at),
            icon: '✅',
          });
        });
      }

      // Sort activities by time and take the most recent ones
      activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setRecentActivity(activities.slice(0, 3));
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  };

  const formatActivityTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(price);
  };

  // Responsive grid columns
  const cardColumns = useResponsiveValue({
    mobile: 1,
    tablet: 2,
    desktop: 3,
  });

  const quickActions = [
    {
      title: 'Add Product',
      route: '/farmer/products/add',
      icon: '➕',
      description: 'List a new product',
      color: colors.primary
    },
    {
      title: 'View Orders',
      route: '/farmer/orders',
      icon: '📋',
      description: 'Check new orders',
      color: colors.secondary
    },
  ];

  const farmerFeatures = [
    {
      title: 'My Products',
      route: '/farmer/my-products',
      icon: '🥬',
      description: 'Manage your product listings',
      stats: `${dashboardStats.totalProducts} Products`
    },
    {
      title: 'Orders',
      route: '/farmer/orders',
      icon: '📋',
      description: 'View and fulfill customer orders',
      stats: `${dashboardStats.pendingOrders} Pending`
    },
    {
      title: 'Inventory',
      route: '/farmer/inventory',
      icon: '📦',
      description: 'Manage your stock levels',
      stats: `${dashboardStats.activeListings} Active`
    },
    {
      title: 'Sales History',
      route: '/farmer/sales-history',
      icon: '💰',
      description: 'View your sales reports',
      stats: `${formatPrice(dashboardStats.monthlyRevenue)} This Month`
    },
    {
      title: 'Farm Profile',
      route: '/farmer/profile',
      icon: '🏡',
      description: 'Update your farm information',
      stats: profile?.farm_name ? 'Profile Complete' : 'Update Profile'
    },
    {
      title: 'Analytics',
      route: '/farmer/analytics',
      icon: '📊',
      description: 'View performance insights',
      stats: 'View Reports'
    },
  ];

  const dashboardStatsDisplay = [
    {
      title: 'Total Products',
      value: dashboardStats.totalProducts.toString(),
      icon: '🥬',
      change: dashboardStats.totalProducts > 0 ? '+' + dashboardStats.totalProducts : '0'
    },
    {
      title: 'Pending Orders',
      value: dashboardStats.pendingOrders.toString(),
      icon: '📋',
      change: dashboardStats.pendingOrders > 0 ? dashboardStats.pendingOrders.toString() : '0'
    },
    {
      title: 'Monthly Revenue',
      value: formatPrice(dashboardStats.monthlyRevenue),
      icon: '💰',
      change: dashboardStats.monthlyRevenue > 0 ? '+' + formatPrice(dashboardStats.monthlyRevenue) : '₱0'
    },
    {
      title: 'Active Listings',
      value: dashboardStats.activeListings.toString(),
      icon: '✅',
      change: dashboardStats.activeListings > 0 ? '+' + dashboardStats.activeListings : '0'
    },
  ];

  const handleNavigation = (route: string) => {
    router.push(route as any);
  };

  if (loading) {
    return (
      <View style={styles.fullScreenContainer}>
        <HeaderComponent
          profile={profile}
          userType="farmer"
          currentRoute="/farmer"
          showAddButton={true}
          addButtonText="+ Quick Add"
          addButtonRoute="/farmer/products/add"
          showMessages={true}
          showNotifications={true}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullScreenContainer}>
      <HeaderComponent
        profile={profile}
        userType="farmer"
        currentRoute="/farmer"
        showAddButton={true}
        addButtonText="+ Quick Add"
        addButtonRoute="/farmer/products/add"
        showMessages={true}
        showNotifications={true}
      />
      <ResponsivePage backgroundColor={colors.background}>
        <View style={styles.container}>
          {/* Welcome Section */}
          <ResponsiveCard style={styles.welcomeCard}>
            <View style={styles.welcomeContent}>
              <View style={styles.welcomeText}>
                <Text style={styles.welcomeTitle}>Welcome back, Farmer! 🌱</Text>
                <Text style={styles.welcomeSubtitle}>
                  Manage your farm, track orders, and grow your business with Farm2Go
                </Text>
              </View>
              <View style={styles.welcomeIcon}>
                <Text style={styles.welcomeEmoji}>🚜</Text>
              </View>
            </View>
          </ResponsiveCard>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsContainer}>
              {quickActions.map((action, index) => (
                <Pressable
                  key={index}
                  style={[styles.quickActionButton, { backgroundColor: action.color }]}
                  onPress={() => handleNavigation(action.route)}
                  android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                >
                  <Text style={styles.quickActionIcon}>{action.icon}</Text>
                  <Text style={styles.quickActionTitle}>{action.title}</Text>
                  <Text style={styles.quickActionDescription}>{action.description}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Dashboard Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dashboard Overview</Text>
            <ResponsiveGrid columns={{ mobile: 2, tablet: 2, desktop: 4 }} gap={16}>
              {dashboardStatsDisplay.map((stat, index) => (
                <ResponsiveCard key={index} style={styles.statCard}>
                  <View style={styles.statContent}>
                    <Text style={styles.statIcon}>{stat.icon}</Text>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statTitle}>{stat.title}</Text>
                    <Text style={styles.statChange}>{stat.change}</Text>
                  </View>
                </ResponsiveCard>
              ))}
            </ResponsiveGrid>
          </View>

          {/* Feature Cards */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Farm Management</Text>
            <ResponsiveGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }} gap={20}>
              {farmerFeatures.map((feature, index) => (
                <Pressable
                  key={index}
                  onPress={() => handleNavigation(feature.route)}
                  android_ripple={{ color: colors.border }}
                >
                  <ResponsiveCard style={styles.featureCard}>
                    <View style={styles.featureContent}>
                      <View style={styles.featureHeader}>
                        <View style={styles.featureIconContainer}>
                          <Text style={styles.featureIcon}>{feature.icon}</Text>
                        </View>
                        <Text style={styles.featureStats}>{feature.stats}</Text>
                      </View>

                      <Text style={styles.featureTitle}>{feature.title}</Text>
                      <Text style={styles.featureDescription}>{feature.description}</Text>

                      <View style={styles.featureAction}>
                        <Text style={styles.featureActionText}>Manage →</Text>
                      </View>
                    </View>
                  </ResponsiveCard>
                </Pressable>
              ))}
            </ResponsiveGrid>
          </View>

          {/* Recent Activity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <ResponsiveCard style={styles.activityCard}>
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <View key={activity.id} style={styles.activityItem}>
                    <Text style={styles.activityIcon}>{activity.icon}</Text>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityTitle}>{activity.title}</Text>
                      <Text style={styles.activityTime}>{activity.time}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.activityItem}>
                  <Text style={styles.activityIcon}>📋</Text>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>No recent activity</Text>
                    <Text style={styles.activityTime}>Start by adding products or managing orders</Text>
                  </View>
                </View>
              )}
            </ResponsiveCard>
          </View>
        </View>
      </ResponsivePage>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  container: {
    flex: 1,
    gap: 24,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // Welcome Section
  welcomeCard: {
    backgroundColor: colors.primary,
    marginBottom: 8,
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomeText: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 22,
  },
  welcomeIcon: {
    marginLeft: 16,
  },
  welcomeEmoji: {
    fontSize: 48,
  },

  // Section
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },

  // Quick Actions
  quickActionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 4,
  },
  quickActionDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },

  // Stats
  statCard: {
    alignItems: 'center',
  },
  statContent: {
    alignItems: 'center',
    gap: 8,
  },
  statIcon: {
    fontSize: 24,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  statTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statChange: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },

  // Feature Cards
  featureCard: {
    minHeight: 160,
  },
  featureContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIcon: {
    fontSize: 20,
  },
  featureStats: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 6,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  featureAction: {
    alignSelf: 'flex-start',
  },
  featureActionText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },

  // Activity
  activityCard: {
    gap: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityIcon: {
    fontSize: 20,
    width: 32,
    textAlign: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});