import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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
    user_type: 'farmer' | 'buyer' | 'admin';
    farm_name: string | null;
    company_name: string | null;
    phone: string | null;
  } | null;
}

interface CreateUserForm {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  user_type: 'farmer' | 'buyer' | 'admin';
  phone: string;
  farm_name: string;
  company_name: string;
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

export default function SuperAdminUsers() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Removed filterType since we only show admin users

  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    user_type: 'admin',
    phone: '',
    farm_name: '',
    company_name: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      if (!userData?.profile || userData.profile.user_type !== 'super-admin') {
        Alert.alert('Access Denied', 'You do not have super admin privileges');
        router.replace('/');
        return;
      }

      setProfile(userData.profile);
      await loadUsers();
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          user_type,
          farm_name,
          company_name,
          phone,
          created_at
        `)
        .eq('user_type', 'admin')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convert to User format (simplified for super admin view)
      const usersData: User[] = data?.map(profile => ({
        id: profile.id,
        email: '', // We'll get this separately if needed
        created_at: profile.created_at || '',
        profiles: {
          first_name: profile.first_name,
          last_name: profile.last_name,
          user_type: profile.user_type as 'farmer' | 'buyer' | 'admin',
          farm_name: profile.farm_name,
          company_name: profile.company_name,
          phone: profile.phone,
        },
      })) || [];

      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const createUser = async () => {
    try {
      if (!createForm.email || !createForm.password || !createForm.first_name) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      // First create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: createForm.email,
        password: createForm.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            first_name: createForm.first_name,
            last_name: createForm.last_name,
            user_type: createForm.user_type,
            phone: createForm.phone || null,
            farm_name: createForm.user_type === 'farmer' ? createForm.farm_name || null : null,
            company_name: createForm.user_type === 'buyer' ? createForm.company_name || null : null,
          });

        if (profileError) throw profileError;

        Alert.alert('Success', 'Admin user created successfully');
        setShowCreateModal(false);
        resetCreateForm();
        await loadUsers();
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      Alert.alert('Error', error.message || 'Failed to create user');
    }
  };

  const deleteUser = async (userId: string) => {
    Alert.alert(
      'Delete User',
      'Are you sure you want to delete this user? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete profile first
              const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

              if (profileError) throw profileError;

              Alert.alert('Success', 'User deleted successfully');
              await loadUsers();
            } catch (error: any) {
              console.error('Error deleting user:', error);
              Alert.alert('Error', error.message || 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  const resetCreateForm = () => {
    setCreateForm({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      user_type: 'admin',
      phone: '',
      farm_name: '',
      company_name: '',
    });
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.profiles?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.profiles?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.profiles?.farm_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.profiles?.company_name?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case 'farmer': return colors.primary;
      case 'buyer': return colors.secondary;
      case 'admin': return colors.danger;
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

        {item.profiles?.farm_name && (
          <Text style={styles.userDetail}>🏡 {item.profiles.farm_name}</Text>
        )}
        {item.profiles?.company_name && (
          <Text style={styles.userDetail}>🏢 {item.profiles.company_name}</Text>
        )}
        {item.profiles?.phone && (
          <Text style={styles.userDetail}>📞 {item.profiles.phone}</Text>
        )}

        <Text style={styles.userDate}>
          Created: {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.userActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => {
            setSelectedUser(item);
            setShowEditModal(true);
          }}
        >
          <Icon name="edit" size={16} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => deleteUser(item.id)}
        >
          <Icon name="trash" size={16} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <HeaderComponent
          profile={profile}
          userType="super-admin"
          currentRoute="/super-admin/users"
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
        currentRoute="/super-admin/users"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search users..."
      />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Admin User Management</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Icon name="plus" size={16} color={colors.white} />
            <Text style={styles.addButtonText}>Add Admin</Text>
          </TouchableOpacity>
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
              <Text style={styles.emptyText}>No admin users found</Text>
            </View>
          }
        />
      </View>

      {/* Create User Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create New Admin</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Icon name="times" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email *"
              value={createForm.email}
              onChangeText={(text) => setCreateForm({ ...createForm, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Password *"
              value={createForm.password}
              onChangeText={(text) => setCreateForm({ ...createForm, password: text })}
              secureTextEntry
            />

            <TextInput
              style={styles.input}
              placeholder="First Name *"
              value={createForm.first_name}
              onChangeText={(text) => setCreateForm({ ...createForm, first_name: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Last Name"
              value={createForm.last_name}
              onChangeText={(text) => setCreateForm({ ...createForm, last_name: text })}
            />

            <View style={styles.userTypeSelector}>
              <Text style={styles.label}>User Type:</Text>
              <View style={styles.fixedUserType}>
                <Text style={styles.fixedUserTypeText}>Admin</Text>
              </View>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Phone"
              value={createForm.phone}
              onChangeText={(text) => setCreateForm({ ...createForm, phone: text })}
              keyboardType="phone-pad"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.createButton}
                onPress={createUser}
              >
                <Text style={styles.createButtonText}>Create Admin</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  filterTabs: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: colors.white,
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
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: colors.warning,
  },
  deleteButton: {
    backgroundColor: colors.danger,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  form: {
    padding: 20,
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: colors.white,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  userTypeSelector: {
    gap: 8,
  },
  userTypeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  userTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  userTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  userTypeButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  userTypeButtonTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  fixedUserType: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
  },
  fixedUserTypeText: {
    fontSize: 14,
    color: colors.white,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  createButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
  },
});