import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import HeaderComponent from '../../components/HeaderComponent';
import { useConfirmationModal } from '../../contexts/ConfirmationModalContext';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { notifyOrderStatusChange, notifyAllAdmins } from '../../services/notifications';

const { width: screenWidth } = Dimensions.get('window');

const colors = {
  primary: '#059669',
  secondary: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  text: '#0f172a',
  textSecondary: '#64748b',
  textLight: '#94a3b8',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
  shadow: '#000000',
};

interface OrderDetail {
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
  purchase_code: string | null;
  products: {
    name: string;
    unit: string;
    price: number;
    category: string;
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

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const { showConfirmation } = useConfirmationModal();

  useEffect(() => {
    loadOrderDetail();
    loadUserType();
  }, [id]);

  const loadUserType = async () => {
    const { user, profile } = await getUserWithProfile();
    if (profile) {
      setUserType(profile.user_type);
      setUserProfile(profile);
    }
  };

  const loadOrderDetail = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          products (
            name,
            unit,
            price,
            category
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
        .eq('id', id)
        .single();

      if (error) throw error;
      setOrder(data as OrderDetail);
    } catch (error: any) {
      console.error('Error loading order:', error);
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    const statusText = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
    const confirmed = await showConfirmation(
      `${statusText} Order`,
      `Are you sure you want to mark this order as ${newStatus}?`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      // Send notifications
      if (order) {
        try {
          const productName = order.products?.name || 'Product';

          // Notify buyer about order status change
          await notifyOrderStatusChange(
            order.id,
            order.buyer_id,
            newStatus,
            `Your order for ${productName} has been ${newStatus}`
          );

          // Notify farmer about order status change
          await notifyOrderStatusChange(
            order.id,
            order.farmer_id,
            newStatus,
            `Order for ${productName} has been ${newStatus}`
          );

          // Notify all admins if action was taken by farmer/buyer
          if (userType !== 'admin' && userType !== 'super-admin') {
            await notifyAllAdmins(
              `Order ${statusText}`,
              `${userType === 'farmer' ? 'Farmer' : 'Buyer'} ${userProfile?.first_name} ${userProfile?.last_name} ${newStatus} order #${order.id.substring(0, 8)}`,
              userProfile?.id || '',
              {
                action: `order_${newStatus}`,
                orderId: order.id
              }
            );
          }
        } catch (notifError) {
          console.error('Failed to send notifications:', notifError);
        }
      }

      Alert.alert('Success', `Order ${newStatus} successfully`);
      await loadOrderDetail();
    } catch (error) {
      console.error('Error updating order:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return colors.success;
      case 'cancelled': return colors.danger;
      case 'ready': return colors.primary;
      case 'confirmed': return colors.secondary;
      default: return colors.warning;
    }
  };

  const formatCurrency = (amount: number) => {
    return `₱${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <HeaderComponent />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <HeaderComponent />
        <View style={styles.errorContainer}>
          <Icon name="exclamation-circle" size={64} color={colors.danger} />
          <Text style={styles.errorTitle}>Order Not Found</Text>
          <Text style={styles.errorText}>The order you're looking for doesn't exist.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const canUpdateStatus = userType === 'admin' || userType === 'super-admin' ||
                         (userType === 'farmer' && order.status === 'pending');

  return (
    <View style={styles.container}>
      <HeaderComponent />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Icon name="arrow-left" size={20} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Order Details</Text>
            <Text style={styles.orderId}>#{order.id.substring(0, 8).toUpperCase()}</Text>
          </View>
        </View>

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
          <Icon name="info-circle" size={16} color={getStatusColor(order.status)} />
          <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
            {order.status.toUpperCase()}
          </Text>
        </View>

        {/* Purchase Code */}
        {order.purchase_code && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Purchase Code</Text>
            <Text style={styles.purchaseCode}>{order.purchase_code}</Text>
          </View>
        )}

        {/* Product Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Product Information</Text>
          <View style={styles.infoRow}>
            <Icon name="box" size={16} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>Product:</Text>
            <Text style={styles.infoValue}>{order.products?.name || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="layer-group" size={16} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>Category:</Text>
            <Text style={styles.infoValue}>{order.products?.category || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="balance-scale" size={16} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>Quantity:</Text>
            <Text style={styles.infoValue}>{order.quantity} {order.products?.unit}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="dollar-sign" size={16} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>Unit Price:</Text>
            <Text style={styles.infoValue}>{formatCurrency(order.products?.price || 0)}</Text>
          </View>
          <View style={[styles.infoRow, styles.totalRow]}>
            <Icon name="receipt" size={16} color={colors.primary} />
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.total_price)}</Text>
          </View>
        </View>

        {/* Buyer Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Buyer Information</Text>
          <View style={styles.infoRow}>
            <Icon name="user" size={16} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>Name:</Text>
            <Text style={styles.infoValue}>
              {order.buyer_profile?.first_name} {order.buyer_profile?.last_name}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="phone" size={16} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>Phone:</Text>
            <Text style={styles.infoValue}>{order.buyer_profile?.phone || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="map-marker-alt" size={16} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>Barangay:</Text>
            <Text style={styles.infoValue}>{order.buyer_profile?.barangay || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="home" size={16} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>Address:</Text>
            <Text style={styles.infoValue}>{order.delivery_address}</Text>
          </View>
        </View>

        {/* Farmer Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Farmer Information</Text>
          <View style={styles.infoRow}>
            <Icon name="user-tie" size={16} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>Name:</Text>
            <Text style={styles.infoValue}>
              {order.farmer_profile?.first_name} {order.farmer_profile?.last_name}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="tractor" size={16} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>Farm:</Text>
            <Text style={styles.infoValue}>{order.farmer_profile?.farm_name || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="phone" size={16} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>Phone:</Text>
            <Text style={styles.infoValue}>{order.farmer_profile?.phone || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="map-marker-alt" size={16} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>Barangay:</Text>
            <Text style={styles.infoValue}>{order.farmer_profile?.barangay || 'N/A'}</Text>
          </View>
        </View>

        {/* Order Notes */}
        {order.notes && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Order Notes</Text>
            <Text style={styles.notesText}>{order.notes}</Text>
          </View>
        )}

        {/* Order Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Timeline</Text>
          <View style={styles.infoRow}>
            <Icon name="clock" size={16} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>Placed on:</Text>
            <Text style={styles.infoValue}>{formatDate(order.created_at)}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        {canUpdateStatus && order.status !== 'delivered' && order.status !== 'cancelled' && (
          <View style={styles.actionsCard}>
            <Text style={styles.cardTitle}>Quick Actions</Text>
            <View style={styles.actionsContainer}>
              {order.status === 'pending' && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.success }]}
                  onPress={() => handleStatusUpdate('confirmed')}
                >
                  <Icon name="check" size={16} color={colors.white} />
                  <Text style={styles.actionButtonText}>Confirm Order</Text>
                </TouchableOpacity>
              )}
              {order.status === 'confirmed' && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  onPress={() => handleStatusUpdate('ready')}
                >
                  <Icon name="box" size={16} color={colors.white} />
                  <Text style={styles.actionButtonText}>Mark as Ready</Text>
                </TouchableOpacity>
              )}
              {order.status === 'ready' && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.success }]}
                  onPress={() => handleStatusUpdate('delivered')}
                >
                  <Icon name="check-circle" size={16} color={colors.white} />
                  <Text style={styles.actionButtonText}>Mark as Delivered</Text>
                </TouchableOpacity>
              )}
              {order.status !== 'cancelled' && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.danger }]}
                  onPress={() => handleStatusUpdate('cancelled')}
                >
                  <Icon name="times" size={16} color={colors.white} />
                  <Text style={styles.actionButtonText}>Cancel Order</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: screenWidth < 768 ? 16 : 24,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  orderId: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  purchaseCode: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    width: 100,
  },
  infoValue: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '700',
    width: 120,
  },
  totalValue: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: '700',
    flex: 1,
  },
  notesText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  actionsCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});
