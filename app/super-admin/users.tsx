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
  province: string;
  city: string;
  barangay: string;
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
  const [showProvinceModal, setShowProvinceModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showBarangayModal, setShowBarangayModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Removed filterType since we only show admin users

  // Location picker state
  const [provinces] = useState([
    'Abra', 'Agusan del Norte', 'Agusan del Sur', 'Aklan', 'Albay', 'Antique', 'Apayao', 'Aurora', 'Basilan', 'Bataan', 'Batanes', 'Batangas', 'Benguet', 'Biliran', 'Bohol', 'Bukidnon', 'Bulacan', 'Cagayan', 'Camarines Norte', 'Camarines Sur', 'Camiguin', 'Capiz', 'Catanduanes', 'Cavite', 'Cebu', 'Compostela Valley', 'Cotabato', 'Davao del Norte', 'Davao del Sur', 'Davao Oriental', 'Dinagat Islands', 'Eastern Samar', 'Guimaras', 'Ifugao', 'Ilocos Norte', 'Ilocos Sur', 'Iloilo', 'Isabela', 'Kalinga', 'Laguna', 'Lanao del Norte', 'Lanao del Sur', 'La Union', 'Leyte', 'Maguindanao', 'Marinduque', 'Masbate', 'Metro Manila', 'Misamis Occidental', 'Misamis Oriental', 'Mountain Province', 'Negros Occidental', 'Negros Oriental', 'Northern Samar', 'Nueva Ecija', 'Nueva Vizcaya', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Pampanga', 'Pangasinan', 'Quezon', 'Quirino', 'Rizal', 'Romblon', 'Samar', 'Sarangani', 'Siquijor', 'Sorsogon', 'South Cotabato', 'Southern Leyte', 'Sultan Kudarat', 'Sulu', 'Surigao del Norte', 'Surigao del Sur', 'Tarlac', 'Tawi-Tawi', 'Zambales', 'Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay'
  ]);
  const [cities, setCities] = useState<string[]>([]);
  const [barangays, setBarangays] = useState<string[]>([]);

  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    user_type: 'admin',
    phone: '',
    farm_name: '',
    company_name: '',
    province: '',
    city: '',
    barangay: '',
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
      if (!createForm.email || !createForm.password || !createForm.first_name || !createForm.province || !createForm.city || !createForm.barangay) {
        Alert.alert('Error', 'Please fill in all required fields including location information');
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
            province: createForm.province || null,
            city: createForm.city || null,
            barangay: createForm.barangay || null,
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
      province: '',
      city: '',
      barangay: '',
    });
    setCities([]);
    setBarangays([]);
  };

  const handleProvinceChange = (province: string) => {
    setCreateForm({ ...createForm, province, city: '', barangay: '' });
    setBarangays([]);

    // Sample cities for popular provinces
    const provinceCities: { [key: string]: string[] } = {
      'Metro Manila': ['Manila', 'Quezon City', 'Makati', 'Pasig', 'Taguig', 'Mandaluyong', 'Marikina', 'Caloocan', 'Las Piñas', 'Muntinlupa', 'Parañaque', 'Pasay', 'Pateros', 'San Juan', 'Valenzuela', 'Malabon', 'Navotas'],
      'Cebu': ['Cebu City', 'Lapu-Lapu City', 'Mandaue City', 'Talisay City', 'Toledo City', 'Danao City', 'Carcar City'],
      'Laguna': ['Calamba', 'Santa Rosa', 'Biñan', 'San Pedro', 'Cabuyao', 'San Pablo', 'Los Baños', 'Sta. Cruz'],
      'Cavite': ['Dasmariñas', 'Bacoor', 'Imus', 'General Trias', 'Kawit', 'Rosario', 'Noveleta', 'Trece Martires'],
      'Bulacan': ['Malolos', 'Meycauayan', 'San Jose del Monte', 'Marilao', 'Bocaue', 'Guiguinto', 'Plaridel'],
      'Rizal': ['Antipolo', 'Cainta', 'Taytay', 'Angono', 'Binangonan', 'Teresa', 'Morong', 'Tanay'],
      'Pampanga': ['San Fernando', 'Angeles', 'Mabalacat', 'Apalit', 'Macabebe', 'Masantol', 'Mexico', 'Santa Ana'],
      'Batangas': ['Batangas City', 'Lipa', 'Tanauan', 'Santo Tomas', 'Calaca', 'Lemery', 'Rosario', 'Taal'],
      'Nueva Ecija': ['Cabanatuan', 'Gapan', 'San Jose', 'Palayan', 'Muñoz', 'Talavera', 'Santa Rosa', 'Aliaga'],
      'Pangasinan': ['Dagupan', 'San Carlos', 'Urdaneta', 'Alaminos', 'Malasiqui', 'Mangaldan', 'Mapandan', 'Binalonan']
    };

    setCities(provinceCities[province] || ['Sample City 1', 'Sample City 2', 'Sample City 3']);
  };

  const handleCityChange = (city: string) => {
    setCreateForm({ ...createForm, city, barangay: '' });

    // Sample barangays
    const sampleBarangays = [
      'Barangay Poblacion', 'Barangay San Antonio', 'Barangay San Jose', 'Barangay Santa Maria',
      'Barangay San Pedro', 'Barangay Santa Cruz', 'Barangay San Juan', 'Barangay San Miguel',
      'Barangay Santo Niño', 'Barangay San Rafael', 'Barangay Santa Ana', 'Barangay San Vicente'
    ];

    setBarangays(sampleBarangays);
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

            {/* Location Picker */}
            <View style={styles.locationSection}>
              <Text style={styles.label}>Location Information:</Text>

              {/* Province Picker */}
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>Province *</Text>
                <View style={styles.pickerWrapper}>
                  <TouchableOpacity
                    style={[styles.picker, !createForm.province && styles.pickerPlaceholder]}
                    onPress={() => setShowProvinceModal(true)}
                  >
                    <Text style={[styles.pickerText, !createForm.province && styles.pickerPlaceholderText]}>
                      {createForm.province || 'Select Province'}
                    </Text>
                    <Icon name="chevron-down" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* City Picker */}
              {createForm.province && (
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerLabel}>City/Municipality *</Text>
                  <View style={styles.pickerWrapper}>
                    <TouchableOpacity
                      style={[styles.picker, !createForm.city && styles.pickerPlaceholder]}
                      onPress={() => setShowCityModal(true)}
                    >
                      <Text style={[styles.pickerText, !createForm.city && styles.pickerPlaceholderText]}>
                        {createForm.city || 'Select City/Municipality'}
                      </Text>
                      <Icon name="chevron-down" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Barangay Picker */}
              {createForm.city && (
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerLabel}>Barangay *</Text>
                  <View style={styles.pickerWrapper}>
                    <TouchableOpacity
                      style={[styles.picker, !createForm.barangay && styles.pickerPlaceholder]}
                      onPress={() => setShowBarangayModal(true)}
                    >
                      <Text style={[styles.pickerText, !createForm.barangay && styles.pickerPlaceholderText]}>
                        {createForm.barangay || 'Select Barangay'}
                      </Text>
                      <Icon name="chevron-down" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

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

      {/* Province Selection Modal */}
      <Modal
        visible={showProvinceModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Province</Text>
            <TouchableOpacity onPress={() => setShowProvinceModal(false)}>
              <Icon name="times" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={provinces}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.listItem}
                onPress={() => {
                  handleProvinceChange(item);
                  setShowProvinceModal(false);
                }}
              >
                <Text style={styles.listItemText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* City Selection Modal */}
      <Modal
        visible={showCityModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select City/Municipality</Text>
            <TouchableOpacity onPress={() => setShowCityModal(false)}>
              <Icon name="times" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={cities}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.listItem}
                onPress={() => {
                  handleCityChange(item);
                  setShowCityModal(false);
                }}
              >
                <Text style={styles.listItemText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Barangay Selection Modal */}
      <Modal
        visible={showBarangayModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Barangay</Text>
            <TouchableOpacity onPress={() => setShowBarangayModal(false)}>
              <Icon name="times" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={barangays}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.listItem}
                onPress={() => {
                  setCreateForm({ ...createForm, barangay: item });
                  setShowBarangayModal(false);
                }}
              >
                <Text style={styles.listItemText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
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

  // Location Picker Styles
  locationSection: {
    gap: 16,
    marginTop: 8,
  },
  pickerContainer: {
    gap: 8,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  pickerWrapper: {
    position: 'relative',
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
  },
  pickerPlaceholder: {
    borderColor: colors.gray200,
  },
  pickerText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  pickerPlaceholderText: {
    color: colors.textSecondary,
  },

  // List Item Styles for Modals
  listItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listItemText: {
    fontSize: 16,
    color: colors.text,
  },
});