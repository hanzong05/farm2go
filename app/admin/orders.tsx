import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useCustomAlert } from '../../components/CustomAlert';
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
  status: 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled' | 'cancellation_requested' | 'issue_reported';
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
  { key: 'cancellation_requested', label: 'Cancel Request' },
  { key: 'issue_reported', label: 'Issue Reported' },
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
  const { showAlert, AlertComponent } = useCustomAlert();

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

  const { status: statusParam } = useLocalSearchParams<{ status?: string }>();
  const [selectedStatus, setSelectedStatus] = useState(statusParam || 'all');
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapOrder, setMapOrder] = useState<Order | null>(null);

  const [filterState, setFilterState] = useState({
    sortBy: 'newest'
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (statusParam) setSelectedStatus(statusParam);
  }, [statusParam]);

  useEffect(() => {
    filterOrders();
  }, [orders, selectedStatus, filterState, searchQuery]);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      if (!userData?.profile || userData.profile.user_type !== 'admin') {
        showAlert('Access Denied', 'Only admins can access this page', [
          { text: 'OK', style: 'default', onPress: () => router.replace('/') }
        ]);
        return;
      }

      setProfile(userData.profile);
      await loadOrders(userData.profile);
    } catch (error) {
      console.error('Error loading data:', error);
      showAlert('Error', 'Failed to load orders', [
        { text: 'OK', style: 'default' }
      ]);
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

    if (selectedStatus === 'issue_reported') {
      filtered = filtered.filter(order =>
        order.status === 'issue_reported' ||
        (order.notes?.includes('[ISSUE_REPORT:') &&
          order.status !== 'cancelled' &&
          order.status !== 'delivered')
      );
    } else if (selectedStatus !== 'all') {
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
      showAlert('No Address', 'This order does not have a delivery address.', [
        { text: 'OK', style: 'default' }
      ]);
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

  const parseIssueFromNotes = (notes: string | null) => {
    if (!notes) return null;
    const match = notes.match(/\[ISSUE_REPORT:([^:]+):([^:]*):?([^\]]*)\]/);
    if (!match) return null;
    const typeLabels: Record<string, string> = {
      rotten: 'Rotten Product',
      damaged: 'Damaged Product',
      wrong_item: 'Wrong Item Delivered',
    };
    return {
      type: typeLabels[match[1]] || match[1],
      description: match[2]?.trim() || '',
      photoUrl: match[3]?.trim() || '',
    };
  };

  const handleCancelOrder = (order: Order) => {
    setConfirmModal({
      visible: true,
      title: 'Cancel Order',
      message: `Cancel order #${order.id.slice(-8)}? Stock will be restored and the buyer will be notified.`,
      isDestructive: true,
      confirmText: 'Yes, Cancel Order',
      onConfirm: () => processCancelOrder(order),
    });
  };

  const processCancelOrder = async (order: Order) => {
    setConfirmModal(prev => ({ ...prev, visible: false }));
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', order.id);
      if (error) throw error;

      // Restore stock
      const { data: orderRow } = await supabase
        .from('orders')
        .select('product_id, quantity')
        .eq('id', order.id)
        .single();
      if (orderRow) {
        const { data: product } = await supabase
          .from('products')
          .select('quantity_available')
          .eq('id', (orderRow as any).product_id)
          .single();
        if (product) {
          await supabase
            .from('products')
            .update({ quantity_available: (product as any).quantity_available + (orderRow as any).quantity })
            .eq('id', (orderRow as any).product_id);
        }
      }
      await supabase.from('transactions').update({ status: 'failed' }).eq('order_id', order.id);

      await notifyOrderStatusChange(
        order.id, 'cancelled',
        order.buyer_id, order.farmer_id,
        {
          buyerName: `${order.buyer_profile?.first_name || ''} ${order.buyer_profile?.last_name || ''}`.trim(),
          farmerName: order.farmer_profile?.farm_name || `${order.farmer_profile?.first_name || ''} ${order.farmer_profile?.last_name || ''}`.trim(),
          totalAmount: order.total_amount,
        },
        profile?.id || ''
      );

      if (profile) await loadOrders(profile);
    } catch (err) {
      console.error('Error cancelling order:', err);
      showAlert('Error', 'Failed to cancel order. Please try again.', [{ text: 'OK', style: 'default' }]);
    }
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'all': '#6b7280',
      'pending': '#f59e0b',
      'confirmed': '#3b82f6',
      'processing': '#8b5cf6',
      'ready': '#10b981',
      'delivered': '#059669',
      'cancellation_requested': '#f97316',
      'issue_reported': '#dc2626',
      'cancelled': '#dc2626',
    };
    return statusColors[status] || '#6b7280';
  };

  const handleCancellationDecision = async (order: Order, decision: 'approve' | 'reject') => {
    const actionLabel = decision === 'approve' ? 'Approve Cancellation' : 'Reject Cancellation';
    const actionMsg = decision === 'approve'
      ? `Approving this will cancel the order. The buyer will be notified.`
      : `Rejecting this will continue the order as confirmed.`;

    setConfirmModal({
      visible: true,
      title: actionLabel,
      message: actionMsg,
      isDestructive: decision === 'approve',
      confirmText: actionLabel,
      onConfirm: () => processCancellationDecision(order, decision),
    });
  };

  const processCancellationDecision = async (order: Order, decision: 'approve' | 'reject') => {
    setConfirmModal(prev => ({ ...prev, visible: false }));
    try {
      const newStatus = decision === 'approve' ? 'cancelled' : 'confirmed';
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', order.id);
      if (error) throw error;

      if (decision === 'approve') {
        // Restore stock
        const { data: orderRow } = await supabase
          .from('orders')
          .select('product_id, quantity')
          .eq('id', order.id)
          .single();
        if (orderRow) {
          const { data: product } = await supabase
            .from('products')
            .select('quantity_available')
            .eq('id', (orderRow as any).product_id)
            .single();
          if (product) {
            await supabase
              .from('products')
              .update({ quantity_available: (product as any).quantity_available + (orderRow as any).quantity })
              .eq('id', (orderRow as any).product_id);
          }
        }
        // Mark transaction failed
        await supabase.from('transactions').update({ status: 'failed' }).eq('order_id', order.id);
      }

      await notifyOrderStatusChange(
        order.id, newStatus,
        order.buyer_id, order.farmer_id,
        { buyerName: `${order.buyer_profile?.first_name || ''} ${order.buyer_profile?.last_name || ''}`.trim(),
          farmerName: order.farmer_profile?.farm_name || `${order.farmer_profile?.first_name || ''} ${order.farmer_profile?.last_name || ''}`.trim(),
          totalAmount: order.total_amount },
        profile?.id || ''
      );

      if (profile) await loadOrders(profile);
    } catch (err) {
      console.error('Error processing cancellation decision:', err);
      showAlert('Error', 'Failed to process decision. Please try again.', [{ text: 'OK', style: 'default' }]);
    }
  };

  const handleIssueDecision = async (order: Order, decision: 'approve' | 'reject') => {
    const actionLabel = decision === 'approve' ? 'Approve Refund' : 'Reject Complaint';
    const actionMsg = decision === 'approve'
      ? `This will mark the order as refunded and notify the buyer.`
      : `This will close the complaint and the order stays as delivered.`;

    setConfirmModal({
      visible: true,
      title: actionLabel,
      message: actionMsg,
      isDestructive: decision === 'approve',
      confirmText: actionLabel,
      onConfirm: () => processIssueDecision(order, decision),
    });
  };

  const processIssueDecision = async (order: Order, decision: 'approve' | 'reject') => {
    setConfirmModal(prev => ({ ...prev, visible: false }));
    try {
      const newStatus = decision === 'approve' ? 'cancelled' : 'delivered';
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', order.id);
      if (error) throw error;

      if (decision === 'approve') {
        await supabase.from('transactions').update({ status: 'refunded' }).eq('order_id', order.id);
      }

      await notifyOrderStatusChange(
        order.id, decision === 'approve' ? 'cancelled' : 'delivered',
        order.buyer_id, order.farmer_id,
        { buyerName: `${order.buyer_profile?.first_name || ''} ${order.buyer_profile?.last_name || ''}`.trim(),
          farmerName: order.farmer_profile?.farm_name || `${order.farmer_profile?.first_name || ''} ${order.farmer_profile?.last_name || ''}`.trim(),
          totalAmount: order.total_amount },
        profile?.id || ''
      );

      if (profile) await loadOrders(profile);
    } catch (err) {
      console.error('Error processing issue decision:', err);
      showAlert('Error', 'Failed to process decision. Please try again.', [{ text: 'OK', style: 'default' }]);
    }
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

        {/* Cancellation Request Review */}
        {order.status === 'cancellation_requested' && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewTitle}>Cancellation Request</Text>
            <Text style={styles.reviewSubtext}>Buyer has requested to cancel this order.</Text>
            <View style={styles.reviewButtons}>
              <TouchableOpacity
                style={[styles.reviewBtn, styles.reviewRejectBtn]}
                onPress={() => handleCancellationDecision(order, 'reject')}
                activeOpacity={0.8}
              >
                <Text style={styles.reviewBtnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reviewBtn, styles.reviewApproveBtn]}
                onPress={() => handleCancellationDecision(order, 'approve')}
                activeOpacity={0.8}
              >
                <Text style={styles.reviewBtnText}>Approve Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Issue Reported Badge */}
        {(order.status === 'issue_reported' || order.notes?.includes('[ISSUE_REPORT:')) && (() => {
          const issue = parseIssueFromNotes(order.notes);
          const isResolved = order.status === 'cancelled' || order.status === 'delivered';
          return (
            <View style={styles.issueBadge}>
              <View style={styles.issueBadgeHeader}>
                <Text style={styles.issueBadgeIcon}>⚠️</Text>
                <Text style={styles.issueBadgeTitle}>
                  {isResolved
                    ? order.status === 'cancelled'
                      ? 'Issue Resolved — Refunded'
                      : 'Issue Resolved — Rejected'
                    : 'Issue Reported'}
                </Text>
              </View>
              {issue && (
                <>
                  <Text style={styles.issueType}>{issue.type}</Text>
                  {issue.description ? (
                    <Text style={styles.issueDescription}>"{issue.description}"</Text>
                  ) : null}
                </>
              )}
            </View>
          );
        })()}

        {/* Issue Report Review — only for unresolved issues */}
        {(order.status === 'issue_reported' ||
          (order.notes?.includes('[ISSUE_REPORT:') &&
            order.status !== 'cancelled' &&
            order.status !== 'delivered')) && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewTitle}>Admin Action Required</Text>
            <Text style={styles.reviewSubtext}>Review the buyer's complaint and take action.</Text>
            <View style={styles.reviewButtons}>
              <TouchableOpacity
                style={[styles.reviewBtn, styles.reviewRejectBtn]}
                onPress={() => handleIssueDecision(order, 'reject')}
                activeOpacity={0.8}
              >
                <Text style={styles.reviewBtnText}>Reject Complaint</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reviewBtn, styles.reviewApproveBtn]}
                onPress={() => handleIssueDecision(order, 'approve')}
                activeOpacity={0.8}
              >
                <Text style={styles.reviewBtnText}>Approve Refund</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Admin Cancel Order */}
        {order.status !== 'cancelled' && order.status !== 'issue_reported' && order.status !== 'cancellation_requested' &&
          !(order.notes?.includes('[ISSUE_REPORT:') && order.status !== 'delivered') && (
          <View style={styles.cancelSection}>
            <TouchableOpacity
              style={styles.cancelOrderBtn}
              onPress={(e) => { e.stopPropagation?.(); handleCancelOrder(order); }}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelOrderBtnText}>Cancel Order</Text>
            </TouchableOpacity>
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

      {AlertComponent}
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
  ordersList: { padding: 0, gap: 8 },
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
  reviewSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingHorizontal: 4 },
  reviewTitle: { fontSize: 13, fontWeight: '700', color: '#dc2626', marginBottom: 2 },
  reviewSubtext: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  reviewButtons: { flexDirection: 'row', gap: 10 },
  reviewBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  reviewApproveBtn: { backgroundColor: '#10b981' },
  reviewRejectBtn: { backgroundColor: '#ef4444' },
  reviewBtnText: { fontSize: 13, color: '#ffffff', fontWeight: '700' },
  issueBadge: { marginTop: 12, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 10, padding: 12 },
  issueBadgeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  issueBadgeIcon: { fontSize: 14 },
  issueBadgeTitle: { fontSize: 13, fontWeight: '700', color: '#b91c1c' },
  issueType: { fontSize: 13, fontWeight: '600', color: '#dc2626', marginBottom: 2 },
  issueDescription: { fontSize: 12, color: '#7f1d1d', fontStyle: 'italic' },
  cancelSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  cancelOrderBtn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#dc2626' },
  cancelOrderBtnText: { fontSize: 13, color: '#dc2626', fontWeight: '700' },
});
