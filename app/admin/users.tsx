import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
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
import AddProductForm from '../../components/AddProductForm';
import AdminInventoryCard from '../../components/AdminInventoryCard';
import AdminOrderCard from '../../components/AdminOrderCard';
import AdminProductCard from '../../components/AdminProductCard';
import AdminTable, { TableColumn, TableAction } from '../../components/AdminTable';
import HeaderComponent from '../../components/HeaderComponent';
import OrderQRScanner from '../../components/OrderQRScanner';
import OrderVerificationModal from '../../components/OrderVerificationModal';
import { useConfirmationModal } from '../../contexts/ConfirmationModalContext';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { notifyAllAdmins, notifyUserAction } from '../../services/notifications';
import { Database } from '../../types/database';

const { width: screenWidth } = Dimensions.get('window');

// Conditional VisionCamera imports for mobile platforms only
let Camera: any = null;
let useCameraDevices: any = () => ({});
let useCodeScanner: any = () => ({});

if (Platform.OS === 'ios' || Platform.OS === 'android') {
  try {
    const visionCamera = require('react-native-vision-camera');
    Camera = visionCamera.Camera;
    useCameraDevices = visionCamera.useCameraDevices;
    useCodeScanner = visionCamera.useCodeScanner;
  } catch (error) {
    console.warn('VisionCamera not available on this platform:', error);
  }
}

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
  // order_items removed - using single table approach
}

interface ProductResponse {
  id: string;
  name: string;
  description?: string;
  price: number;
  unit: string;
  stock_quantity: number;
  category: string;
  image_url?: string;
  status: 'pending' | 'approved' | 'rejected';
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
  const { showConfirmation } = useConfirmationModal();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'farmer' | 'buyer'>('farmer');

  // Animation states for scroll-aware header
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const scrollDirection = useRef<'up' | 'down'>('up');
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

  // QR Scanner states
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [orderProcessingVisible, setOrderProcessingVisible] = useState(false);
  const [scannedOrderData, setScannedOrderData] = useState<any>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(true);

  // Camera setup (mobile only)
  const devices = useCameraDevices();
  const device = devices?.back;

  // Code scanner setup (mobile only)
  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13'],
    onCodeScanned: (codes: any[]) => {
      if (isScanning && codes.length > 0) {
        setIsScanning(false);
        handleQrCodeScanned(codes[0].value || '');
      }
    }
  });
  
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
      // Silently handle auth state changes

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
      console.log('🔄 useEffect triggered - loading users for activeTab:', activeTab);
      loadUsers(profile);
      // Update form barangay when profile loads
      setCreateUserForm(prev => ({
        ...prev,
        barangay: profile.barangay || ''
      }));
    }
  }, [activeTab, profile]);

  // Calculate sales data when tab changes or users are loaded
  useEffect(() => {
    if (users.length > 0 && !loading) {
      console.log('🔄 Checking if sales data needed for', users.length, 'users in', activeTab, 'tab');

      // Always try to load sales data when tab changes or users load
      // Let the loadSalesDataInBackground function handle the detailed checking
      loadSalesDataInBackground(users);
    }
  }, [activeTab, users.length, loading]);

  // Camera permission check (mobile only)
  useEffect(() => {
    const checkPermissions = async () => {
      if (Camera && (Platform.OS === 'ios' || Platform.OS === 'android')) {
        try {
          const permission = await Camera.requestCameraPermission();
          setHasPermission(permission === 'authorized');
        } catch (error) {
          console.warn('Camera permission error:', error);
          setHasPermission(false);
        }
      } else {
        setHasPermission(false); // No camera support on web
      }
    };
    checkPermissions();
  }, []);

  const loadData = async () => {
    try {
      // Wait a bit for auth state to stabilize on refresh
      await new Promise(resolve => setTimeout(resolve, 200));

      let userData = await getUserWithProfile();
      console.log('🔍 Admin Page - User data:', userData);
      console.log('🔍 Admin Page - User type:', userData?.profile?.user_type);
      console.log('🔍 Admin Page - User barangay:', userData?.profile?.barangay);

      // Retry logic if profile is undefined but user exists
      if (userData?.user && !userData?.profile) {
        console.log('🔄 Profile undefined, retrying in 500ms...');
        await new Promise(resolve => setTimeout(resolve, 500));
        userData = await getUserWithProfile();
        console.log('🔍 Admin Page - Retry result:', userData?.profile?.user_type);
      }

      // If still no profile after retry, try one more time
      if (userData?.user && !userData?.profile) {
        console.log('🔄 Profile still undefined, final retry in 1000ms...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        userData = await getUserWithProfile();
        console.log('🔍 Admin Page - Final retry result:', userData?.profile?.user_type);
      }

      console.log('🔍 Admin Page - Full profile:', JSON.stringify(userData?.profile, null, 2));
      setAuthChecked(true);

      // Check if we have a user but no profile (database issue)
      if (userData?.user && !userData?.profile) {
        console.log('❌ User exists but no profile found in database');
        Alert.alert('Profile Error', 'User profile not found. Please contact support.');
        setLoading(false);
        router.replace('/');
        return;
      }

      // Check if no user at all
      if (!userData?.user) {
        console.log('❌ No user session found');
        setLoading(false);
        router.replace('/');
        return;
      }

      // Check permissions
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

  // Handle scroll for header animation
  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;

    // Hide header completely when scrolling (any direction)
    if (currentScrollY > 50) { // Only hide after scrolling past initial position
      if (headerTranslateY._value !== -300) {
        Animated.timing(headerTranslateY, {
          toValue: -300,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    } else {
      // Show header when at the top
      if (headerTranslateY._value !== 0) {
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }

    lastScrollY.current = currentScrollY;
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

  const fetchFarmerSalesData = async (userId: string): Promise<User['salesData']> => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7); // Last 7 days

      // Fetch all delivered orders for lifetime total (farmer earnings)
      const { data: allOrders, error: allOrdersError } = await supabase
        .from('orders')
        .select('total_price')
        .eq('farmer_id', userId)
        .in('status', ['delivered']);

      if (allOrdersError) {
        console.error(`Error fetching all farmer orders for user ${userId}:`, allOrdersError);
      }

      // Fetch orders for this farmer (last 7 days)
      const { data: orders, error } = await supabase
        .from('orders')
        .select('total_price, created_at, status')
        .eq('farmer_id', userId)
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
        console.error(`Error fetching farmer orders for user ${userId}:`, error);
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
      console.error(`Error fetching farmer sales data for user ${userId}:`, error);
      return { totalSales: 0, totalLifetime: 0, chartData: [] };
    }
  };

  const loadUsers = async (adminProfile?: Profile, forceUserType?: 'farmer' | 'buyer') => {
    const currentProfile = adminProfile || profile;
    if (!currentProfile) return;

    // Use forceUserType if provided, otherwise use activeTab
    const userTypeToLoad = forceUserType || activeTab;
    console.log('🔄 loadUsers called for', userTypeToLoad, 'in barangay:', currentProfile?.barangay);
    setLoading(true);

    try {
      // First, get approved users from verification_submissions
      const { data: approvedVerifications, error: verificationsError } = await supabase
        .from('verification_submissions')
        .select('user_id')
        .eq('status', 'approved');

      if (verificationsError) {
        console.error('❌ Error loading verifications:', verificationsError);
        throw verificationsError;
      }

      const approvedUserIds = approvedVerifications?.map(v => v.user_id) || [];
      console.log('✅ Found', approvedUserIds.length, 'approved users from verifications');
      console.log('📋 Approved user IDs:', approvedUserIds);

      if (approvedUserIds.length === 0) {
        console.log('ℹ️ No approved users found in this barangay yet');
        setUsers([]);
        setLoading(false);
        return;
      }

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
        .eq('user_type', userTypeToLoad)
        .in('id', approvedUserIds)
        .order('created_at', { ascending: false });

      if (currentProfile?.barangay) {
        query = query.eq('barangay', currentProfile.barangay);
      }

      console.log('🔍 Query for', activeTab, 'users in barangay:', currentProfile?.barangay);
      const { data, error } = await query;

      if (error) {
        console.error('❌ Error loading users:', error);
        throw error;
      }

      console.log('📊 Raw data from database:', data?.length, 'users found');
      console.log('📊 User IDs from profiles:', data?.map(u => u.id));
      console.log('📊 User types from profiles:', data?.map(u => u.user_type));

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

      console.log('✅ Loaded', usersData.length, activeTab + 's');
      setUsers(usersData);
      setLoading(false);

      // Fetch sales data in background without blocking UI
      // Use setTimeout to ensure loading state is updated first
      setTimeout(() => {
        loadSalesDataInBackground(usersData);
      }, 100);

    } catch (error) {
      console.error('Error loading users:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to load users');
    }
  };

  const loadSalesDataInBackground = async (usersData: User[]) => {
    try {
      console.log('💰 loadSalesDataInBackground called with', usersData.length, 'users, loading:', loading);

      // Fetch sales data for both farmers and buyers
      if (usersData.length === 0 || loading) {
        console.log('❌ Skipping sales data load: no users or still loading');
        return;
      }

      // Check if any users actually need sales data to avoid unnecessary updates
      const usersNeedingData = usersData.filter(user => {
        if (!user.salesData) return true;
        // Only skip if we have meaningful sales data
        return (user.salesData.totalSales === 0 && user.salesData.totalLifetime === 0 &&
                (!user.salesData.chartData || user.salesData.chartData.length === 0));
      });

      console.log('📊 Users needing sales data:', usersNeedingData.length, 'out of', usersData.length);
      if (usersNeedingData.length === 0) {
        console.log('✅ All users already have sales data');
        return;
      }

      const usersWithSalesData = await Promise.all(
        usersData.map(async (user) => {
          try {
            // Skip if user already has valid sales data
            if (user.salesData && (user.salesData.totalSales > 0 || user.salesData.totalLifetime > 0)) {
              return user;
            }

            let salesData;
            if (activeTab === 'farmer') {
              console.log('🌱 Fetching FARMER sales data for user:', user.id);
              // For farmers, calculate earnings from delivered orders
              salesData = await fetchFarmerSalesData(user.id);
            } else {
              console.log('🛒 Fetching BUYER sales data for user:', user.id);
              // For buyers, calculate spending on delivered orders
              salesData = await fetchUserSalesData(user.id);
            }
            console.log('💰 Sales data result:', salesData);
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

      // Only update if there are actual changes and not loading
      const hasChanges = usersWithSalesData.some((user, index) =>
        JSON.stringify(user.salesData) !== JSON.stringify(usersData[index].salesData)
      );

      if (!loading && hasChanges) {
        // Use callback form to avoid overwriting with stale data
        setUsers(currentUsers => {
          // Only update if the user count matches (prevents overwriting with old data)
          if (currentUsers.length === usersWithSalesData.length) {
            return usersWithSalesData;
          }
          console.log('⚠️ User count mismatch, skipping sales data update');
          return currentUsers;
        });
      }
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

    const matchesUserType = user.profiles?.user_type === activeTab;

    return matchesSearch && matchesUserType;
  });

  // Debug logging
  console.log('🔍 Debug - Total users:', users.length);
  console.log('🔍 Debug - Active tab:', activeTab);
  console.log('🔍 Debug - User types in data:', users.map(u => u.profiles?.user_type));
  console.log('🔍 Debug - Filtered users:', filteredUsers.length);
  console.log('🔍 Debug - Search query:', searchQuery);

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
          buyer_profile:profiles!orders_buyer_id_fkey(first_name, last_name)
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
    // Get product details first for better confirmation message
    try {
      const { data: productData, error: fetchError } = await supabase
        .from('products')
        .select('name')
        .eq('id', productId)
        .single();

      const productName = productData?.name || 'this product';

      // Close the user detail modal immediately when showing confirmation
      setModalVisible(false);
      setBuyerModalVisible(false);

      showConfirmation(
        'Delete Product',
        `Are you sure you want to delete "${productName}"? This action cannot be undone and will notify the farmer.`,
        async () => {
            try {
              // Get product details before deletion for notification
              const { data: productData, error: fetchError } = await supabase
                .from('products')
                .select('name, farmer_id')
                .eq('id', productId)
                .single();

              if (fetchError || !productData) {
                console.error('Error fetching product data:', fetchError);
                Alert.alert('Error', 'Failed to get product information');
                return;
              }

              const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', productId);

              if (error) {
                Alert.alert('Error', 'Failed to delete product');
                return;
              }

              // Send notifications
              try {
                // Notify the farmer whose product was deleted
                await notifyUserAction(
                  productData.farmer_id,
                  'deleted',
                  'product',
                  productData.name,
                  profile?.id || '',
                  'Product removed by administrator'
                );

                // Notify all other admins about the product deletion
                await notifyAllAdmins(
                  'Product Deleted',
                  `Admin ${profile?.first_name} ${profile?.last_name} deleted the product "${productData.name}"`,
                  profile?.id || '',
                  {
                    action: 'product_deleted',
                    productName: productData.name,
                    farmerId: productData.farmer_id
                  }
                );

                console.log('✅ Notifications sent for product deletion');
              } catch (notifError) {
                console.error('⚠️ Failed to send notifications:', notifError);
              }

              // Refresh farmer data
              if (selectedFarmer) {
                await loadFarmerData(selectedFarmer.id);
              }

              // Show success message
              Alert.alert(
                'Success!',
                `Product "${productData.name}" has been deleted successfully and the farmer has been notified.`,
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Error deleting product:', error);
              Alert.alert('Error', 'Failed to delete product');
            }
        },
        true, // isDestructive
        'Delete Product',
        'Cancel'
      );
    } catch (error) {
      console.error('Error fetching product details:', error);
      Alert.alert('Error', 'Failed to load product details');
    }
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

  // QR Scanner Functions
  const handleQrScan = () => {
    setIsScanning(true);
    setQrScannerVisible(true);
  };

  const handleQrCodeScanned = async (data: string) => {
    try {
      // Parse the QR code data (assuming it contains order information)
      const orderData = JSON.parse(data);

      // Fetch the full order details from the database including buyer's full information
      const { data: orderDetails, error } = await supabase
        .from('orders')
        .select(`
          *,
          buyer_profile:profiles!orders_buyer_id_fkey(first_name, last_name, phone, barangay),
          farmer_profile:profiles!orders_farmer_id_fkey(first_name, last_name, farm_name),
          product:products(name, price, unit)
        `)
        .eq('id', orderData.orderId || orderData.order_id)
        .single();

      if (error || !orderDetails) {
        Alert.alert('Error', 'Order not found or invalid QR code');
        return;
      }

      // Add buyer name info for easy display
      const enrichedOrderData = {
        ...orderDetails,
        buyerName: `${orderDetails.buyer_profile?.first_name || ''} ${orderDetails.buyer_profile?.last_name || ''}`.trim(),
        farmerName: `${orderDetails.farmer_profile?.first_name || ''} ${orderDetails.farmer_profile?.last_name || ''}`.trim(),
      };

      setScannedOrderData(enrichedOrderData);
      setQrScannerVisible(false);
      setOrderProcessingVisible(true);
    } catch (error) {
      console.error('Error processing QR code:', error);
      Alert.alert('Error', 'Invalid QR code format');
    }
  };

  const handleOrderAction = (action: 'complete' | 'cancel') => {
    if (!scannedOrderData) return;

    const actionTitle = action === 'complete' ? 'Complete Transaction' : 'Cancel Order';
    const actionMessage = action === 'complete'
      ? `Are you sure you want to mark this order as completed? This will finalize the transaction.`
      : `Are you sure you want to cancel this order? This action cannot be undone and will notify both the buyer and farmer.`;

    showConfirmation(
      actionTitle,
      actionMessage,
      async () => {
        try {
          const newStatus = action === 'complete' ? 'delivered' : 'cancelled';

          const { error } = await supabase
            .from('orders')
            .update({ status: newStatus } as any)
            .eq('id', scannedOrderData.id);

          if (error) throw error;

          Alert.alert(
            'Success',
            `Order has been ${action === 'complete' ? 'completed' : 'cancelled'} successfully`
          );

          setOrderProcessingVisible(false);
          setScannedOrderData(null);

          // Refresh the users list to update any displayed data
          loadData();
        } catch (error) {
          console.error('Error updating order:', error);
          Alert.alert('Error', 'Failed to update order status');
        }
      },
      action === 'cancel', // isDestructive - true for cancel, false for complete
      action === 'complete' ? 'Complete' : 'Cancel Order',
      'Go Back'
    );
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
      console.log('🚀 Creating user via Edge Function (no auto-login)');

      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call Edge Function to create user without logging in
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: createUserForm.email,
          password: createUserForm.password,
          user_metadata: {
            first_name: createUserForm.first_name,
            last_name: createUserForm.last_name,
            user_type: createUserForm.user_type,
            farm_name: createUserForm.farm_name.trim() || null,
            phone: createUserForm.phone.trim() || null,
            barangay: createUserForm.barangay,
          }
        }
      });

      if (error) {
        if (error.message?.includes('already registered') || error.message?.includes('User already registered')) {
          throw new Error('This email address is already registered. Please use a different email.');
        }
        throw new Error(error.message || 'Failed to create user');
      }

      if (!data?.success || !data?.user_id) {
        throw new Error(data?.error || 'Failed to create user');
      }

      const newUserId = data.user_id;
      console.log('✅ User, profile, and verification created successfully via Edge Function');
      console.log('✅ User ID:', newUserId);

      // Send notifications
      try {
        // Notify the newly created user
        await notifyUserAction(
          newUserId,
          'approved',
          'account',
          `${createUserForm.first_name} ${createUserForm.last_name}`,
          profile?.id || '',
          'Account created by administrator'
        );

        // Notify all other admins about the new user creation
        await notifyAllAdmins(
          `New ${createUserForm.user_type} Created`,
          `Admin ${profile?.first_name} ${profile?.last_name} created a new ${createUserForm.user_type} account for ${createUserForm.first_name} ${createUserForm.last_name} (${createUserForm.email})`,
          profile?.id || '',
          {
            action: 'user_created',
            userType: createUserForm.user_type,
            userEmail: createUserForm.email,
            userName: `${createUserForm.first_name} ${createUserForm.last_name}`
          }
        );

        console.log('✅ Notifications sent for user creation');
      } catch (notifError) {
        console.error('⚠️ Failed to send notifications:', notifError);
        // Don't fail the user creation if notifications fail
      }

      // Success - user created WITHOUT logging you out!
      console.log('🎉 User created successfully - you remain logged in as admin');

      Alert.alert(
        'Success',
        `${createUserForm.user_type} account created successfully for ${createUserForm.first_name} ${createUserForm.last_name}`,
        [
          {
            text: 'OK',
            onPress: async () => {
              closeCreateUserModal();

              // Switch to the correct tab
              if (createUserForm.user_type === 'farmer' || createUserForm.user_type === 'buyer') {
                setActiveTab(createUserForm.user_type);
              }

              // Reload users list
              if (profile) {
                await loadUsers(profile);
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

  // Handle product status update
  const handleProductStatusUpdate = async (productId: string, newStatus: 'approved' | 'rejected') => {
    // Close the user detail modal immediately when showing confirmation
    setModalVisible(false);
    setBuyerModalVisible(false);

    const actionText = newStatus === 'approved' ? 'approve' : 'reject';
    const confirmed = await showConfirmation(
      `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Product`,
      `Are you sure you want to ${actionText} this product?`
    );

    if (!confirmed) return;

    try {
      // Get product details for notification
      const { data: productData, error: fetchError } = await supabase
        .from('products')
        .select('name, farmer_id')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('products')
        .update({ status: newStatus })
        .eq('id', productId);

      if (error) throw error;

      // Send notification to farmer
      try {
        await notifyUserAction(
          productData.farmer_id,
          newStatus === 'approved' ? 'approved' : 'rejected',
          'product',
          productData.name,
          profile?.id || '',
          `Your product "${productData.name}" has been ${newStatus} by an administrator`
        );

        // Notify all admins
        await notifyAllAdmins(
          `Product ${newStatus === 'approved' ? 'Approved' : 'Rejected'}`,
          `Admin ${profile?.first_name} ${profile?.last_name} ${newStatus} the product "${productData.name}"`,
          profile?.id || '',
          {
            action: `product_${newStatus}`,
            productId: productId,
            productName: productData.name,
            farmerId: productData.farmer_id
          }
        );
      } catch (notifError) {
        console.error('Failed to send notifications:', notifError);
      }

      // Show success message
      Alert.alert('Success', `Product ${newStatus} successfully!`);

      // Refresh farmer data
      if (selectedFarmer) {
        await loadFarmerData(selectedFarmer.id);
      }
    } catch (error) {
      console.error('Error updating product status:', error);
      Alert.alert('Error', 'Failed to update product status');
    }
  };

  // Handle order status update
  const handleOrderStatusUpdate = async (orderId: string, newStatus: string) => {
    // Close the user detail modal immediately when showing confirmation
    setModalVisible(false);
    setBuyerModalVisible(false);

    const actionMap: { [key: string]: string } = {
      confirmed: 'confirm',
      cancelled: 'cancel',
      delivered: 'mark as delivered',
      ready: 'mark as ready'
    };

    const actionText = actionMap[newStatus] || newStatus;
    const confirmed = await showConfirmation(
      `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Order`,
      `Are you sure you want to ${actionText} this order?`
    );

    if (!confirmed) return;

    try {
      // Get order details for notification
      const { data: orderData, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id,
          buyer_id,
          farmer_id,
          products (name)
        `)
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus } as any)
        .eq('id', orderId);

      if (error) throw error;

      // Send notifications
      try {
        const productName = orderData.products?.name || 'Product';

        // Notify buyer about order status change
        await notifyOrderStatusChange(
          orderId,
          orderData.buyer_id,
          newStatus,
          `Your order for ${productName} has been ${newStatus}`
        );

        // Notify farmer about order status change
        await notifyOrderStatusChange(
          orderId,
          orderData.farmer_id,
          newStatus,
          `Order for ${productName} has been ${newStatus} by admin`
        );

        // Notify all admins
        await notifyAllAdmins(
          `Order ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
          `Admin ${profile?.first_name} ${profile?.last_name} ${newStatus} order #${orderId.substring(0, 8)}`,
          profile?.id || '',
          {
            action: `order_${newStatus}`,
            orderId: orderId
          }
        );
      } catch (notifError) {
        console.error('Failed to send notifications:', notifError);
      }

      // Show success message
      Alert.alert('Success', `Order ${newStatus} successfully!`);

      // Refresh data
      if (selectedFarmer) {
        await loadFarmerData(selectedFarmer.id);
      }
      if (selectedBuyer) {
        await loadBuyerData(selectedBuyer.id);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
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
          <View style={styles.badgeContainer}>
            <View style={[styles.userTypeBadge, { backgroundColor: getUserTypeColor(item.profiles?.user_type || '') + '15' }]}>
              <Text style={[styles.userTypeText, { color: getUserTypeColor(item.profiles?.user_type || '') }]}>
                {item.profiles?.user_type?.toUpperCase()}
              </Text>
            </View>
            <View style={[styles.approvedBadge, { backgroundColor: '#10b981' + '15' }]}>
              <Icon name="check-circle" size={10} color="#10b981" style={{ marginRight: 4 }} />
              <Text style={[styles.approvedBadgeText, { color: '#10b981' }]}>
                APPROVED
              </Text>
            </View>
          </View>
        </View>

        {/* Sales Chart */}
        {hasValidData ? (
          <View style={styles.chartContainer} pointerEvents="none">
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
          showMessages={true}
          showNotifications={true}
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
      <View style={styles.headerComponentWrapper}>
        <HeaderComponent
          profile={profile}
          userType="admin"
          currentRoute="/admin/users"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search users..."
          showMessages={true}
          showNotifications={true}
        />
      </View>

      <View style={styles.content}>
        <Animated.View
          style={[
            styles.enhancedHeaderFixed,
            {
              transform: [{ translateY: headerTranslateY }]
            }
          ]}
        >
          <View style={styles.headerTop}>
            <View style={styles.tabContainer}>
              <TouchableOpacity style={[styles.tab, activeTab === 'farmer' && styles.activeTab]} onPress={() => setActiveTab('farmer')}>
                <Icon name="seedling" size={16} color={activeTab === 'farmer' ? colors.white : colors.textSecondary} />
                <Text style={[styles.tabText, activeTab === 'farmer' && styles.activeTabText]}>Farmers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, activeTab === 'buyer' && styles.activeTab]} onPress={() => setActiveTab('buyer')}>
                <Icon name="shopping-cart" size={16} color={activeTab === 'buyer' ? colors.white : colors.textSecondary} />
                <Text style={[styles.tabText, activeTab === 'buyer' && styles.activeTabText]}>Buyers</Text>
              </TouchableOpacity>
            </View>
            {screenWidth >= 768 && (
              <View style={styles.headerButtons}>
                {activeTab === 'buyer' && (
                  <TouchableOpacity style={styles.createUserCircleButton} onPress={() => setQrScannerVisible(true)}>
                    <Icon name="qrcode" size={20} color={colors.white} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.createUserCircleButton} onPress={openCreateUserModal}>
                  <Icon name="plus" size={20} color={colors.white} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Icon name="users" size={18} color={colors.primary} />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{filteredUsers.length}</Text>
                <Text style={styles.statLabel}>Total {activeTab}s</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Icon name={activeTab === 'buyer' ? 'shopping-bag' : 'dollar-sign'} size={18} color={colors.secondary} />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{formatCurrency(getTotalSales()).replace('₱', '₱')}</Text>
                <Text style={styles.statLabel}>{activeTab === 'buyer' ? 'Total Spending' : 'Total Sales'}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Users Grid */}
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          key={screenWidth < 600 ? 'single-column' : 'two-columns'}
          numColumns={screenWidth < 600 ? 1 : 2}
          columnWrapperStyle={screenWidth < 600 ? undefined : styles.gridRow}
          contentContainerStyle={[styles.listContainer, { paddingTop: 250 }]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
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

        {/* Floating Action Button Widget (Mobile Only) */}
        {screenWidth < 768 && (
          <View style={styles.fabWidget}>
            {activeTab === 'buyer' && (
              <TouchableOpacity style={[styles.fabButton, { backgroundColor: colors.secondary }]} onPress={() => setQrScannerVisible(true)}>
                <Icon name="qrcode" size={18} color={colors.white} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.fabButton, { backgroundColor: colors.primary }]} onPress={openCreateUserModal}>
              <Icon name="plus" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Create User Modal */}
      <Modal
        animationKeyframesType="slide"
        transparent={true}
        visible={createUserModalVisible}
        onRequestClose={closeCreateUserModal}
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={closeCreateUserModal}
            >
              <Icon name="times" size={20} color={colors.white} />
            </TouchableOpacity>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>Create New {createUserForm.user_type}</Text>
              <Text style={styles.modalSubtitle}>Add a new user to the system</Text>
            </View>
          </View>

          {/* Form Content */}
          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}
          >
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

              {/* Action Button */}
              <TouchableOpacity
                style={[styles.submitButton, createUserLoading && styles.submitButtonDisabled, { flex: 1 }]}
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
          </ScrollView>
        </View>
      </Modal>

      {/* Farmer Detail Modal */}
      <Modal
        animationKeyframesType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
        presentationStyle="overFullScreen"
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
                {showAddForm ? (
                  <AddProductForm
                    farmerId={selectedFarmer?.id || ''}
                    onSuccess={() => {
                      setShowAddForm(false);
                      loadFarmerData(selectedFarmer?.id || '');
                    }}
                    onCancel={() => setShowAddForm(false)}
                  />
                ) : (
                  <AdminTable
                    columns={[
                      { key: 'name', title: 'Product Name', width: 180 },
                      {
                        key: 'price',
                        title: 'Price',
                        width: 120,
                        render: (value, row) => <Text style={styles.cellText}>{formatCurrency(value)}/{row.unit}</Text>
                      },
                      { key: 'stock_quantity', title: 'Stock', width: 100 },
                      { key: 'category', title: 'Category', width: 120 },
                      {
                        key: 'status',
                        title: 'Status',
                        width: 120,
                        render: (value) => (
                          <View style={[styles.statusBadge, {
                            backgroundColor: value === 'approved' ? colors.success + '20' :
                                           value === 'pending' ? colors.warning + '20' : colors.danger + '20'
                          }]}>
                            <Text style={{
                              color: value === 'approved' ? colors.success :
                                     value === 'pending' ? colors.warning : colors.danger,
                              fontSize: 12,
                              fontWeight: '600'
                            }}>{value.toUpperCase()}</Text>
                          </View>
                        )
                      },
                    ]}
                    data={farmerProducts}
                    onAddPress={() => setShowAddForm(true)}
                    addButtonText="+ Add Product"
                    emptyMessage="No products found"
                    actions={[
                      {
                        icon: 'eye',
                        label: 'View',
                        color: colors.primary,
                        onPress: (product) => {
                          setModalVisible(false);
                          router.push(`/products/${product.id}` as any);
                        }
                      },
                      {
                        icon: 'check',
                        label: 'Approve',
                        color: colors.success,
                        show: (product) => product.status === 'pending',
                        onPress: (product) => handleProductStatusUpdate(product.id, 'approved')
                      },
                      {
                        icon: 'times',
                        label: 'Reject',
                        color: colors.warning,
                        show: (product) => product.status === 'pending',
                        onPress: (product) => handleProductStatusUpdate(product.id, 'rejected')
                      },
                      {
                        icon: 'trash-alt',
                        label: 'Delete',
                        color: colors.danger,
                        onPress: (product) => handleDeleteProduct(product.id)
                      },
                    ]}
                  />
                )}
              </View>
            )}

            {farmerDetailTab === 'orders' && (
              <View style={styles.tabContent}>
                <AdminTable
                  columns={[
                    { key: 'id', title: 'Order ID', width: 100, render: (value) => <Text style={styles.cellText}>#{value.substring(0, 8)}</Text> },
                    {
                      key: 'buyer_profile',
                      title: 'Buyer',
                      width: 150,
                      render: (value) => <Text style={styles.cellText}>{value?.first_name} {value?.last_name}</Text>
                    },
                    {
                      key: 'total_price',
                      title: 'Amount',
                      width: 120,
                      render: (value) => <Text style={styles.cellText}>{formatCurrency(value)}</Text>
                    },
                    {
                      key: 'status',
                      title: 'Status',
                      width: 120,
                      render: (value) => (
                        <View style={[styles.statusBadge, {
                          backgroundColor: value === 'delivered' ? colors.success + '20' :
                                         value === 'cancelled' ? colors.danger + '20' :
                                         value === 'ready' ? colors.primary + '20' : colors.warning + '20'
                        }]}>
                          <Text style={{
                            color: value === 'delivered' ? colors.success :
                                   value === 'cancelled' ? colors.danger :
                                   value === 'ready' ? colors.primary : colors.warning,
                            fontSize: 12,
                            fontWeight: '600'
                          }}>{value.toUpperCase()}</Text>
                        </View>
                      )
                    },
                    {
                      key: 'created_at',
                      title: 'Date',
                      width: 140,
                      render: (value) => <Text style={styles.cellText}>{formatOrderDate(value)}</Text>
                    },
                  ]}
                  data={farmerOrders}
                  emptyMessage="No orders found"
                  actions={[
                    {
                      icon: 'eye',
                      label: 'View',
                      color: colors.primary,
                      onPress: (order) => {
                        setModalVisible(false);
                        router.push(`/admin/orders/${order.id}` as any);
                      }
                    },
                    {
                      icon: 'check',
                      label: 'Confirm',
                      color: colors.success,
                      show: (order) => order.status === 'pending',
                      onPress: (order) => handleOrderStatusUpdate(order.id, 'confirmed')
                    },
                    {
                      icon: 'times',
                      label: 'Cancel',
                      color: colors.danger,
                      show: (order) => !['delivered', 'cancelled'].includes(order.status),
                      onPress: (order) => handleOrderStatusUpdate(order.id, 'cancelled')
                    },
                  ]}
                />
              </View>
            )}

            {farmerDetailTab === 'inventory' && (
              <View style={styles.tabContent}>
                <AdminTable
                  columns={[
                    { key: 'name', title: 'Product Name', width: 180 },
                    {
                      key: 'price',
                      title: 'Price',
                      width: 120,
                      render: (value, row) => <Text style={styles.cellText}>{formatCurrency(value)}/{row.unit}</Text>
                    },
                    {
                      key: 'stock_quantity',
                      title: 'Stock',
                      width: 100,
                      render: (value) => (
                        <Text style={[styles.cellText, {
                          color: value === 0 ? colors.danger : value < 10 ? colors.warning : colors.success,
                          fontWeight: '600'
                        }]}>{value}</Text>
                      )
                    },
                    { key: 'category', title: 'Category', width: 120 },
                    {
                      key: 'created_at',
                      title: 'Added',
                      width: 140,
                      render: (value) => <Text style={styles.cellText}>{new Date(value).toLocaleDateString()}</Text>
                    },
                  ]}
                  data={farmerInventory}
                  emptyMessage="No inventory items"
                  actions={[
                    {
                      icon: 'eye',
                      label: 'View',
                      color: colors.primary,
                      onPress: (item) => {
                        setModalVisible(false);
                        router.push(`/products/${item.id}` as any);
                      }
                    },
                    {
                      icon: 'edit',
                      label: 'Edit',
                      color: colors.secondary,
                      onPress: (item) => {
                        setModalVisible(false);
                        router.push(`/admin/products/edit/${item.id}` as any);
                      }
                    },
                    {
                      icon: 'trash-alt',
                      label: 'Delete',
                      color: colors.danger,
                      onPress: (item) => handleDeleteProduct(item.id)
                    },
                  ]}
                />
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Buyer Detail Modal */}
      <Modal
        animationKeyframesType="slide"
        transparent={true}
        visible={buyerModalVisible}
        onRequestClose={() => setBuyerModalVisible(false)}
        presentationStyle="overFullScreen"
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
                <AdminTable
                  columns={[
                    { key: 'id', title: 'Order ID', width: 100, render: (value) => <Text style={styles.cellText}>#{value.substring(0, 8)}</Text> },
                    {
                      key: 'farmer_profile',
                      title: 'Farmer',
                      width: 150,
                      render: (value) => <Text style={styles.cellText}>{value?.first_name} {value?.last_name}</Text>
                    },
                    {
                      key: 'product',
                      title: 'Product',
                      width: 150,
                      render: (value, row) => <Text style={styles.cellText}>{value?.name} ({row.quantity} {value?.unit})</Text>
                    },
                    {
                      key: 'total_price',
                      title: 'Amount',
                      width: 120,
                      render: (value) => <Text style={styles.cellText}>{formatCurrency(value)}</Text>
                    },
                    {
                      key: 'status',
                      title: 'Status',
                      width: 120,
                      render: (value) => (
                        <View style={[styles.statusBadge, {
                          backgroundColor: value === 'delivered' ? colors.success + '20' :
                                         value === 'cancelled' ? colors.danger + '20' :
                                         value === 'ready' ? colors.primary + '20' : colors.warning + '20'
                        }]}>
                          <Text style={{
                            color: value === 'delivered' ? colors.success :
                                   value === 'cancelled' ? colors.danger :
                                   value === 'ready' ? colors.primary : colors.warning,
                            fontSize: 12,
                            fontWeight: '600'
                          }}>{value.toUpperCase()}</Text>
                        </View>
                      )
                    },
                  ]}
                  data={buyerOrders}
                  emptyMessage="No current orders"
                  actions={[
                    {
                      icon: 'eye',
                      label: 'View',
                      color: colors.primary,
                      onPress: (order) => {
                        setBuyerModalVisible(false);
                        router.push(`/admin/orders/${order.id}` as any);
                      }
                    },
                    {
                      icon: 'times',
                      label: 'Cancel',
                      color: colors.danger,
                      show: (order) => !['delivered', 'cancelled'].includes(order.status),
                      onPress: (order) => handleOrderStatusUpdate(order.id, 'cancelled')
                    },
                  ]}
                />
              </View>
            )}

            {buyerDetailTab === 'history' && (
              <View style={styles.tabContent}>
                <AdminTable
                  columns={[
                    { key: 'id', title: 'Order ID', width: 100, render: (value) => <Text style={styles.cellText}>#{value.substring(0, 8)}</Text> },
                    {
                      key: 'farmer_profile',
                      title: 'Farmer',
                      width: 150,
                      render: (value) => <Text style={styles.cellText}>{value?.first_name} {value?.last_name}</Text>
                    },
                    {
                      key: 'product',
                      title: 'Product',
                      width: 150,
                      render: (value, row) => <Text style={styles.cellText}>{value?.name} ({row.quantity} {value?.unit})</Text>
                    },
                    {
                      key: 'total_price',
                      title: 'Amount',
                      width: 120,
                      render: (value) => <Text style={styles.cellText}>{formatCurrency(value)}</Text>
                    },
                    {
                      key: 'status',
                      title: 'Status',
                      width: 120,
                      render: (value) => (
                        <View style={[styles.statusBadge, {
                          backgroundColor: value === 'delivered' ? colors.success + '20' :
                                         value === 'cancelled' ? colors.danger + '20' :
                                         value === 'ready' ? colors.primary + '20' : colors.warning + '20'
                        }]}>
                          <Text style={{
                            color: value === 'delivered' ? colors.success :
                                   value === 'cancelled' ? colors.danger :
                                   value === 'ready' ? colors.primary : colors.warning,
                            fontSize: 12,
                            fontWeight: '600'
                          }}>{value.toUpperCase()}</Text>
                        </View>
                      )
                    },
                    {
                      key: 'created_at',
                      title: 'Date',
                      width: 140,
                      render: (value) => <Text style={styles.cellText}>{formatOrderDate(value)}</Text>
                    },
                  ]}
                  data={buyerHistory}
                  emptyMessage="No purchase history"
                  actions={[
                    {
                      icon: 'eye',
                      label: 'View',
                      color: colors.primary,
                      onPress: (order) => {
                        setBuyerModalVisible(false);
                        router.push(`/admin/orders/${order.id}` as any);
                      }
                    },
                  ]}
                />
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* QR Scanner Modal */}
      <Modal
        animationKeyframesType="slide"
        transparent={false}
        visible={qrScannerVisible}
        onRequestClose={() => setQrScannerVisible(false)}
      >
        <View style={styles.qrScannerContainer}>
          <View style={styles.qrScannerHeader}>
            <TouchableOpacity
              style={styles.qrCloseButton}
              onPress={() => setQrScannerVisible(false)}
            >
              <Icon name="times" size={24} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.qrScannerTitle}>Scan Buyer QR Code</Text>
          </View>

          <View style={styles.qrCameraContainer}>
            {hasPermission === null ? (
              <View style={styles.qrPermissionContainer}>
                <ActivityIndicator size="large" color={colors.white} />
                <Text style={styles.qrPermissionText}>Requesting camera permission...</Text>
              </View>
            ) : hasPermission === false ? (
              <View style={styles.qrPermissionContainer}>
                <Icon name="camera" size={48} color={colors.white} />
                <Text style={styles.qrPermissionText}>Camera permission is required to scan QR codes</Text>
                <TouchableOpacity
                  style={styles.qrPermissionButton}
                  onPress={async () => {
                    if (Camera && (Platform.OS === 'ios' || Platform.OS === 'android')) {
                      try {
                        const permission = await Camera.requestCameraPermission();
                        setHasPermission(permission === 'authorized');
                      } catch (error) {
                        console.warn('Camera permission error:', error);
                      }
                    }
                  }}
                >
                  <Text style={styles.qrPermissionButtonText}>Grant Permission</Text>
                </TouchableOpacity>
              </View>
            ) : device == null ? (
              <View style={styles.qrPermissionContainer}>
                <Icon name="camera" size={48} color={colors.white} />
                <Text style={styles.qrPermissionText}>No camera available</Text>
              </View>
            ) : (
              <>
                {Camera && (Platform.OS === 'ios' || Platform.OS === 'android') ? (
                  <Camera
                    style={styles.camera}
                    device={device}
                    isActive={qrScannerVisible}
                    codeScanner={codeScanner}
                  />
                ) : (
                  <View style={styles.qrPermissionContainer}>
                    <Icon name="camera" size={48} color={colors.white} />
                    <Text style={styles.qrPermissionText}>QR Scanner not available on web platform</Text>
                  </View>
                )}

                <View style={styles.qrOverlay}>
                  <View style={styles.qrFrame} />
                  <Text style={styles.qrInstructions}>
                    Position the QR code within the frame
                  </Text>
                  {!isScanning && (
                    <TouchableOpacity
                      style={styles.qrRescanButton}
                      onPress={() => setIsScanning(true)}
                    >
                      <Icon name="redo" size={20} color={colors.white} />
                      <Text style={styles.qrRescanButtonText}>Scan Again</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Order Processing Modal */}
      <Modal
        animationKeyframesType="slide"
        transparent={true}
        visible={orderProcessingVisible}
        onRequestClose={() => setOrderProcessingVisible(false)}
      >
        <View style={styles.orderProcessingOverlay}>
          <View style={styles.orderProcessingContainer}>
            <View style={styles.orderProcessingHeader}>
              <Text style={styles.orderProcessingTitle}>Process Order</Text>
              <TouchableOpacity
                style={styles.orderCloseButton}
                onPress={() => setOrderProcessingVisible(false)}
              >
                <Icon name="times" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {scannedOrderData && (
              <ScrollView style={styles.orderDetailsContainer}>
                {/* Buyer Information */}
                <View style={styles.orderInfoSection}>
                  <Text style={styles.orderSectionTitle}>Buyer Information</Text>
                  <View style={styles.orderInfoRow}>
                    <Icon name="user" size={16} color={colors.primary} />
                    <Text style={styles.orderInfoText}>
                      {scannedOrderData.buyerName || 'Unknown Buyer'}
                    </Text>
                  </View>
                  <View style={styles.orderInfoRow}>
                    <Icon name="phone" size={16} color={colors.primary} />
                    <Text style={styles.orderInfoText}>
                      {scannedOrderData.buyer_profile?.phone || 'No phone'}
                    </Text>
                  </View>
                  <View style={styles.orderInfoRow}>
                    <Icon name="map-marker-alt" size={16} color={colors.primary} />
                    <Text style={styles.orderInfoText}>
                      {scannedOrderData.buyer_profile?.barangay || 'No location'}
                    </Text>
                  </View>
                </View>

                {/* Order Details */}
                <View style={styles.orderInfoSection}>
                  <Text style={styles.orderSectionTitle}>Order Details</Text>
                  <View style={styles.orderInfoRow}>
                    <Icon name="leaf" size={16} color={colors.primary} />
                    <Text style={styles.orderInfoText}>
                      {scannedOrderData.product?.name || 'Unknown Product'}
                    </Text>
                  </View>
                  <View style={styles.orderInfoRow}>
                    <Icon name="shopping-bag" size={16} color={colors.primary} />
                    <Text style={styles.orderInfoText}>
                      Quantity: {scannedOrderData.quantity} {scannedOrderData.product?.unit || 'units'}
                    </Text>
                  </View>
                  <View style={styles.orderInfoRow}>
                    <Icon name="peso-sign" size={16} color={colors.primary} />
                    <Text style={styles.orderInfoText}>
                      Total: ₱{scannedOrderData.total_price?.toFixed(2) || '0.00'}
                    </Text>
                  </View>
                  <View style={styles.orderInfoRow}>
                    <Icon name="clock" size={16} color={colors.primary} />
                    <Text style={styles.orderInfoText}>
                      Status: {scannedOrderData.status}
                    </Text>
                  </View>
                </View>

                {/* Farmer Information */}
                <View style={styles.orderInfoSection}>
                  <Text style={styles.orderSectionTitle}>Farmer Information</Text>
                  <View style={styles.orderInfoRow}>
                    <Icon name="seedling" size={16} color={colors.primary} />
                    <Text style={styles.orderInfoText}>
                      {scannedOrderData.farmerName || 'Unknown Farmer'}
                    </Text>
                  </View>
                  <View style={styles.orderInfoRow}>
                    <Icon name="store" size={16} color={colors.primary} />
                    <Text style={styles.orderInfoText}>
                      {scannedOrderData.farmer_profile?.farm_name || 'No farm name'}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* Action Buttons */}
            <View style={styles.orderActionButtons}>
              <TouchableOpacity
                style={[styles.orderActionButton, styles.completeButton]}
                onPress={() => handleOrderAction('complete')}
              >
                <Icon name="check" size={16} color={colors.white} />
                <Text style={styles.orderActionButtonText}>Complete Transaction</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.orderActionButton, styles.cancelButton]}
                onPress={() => handleOrderAction('cancel')}
              >
                <Icon name="times" size={16} color={colors.white} />
                <Text style={styles.orderActionButtonText}>Cancel Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Order QR Scanner */}
      <OrderQRScanner
        visible={qrScannerVisible}
        onClose={() => setQrScannerVisible(false)}
        onOrderScanned={(orderData) => {
          setScannedOrderData(orderData);
          setQrScannerVisible(false);
          setOrderProcessingVisible(true);
        }}
      />

      {/* Order Verification Modal */}
      <OrderVerificationModal
        visible={orderProcessingVisible}
        orderData={scannedOrderData}
        onClose={() => {
          setOrderProcessingVisible(false);
          setScannedOrderData(null);
        }}
        onOrderCompleted={() => {
          // Refresh user data if needed
          onRefresh();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerComponentWrapper: {
    zIndex: 100,
    elevation: 100,
    backgroundColor: colors.background,
    position: 'relative',
  },
  content: {
    flex: 1,
    position: 'relative',
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
  titleWithButton: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleContent: {
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, header: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statWithButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statContent: {
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
    backgroundColor: 'rgba(248, 250, 252, 0.8)',
    borderRadius: 20,
    padding: 6,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    flex: screenWidth < 400 ? 1 : 0,
    minWidth: screenWidth < 400 ? '100%' : 'auto',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: screenWidth < 400 ? 10 : 14,
    paddingHorizontal: screenWidth < 400 ? 8 : 16,
    borderRadius: 12,
    gap: screenWidth < 400 ? 4 : 8,
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
    fontSize: screenWidth < 400 ? 13 : 15,
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  createUserCircleButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  qrScannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 8,
    elevation: 2,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginRight: 8,
  },
  qrScannerButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  listContainer: {
    paddingHorizontal: screenWidth < 600 ? 16 : 16,
    paddingBottom: 20,
    alignItems: screenWidth < 600 ? 'stretch' : 'center',
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
    width: screenWidth < 600 ? '100%' : (screenWidth - 48) / 2,
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
  badgeContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
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
  approvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  approvedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
    backgroundColor: colors.white,
    zIndex: 1000,
    elevation: 1000,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    backgroundColor: colors.primary,
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
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
  },
  modalSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
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
    backgroundColor: '#f5f5f5',
  },
  tabContent: {
    padding: 0,
    alignItems: 'center',
    width: '100%',
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
    marginBottom: 20,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
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
    backgroundColor: '#f8f9fa',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  userTypeSelection: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  userTypeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    gap: 8,
  },
  userTypeOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  userTypeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  userTypeOptionTextActive: {
    color: colors.white,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    paddingTop: 0,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: colors.primary,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
    elevation: 0,
    shadowOpacity: 0,
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

  qrScannerContainer: {
    flex: 1,
    backgroundColor: colors.text,
  },
  qrScannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 50,
    backgroundColor: colors.text,
  },
  qrCloseButton: {
    padding: 8,
  },
  qrScannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    flex: 1,
    textAlign: 'center',
    marginRight: 40,
  },
  qrCameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  qrOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  qrInstructions: {
    fontSize: 16,
    color: colors.white,
    textAlign: 'center',
    marginTop: 30,
    paddingHorizontal: 40,
  },
  qrPermissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  qrPermissionText: {
    fontSize: 16,
    color: colors.white,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 24,
  },
  qrPermissionButton: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 30,
  },
  qrPermissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  qrRescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginTop: 30,
    gap: 8,
  },
  qrRescanButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },

  // Order Processing Modal Styles
  orderProcessingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  orderProcessingContainer: {
    backgroundColor: colors.white,
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    elevation: 10,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  orderProcessingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  orderProcessingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  orderCloseButton: {
    padding: 8,
  },
  orderDetailsContainer: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  orderInfoSection: {
    marginVertical: 16,
  },
  orderSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  orderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  orderInfoText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  orderActionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  completeButton: {
    backgroundColor: colors.success,
  },
  cancelButton: {
    backgroundColor: colors.danger,
  },
  orderActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  // Enhanced Header Styles
  enhancedHeaderFixed: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    marginHorizontal: 16,
    elevation: 5,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    overflow: 'hidden',
    zIndex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenWidth < 400 ? 12 : 20,
    paddingTop: screenWidth < 400 ? 12 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    flexWrap: 'wrap',
    gap: 12,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  cellText: {
    fontSize: 14,
    color: colors.text,
  },
  // Floating Action Button Widget
  fabWidget: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'column',
    gap: 10,
    zIndex: 1000,
    elevation: 8,
  },
  fabButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});