import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import HeaderComponent from '../../components/HeaderComponent';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

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
  gray100: '#f9fafb',
  gray200: '#e5e7eb',
};

export default function AdminUsers() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

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
        .in('user_type', ['farmer', 'buyer'])
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

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <View style={styles.userHeader}>
          <Text style={styles.userName}>
            {item.profiles?.first_name} {item.profiles?.last_name}
          </Text>
          <View style={[styles.userTypeBadge, { backgroundColor: getUserTypeColor(item.profiles?.user_type || '') }]}>
            <Text style={styles.userTypeText}>{item.profiles?.user_type?.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.userDetail}>📧 {item.email}</Text>

        {item.profiles?.farm_name && (
          <Text style={styles.userDetail}>🏡 {item.profiles.farm_name}</Text>
        )}
        {item.profiles?.phone && (
          <Text style={styles.userDetail}>📞 {item.profiles.phone}</Text>
        )}
        {item.profiles?.barangay && (
          <Text style={styles.userDetail}>📍 {item.profiles.barangay}</Text>
        )}

        <Text style={styles.userDate}>
          Created: {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <Text style={styles.title}>User Management</Text>
            <Text style={styles.barangayInfo}>
              📍 {profile?.barangay ? `Managing: ${profile.barangay}` : 'All Barangays (No barangay filter)'}
            </Text>
          </View>
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>Total Users: {users.length}</Text>
          </View>
        </View>

        {/* Users List */}
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
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
              <Text style={styles.emptyText}>No users found</Text>
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
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  titleSection: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  barangayInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statsContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  listContainer: {
    gap: 12,
  },
  userCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  userTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  userTypeText: {
    fontSize: 10,
    color: colors.white,
    fontWeight: 'bold',
  },
  userDetail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  userDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});