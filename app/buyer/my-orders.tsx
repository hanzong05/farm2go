import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import HeaderComponent from '../../components/HeaderComponent';
import OrderQRCodeModal from '../../components/OrderQRCodeModal';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

const { width } = Dimensions.get('window');

type Profile = Database['public']['Tables']['profiles']['Row'];

// Database response types
interface DatabaseOrderItem {
  order_id: string;
  quantity: number;
  unit_price: number;
  products: {
    farmer_id: string;
    name: string;
    unit: string;
  } | null;
}

interface DatabaseOrder {
  id: string;
  buyer_id: string;
  farmer_id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  delivery_address: string;
  notes: string | null;
  products: {
    name: string;
    unit: string;
    price: number;
  } | null;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    farm_name: string | null;
    barangay: string | null;
  } | null;
}

interface Order {
  id: string;
  buyer_id: string;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  created_at: string;
  delivery_date: string | null;
  delivery_address: string | null;
  notes: string | null;
  purchase_code?: string;
  farmer_profile?: {
    first_name: string | null;
    last_name: string | null;
    farm_name: string | null;
    barangay: string | null;
  };
  order_items?: Array<{
    order_id: string;
    quantity: number;
    unit_price: number;
    product: {
      name: string;
      unit: string;
    };
  }>;
}

const ORDER_STATUSES = [
  { key: 'all', label: 'All Orders', color: '#6b7280', bgColor: '#f3f4f6' },
  { key: 'pending', label: 'Pending', color: '#f59e0b', bgColor: '#fffbeb' },
  { key: 'confirmed', label: 'Confirmed', color: '#3b82f6', bgColor: '#eff6ff' },
  { key: 'preparing', label: 'Preparing', color: '#8b5cf6', bgColor: '#f3f0ff' },
  { key: 'ready', label: 'Ready', color: '#10b981', bgColor: '#ecfdf5' },
  { key: 'completed', label: 'Completed', color: '#059669', bgColor: '#ecfdf5' },
  { key: 'cancelled', label: 'Cancelled', color: '#dc2626', bgColor: '#fef2f2' },
];

export default function BuyerMyOrdersScreen() {
  const navigation = useNavigation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    loadData();
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, selectedStatus]);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      console.log('User data:', userData);

      if (!userData?.profile) {
        console.log('No user profile found, redirecting to login');
        navigation.navigate('Login' as never);
        return;
      }

      console.log('Setting profile and loading orders for user:', userData.user.id);
      setProfile(userData.profile);
      await loadOrders(userData.user.id);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (buyerId: string) => {
    try {
      // Get orders for this buyer with product and farmer info
      const { data: ordersData, error: ordersError } = await (supabase as any)
        .from('orders')
        .select(`
          id,
          buyer_id,
          quantity,
          total_price,
          status,
          created_at,
          delivery_address,
          notes,
          products (
            name,
            unit,
            price
          ),
          profiles:farmer_id (
            first_name,
            last_name,
            farm_name,
            barangay
          )
        `)
        .eq('buyer_id', buyerId)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Orders query error:', ordersError);
        throw ordersError;
      }

      console.log('Orders data:', ordersData);

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      // Transform the data to match the expected structure
      const orders: Order[] = ordersData.map((order: any) => ({
        id: order.id,
        buyer_id: order.buyer_id,
        total_amount: order.total_price, // Map total_price to total_amount for UI consistency
        status: order.status as Order['status'],
        created_at: order.created_at,
        delivery_date: null, // Not in current schema
        delivery_address: order.delivery_address,
        notes: order.notes,
        purchase_code: null, // Temporarily set to null until column exists
        farmer_profile: order.profiles ? {
          first_name: order.profiles.first_name,
          last_name: order.profiles.last_name,
          farm_name: order.profiles.farm_name,
          barangay: order.profiles.barangay,
        } : undefined,
        order_items: [{
          order_id: order.id,
          quantity: order.quantity,
          unit_price: order.products?.price || 0,
          product: {
            name: order.products?.name || '',
            unit: order.products?.unit || '',
          },
        }],
      }));

      setOrders(orders);
    } catch (error) {
      console.error('Error loading orders:', error);
      throw error;
    }
  };

  const filterOrders = () => {
    if (selectedStatus === 'all') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter(order => order.status === selectedStatus));
    }
  };

  const onRefresh = async () => {
    if (!profile) return;
    setRefreshing(true);
    try {
      const userData = await getUserWithProfile();
      if (userData?.user) {
        await loadOrders(userData.user.id);
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(price);
  };

  const getStatusConfig = (status: string) => {
    const statusObj = ORDER_STATUSES.find(s => s.key === status);
    return statusObj || { color: '#6b7280', bgColor: '#f3f4f6' };
  };

  const getOrderStats = () => {
    const pending = orders.filter(o => o.status === 'pending').length;
    const active = orders.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status)).length;
    const completed = orders.filter(o => o.status === 'completed').length;
    const totalSpent = orders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + o.total_amount, 0);

    return { pending, active, completed, totalSpent };
  };

  const handleShowQRCode = (order: Order) => {
    setSelectedOrder(order);
    setShowQRModal(true);
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setSelectedOrder(null);
  };

  const renderStatsCard = (title: string, value: string | number, icon: string, color: string) => (
    <View style={[styles.statsCard, { borderLeftColor: color }]}>
      <View style={styles.statsContent}>
        <View style={[styles.statsIcon, { backgroundColor: color + '20' }]}>
          <Text style={styles.statsIconText}>{icon}</Text>
        </View>
        <View style={styles.statsInfo}>
          <Text style={styles.statsValue}>{value}</Text>
          <Text style={styles.statsTitle}>{title}</Text>
        </View>
      </View>
    </View>
  );

  const renderOrderCard = ({ item: order }: { item: Order }) => {
    const statusConfig = getStatusConfig(order.status);
    
    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderMainInfo}>
            <Text style={styles.orderId}>Order #{order.id.slice(-8)}</Text>
            <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
            <Text style={styles.statusText}>
              {order.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={[styles.farmerSection, { backgroundColor: statusConfig.bgColor }]}>
          <Text style={styles.farmerIcon}>🏡</Text>
          <View style={styles.farmerInfo}>
            <Text style={styles.farmerName}>
              {order.farmer_profile?.farm_name ||
               `${order.farmer_profile?.first_name || ''} ${order.farmer_profile?.last_name || ''}`.trim() ||
               'Farm'}
            </Text>
            {order.farmer_profile?.barangay && (
              <Text style={styles.farmerLocation}>{order.farmer_profile.barangay}</Text>
            )}
          </View>
          <View style={[styles.verifiedBadge, { backgroundColor: statusConfig.color }]}>
            <Text style={styles.verifiedText}>✓</Text>
          </View>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.orderItems}>
            <Text style={styles.itemsTitle}>Items Ordered</Text>
            {order.order_items?.map((item, index) => (
              <View key={index} style={styles.orderItem}>
                <View style={[styles.itemQuantityBadge, { backgroundColor: statusConfig.color }]}>
                  <Text style={styles.itemQuantity}>{item.quantity}</Text>
                  <Text style={styles.itemUnit}>{item.product.unit}</Text>
                </View>
                <Text style={styles.itemName}>{item.product.name}</Text>
                <Text style={styles.itemPrice}>{formatPrice(item.unit_price)}</Text>
              </View>
            )) || null}
          </View>

          <View style={styles.orderAmount}>
            <View style={styles.amountContent}>
              <Text style={styles.amountLabel}>Total Amount</Text>
              <Text style={styles.amountValue}>{formatPrice(order.total_amount)}</Text>
            </View>
            <Text style={styles.amountIcon}>💰</Text>
          </View>
        </View>

        {/* Status Timeline */}
        <View style={styles.statusTimeline}>
          <Text style={styles.timelineTitle}>Order Progress</Text>
          <View style={styles.timelineContainer}>
            {['pending', 'confirmed', 'preparing', 'ready', 'completed'].map((status, index) => {
              const isActive = ['pending', 'confirmed', 'preparing', 'ready', 'completed'].indexOf(order.status) >= index;
              const isCurrent = order.status === status;
              
              return (
                <View key={status} style={styles.timelineStep}>
                  <View style={[
                    styles.timelineNode,
                    isActive && [styles.timelineNodeActive, { backgroundColor: statusConfig.color }],
                    isCurrent && [styles.timelineNodeCurrent, { borderColor: statusConfig.color }]
                  ]}>
                    <Text style={[
                      styles.timelineNodeText,
                      isActive && styles.timelineNodeTextActive
                    ]}>
                      {index + 1}
                    </Text>
                  </View>
                  {index < 4 && (
                    <View style={[
                      styles.timelineLine,
                      isActive && [styles.timelineLineActive, { backgroundColor: statusConfig.color }]
                    ]} />
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.timelineLabels}>
            <Text style={styles.timelineLabel}>Placed</Text>
            <Text style={styles.timelineLabel}>Confirmed</Text>
            <Text style={styles.timelineLabel}>Preparing</Text>
            <Text style={styles.timelineLabel}>Ready</Text>
            <Text style={styles.timelineLabel}>Completed</Text>
          </View>
        </View>

        {/* Additional Info */}
        {order.delivery_address && (
          <View style={styles.additionalInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📍</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Delivery Address</Text>
                <Text style={styles.infoText}>{order.delivery_address}</Text>
              </View>
            </View>
          </View>
        )}

        {order.notes && (
          <View style={styles.additionalInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📝</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Notes</Text>
                <Text style={styles.infoText}>{order.notes}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.qrButton, { backgroundColor: statusConfig.color }]}
            onPress={() => handleShowQRCode(order)}
            activeOpacity={0.8}
          >
            <Text style={styles.qrButtonIcon}>📱</Text>
            <Text style={styles.qrButtonText}>Show QR Code</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyIconContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
        </View>
      </View>
      
      <Text style={styles.emptyTitle}>No Orders Yet</Text>
      <Text style={styles.emptyDescription}>
        {selectedStatus === 'all'
          ? 'Start shopping to see your orders here. Browse fresh products from local farmers!'
          : `No ${selectedStatus} orders at the moment.`}
      </Text>

      {selectedStatus === 'all' && (
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => navigation.navigate('Marketplace' as never)}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaIcon}>🛒</Text>
          <Text style={styles.ctaText}>Start Shopping</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const stats = getOrderStats();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading your orders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        showSearch={true}
        searchPlaceholder="Search your orders..."
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
            colors={['#10b981']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.statsGrid}>
            {renderStatsCard('Pending', stats.pending, '⏰', '#f59e0b')}
            {renderStatsCard('Active', stats.active, '🚀', '#3b82f6')}
            {renderStatsCard('Completed', stats.completed, '✅', '#10b981')}
            {renderStatsCard('Total Spent', formatPrice(stats.totalSpent), '💰', '#8b5cf6')}
          </View>
        </View>

        {/* Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.sectionTitle}>Filter Orders</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContainer}
          >
            {ORDER_STATUSES.map((status) => (
              <TouchableOpacity
                key={status.key}
                style={[
                  styles.filterButton,
                  selectedStatus === status.key && [
                    styles.filterButtonActive,
                    { backgroundColor: status.color }
                  ]
                ]}
                onPress={() => setSelectedStatus(status.key)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedStatus === status.key && styles.filterButtonTextActive
                ]}>
                  {status.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Orders List */}
        <View style={styles.ordersSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Your Orders {filteredOrders.length > 0 && `(${filteredOrders.length})`}
            </Text>
          </View>

          {filteredOrders.length === 0 ? (
            renderEmptyState()
          ) : (
            <View style={styles.ordersList}>
              {filteredOrders.map((order, index) => (
                <Animated.View 
                  key={order.id}
                  style={{
                    opacity: fadeAnim,
                    transform: [{
                      translateY: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [30 * (index + 1), 0]
                      })
                    }]
                  }}
                >
                  {renderOrderCard({ item: order })}
                </Animated.View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* QR Code Modal */}
      {selectedOrder && (
        <OrderQRCodeModal
          visible={showQRModal}
          onClose={handleCloseQRModal}
          order={selectedOrder}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Section Titles
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 20,
  },

  // Stats Section
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 36,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statsCard: {
    flex: 1,
    minWidth: (width - 60) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderLeftWidth: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  statsContent: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  statsIconText: {
    fontSize: 20,
  },
  statsInfo: {
    flex: 1,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  statsTitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Filter Section
  filterSection: {
    paddingHorizontal: 20,
    marginBottom: 36,
  },
  filterContainer: {
    paddingRight: 20,
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  filterButtonActive: {
    borderColor: 'transparent',
    elevation: 4,
    shadowOpacity: 0.15,
  },
  filterButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },

  // Orders Section
  ordersSection: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    marginBottom: 24,
  },
  ordersList: {
    gap: 20,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  orderMainInfo: {
    flex: 1,
    marginRight: 16,
  },
  orderId: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6,
    lineHeight: 26,
  },
  orderDate: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  farmerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  farmerIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  farmerInfo: {
    flex: 1,
  },
  farmerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  farmerLocation: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  verifiedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  orderDetails: {
    marginBottom: 20,
  },
  orderItems: {
    marginBottom: 20,
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  itemQuantityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  itemQuantity: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  itemUnit: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '500',
  },
  itemName: {
    fontSize: 14,
    color: '#0f172a',
    flex: 1,
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  orderAmount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  amountContent: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
  },
  amountIcon: {
    fontSize: 24,
  },
  
  // Status Timeline
  statusTimeline: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 16,
  },
  timelineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timelineStep: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  timelineNodeActive: {
    borderColor: '#10b981',
  },
  timelineNodeCurrent: {
    borderWidth: 3,
  },
  timelineNodeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
  },
  timelineNodeTextActive: {
    color: '#ffffff',
  },
  timelineLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
  },
  timelineLineActive: {
    backgroundColor: '#10b981',
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  timelineLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },

  // Additional Info
  additionalInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 12,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },

  // Action Buttons
  actionButtons: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  qrButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  qrButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIllustration: {
    marginBottom: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#bbf7d0',
  },
  emptyIcon: {
    fontSize: 60,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 36,
    paddingVertical: 20,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  ctaIcon: {
    fontSize: 22,
    color: '#ffffff',
    marginRight: 12,
    fontWeight: 'bold',
  },
  ctaText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});