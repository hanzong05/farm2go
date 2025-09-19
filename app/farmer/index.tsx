import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import ResponsivePage, { ResponsiveGrid, ResponsiveCard, useResponsiveValue } from '../../components/ResponsivePage';

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
      stats: '12 Products'
    },
    {
      title: 'Orders',
      route: '/farmer/orders',
      icon: '📋',
      description: 'View and fulfill customer orders',
      stats: '3 Pending'
    },
    {
      title: 'Inventory',
      route: '/farmer/inventory',
      icon: '📦',
      description: 'Manage your stock levels',
      stats: '8 Low Stock'
    },
    {
      title: 'Sales History',
      route: '/farmer/sales-history',
      icon: '💰',
      description: 'View your sales reports',
      stats: '₱24,560 This Month'
    },
    {
      title: 'Farm Profile',
      route: '/farmer/profile',
      icon: '🏡',
      description: 'Update your farm information',
      stats: 'Complete Profile'
    },
    {
      title: 'Analytics',
      route: '/farmer/analytics',
      icon: '📊',
      description: 'View performance insights',
      stats: '+15% Growth'
    },
  ];

  const dashboardStats = [
    { title: 'Total Products', value: '12', icon: '🥬', change: '+2' },
    { title: 'Pending Orders', value: '3', icon: '📋', change: '-1' },
    { title: 'Monthly Revenue', value: '₱24,560', icon: '💰', change: '+15%' },
    { title: 'Active Listings', value: '8', icon: '✅', change: '+3' },
  ];

  const handleNavigation = (route: string) => {
    router.push(route as any);
  };

  return (
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
            {dashboardStats.map((stat, index) => (
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
            <View style={styles.activityItem}>
              <Text style={styles.activityIcon}>📦</Text>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>New order received</Text>
                <Text style={styles.activityTime}>2 minutes ago</Text>
              </View>
            </View>
            <View style={styles.activityItem}>
              <Text style={styles.activityIcon}>✅</Text>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Product "Fresh Tomatoes" approved</Text>
                <Text style={styles.activityTime}>1 hour ago</Text>
              </View>
            </View>
            <View style={styles.activityItem}>
              <Text style={styles.activityIcon}>💰</Text>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Payment received: ₱450</Text>
                <Text style={styles.activityTime}>3 hours ago</Text>
              </View>
            </View>
          </ResponsiveCard>
        </View>
      </View>
    </ResponsivePage>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 24,
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