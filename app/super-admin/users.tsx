import { createClient } from '@supabase/supabase-js';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import HeaderComponent from '../../components/HeaderComponent';
import LocationPicker from '../../components/LocationPicker';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

const { width } = Dimensions.get('window');

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

interface CreateUserForm {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  user_type: 'farmer' | 'buyer' | 'admin' | 'super-admin';
  phone: string;
  farm_name: string;
  barangay: string;
}

const colors = {
  primary: '#059669',
  primaryLight: '#34d399',
  primaryDark: '#047857',
  secondary: '#10b981',
  white: '#ffffff',
  background: '#f0fdf4',
  backgroundLight: '#ecfdf5',
  text: '#0f172a',
  textSecondary: '#64748b',
  textLight: '#94a3b8',
  border: '#d1fae5',
  borderLight: '#dcfce7',
  shadow: 'rgba(0,0,0,0.1)',
  shadowLight: 'rgba(0,0,0,0.05)',
  danger: '#ef4444',
  dangerLight: '#fca5a5',
  warning: '#f59e0b',
  warningLight: '#fbbf24',
  success: '#22c55e',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray300: '#cbd5e1',
  glass: 'rgba(255, 255, 255, 0.8)',
};

export default function SuperAdminUsers() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [emailError, setEmailError] = useState('');
  
  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);
  const scaleAnim = new Animated.Value(0.9);

  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    user_type: 'admin',
    phone: '',
    farm_name: '',
    barangay: '',
  });

  useEffect(() => {
    loadData();
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      console.log('🔍 Super Admin Page - User data:', userData);
      console.log('🔍 Super Admin Page - Profile:', userData?.profile);
      console.log('🔍 Super Admin Page - User type:', userData?.profile?.user_type);

      if (!userData?.profile || userData.profile.user_type !== 'super-admin') {
        console.log('❌ Access denied - User type:', userData?.profile?.user_type);
        Alert.alert('Access Denied', `You do not have super admin privileges. Current user type: ${userData?.profile?.user_type || 'none'}`);
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
      console.log('📊 Loading admin users...');

      const { data, error } = await supabase
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
        .eq('user_type', 'admin')
        .order('created_at', { ascending: false })
        .returns<{
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          user_type: 'farmer' | 'buyer' | 'admin' | 'super-admin';
          farm_name: string | null;
          phone: string | null;
          barangay: string | null;
          created_at: string;
        }[]>();

      console.log('📊 Load users response:', {
        success: !error,
        count: data?.length || 0,
        data: data,
        error: error
      });

      if (error) {
        console.error('❌ Error loading users:', error);
        throw error;
      }

      const usersData: User[] = data?.map(profile => ({
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

      console.log('👥 Processed users data:', usersData);
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

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const createUser = async () => {
    try {
      if (!createForm.email || !createForm.password || !createForm.first_name || !createForm.barangay) {
        Alert.alert('Error', 'Please fill in all required fields including barangay location');
        return;
      }

      if (!validateEmail(createForm.email.trim())) {
        Alert.alert('Error', 'Please enter a valid email address');
        return;
      }

      if (createForm.password.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters long');
        return;
      }

      console.log('🚀 Creating auth user with email:', createForm.email.trim().toLowerCase());

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
      });

      console.log('📧 Auth signup response:', {
        user: authData?.user ? 'User created' : 'No user',
        userId: authData?.user?.id,
        error: authError ? authError.message : 'No error'
      });

      if (authError) {
        console.error('❌ Auth error:', authError);
        throw authError;
      }

      if (authData.user) {
        console.log('👤 Creating profile for user:', authData.user.id);

        const untypedSupabase = createClient(
          process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://demo.supabase.co',
          process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'demo-anon-key'
        );

        const profileData = {
          id: authData.user.id,
          email: createForm.email.trim().toLowerCase(),
          first_name: createForm.first_name.trim() || null,
          last_name: createForm.last_name.trim() || null,
          user_type: createForm.user_type,
          phone: createForm.phone.trim() || null,
          farm_name: createForm.user_type === 'farmer' ? (createForm.farm_name.trim() || null) : null,
          barangay: createForm.barangay || null,
        };

        console.log('📝 Profile data to insert:', profileData);

        const { data: insertedProfile, error: profileError } = await untypedSupabase
          .from('profiles')
          .insert(profileData)
          .select()
          .single();

        console.log('📊 Profile insertion result:', {
          success: !profileError,
          profile: insertedProfile,
          error: profileError
        });

        if (profileError) {
          console.error('❌ Profile creation error:', profileError);
          throw profileError;
        }

        console.log('🔍 Verifying profile creation...');
        const { data: verifyProfile, error: verifyError } = await untypedSupabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        console.log('✅ Profile verification:', {
          found: !verifyError,
          profile: verifyProfile,
          error: verifyError
        });

        Alert.alert('Success', `Admin user created successfully! User ID: ${authData.user.id}`);
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
      barangay: '',
    });
    setEmailError('');
  };

  const handleEmailChange = (text: string) => {
    setCreateForm({ ...createForm, email: text });

    if (text.trim() && !validateEmail(text.trim())) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handleLocationSelect = (barangay: string) => {
    setCreateForm({ ...createForm, barangay });
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
      case 'farmer': return [colors.primary, colors.primaryLight];
      case 'buyer': return [colors.secondary, '#6ee7b7'];
      case 'admin': return [colors.danger, colors.dangerLight];
      default: return [colors.textSecondary, colors.textLight];
    }
  };

  const renderUser = ({ item, index }: { item: User; index: number }) => {
    const animatedValue = new Animated.Value(0);
    
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 500,
      delay: index * 100,
      useNativeDriver: true,
    }).start();

    const translateY = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [30, 0],
    });

    const userTypeColors = getUserTypeColor(item.profiles?.user_type || '');

    return (
      <Animated.View
        style={[
          styles.userCard,
          {
            opacity: animatedValue,
            transform: [{ translateY }],
          },
        ]}
      >
        <LinearGradient
          colors={[colors.white, colors.gray50]}
          style={styles.cardGradient}
        >
          <View style={styles.userInfo}>
            <View style={styles.userHeader}>
              <View style={styles.userTitleContainer}>
                <View style={styles.avatarContainer}>
                  <LinearGradient
                    colors={userTypeColors}
                    style={styles.avatar}
                  >
                    <Text style={styles.avatarText}>
                      {item.profiles?.first_name?.charAt(0) || 'A'}
                      {item.profiles?.last_name?.charAt(0) || ''}
                    </Text>
                  </LinearGradient>
                </View>
                <View style={styles.userNameContainer}>
                  <Text style={styles.userName}>
                    {item.profiles?.first_name} {item.profiles?.last_name}
                  </Text>
                  <LinearGradient
                    colors={userTypeColors}
                    style={styles.userTypeBadge}
                  >
                    <Text style={styles.userTypeText}>
                      {item.profiles?.user_type?.toUpperCase()}
                    </Text>
                  </LinearGradient>
                </View>
              </View>
            </View>

            <View style={styles.userDetailsContainer}>
              <View style={styles.userDetailRow}>
                <View style={styles.iconContainer}>
                  <Icon name="envelope" size={14} color={colors.primary} />
                </View>
                <Text style={styles.userDetail}>{item.email}</Text>
              </View>

              {item.profiles?.phone && (
                <View style={styles.userDetailRow}>
                  <View style={styles.iconContainer}>
                    <Icon name="phone" size={14} color={colors.primary} />
                  </View>
                  <Text style={styles.userDetail}>{item.profiles.phone}</Text>
                </View>
              )}

              {item.profiles?.barangay && (
                <View style={styles.userDetailRow}>
                  <View style={styles.iconContainer}>
                    <Icon name="map-marker-alt" size={14} color={colors.primary} />
                  </View>
                  <Text style={styles.userDetail}>{item.profiles.barangay}</Text>
                </View>
              )}

              <View style={styles.userDetailRow}>
                <View style={styles.iconContainer}>
                  <Icon name="calendar" size={14} color={colors.textLight} />
                </View>
                <Text style={styles.userDate}>
                  Created: {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.userActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setSelectedUser(item);
                setShowEditModal(true);
              }}
            >
              <LinearGradient
                colors={[colors.warning, colors.warningLight]}
                style={styles.actionButtonGradient}
              >
                <Icon name="edit" size={16} color={colors.white} />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => deleteUser(item.id)}
            >
              <LinearGradient
                colors={[colors.danger, colors.dangerLight]}
                style={styles.actionButtonGradient}
              >
                <Icon name="trash" size={16} color={colors.white} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <LinearGradient
        colors={[colors.background, colors.backgroundLight]}
        style={styles.container}
      >
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <HeaderComponent
          profile={profile}
          userType="super-admin"
          currentRoute="/super-admin/users"
        />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingCard}>
            <LinearGradient
              colors={[colors.primary, colors.primaryLight]}
              style={styles.loadingSpinner}
            >
              <ActivityIndicator size="large" color={colors.white} />
            </LinearGradient>
            <Text style={styles.loadingText}>Loading users...</Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.background, colors.backgroundLight]}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <HeaderComponent
        profile={profile}
        userType="super-admin"
        currentRoute="/super-admin/users"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search users..."
      />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        {/* Enhanced Header */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <LinearGradient
              colors={[colors.primary, colors.primaryLight]}
              style={styles.titleIcon}
            >
              <Icon name="users-cog" size={24} color={colors.white} />
            </LinearGradient>
            <View>
              <Text style={styles.title}>Admin Management</Text>
              <Text style={styles.subtitle}>
                {filteredUsers.length} admin{filteredUsers.length !== 1 ? 's' : ''} found
              </Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.addButtonContainer}
            onPress={() => setShowCreateModal(true)}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryLight]}
              style={styles.addButton}
            >
              <Icon name="plus" size={16} color={colors.white} />
              <Text style={styles.addButtonText}>Add Admin</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsContainer}>
          <LinearGradient
            colors={[colors.white, colors.gray50]}
            style={styles.statCard}
          >
            <View style={styles.statIconContainer}>
              <LinearGradient
                colors={[colors.success, '#4ade80']}
                style={styles.statIcon}
              >
                <Icon name="user-shield" size={20} color={colors.white} />
              </LinearGradient>
            </View>
            <View>
              <Text style={styles.statNumber}>{users.length}</Text>
              <Text style={styles.statLabel}>Total Admins</Text>
            </View>
          </LinearGradient>

          <LinearGradient
            colors={[colors.white, colors.gray50]}
            style={styles.statCard}
          >
            <View style={styles.statIconContainer}>
              <LinearGradient
                colors={[colors.warning, colors.warningLight]}
                style={styles.statIcon}
              >
                <Icon name="clock" size={20} color={colors.white} />
              </LinearGradient>
            </View>
            <View>
              <Text style={styles.statNumber}>
                {users.filter(u => {
                  const createdDate = new Date(u.created_at);
                  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                  return createdDate > thirtyDaysAgo;
                }).length}
              </Text>
              <Text style={styles.statLabel}>Recent</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Enhanced Users List */}
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.white}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <LinearGradient
                colors={[colors.gray100, colors.gray50]}
                style={styles.emptyIcon}
              >
                <Icon name="users" size={40} color={colors.textLight} />
              </LinearGradient>
              <Text style={styles.emptyTitle}>No admins found</Text>
              <Text style={styles.emptyText}>
                {searchQuery ? 'Try adjusting your search terms' : 'Create your first admin user'}
              </Text>
            </View>
          }
        />
      </Animated.View>

      {/* Enhanced Create User Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <LinearGradient
          colors={[colors.background, colors.white]}
          style={styles.modalContainer}
        >
          <BlurView intensity={10} style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <LinearGradient
                colors={[colors.primary, colors.primaryLight]}
                style={styles.modalTitleIcon}
              >
                <Icon name="user-plus" size={20} color={colors.white} />
              </LinearGradient>
              <Text style={styles.modalTitle}>Create New Admin</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowCreateModal(false)}
              style={styles.closeButton}
            >
              <Icon name="times" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </BlurView>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address *</Text>
              <View style={[styles.inputContainer, emailError ? styles.inputError : null]}>
                <Icon name="envelope" size={16} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter email address"
                  value={createForm.email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              {emailError ? (
                <Text style={styles.errorText}>{emailError}</Text>
              ) : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password *</Text>
              <View style={styles.inputContainer}>
                <Icon name="lock" size={16} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Create strong password"
                  value={createForm.password}
                  onChangeText={(text) => setCreateForm({ ...createForm, password: text })}
                  secureTextEntry
                />
              </View>
            </View>

            <View style={styles.nameRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>First Name *</Text>
                <View style={styles.inputContainer}>
                  <Icon name="user" size={16} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="First name"
                    value={createForm.first_name}
                    onChangeText={(text) => setCreateForm({ ...createForm, first_name: text })}
                  />
                </View>
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <View style={styles.inputContainer}>
                  <Icon name="user" size={16} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Last name"
                    value={createForm.last_name}
                    onChangeText={(text) => setCreateForm({ ...createForm, last_name: text })}
                  />
                </View>
              </View>
            </View>

            <View style={styles.userTypeSelector}>
              <Text style={styles.inputLabel}>User Type</Text>
              <LinearGradient
                colors={[colors.danger, colors.dangerLight]}
                style={styles.fixedUserType}
              >
                <Icon name="shield-alt" size={16} color={colors.white} />
                <Text style={styles.fixedUserTypeText}>Administrator</Text>
              </LinearGradient>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <View style={styles.inputContainer}>
                <Icon name="phone" size={16} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Phone number"
                  value={createForm.phone}
                  onChangeText={(text) => setCreateForm({ ...createForm, phone: text })}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Location *</Text>
              <LocationPicker
                onLocationSelect={handleLocationSelect}
                initialBarangay={createForm.barangay}
                focusedInput={focusedInput}
                setFocusedInput={setFocusedInput}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButtonContainer}
                onPress={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.createButtonContainer}
                onPress={createUser}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryLight]}
                  style={styles.createButton}
                >
                  <Icon name="user-plus" size={16} color={colors.white} />
                  <Text style={styles.createButtonText}>Create Admin</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingCard: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: colors.white,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  loadingSpinner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  addButtonContainer: {
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  statIconContainer: {
    marginRight: 12,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  listContainer: {
    gap: 16,
    paddingBottom: 20,
  },
  userCard: {
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  cardGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    marginBottom: 16,
  },
  userTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
  },
  userNameContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 6,
  },
  userTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userTypeText: {
    fontSize: 11,
    color: colors.white,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  userDetailsContainer: {
    gap: 8,
  },
  userDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 20,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  userDetail: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  userDate: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '400',
    flex: 1,
  },
  userActions: {
    flexDirection: 'column',
    gap: 12,
    marginLeft: 16,
  },
  actionButton: {
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  actionButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalTitleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray100,
  },
  form: {
    flex: 1,
    padding: 20,
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadowLight,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 4,
  },
  nameRow: {
    flexDirection: 'row',
  },
  userTypeSelector: {
    gap: 8,
  },
  fixedUserType: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: colors.danger,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  fixedUserTypeText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  cancelButtonContainer: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  createButtonContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
  },
});