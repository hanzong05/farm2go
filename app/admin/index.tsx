import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import HeaderComponent from '../../components/HeaderComponent';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AdminStats {
  totalUsers: number;
  totalFarmers: number;
  totalBuyers: number;
  totalProducts: number;
  totalOrders: number;
  pendingVerifications: number;
}

const colors = {
  primary: '#059669',
  secondary: '#10b981',
  white: '#ffffff',
  background: '#f0f9f4',
  text: '#0f172a',
  textSecondary: '#6b7280',
  border: '#d1fae5',
  shadow: 'rgba(0,0,0,0.1)',
  danger: '#ef4444',
  warning: '#f59e0b',
};

export default function AdminDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalFarmers: 0,
    totalBuyers: 0,
    totalProducts: 0,
    totalOrders: 0,
    pendingVerifications: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = async () => {
    try {
      const userData = await getUserWithProfile();
      if (userData?.profile?.user_type !== 'admin') {
        Alert.alert('Access Denied', 'You do not have admin privileges.');
        router.replace('/');
        return;
      }
      setProfile(userData.profile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    }
  };

  const fetchStats = async () => {
    try {
      // Fetch users count
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch farmers count
      const { count: totalFarmers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('user_type', 'farmer');

      // Fetch buyers count
      const { count: totalBuyers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('user_type', 'buyer');

      // Fetch products count
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Fetch orders count
      const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      // Fetch pending verifications
      const { count: pendingVerifications } = await supabase
        .from('verifications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      setStats({
        totalUsers: totalUsers || 0,
        totalFarmers: totalFarmers || 0,
        totalBuyers: totalBuyers || 0,
        totalProducts: totalProducts || 0,
        totalOrders: totalOrders || 0,
        pendingVerifications: pendingVerifications || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchProfile(), fetchStats()]);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const StatCard = ({ title, value, icon, color = colors.primary, onPress }: {
    title: string;
    value: number;
    icon: string;
    color?: string;
    onPress?: () => void;
  }) => (
    <Pressable
      style={[styles.statCard, { borderColor: color }]}
      onPress={onPress}
      android_ripple={{ color: `${color}20` }}
    >
      <View style={[styles.statIconContainer, { backgroundColor: `${color}10` }]}>
        <Icon name={icon} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value.toLocaleString()}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </Pressable>
  );

  const QuickActionCard = ({ title, description, icon, onPress, color = colors.primary }: {
    title: string;
    description: string;
    icon: string;
    onPress: () => void;
    color?: string;
  }) => (
    <Pressable
      style={styles.actionCard}
      onPress={onPress}
      android_ripple={{ color: `${color}20` }}
    >
      <View style={[styles.actionIconContainer, { backgroundColor: `${color}10` }]}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <View style={styles.actionContent}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Icon name="chevron-right" size={16} color={colors.textSecondary} />
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading admin dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        userType="admin"
        currentRoute="/admin"
        showMessages={true}
        showNotifications={true}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {profile && (
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>Welcome back, Admin!</Text>
            <Text style={styles.welcomeSubtitle}>
              {profile.first_name} {profile.last_name}
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Users"
              value={stats.totalUsers}
              icon="users"
              onPress={() => router.push('/admin/users')}
            />
            <StatCard
              title="Farmers"
              value={stats.totalFarmers}
              icon="seedling"
              color={colors.secondary}
              onPress={() => router.push('/admin/users')}
            />
            <StatCard
              title="Buyers"
              value={stats.totalBuyers}
              icon="shopping-cart"
              color={colors.warning}
              onPress={() => router.push('/admin/users')}
            />
            <StatCard
              title="Products"
              value={stats.totalProducts}
              icon="boxes"
              color="#8b5cf6"
            />
            <StatCard
              title="Orders"
              value={stats.totalOrders}
              icon="receipt"
              color="#06b6d4"
            />
            <StatCard
              title="Pending Verifications"
              value={stats.pendingVerifications}
              icon="clock"
              color={stats.pendingVerifications > 0 ? colors.danger : colors.primary}
              onPress={() => router.push('/admin/verifications')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsContainer}>
            <QuickActionCard
              title="User Management"
              description="View and manage all platform users"
              icon="users-cog"
              onPress={() => router.push('/admin/users')}
            />
            <QuickActionCard
              title="Verification Queue"
              description="Review pending user verifications"
              icon="check-circle"
              onPress={() => router.push('/admin/verifications')}
              color={stats.pendingVerifications > 0 ? colors.danger : colors.primary}
            />
            <QuickActionCard
              title="Platform Settings"
              description="Configure system settings"
              icon="cogs"
              onPress={() => router.push('/admin/settings')}
              color={colors.secondary}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  welcomeCard: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 3,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    borderWidth: 1,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 2,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  statTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionsContainer: {
    gap: 12,
  },
  actionCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});