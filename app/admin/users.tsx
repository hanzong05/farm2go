import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

interface ProfileResponse {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  user_type: 'farmer' | 'buyer' | 'admin' | 'super-admin';
  farm_name: string | null;
  phone: string | null;
  barangay: string | null;
  created_at: string | null;
}

interface OrderResponse {
  id: string;
  buyer_id: string;
  farmer_id: string;
  total_price: number;
  quantity: number;
  status: string;
  created_at: string;
  buyer_profile?: {
    first_name: string | null;
    last_name: string | null;
  };
  farmer_profile?: {
    first_name: string | null;
    last_name: string | null;
    farm_name: string | null;
  };
  product?: {
    name: string;
    price: number;
    unit: string;
  };
  order_items?: Array<{
    id: string;
    product: {
      name: string;
      price: number;
    };
  }>;
}

interface ProductResponse {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  category: string;
  farmer_id: string;
  created_at: string;
}

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

interface CreateUserForm {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  user_type: 'farmer' | 'buyer' | 'admin';
  farm_name: string;
  phone: string;
  barangay: string;
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
  const [selectedFarmer, setSelectedFarmer] = useState<User | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [farmerDetailTab, setFarmerDetailTab] = useState<'products' | 'orders' | 'inventory'>('products');
  const [farmerProducts, setFarmerProducts] = useState<ProductResponse[]>([]);
  const [farmerOrders, setFarmerOrders] = useState<OrderResponse[]>([]);
  const [farmerInventory, setFarmerInventory] = useState<ProductResponse[]>([]);
  const [editingItem, setEditingItem] = useState<ProductResponse | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Buyer modal states
  const [selectedBuyer, setSelectedBuyer] = useState<User | null>(null);
  const [buyerModalVisible, setBuyerModalVisible] = useState(false);
  const [buyerDetailTab, setBuyerDetailTab] = useState<'orders' | 'history'>('orders');
  const [buyerOrders, setBuyerOrders] = useState<OrderResponse[]>([]);
  const [buyerHistory, setBuyerHistory] = useState<OrderResponse[]>([]);
  
  // Create User Modal states
  const [createUserModalVisible, setCreateUserModalVisible] = useState(false);
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserForm, setCreateUserForm] = useState<CreateUserForm>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    user_type: 'farmer',
    farm_name: '',
    phone: '',
    barangay: profile?.barangay || '',
  });

  useEffect(() => {
    loadData();

    // Listen for auth state changes (handles refresh scenarios)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state change:', event, session?.user?.id);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Re-check user profile when auth is restored
        if (!profile && !authChecked) {
          await loadData();
        }
      } else if (event === 'SIGNED_OUT') {
        setLoading(false);
        router.replace('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (profile) {
      loadUsers(profile);
      // Update form barangay when profile loads
      setCreateUserForm(prev => ({
        ...prev,
        barangay: profile.barangay || ''
      }));
    }
  }, [activeTab, profile]);

  const loadData = async () => {
    try {
      // Wait a bit for auth state to stabilize on refresh
      await new Promise(resolve => setTimeout(resolve, 100));

      const userData = await getUserWithProfile();
      console.log('🔍 Admin Page - User data:', userData);
      console.log('🔍 Admin Page - User type:', userData?.profile?.user_type);
      console.log('🔍 Admin Page - User barangay:', userData?.profile?.barangay);
      console.log('🔍 Admin Page - Full profile:', JSON.stringify(userData?.profile, null, 2));

      setAuthChecked(true);

      if (!userData?.profile || !['admin', 'super-admin'].includes(userData.profile.user_type)) {
        console.log('❌ Access denied - User type:', userData?.profile?.user_type);
        // Only show alert if we actually have user data but wrong permissions
        if (userData?.profile) {
          Alert.alert('Access Denied', `You do not have admin privileges. Current user type: ${userData?.profile?.user_type || 'none'}`);
        }
        setLoading(false);
        router.replace('/');
        return;
      }

      setProfile(userData.profile);
      // Don't set loading to false here - let loadUsers handle it
    } catch (error) {
      console.error('Error loading data:', error);
      setAuthChecked(true);
      // Only show error alert if it's not an auth issue during refresh
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage !== 'No user on the session!' && !errorMessage.includes('session')) {
        Alert.alert('Error', 'Failed to load user data');
      }
      setLoading(false);
      // Give auth time to restore before redirecting
      setTimeout(() => {
        router.replace('/');
      }, 1000);
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

      // Fetch all delivered orders for lifetime total
      const { data: allOrders, error: allOrdersError } = await supabase
        .from('orders')
        .select('total_price')
        .eq('buyer_id', userId)
        .in('status', ['delivered']);

      if (allOrdersError) {
        console.error(`Error fetching all orders for user ${userId}:`, allOrdersError);
      }

      // Fetch orders for this user (last 7 days)
      const { data: orders, error } = await supabase
        .from('orders')
        .select('total_price, created_at, status')
        .eq('buyer_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['delivered']);

      type OrderData = {
        total_price: number;
        created_at: string;
        status: string;
      };

      type AllOrderData = {
        total_price: number;
      };

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
      (orders as OrderData[] | null)?.forEach(order => {
        const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
        if (salesByDate.hasOwnProperty(orderDate)) {
          salesByDate[orderDate] += order.total_price || 0;
        }
      });

      // Convert to chart data format
      const chartData = dates.map(date => ({
        date,
        amount: salesByDate[date] || 0
      }));

      const totalSales = chartData.reduce((sum, day) => sum + day.amount, 0);
      const totalLifetime = (allOrders as AllOrderData[] | null)?.reduce((sum, order) => sum + (order.total_price || 0), 0) || 0;

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
    if (!currentProfile) return;

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
        query = query.eq('barangay', currentProfile.barangay);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error loading users:', error);
        throw error;
      }

      // Convert to User format without fetching sales data initially
      let usersData: User[] = (data as ProfileResponse[] | null)?.map(profile => ({
        id: profile.id,
        email: profile.email || '',
        created_at: profile.created_at || '',
        profiles: {
          first_name: profile.first_name,
          last_name: profile.last_name,
          user_type: profile.user_type,
          farm_name: profile.farm_name,
          phone: profile.phone,
          barangay: profile.barangay,
        },
        salesData: {
          totalSales: 0,
          totalLifetime: 0,
          chartData: []
        }
      })) || [];

      setUsers(usersData);
      setLoading(false);

      // Fetch sales data in background without blocking UI
      loadSalesDataInBackground(usersData);

    } catch (error) {
      console.error('Error loading users:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to load users');
    }
  };

  const loadSalesDataInBackground = async (usersData: User[]) => {
    try {
      // Only fetch sales data for buyers to show spending
      const usersToUpdate = activeTab === 'buyer' ? usersData : [];

      if (usersToUpdate.length === 0) return;

      const usersWithSalesData = await Promise.all(
        usersToUpdate.map(async (user) => {
          try {
            const salesData = await fetchUserSalesData(user.id);
            return {
              ...user,
              salesData
            };
          } catch (error) {
            console.error(`Error fetching sales data for user ${user.id}:`, error);
            return user; // Return user without sales data if fetch fails
          }
        })
      );

      setUsers(usersWithSalesData);
    } catch (error) {
      console.error('Error loading sales data in background:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (profile) {
        await loadUsers(profile);
      }
    } catch (error) {
      console.error('Error refreshing users:', error);
    } finally {
      setRefreshing(false);
    }
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

  const openFarmerDetail = async (farmer: User) => {
    setSelectedFarmer(farmer);
    setModalVisible(true);
    setFarmerDetailTab('products');
    await loadFarmerData(farmer.id);
  };

  const loadFarmerData = async (farmerId: string) => {
    try {
      // Load products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false });

      if (productsError) {
        console.error('Error loading farmer products:', productsError);
      } else {
        setFarmerProducts((products as ProductResponse[] | null) || []);
      }

      // Load orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          buyer_profile:profiles!orders_buyer_id_fkey(first_name, last_name),
          order_items(
            *,
            product:products(name, price)
          )
        `)
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error loading farmer orders:', ordersError);
      } else {
        setFarmerOrders((orders as OrderResponse[] | null) || []);
      }

      // Load inventory (same as products but with stock focus)
      setFarmerInventory((products as ProductResponse[] | null) || []);

    } catch (error) {
      console.error('Error loading farmer data:', error);
    }
  };

  const openBuyerDetail = async (buyer: User) => {
    setSelectedBuyer(buyer);
    setBuyerModalVisible(true);
    setBuyerDetailTab('orders');
    await loadBuyerData(buyer.id);
  };

  const loadBuyerData = async (buyerId: string) => {
    try {
      // Load current orders (pending, confirmed, processing, ready)
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          farmer_profile:profiles!orders_farmer_id_fkey(first_name, last_name, farm_name),
          product:products(name, price, unit)
        `)
        .eq('buyer_id', buyerId)
        .in('status', ['pending', 'confirmed', 'processing', 'ready'])
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error loading buyer orders:', ordersError);
      } else {
        setBuyerOrders((orders as OrderResponse[] | null) || []);
      }

      // Load purchase history (all orders including cancelled/delivered)
      const { data: history, error: historyError } = await supabase
        .from('orders')
        .select(`
          *,
          farmer_profile:profiles!orders_farmer_id_fkey(first_name, last_name, farm_name),
          product:products(name, price, unit)
        `)
        .eq('buyer_id', buyerId)
        .order('created_at', { ascending: false });

      if (historyError) {
        console.error('Error loading buyer history:', historyError);
      } else {
        setBuyerHistory((history as OrderResponse[] | null) || []);
      }

    } catch (error) {
      console.error('Error loading buyer data:', error);
    }
  };

  const getOrderStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'ORDER PLACED';
      case 'confirmed': return 'CONFIRMED';
      case 'processing': return 'PROCESSING';
      case 'ready': return 'READY FOR PICKUP';
      case 'delivered': return 'DELIVERED';
      case 'cancelled': return 'CANCELLED';
      default: return status.toUpperCase();
    }
  };

  const getOrderDeliveryText = (status: string) => {
    switch (status) {
      case 'pending': return 'Processing order';
      case 'confirmed': return 'Order confirmed by farmer';
      case 'processing': return 'Preparing your order';
      case 'ready': return 'Ready for pickup/delivery';
      case 'delivered': return 'Order delivered';
      case 'cancelled': return 'Order cancelled';
      default: return 'Status update';
    }
  };

  const formatOrderDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDeleteProduct = async (productId: string) => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', productId);

              if (error) {
                Alert.alert('Error', 'Failed to delete product');
                return;
              }

              // Refresh farmer data
              if (selectedFarmer) {
                await loadFarmerData(selectedFarmer.id);
              }
            } catch (error) {
              console.error('Error deleting product:', error);
              Alert.alert('Error', 'Failed to delete product');
            }
          },
        },
      ]
    );
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return colors.warning + '40';
      case 'confirmed': return colors.primary + '40';
      case 'completed': return colors.success + '40';
      case 'cancelled': return colors.danger + '40';
      default: return colors.textLight + '40';
    }
  };

  // Create User Functions
  const openCreateUserModal = () => {
    setCreateUserForm({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      user_type: activeTab, // Default to current tab
      farm_name: '',
      phone: '',
      barangay: profile?.barangay || '',
    });
    setCreateUserModalVisible(true);
  };

  const closeCreateUserModal = () => {
    setCreateUserModalVisible(false);
    setCreateUserForm({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      user_type: 'farmer',
      farm_name: '',
      phone: '',
      barangay: profile?.barangay || '',
    });
  };

  const validateCreateUserForm = (): string | null => {
    if (!createUserForm.email.trim()) return 'Email is required';
    if (!createUserForm.password.trim()) return 'Password is required';
    if (createUserForm.password.length < 6) return 'Password must be at least 6 characters';
    if (!createUserForm.first_name.trim()) return 'First name is required';
    if (!createUserForm.last_name.trim()) return 'Last name is required';
    if (!createUserForm.user_type) return 'User type is required';
    if (!createUserForm.barangay.trim()) return 'Barangay is required';
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(createUserForm.email)) return 'Please enter a valid email address';
    
    // Phone validation (if provided)
    if (createUserForm.phone.trim() && !/^[\+]?[0-9\-\(\)\s]{10,}$/.test(createUserForm.phone)) {
      return 'Please enter a valid phone number';
    }

    return null;
  };

  const handleCreateUser = async () => {
    const validationError = validateCreateUserForm();
    if (validationError) {
      Alert.alert('Validation Error', validationError);
      return;
    }

    setCreateUserLoading(true);
    
    try {
      // Create user account with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: createUserForm.email,
        password: createUserForm.password,
      });

      if (authError) {
        throw new Error(`Failed to create user account: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      // Create profile in the profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: authData.user.id,
            email: createUserForm.email,
            first_name: createUserForm.first_name,
            last_name: createUserForm.last_name,
            user_type: createUserForm.user_type,
            farm_name: createUserForm.farm_name.trim() || null,
            phone: createUserForm.phone.trim() || null,
            barangay: createUserForm.barangay,
          }
        ] as any);

      if (profileError) {
        // If profile creation fails, we should try to clean up the auth user
        console.error('Profile creation error:', profileError);
        throw new Error(`Failed to create user profile: ${profileError.message}`);
      }

      // Success
      Alert.alert(
        'Success',
        `${createUserForm.user_type} account created successfully for ${createUserForm.first_name} ${createUserForm.last_name}`,
        [
          {
            text: 'OK',
            onPress: () => {
              closeCreateUserModal();
              // Refresh the users list
              if (profile) {
                loadUsers(profile);
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('Create user error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create user';
      Alert.alert('Error', errorMessage);
    } finally {
      setCreateUserLoading(false);
    }
  };

  const updateCreateUserForm = (field: keyof CreateUserForm, value: string) => {
    setCreateUserForm(prev => ({
      ...prev,
      [field]: value
    }));
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
              <TouchableOpacity
                onPress={() => {
                  if (item.profiles?.user_type === 'farmer') {
                    openFarmerDetail(item);
                  } else if (item.profiles?.user_type === 'buyer') {
                    openBuyerDetail(item);
                  }
                }}
                disabled={item.profiles?.user_type !== 'farmer' && item.profiles?.user_type !== 'buyer'}
              >
                <Text style={[
                  styles.userName,
                  (item.profiles?.user_type === 'farmer' || item.profiles?.user_type === 'buyer') && styles.clickableUserName
                ]} numberOfLines={1}>
                  {item.profiles?.first_name} {item.profiles?.last_name}
                  {(item.profiles?.user_type === 'farmer' || item.profiles?.user_type === 'buyer') && (
                    <Icon name="external-link-alt" size={10} color={colors.primary} style={{ marginLeft: 4 }} />
                  )}
                </Text>
              </TouchableOpacity>
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

        {/* Enhanced Tab Navigation with Create Button */}
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
          
          {/* Create New User Button */}
          <TouchableOpacity
            style={styles.createUserButton}
            onPress={openCreateUserModal}
          >
            <Icon name="user-plus" size={16} color={colors.white} />
            <Text style={styles.createUserButtonText}>Create {activeTab}</Text>
          </TouchableOpacity>
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
              <TouchableOpacity
                style={styles.emptyCreateButton}
                onPress={openCreateUserModal}
              >
                <Icon name="user-plus" size={16} color={colors.white} />
                <Text style={styles.emptyCreateButtonText}>Create First {activeTab}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>

      {/* Create User Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={createUserModalVisible}
        onRequestClose={closeCreateUserModal}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={closeCreateUserModal}
            >
              <Icon name="times" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>Create New {createUserForm.user_type}</Text>
              <Text style={styles.modalSubtitle}>Add a new user to the system</Text>
            </View>
          </View>

          {/* Form Content */}
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formContainer}>
              
              {/* User Type Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>User Type *</Text>
                <View style={styles.userTypeSelection}>
                  <TouchableOpacity
                    style={[
                      styles.userTypeOption,
                      createUserForm.user_type === 'farmer' && styles.userTypeOptionActive
                    ]}
                    onPress={() => updateCreateUserForm('user_type', 'farmer')}
                  >
                    <Icon 
                      name="seedling" 
                      size={16} 
                      color={createUserForm.user_type === 'farmer' ? colors.white : colors.textSecondary} 
                    />
                    <Text style={[
                      styles.userTypeOptionText,
                      createUserForm.user_type === 'farmer' && styles.userTypeOptionTextActive
                    ]}>
                      Farmer
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.userTypeOption,
                      createUserForm.user_type === 'buyer' && styles.userTypeOptionActive
                    ]}
                    onPress={() => updateCreateUserForm('user_type', 'buyer')}
                  >
                    <Icon 
                      name="shopping-cart" 
                      size={16} 
                      color={createUserForm.user_type === 'buyer' ? colors.white : colors.textSecondary} 
                    />
                    <Text style={[
                      styles.userTypeOptionText,
                      createUserForm.user_type === 'buyer' && styles.userTypeOptionTextActive
                    ]}>
                      Buyer
                    </Text>
                  </TouchableOpacity>
                  {profile?.user_type === 'super-admin' && (
                    <TouchableOpacity
                      style={[
                        styles.userTypeOption,
                        createUserForm.user_type === 'admin' && styles.userTypeOptionActive
                      ]}
                      onPress={() => updateCreateUserForm('user_type', 'admin')}
                    >
                      <Icon 
                        name="user-shield" 
                        size={16} 
                        color={createUserForm.user_type === 'admin' ? colors.white : colors.textSecondary} 
                      />
                      <Text style={[
                        styles.userTypeOptionText,
                        createUserForm.user_type === 'admin' && styles.userTypeOptionTextActive
                      ]}>
                        Admin
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Personal Information */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Personal Information</Text>
                
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, styles.formGroupHalf]}>
                    <Text style={styles.formLabel}>First Name *</Text>
                    <TextInput
                      style={styles.formInput}
                      value={createUserForm.first_name}
                      onChangeText={(text) => updateCreateUserForm('first_name', text)}
                      placeholder="Enter first name"
                      placeholderTextColor={colors.textLight}
                    />
                  </View>
                  
                  <View style={[styles.formGroup, styles.formGroupHalf]}>
                    <Text style={styles.formLabel}>Last Name *</Text>
                    <TextInput
                      style={styles.formInput}
                      value={createUserForm.last_name}
                      onChangeText={(text) => updateCreateUserForm('last_name', text)}
                      placeholder="Enter last name"
                      placeholderTextColor={colors.textLight}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.formInput}
                    value={createUserForm.phone}
                    onChangeText={(text) => updateCreateUserForm('phone', text)}
                    placeholder="Enter phone number"
                    placeholderTextColor={colors.textLight}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* Account Information */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Account Information</Text>
                
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Email Address *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={createUserForm.email}
                    onChangeText={(text) => updateCreateUserForm('email', text)}
                    placeholder="Enter email address"
                    placeholderTextColor={colors.textLight}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Password *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={createUserForm.password}
                    onChangeText={(text) => updateCreateUserForm('password', text)}
                    placeholder="Enter password (min 6 characters)"
                    placeholderTextColor={colors.textLight}
                    secureTextEntry
                  />
                </View>
              </View>

              {/* Location Information */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Location</Text>
                
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Barangay *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={createUserForm.barangay}
                    onChangeText={(text) => updateCreateUserForm('barangay', text)}
                    placeholder="Enter barangay"
                    placeholderTextColor={colors.textLight}
                  />
                </View>
              </View>

              {/* Farm Information (only for farmers) */}
              {createUserForm.user_type === 'farmer' && (
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Farm Information</Text>
                  
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Farm Name</Text>
                    <TextInput
                      style={styles.formInput}
                      value={createUserForm.farm_name}
                      onChangeText={(text) => updateCreateUserForm('farm_name', text)}
                      placeholder="Enter farm name (optional)"
                      placeholderTextColor={colors.textLight}
                    />
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={closeCreateUserModal}
                  disabled={createUserLoading}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.submitButton, createUserLoading && styles.submitButtonDisabled]}
                  onPress={handleCreateUser}
                  disabled={createUserLoading}
                >
                  {createUserLoading ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Icon name="user-plus" size={16} color={colors.white} />
                      <Text style={styles.submitButtonText}>Create User</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Farmer Detail Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setModalVisible(false)}
            >
              <Icon name="arrow-left" size={20} color={colors.primary} />
            </TouchableOpacity>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>
                {selectedFarmer?.profiles?.first_name} {selectedFarmer?.profiles?.last_name}
              </Text>
              <Text style={styles.modalSubtitle}>
                {selectedFarmer?.profiles?.farm_name || 'Farm Management'}
              </Text>
            </View>
          </View>

          {/* Tab Navigation */}
          <View style={styles.modalTabContainer}>
            <TouchableOpacity
              style={[styles.modalTab, farmerDetailTab === 'products' && styles.activeModalTab]}
              onPress={() => setFarmerDetailTab('products')}
            >
              <Icon name="leaf" size={16} color={farmerDetailTab === 'products' ? colors.white : colors.textSecondary} />
              <Text style={[styles.modalTabText, farmerDetailTab === 'products' && styles.activeModalTabText]}>
                Products
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalTab, farmerDetailTab === 'orders' && styles.activeModalTab]}
              onPress={() => setFarmerDetailTab('orders')}
            >
              <Icon name="shopping-bag" size={16} color={farmerDetailTab === 'orders' ? colors.white : colors.textSecondary} />
              <Text style={[styles.modalTabText, farmerDetailTab === 'orders' && styles.activeModalTabText]}>
                Orders
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalTab, farmerDetailTab === 'inventory' && styles.activeModalTab]}
              onPress={() => setFarmerDetailTab('inventory')}
            >
              <Icon name="boxes" size={16} color={farmerDetailTab === 'inventory' ? colors.white : colors.textSecondary} />
              <Text style={[styles.modalTabText, farmerDetailTab === 'inventory' && styles.activeModalTabText]}>
                Inventory
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          <ScrollView style={styles.modalContent}>
            {farmerDetailTab === 'products' && (
              <View style={styles.tabContent}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Products ({farmerProducts.length})</Text>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowAddForm(true)}
                  >
                    <Icon name="plus" size={16} color={colors.white} />
                    <Text style={styles.addButtonText}>Add Product</Text>
                  </TouchableOpacity>
                </View>

                {farmerProducts.map((product) => (
                  <View key={product.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName}>{product.name}</Text>
                      <View style={styles.itemActions}>
                        <TouchableOpacity
                          style={styles.editButton}
                          onPress={() => setEditingItem(product)}
                        >
                          <Icon name="edit" size={14} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDeleteProduct(product.id)}
                        >
                          <Icon name="trash" size={14} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.itemDetail}>Price: {formatCurrency(product.price)}</Text>
                    <Text style={styles.itemDetail}>Stock: {product.stock_quantity}</Text>
                    <Text style={styles.itemDetail}>Category: {product.category}</Text>
                  </View>
                ))}
              </View>
            )}

            {farmerDetailTab === 'orders' && (
              <View style={styles.tabContent}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Orders ({farmerOrders.length})</Text>
                </View>

                {farmerOrders.map((order) => (
                  <View key={order.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName}>Order #{order.id.slice(-8)}</Text>
                      <Text style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(order.status) }]}>
                        {order.status}
                      </Text>
                    </View>
                    <Text style={styles.itemDetail}>
                      Buyer: {order.buyer_profile?.first_name} {order.buyer_profile?.last_name}
                    </Text>
                    <Text style={styles.itemDetail}>Total: {formatCurrency(order.total_price)}</Text>
                    <Text style={styles.itemDetail}>
                      Date: {new Date(order.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {farmerDetailTab === 'inventory' && (
              <View style={styles.tabContent}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Inventory ({farmerInventory.length})</Text>
                </View>

                {farmerInventory.map((item) => (
                  <View key={item.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <View style={styles.itemActions}>
                        <TouchableOpacity
                          style={styles.editButton}
                          onPress={() => setEditingItem(item)}
                        >
                          <Icon name="edit" size={14} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.itemDetail}>Current Stock: {item.stock_quantity}</Text>
                    <Text style={[styles.itemDetail, { color: item.stock_quantity < 10 ? colors.danger : colors.textSecondary }]}>
                      Status: {item.stock_quantity < 10 ? 'Low Stock' : 'In Stock'}
                    </Text>
                    <Text style={styles.itemDetail}>Price: {formatCurrency(item.price)}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Buyer Detail Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={buyerModalVisible}
        onRequestClose={() => setBuyerModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setBuyerModalVisible(false)}
            >
              <Icon name="arrow-left" size={20} color={colors.primary} />
            </TouchableOpacity>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>
                {selectedBuyer?.profiles?.first_name} {selectedBuyer?.profiles?.last_name}
              </Text>
              <Text style={styles.modalSubtitle}>
                Buyer Account Management
              </Text>
            </View>
          </View>

          {/* Tab Navigation */}
          <View style={styles.modalTabContainer}>
            <TouchableOpacity
              style={[styles.modalTab, buyerDetailTab === 'orders' && styles.activeModalTab]}
              onPress={() => setBuyerDetailTab('orders')}
            >
              <Icon name="shopping-bag" size={16} color={buyerDetailTab === 'orders' ? colors.white : colors.textSecondary} />
              <Text style={[styles.modalTabText, buyerDetailTab === 'orders' && styles.activeModalTabText]}>
                Current Orders
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalTab, buyerDetailTab === 'history' && styles.activeModalTab]}
              onPress={() => setBuyerDetailTab('history')}
            >
              <Icon name="history" size={16} color={buyerDetailTab === 'history' ? colors.white : colors.textSecondary} />
              <Text style={[styles.modalTabText, buyerDetailTab === 'history' && styles.activeModalTabText]}>
                Purchase History
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          <ScrollView style={styles.modalContent}>
            {buyerDetailTab === 'orders' && (
              <View style={styles.tabContent}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Current Orders ({buyerOrders.length})</Text>
                </View>

                {buyerOrders.map((order) => (
                  <View key={order.id} style={styles.buyerOrderCard}>
                    {/* Order Header - similar to buyer's view */}
                    <View style={styles.buyerOrderHeader}>
                      <View style={styles.buyerOrderLeftInfo}>
                        <Text style={styles.buyerOrderStatusText}>{getOrderStatusText(order.status)}</Text>
                        <Text style={styles.buyerOrderDate}>{formatOrderDate(order.created_at)}</Text>
                      </View>
                      <View style={styles.buyerOrderRightInfo}>
                        <Text style={styles.buyerOrderTotal}>TOTAL</Text>
                        <Text style={styles.buyerOrderAmount}>{formatCurrency(order.total_price)}</Text>
                      </View>
                    </View>

                    {/* Delivery Status */}
                    <View style={styles.buyerDeliveryStatus}>
                      <Text style={[styles.buyerDeliveryText, { color: getOrderStatusColor(order.status) }]}>
                        {getOrderDeliveryText(order.status)}
                      </Text>
                    </View>

                    {/* Product Info */}
                    <View style={styles.buyerProductSection}>
                      <View style={styles.buyerProductRow}>
                        <View style={styles.buyerProductIconContainer}>
                          <Text style={styles.buyerProductIcon}>📦</Text>
                        </View>
                        <View style={styles.buyerProductInfo}>
                          <Text style={styles.buyerProductName}>{order.product?.name}</Text>
                          <Text style={styles.buyerProductDetails}>
                            Quantity: {order.quantity} {order.product?.unit} • From: {
                              order.farmer_profile?.farm_name ||
                              `${order.farmer_profile?.first_name || ''} ${order.farmer_profile?.last_name || ''}`.trim() ||
                              'Farm'
                            }
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Order ID Section */}
                    <View style={styles.buyerOrderIdSection}>
                      <Text style={styles.buyerOrderIdLabel}>ORDER # {order.id.slice(-12).toUpperCase()}</Text>
                    </View>
                  </View>
                ))}

                {buyerOrders.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No current orders</Text>
                  </View>
                )}
              </View>
            )}

            {buyerDetailTab === 'history' && (
              <View style={styles.tabContent}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Purchase History ({buyerHistory.length})</Text>
                </View>

                {buyerHistory.map((order) => (
                  <View key={order.id} style={styles.buyerOrderCard}>
                    {/* Order Header - similar to buyer's view */}
                    <View style={styles.buyerOrderHeader}>
                      <View style={styles.buyerOrderLeftInfo}>
                        <Text style={styles.buyerOrderStatusText}>{getOrderStatusText(order.status)}</Text>
                        <Text style={styles.buyerOrderDate}>{formatOrderDate(order.created_at)}</Text>
                      </View>
                      <View style={styles.buyerOrderRightInfo}>
                        <Text style={styles.buyerOrderTotal}>TOTAL</Text>
                        <Text style={styles.buyerOrderAmount}>{formatCurrency(order.total_price)}</Text>
                      </View>
                    </View>

                    {/* Delivery Status */}
                    <View style={styles.buyerDeliveryStatus}>
                      <Text style={[styles.buyerDeliveryText, { color: getOrderStatusColor(order.status) }]}>
                        {getOrderDeliveryText(order.status)}
                      </Text>
                    </View>

                    {/* Product Info */}
                    <View style={styles.buyerProductSection}>
                      <View style={styles.buyerProductRow}>
                        <View style={styles.buyerProductIconContainer}>
                          <Text style={styles.buyerProductIcon}>📦</Text>
                        </View>
                        <View style={styles.buyerProductInfo}>
                          <Text style={styles.buyerProductName}>{order.product?.name}</Text>
                          <Text style={styles.buyerProductDetails}>
                            Quantity: {order.quantity} {order.product?.unit} • From: {
                              order.farmer_profile?.farm_name ||
                              `${order.farmer_profile?.first_name || ''} ${order.farmer_profile?.last_name || ''}`.trim() ||
                              'Farm'
                            }
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Order ID Section */}
                    <View style={styles.buyerOrderIdSection}>
                      <Text style={styles.buyerOrderIdLabel}>ORDER # {order.id.slice(-12).toUpperCase()}</Text>
                    </View>
                  </View>
                ))}

                {buyerHistory.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No purchase history</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
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
    marginBottom: 12,
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
  createUserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
    elevation: 2,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  createUserButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
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
  clickableUserName: {
    color: colors.primary,
    textDecorationLine: 'underline',
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
    marginBottom: 24,
  },
  emptyCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
  },
  emptyCreateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalTabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 4,
    gap: 6,
  },
  activeModalTab: {
    backgroundColor: colors.primary,
  },
  modalTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeModalTabText: {
    color: colors.white,
  },
  modalContent: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabContent: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  itemCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.primary + '15',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.danger + '15',
  },
  itemDetail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    minWidth: 80,
  },
  // Create User Form Styles
  formContainer: {
    padding: 20,
  },
  formSection: {
    marginBottom: 24,
  },
  formSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formGroupHalf: {
    flex: 1,
  },
  formRow: {
    flexDirection: 'row',
    gap: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    elevation: 1,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  userTypeSelection: {
    flexDirection: 'row',
    gap: 8,
  },
  userTypeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  userTypeOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  userTypeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  userTypeOptionTextActive: {
    color: colors.white,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    gap: 8,
    elevation: 2,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  submitButtonDisabled: {
    backgroundColor: colors.textLight,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },

  // Buyer Order Card Styles (matching buyer's my-orders view)
  buyerOrderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 12,
  },
  buyerOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  buyerOrderLeftInfo: {
    flex: 1,
  },
  buyerOrderStatusText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 2,
  },
  buyerOrderDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  buyerOrderRightInfo: {
    alignItems: 'flex-end',
  },
  buyerOrderTotal: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  buyerOrderAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  buyerDeliveryStatus: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  buyerDeliveryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buyerProductSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buyerProductRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  buyerProductIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  buyerProductIcon: {
    fontSize: 18,
  },
  buyerProductInfo: {
    flex: 1,
  },
  buyerProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  buyerProductDetails: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  buyerOrderIdSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  buyerOrderIdLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
});