import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
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

const { width, height } = Dimensions.get('window');

// Responsive breakpoints
const isTablet = width >= 768;
const isDesktop = width >= 1024;
const isWeb = Platform.OS === 'web';

type Profile = Database['public']['Tables']['profiles']['Row'];

// Database response types
interface DatabaseOrder {
  id: string;
  buyer_id: string;
  farmer_id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  status: string;
  delivery_address: string;
  notes: string | null;
  created_at: string;
  products: {
    name: string;
    unit: string;
    price: number;
  } | null;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    company_name: string | null;
  } | null;
}

interface Order {
  id: string;
  buyer_id: string;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled';
  created_at: string;
  delivery_date: string | null;
  delivery_address: string | null;
  notes: string | null;
  buyer_profile?: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    company_name: string | null;
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
  { key: 'all', label: 'All Orders', color: '#6b7280' },
  { key: 'pending', label: 'Pending', color: '#f59e0b' },
  { key: 'confirmed', label: 'Confirmed', color: '#3b82f6' },
  { key: 'processing', label: 'Processing', color: '#8b5cf6' },
  { key: 'ready', label: 'Ready', color: '#10b981' },
  { key: 'delivered', label: 'Delivered', color: '#059669' },
  { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
];

export default function FarmerOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, selectedStatus, searchQuery]);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      if (!userData?.profile) {
        router.replace('/auth/login');
        return;
      }

      setProfile(userData.profile);
      await loadOrders(userData.user.id);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (farmerId: string) => {
    try {
      // Get orders directly for this farmer with product and buyer information
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          buyer_id,
          farmer_id,
          product_id,
          quantity,
          total_price,
          status,
          delivery_address,
          notes,
          created_at,
          products (
            name,
            unit,
            price
          ),
          profiles!orders_buyer_id_fkey (
            first_name,
            last_name,
            phone,
            company_name
          )
        `)
        .eq('farmer_id', farmerId);

      if (ordersError) throw ordersError;

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      // Transform orders into the expected format
      const ordersWithItems: Order[] = ordersData.map(order => ({
        id: order.id,
        buyer_id: order.buyer_id,
        total_amount: order.total_price,
        status: order.status as Order['status'],
        created_at: order.created_at,
        delivery_date: null, // Not in current schema
        delivery_address: order.delivery_address,
        notes: order.notes,
        buyer_profile: order.profiles ? {
          first_name: order.profiles.first_name,
          last_name: order.profiles.last_name,
          phone: order.profiles.phone,
          company_name: order.profiles.company_name,
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

      setOrders(ordersWithItems);
    } catch (error) {
      console.error('Error loading orders:', error);
      throw error;
    }
  };

  const filterOrders = () => {
    let filtered = orders;

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(order => order.status === selectedStatus);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(order => {
        const searchLower = searchQuery.toLowerCase();
        const orderId = order.id.slice(-8).toLowerCase();
        const buyerName = (order.buyer_profile?.company_name ||
          `${order.buyer_profile?.first_name || ''} ${order.buyer_profile?.last_name || ''}`.trim() ||
          'unknown buyer').toLowerCase();
        const phone = order.buyer_profile?.phone?.toLowerCase() || '';
        const address = order.delivery_address?.toLowerCase() || '';
        const notes = order.notes?.toLowerCase() || '';

        return orderId.includes(searchLower) ||
               buyerName.includes(searchLower) ||
               phone.includes(searchLower) ||
               address.includes(searchLower) ||
               notes.includes(searchLower);
      });
    }

    setFilteredOrders(filtered);
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

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const { error } = await (supabase as any)
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // Update local state
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      Alert.alert('Success', 'Order status updated successfully');
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
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

  const getStatusColor = (status: string) => {
    const statusObj = ORDER_STATUSES.find(s => s.key === status);
    return statusObj?.color || '#6b7280';
  };

  const getOrderStats = () => {
    const pending = orders.filter(o => o.status === 'pending').length;
    const processing = orders.filter(o => o.status === 'processing').length;
    const ready = orders.filter(o => o.status === 'ready').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const totalRevenue = orders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + o.total_amount, 0);

    return { pending, processing, ready, delivered, totalRevenue };
  };

  const renderOrderCard = ({ item: order, isCompact = false }: { item: Order; isCompact?: boolean }) => {
    const statusColor = getStatusColor(order.status);
    
    return (
      <View style={[
        styles.orderCard,
        isDesktop && styles.orderCardDesktop,
        isCompact && styles.orderCardCompact
      ]}>
        <View style={[
          styles.orderHeader,
          isDesktop && styles.orderHeaderDesktop
        ]}>
          <View style={styles.orderMainInfo}>
            <Text style={[
              styles.orderId,
              isCompact && styles.orderIdCompact
            ]}>Order #{order.id.slice(-8)}</Text>
            <Text style={[
              styles.orderDate,
              isCompact && styles.orderDateCompact
            ]}>{formatDate(order.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>
              {order.status === 'pending' ? 'NEW' :
               order.status === 'confirmed' ? 'CONFIRMED' :
               order.status === 'processing' ? 'PROCESSING' :
               order.status === 'ready' ? 'READY' :
               order.status === 'delivered' ? 'DELIVERED' : 'CANCELLED'}
            </Text>
          </View>
        </View>

        <View style={[
          styles.buyerSection,
          isDesktop && styles.buyerSectionDesktop
        ]}>
          <Text style={[
            styles.buyerName,
            isCompact && styles.buyerNameCompact
          ]}>
            {order.buyer_profile?.company_name ||
             `${order.buyer_profile?.first_name || ''} ${order.buyer_profile?.last_name || ''}`.trim() ||
             'Unknown Buyer'}
          </Text>
          {order.buyer_profile?.phone && (
            <View style={styles.buyerPhoneContainer}>
              <Icon name="phone" size={12} color="#64748b" style={{marginRight: 6}} />
              <Text style={[
                styles.buyerPhone,
                isCompact && styles.buyerPhoneCompact
              ]}>{order.buyer_profile.phone}</Text>
            </View>
          )}
        </View>

        <View style={[
          styles.orderDetails,
          isDesktop && styles.orderDetailsDesktop
        ]}>
          <View style={styles.orderItems}>
            <Text style={[
              styles.itemsTitle,
              isCompact && styles.itemsTitleCompact
            ]}>Items Ordered:</Text>
            {order.order_items?.map((item, index) => (
              <View key={index} style={[
                styles.orderItem,
                isCompact && styles.orderItemCompact
              ]}>
                <Text style={[
                  styles.itemQuantity,
                  isCompact && styles.itemQuantityCompact
                ]}>{item.quantity} {item.product.unit}</Text>
                <Text style={[
                  styles.itemName,
                  isCompact && styles.itemNameCompact
                ]}>{item.product.name}</Text>
                <Text style={[
                  styles.itemPrice,
                  isCompact && styles.itemPriceCompact
                ]}>{formatPrice(item.unit_price)}</Text>
              </View>
            )) || null}
          </View>

          <View style={[
            styles.orderAmount,
            isCompact && styles.orderAmountCompact
          ]}>
            <Text style={[
              styles.amountLabel,
              isCompact && styles.amountLabelCompact
            ]}>Total Amount</Text>
            <Text style={[
              styles.amountValue,
              isCompact && styles.amountValueCompact
            ]}>{formatPrice(order.total_amount)}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={[
          styles.actionSection,
          isDesktop && styles.actionSectionDesktop
        ]}>
          {order.status === 'pending' && (
            <View style={[
              styles.actionButtons,
              isDesktop && styles.actionButtonsDesktop
            ]}>
              <TouchableOpacity
                style={[styles.actionButton, styles.confirmButton]}
                onPress={() => updateOrderStatus(order.id, 'confirmed')}
                activeOpacity={0.8}
              >
                <View style={styles.actionButtonContent}>
                <Icon name="check" size={14} color="#ffffff" style={{marginRight: 6}} />
                <Text style={styles.actionButtonText}>Accept</Text>
              </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => updateOrderStatus(order.id, 'cancelled')}
                activeOpacity={0.8}
              >
                <View style={styles.actionButtonContent}>
                  <Icon name="times" size={14} color="#ffffff" style={{marginRight: 6}} />
                  <Text style={styles.actionButtonText}>Decline</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {order.status === 'confirmed' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.processingButton]}
              onPress={() => updateOrderStatus(order.id, 'processing')}
              activeOpacity={0.8}
            >
              <View style={styles.actionButtonContent}>
                <Icon name="utensils" size={14} color="#ffffff" style={{marginRight: 6}} />
                <Text style={styles.actionButtonText}>Start Preparing</Text>
              </View>
            </TouchableOpacity>
          )}

          {order.status === 'processing' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.readyButton]}
              onPress={() => updateOrderStatus(order.id, 'ready')}
              activeOpacity={0.8}
            >
              <View style={styles.actionButtonContent}>
                <Icon name="check-circle" size={14} color="#ffffff" style={{marginRight: 6}} />
                <Text style={styles.actionButtonText}>Mark Ready</Text>
              </View>
            </TouchableOpacity>
          )}

          {order.status === 'ready' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => updateOrderStatus(order.id, 'delivered')}
              activeOpacity={0.8}
            >
              <View style={styles.actionButtonContent}>
                <Icon name="truck" size={14} color="#ffffff" style={{marginRight: 6}} />
                <Text style={styles.actionButtonText}>Complete Delivery</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Additional Info */}
        {order.delivery_address && (
          <View style={styles.additionalInfo}>
            <View style={styles.infoRow}>
              <Icon name="map-marker-alt" size={16} color="#64748b" style={styles.infoIcon} />
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
              <Icon name="file-text" size={16} color="#64748b" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Special Notes</Text>
                <Text style={styles.infoText}>{order.notes}</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={[
      styles.emptyContainer,
      isDesktop && styles.emptyContainerDesktop
    ]}>
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyIconContainer}>
          <Icon name="file-text" size={60} color="#10b981" />
        </View>
      </View>
      
      <Text style={styles.emptyTitle}>No Orders Found</Text>
      <Text style={styles.emptyDescription}>
        {selectedStatus === 'all'
          ? 'You haven\'t received any orders yet. Keep your products updated to attract buyers!'
          : `No ${selectedStatus} orders at the moment.`}
      </Text>

      {selectedStatus === 'all' && (
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/farmer/products/add')}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaIcon}>+</Text>
          <Text style={styles.ctaText}>Add Products</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const stats = getOrderStats();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading orders dashboard...</Text>
      </View>
    );
  }

  // Desktop Layout
  if (isDesktop) {
    return (
      <View style={styles.container}>
        <HeaderComponent
          profile={profile}
          showSearch={true}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search orders..."
          showAddButton={true}
          addButtonText="+ Add Product"
          addButtonRoute="/farmer/products/add"
        />

        <View style={styles.desktopLayout}>
          {/* Left Sidebar */}
          <View style={styles.sidebar}>
            {/* Stats */}
           

            {/* Filter */}
            <View style={styles.sidebarSection}>
              <Text style={styles.sidebarTitle}>Filter Orders</Text>
              <View style={styles.sidebarFilters}>
                {ORDER_STATUSES.map((status) => (
                  <TouchableOpacity
                    key={status.key}
                    style={[
                      styles.sidebarFilterButton,
                      selectedStatus === status.key && [
                        styles.sidebarFilterButtonActive,
                        { backgroundColor: status.color }
                      ]
                    ]}
                    onPress={() => setSelectedStatus(status.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.sidebarFilterText,
                      selectedStatus === status.key && styles.sidebarFilterTextActive
                    ]}>
                      {status.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            <View style={styles.mainHeader}>
              <Text style={styles.mainTitle}>
                Orders {filteredOrders.length > 0 && `(${filteredOrders.length})`}
              </Text>
            </View>

            <ScrollView
              style={styles.ordersScrollView}
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
              {filteredOrders.length === 0 ? (
                renderEmptyState()
              ) : (
                <View style={styles.ordersGrid}>
                  {filteredOrders.map((order) => (
                    <View key={order.id} style={styles.orderGridItem}>
                      {renderOrderCard({ item: order, isCompact: true })}
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    );
  }

  // Mobile/Tablet Layout
  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        showSearch={true}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search orders..."
        showAddButton={true}
        addButtonText="+ Add Product"
        addButtonRoute="/farmer/products/add"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.scrollContentTablet
        ]}
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
       

        {/* Filter */}
        <View style={[
          styles.filterSection,
          isTablet && styles.filterSectionTablet
        ]}>
          <Text style={styles.sectionTitle}>Filter Orders</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.filterContainer,
              isTablet && styles.filterContainerTablet
            ]}
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

        {/* Orders */}
        <View style={[
          styles.ordersSection,
          isTablet && styles.ordersSectionTablet
        ]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Orders {filteredOrders.length > 0 && `(${filteredOrders.length})`}
            </Text>
          </View>

          {filteredOrders.length === 0 ? (
            renderEmptyState()
          ) : (
            <View style={[
              styles.ordersList,
              isTablet && styles.ordersListTablet
            ]}>
              {filteredOrders.map((order) => (
                <View key={order.id}>
                  {renderOrderCard({ item: order })}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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

  // Desktop Layout
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
    maxWidth: 1400,
    alignSelf: 'center',
    width: '100%',
  },

  sidebar: {
    width: 320,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    padding: 24,
  },

  sidebarSection: {
    marginBottom: 32,
  },

  sidebarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },

  sidebarStats: {
    gap: 12,
  },

  revenueCard: {
    marginTop: 16,
  },

  sidebarFilters: {
    gap: 8,
  },

  sidebarFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  sidebarFilterButtonActive: {
    borderColor: 'transparent',
  },

  sidebarFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },

  sidebarFilterTextActive: {
    color: '#ffffff',
  },

  mainContent: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },

  mainHeader: {
    padding: 24,
    paddingBottom: 0,
  },

  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },

  ordersScrollView: {
    flex: 1,
    padding: 24,
  },

  ordersGrid: {
    gap: 20,
  },

  orderGridItem: {
    marginBottom: 0,
  },

  // Mobile/Tablet Scroll Layout
  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 40,
  },

  scrollContentTablet: {
    paddingHorizontal: 40,
  },

  // Section Styles
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

  statsSectionTablet: {
    paddingHorizontal: 0,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },

  statsGridTablet: {
    justifyContent: 'space-between',
  },

  // Filter Section
  filterSection: {
    paddingHorizontal: 20,
    marginBottom: 36,
  },

  filterSectionTablet: {
    paddingHorizontal: 0,
  },

  filterContainer: {
    paddingRight: 20,
    gap: 12,
  },

  filterContainerTablet: {
    paddingRight: 0,
    flexWrap: 'wrap',
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

  ordersSectionTablet: {
    paddingHorizontal: 0,
  },

  sectionHeader: {
    marginBottom: 24,
  },

  ordersList: {
    gap: 20,
  },

  ordersListTablet: {
    gap: 24,
  },

  // Order Card Styles
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

  orderCardDesktop: {
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },

  orderCardCompact: {
    padding: 16,
    borderRadius: 12,
  },

  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },

  orderHeaderDesktop: {
    marginBottom: 16,
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

  orderIdCompact: {
    fontSize: 18,
    lineHeight: 22,
  },

  orderDate: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  orderDateCompact: {
    fontSize: 12,
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

  buyerSection: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },

  buyerSectionDesktop: {
    padding: 12,
    marginBottom: 16,
  },

  buyerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },

  buyerNameCompact: {
    fontSize: 16,
    marginBottom: 4,
  },

  buyerPhone: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  buyerPhoneCompact: {
    fontSize: 12,
  },

  orderDetails: {
    marginBottom: 20,
  },

  orderDetailsDesktop: {
    marginBottom: 16,
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

  itemsTitleCompact: {
    fontSize: 14,
    marginBottom: 8,
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

  orderItemCompact: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
  },

  itemQuantity: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
    width: 80,
  },

  itemQuantityCompact: {
    fontSize: 12,
    width: 60,
  },

  itemName: {
    fontSize: 14,
    color: '#0f172a',
    flex: 1,
    fontWeight: '500',
  },

  itemNameCompact: {
    fontSize: 12,
  },

  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  itemPriceCompact: {
    fontSize: 12,
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

  orderAmountCompact: {
    padding: 12,
  },

  amountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },

  amountLabelCompact: {
    fontSize: 14,
  },

  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
  },

  amountValueCompact: {
    fontSize: 18,
  },

  actionSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },

  actionSectionDesktop: {
    marginTop: 16,
    paddingTop: 16,
  },

  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },

  actionButtonsDesktop: {
    gap: 8,
  },

  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  confirmButton: {
    backgroundColor: '#3b82f6',
  },

  cancelButton: {
    backgroundColor: '#dc2626',
  },

  processingButton: {
    backgroundColor: '#8b5cf6',
  },

  readyButton: {
    backgroundColor: '#10b981',
  },

  completeButton: {
    backgroundColor: '#059669',
  },

  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  buyerPhoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

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

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },

  emptyContainerDesktop: {
    paddingVertical: 80,
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