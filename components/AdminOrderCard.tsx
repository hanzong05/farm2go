import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Theme } from '../constants/theme';
import { useConfirmationModal } from '../contexts/ConfirmationModalContext';
import { supabase } from '../lib/supabase';

interface AdminOrderCardProps {
  id: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  buyerProfile?: {
    first_name: string | null;
    last_name: string | null;
  };
  farmer?: string;
  items?: string; // JSON string or description of items
  onStatusUpdate?: () => void;
  onCloseModal?: () => void; // Callback to close parent modal
}

export default function AdminOrderCard({
  id,
  totalAmount,
  status,
  createdAt,
  buyerProfile,
  farmer,
  items,
  onStatusUpdate,
  onCloseModal,
}: AdminOrderCardProps) {
  const { showConfirmation } = useConfirmationModal();
  const [processing, setProcessing] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(price);
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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return Theme.colors.success;
      case 'cancelled':
      case 'rejected':
        return Theme.colors.error;
      case 'pending':
        return Theme.colors.warning;
      case 'confirmed':
      case 'approved':
        return Theme.colors.primary;
      case 'processing':
        return '#6366f1';
      case 'shipped':
        return '#8b5cf6';
      default:
        return Theme.colors.text.secondary;
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  const handleOrderAction = async (action: 'confirmed' | 'cancelled') => {
    const buyerName = buyerProfile ?
      `${buyerProfile.first_name} ${buyerProfile.last_name}`.trim() :
      'Unknown Buyer';

    // Close parent modal if callback is provided
    if (onCloseModal) {
      onCloseModal();
    }

    showConfirmation(
      `${action === 'confirmed' ? 'Confirm' : 'Cancel'} Order`,
      `Are you sure you want to ${action === 'confirmed' ? 'confirm' : 'cancel'} this ${formatPrice(totalAmount)} order from ${buyerName}?`,
      () => updateOrderStatus(action),
      action === 'cancelled', // isDestructive
      `Yes, ${action === 'confirmed' ? 'Confirm' : 'Cancel'}`,
      'No'
    );
  };

  const updateOrderStatus = async (newStatus: string) => {
    try {
      setProcessing(true);

      const { error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      const actionText = newStatus === 'confirmed' ? 'confirmed' : 'cancelled';
      const buyerName = buyerProfile ?
        `${buyerProfile.first_name} ${buyerProfile.last_name}`.trim() :
        'the buyer';

      Alert.alert(
        'Success!',
        `Order ${actionText} successfully! ${buyerName} has been notified.`,
        [{ text: 'OK', onPress: onStatusUpdate }]
      );
    } catch (error) {
      console.error('Error updating order:', error);
      Alert.alert('Error', 'Failed to update order status');
    } finally {
      setProcessing(false);
    }
  };

  const canTakeAction = () => {
    const actionableStatuses = ['pending', 'processing'];
    return actionableStatuses.includes(status.toLowerCase());
  };

  const buyerName = buyerProfile ?
    `${buyerProfile.first_name} ${buyerProfile.last_name}`.trim() :
    'Unknown Buyer';

  return (
    <View style={styles.container}>
      {/* Order Header */}
      <View style={styles.header}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderId}>Order #{id.slice(-8).toUpperCase()}</Text>
          <Text style={styles.orderDate}>{formatDate(createdAt)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
          <Text style={styles.statusText}>{getStatusText(status)}</Text>
        </View>
      </View>

      {/* Order Details */}
      <View style={styles.content}>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Buyer:</Text>
          <Text style={styles.value}>{buyerName}</Text>
        </View>

        {farmer && (
          <View style={styles.detailRow}>
            <Text style={styles.label}>Farmer:</Text>
            <Text style={styles.value}>🌾 {farmer}</Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.label}>Total:</Text>
          <Text style={styles.totalAmount}>{formatPrice(totalAmount)}</Text>
        </View>

        {items && (
          <View style={styles.itemsSection}>
            <Text style={styles.label}>Items:</Text>
            <Text style={styles.itemsText} numberOfLines={2}>
              {items}
            </Text>
          </View>
        )}

        {/* Action Buttons - Only show for actionable orders */}
        {canTakeAction() && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => handleOrderAction('cancelled')}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>Cancel</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.confirmButton]}
              onPress={() => handleOrderAction('confirmed')}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    ...Theme.shadows.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: Theme.spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    ...Theme.typography.h6,
    color: Theme.colors.text.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  orderDate: {
    ...Theme.typography.caption,
    color: Theme.colors.text.secondary,
  },
  statusBadge: {
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.full,
  },
  statusText: {
    color: Theme.colors.text.inverse,
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
  },
  label: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    fontWeight: '500',
  },
  value: {
    ...Theme.typography.body2,
    color: Theme.colors.text.primary,
    flex: 1,
    textAlign: 'right',
  },
  totalAmount: {
    ...Theme.typography.body1,
    color: Theme.colors.primary,
    fontWeight: 'bold',
  },
  itemsSection: {
    marginTop: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  itemsText: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    marginTop: Theme.spacing.xs,
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  cancelButton: {
    backgroundColor: Theme.colors.error,
  },
  confirmButton: {
    backgroundColor: Theme.colors.success,
  },
  actionButtonText: {
    color: Theme.colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
});