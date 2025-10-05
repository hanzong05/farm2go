import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import ConfirmationModal from '../../components/ConfirmationModal';
import MapDirectionsModal from '../../components/MapDirectionsModal';
import FilterSidebar from '../../components/FilterSidebar';
import HeaderComponent from '../../components/HeaderComponent';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { notifyOrderStatusChange } from '../../services/notifications';
import { subscribeToUserOrders } from '../../services/orders';
import { Database } from '../../types/database';
import { applyFilters } from '../../utils/filterConfigs';

const { width } = Dimensions.get('window');

const isTablet = width >= 768;
const isDesktop = width >= 1024;

type Profile = Database['public']['Tables']['profiles']['Row'];

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
  buyer_profile: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    barangay: string | null;
  } | null;
  farmer_profile: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    farm_name: string | null;
    barangay: string | null;
  } | null;
}

interface Order {
  id: string;
  buyer_id: string;
  farmer_id: string;
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
    barangay: string | null;
  };
  farmer_profile?: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
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

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'processing', label: 'Processing' },
  { key: 'ready', label: 'Ready' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest First' },
  { key: 'oldest', label: 'Oldest First' },
  { key: 'amount-high', label: 'Amount: High to Low' },
  { key: 'amount-low', label: 'Amount: Low to High' },
  { key: 'status', label: 'Status' },
];

export default function AdminOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    isDestructive: boolean;
    confirmText: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    isDestructive: false,
    confirmText: '',
    onConfirm: () => {},
  });

  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapOrder, setMapOrder] = useState<Order | null>(null);

  const [filterState, setFilterState] = useState({
    sortBy: 'newest'
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, selectedStatus, filterState, searchQuery]);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      if (!userData?.profile || userData.profile.user_type !== 'admin') {
        Alert.alert('Access Denied', 'Only admins can access this page');
        router.replace('/');
        return;
      }

      setProfile(userData.profile);
      await loadOrders(userData.profile);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (adminProfile: Profile) => {
    try {
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
          buyer_profile:profiles!orders_buyer_id_fkey (
            first_name,
            last_name,
            phone,
            barangay
          ),
          farmer_profile:profiles!orders_farmer_id_fkey (
            first_name,
            last_name,
            phone,
            farm_name,
            barangay
          )
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Filter orders by admin's barangay
      let filteredData = ordersData || [];
      if (adminProfile.barangay) {
        filteredData = filteredData.filter((order: any) =>
          order.farmer_profile?.barangay === adminProfile.barangay ||
          order.buyer_profile?.barangay === adminProfile.barangay
        );
      }

      if (!filteredData || filteredData.length === 0) {
        setOrders([]);
        return;
      }

      const ordersWithItems: Order[] = filteredData.map((order: any) => ({
        id: order.id,
        buyer_id: order.buyer_id,
        farmer_id: order.farmer_id,
        total_amount: order.total_price,
        status: order.status as Order['status'],
        created_at: order.created_at,
        delivery_date: null,
        delivery_address: order.delivery_address,
        notes: order.notes,
        buyer_profile: order.buyer_profile,
        farmer_profile: order.farmer_profile,
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

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(order => order.status === selectedStatus);
    }

    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(order => {
        const orderId = order.id.slice(-8).toLowerCase();
        const buyerName = (`${order.buyer_profile?.first_name || ''} ${order.buyer_profile?.last_name || ''}`.trim()).toLowerCase();
        const farmerName = (`${order.farmer_profile?.first_name || ''} ${order.farmer_profile?.last_name || ''}`.trim()).toLowerCase();
        const productNames = (order.order_items || []).map(item => item.product.name.toLowerCase()).join(' ');

        return orderId.includes(searchLower) ||
               buyerName.includes(searchLower) ||
               farmerName.includes(searchLower) ||
               productNames.includes(searchLower);
      });
    }

    filtered = applyFilters(filtered, filterState, {
      dateKey: 'created_at',
      amountKey: 'total_amount'
    });

    setFilteredOrders(filtered);
  };

  const onRefresh = async () => {
    if (!profile) return;
    setRefreshing(true);
    try {
      await loadOrders(profile);
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleShowDirections = (order: Order) => {
    if (!order.delivery_address) {
      Alert.alert('No Address', 'This order does not have a delivery address.');
      return;
    }
    setMapOrder(order);
    setShowMapModal(true);
  };

  const handleCloseMapModal = () => {
    setShowMapModal(false);
    setMapOrder(null);
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
    const statusColors = {
      'all': '#6b7280',
      'pending': '#f59e0b',
      'confirmed': '#3b82f6',
      'processing': '#8b5cf6',
      'ready': '#10b981',
      'delivered': '#059669',
      'cancelled': '#dc2626',
    };
    return statusColors[status as keyof typeof statusColors] || '#6b7280';
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilterState(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const getFilterSections = () => {
    return [
      {
        key: 'sortBy',
        title: 'Sort By',
        type: 'sort' as const,
        options: SORT_OPTIONS.map(sort => ({
          key: sort.key,
          label: sort.label
        }))
      }
    ];
  };

  const renderOrderCard = ({ item: order }: { item: Order }) => {
    const statusColor = getStatusColor(order.status);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => router.push(`/order-detail/${order.id}` as any)}
        activeOpacity={0.8}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderMainInfo}>
            <Text style={styles.orderId}>Order #{order.id.slice(-8)}</Text>
            <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.partiesSection}>
          <View style={styles.partyInfo}>
            <Text style={styles.partyLabel}>BUYER:</Text>
            <Text style={styles.partyName}>
              {`${order.buyer_profile?.first_name || ''} ${order.buyer_profile?.last_name || ''}`.trim() || 'Unknown'}
            </Text>
            {order.buyer_profile?.barangay && (
              <Text style={styles.partyBarangay}>📍 {order.buyer_profile.barangay}</Text>
            )}
          </View>
          <View style={styles.partyInfo}>
            <Text style={styles.partyLabel}>FARMER:</Text>
            <Text style={styles.partyName}>
              {order.farmer_profile?.farm_name ||
               `${order.farmer_profile?.first_name || ''} ${order.farmer_profile?.last_name || ''}`.trim() || 'Unknown'}
            </Text>
            {order.farmer_profile?.barangay && (
              <Text style={styles.partyBarangay}>📍 {order.farmer_profile.barangay}</Text>
            )}
          </View>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.orderItems}>
            <Text style={styles.itemsTitle}>Items:</Text>
            {order.order_items?.map((item, index) => (
              <View key={index} style={styles.orderItem}>
                <Text style={styles.itemQuantity}>{item.quantity} {item.product.unit}</Text>
                <Text style={styles.itemName}>{item.product.name}</Text>
                <Text style={styles.itemPrice}>{formatPrice(item.unit_price)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.orderAmount}>
            <Text style={styles.amountLabel}>Total Amount</Text>
            <Text style={styles.amountValue}>{formatPrice(order.total_amount)}</Text>
          </View>
        </View>

        {order.delivery_address && (
          <View style={styles.addressSection}>
            <Icon name="map-marker-alt" size={14} color="#64748b" style={styles.addressIcon} />
            <Text style={styles.addressText}>{order.delivery_address}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="clipboard-list" size={60} color="#10b981" />
      <Text style={styles.emptyTitle}>No Orders Found</Text>
      <Text style={styles.emptyDescription}>
        {selectedStatus === 'all'
          ? 'No orders in your barangay yet.'
          : `No ${selectedStatus} orders found.`}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        userType="admin"
        currentRoute="/admin/orders"
        showMessages={true}
        showNotifications={true}
        showSearch={true}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search orders..."
        showFilterButton={!isDesktop}
        onFilterPress={() => setShowSidebar(!showSidebar)}
      />

      <View style={styles.tabBar}>
        {STATUS_FILTERS.map((status) => (
          <TouchableOpacity
            key={status.key}
            style={[
              styles.tab,
              selectedStatus === status.key && styles.activeTab
            ]}
            onPress={() => setSelectedStatus(status.key)}
          >
            <Text style={[
              styles.tabText,
              selectedStatus === status.key && styles.activeTabText
            ]}>
              {status.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.mainContent}>
        {isDesktop && (
          <FilterSidebar
            sections={getFilterSections()}
            filterState={filterState}
            onFilterChange={handleFilterChange}
            width={240}
          />
        )}

        <View style={[styles.ordersContainer, isDesktop && styles.ordersContainerWithSidebar]}>
          <ScrollView
            style={styles.scrollView}
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
              <View style={styles.ordersList}>
                {filteredOrders.map((order) => (
                  <View key={order.id}>
                    {renderOrderCard({ item: order })}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {mapOrder && (
        <MapDirectionsModal
          visible={showMapModal}
          onClose={handleCloseMapModal}
          deliveryAddress={mapOrder.delivery_address || ''}
          orderInfo={{
            orderId: mapOrder.id,
            buyerName: `${mapOrder.buyer_profile?.first_name || ''} ${mapOrder.buyer_profile?.last_name || ''}`.trim(),
          }}
        />
      )}

      {!isDesktop && (
        <FilterSidebar
          sections={getFilterSections()}
          filterState={filterState}
          onFilterChange={handleFilterChange}
          showMobile={showSidebar}
          onCloseMobile={() => setShowSidebar(false)}
          title="Filters"
        />
      )}

      <ConfirmationModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingText: { marginTop: 20, fontSize: 16, color: '#64748b', fontWeight: '500' },
  tabBar: { flexDirection: 'row', backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  tab: { flex: 1, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', position: 'relative' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#10b981' },
  tabText: { fontSize: 13, color: '#666', fontWeight: '500', textAlign: 'center' },
  activeTabText: { color: '#10b981', fontWeight: '600' },
  mainContent: { flex: 1, flexDirection: 'row' },
  ordersContainer: { flex: 1 },
  ordersContainerWithSidebar: { flex: 1, marginLeft: 0 },
  scrollView: { flex: 1, backgroundColor: '#f5f5f5' },
  ordersList: { padding: 12, gap: 8 },
  orderCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  orderMainInfo: { flex: 1, marginRight: 16 },
  orderId: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  orderDate: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusText: { fontSize: 10, color: '#ffffff', fontWeight: 'bold', letterSpacing: 0.8 },
  partiesSection: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  partyInfo: { flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 10 },
  partyLabel: { fontSize: 10, color: '#64748b', fontWeight: '600', marginBottom: 4, letterSpacing: 0.5 },
  partyName: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 2 },
  partyBarangay: { fontSize: 11, color: '#64748b' },
  orderDetails: { marginBottom: 12 },
  orderItems: { marginBottom: 12 },
  itemsTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  orderItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#f1f5f9', borderRadius: 8, marginBottom: 6 },
  itemQuantity: { fontSize: 12, fontWeight: '700', color: '#059669', width: 60 },
  itemName: { fontSize: 12, color: '#0f172a', flex: 1, fontWeight: '500' },
  itemPrice: { fontSize: 12, fontWeight: '600', color: '#374151' },
  orderAmount: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ecfdf5', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0' },
  amountLabel: { fontSize: 14, fontWeight: '600', color: '#059669' },
  amountValue: { fontSize: 18, fontWeight: 'bold', color: '#059669' },
  addressSection: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  addressIcon: { marginRight: 8, marginTop: 2 },
  addressText: { flex: 1, fontSize: 13, color: '#64748b', lineHeight: 18 },
  emptyContainer: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', color: '#0f172a', marginTop: 24, marginBottom: 12 },
  emptyDescription: { fontSize: 16, color: '#64748b', textAlign: 'center', paddingHorizontal: 40 },
});
