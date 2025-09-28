import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Theme } from '../constants/theme';
import { supabase } from '../lib/supabase';

interface AdminProductCardProps {
  id: string;
  name: string;
  price: number;
  unit: string;
  imageUrl?: string;
  category?: string;
  quantity?: number;
  status: 'pending' | 'approved' | 'rejected';
  description?: string;
  farmer?: string;
  onStatusUpdate?: () => void;
  onDelete?: (productId: string) => void;
}

export default function AdminProductCard({
  id,
  name,
  price,
  unit,
  imageUrl,
  category,
  quantity,
  status,
  description,
  farmer,
  onStatusUpdate,
  onDelete,
}: AdminProductCardProps) {
  const [processing, setProcessing] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return Theme.colors.success;
      case 'rejected': return Theme.colors.error;
      case 'pending': return Theme.colors.warning;
      default: return Theme.colors.text.secondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'pending': return 'Pending Review';
      default: return status;
    }
  };

  const handleProductAction = async (action: 'approved' | 'rejected') => {
    Alert.alert(
      `${action === 'approved' ? 'Approve' : 'Reject'} Product?`,
      `Are you sure you want to ${action === 'approved' ? 'approve' : 'reject'} "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Yes, ${action === 'approved' ? 'Approve' : 'Reject'}`,
          style: action === 'approved' ? 'default' : 'destructive',
          onPress: () => updateProductStatus(action)
        }
      ]
    );
  };

  const updateProductStatus = async (newStatus: 'approved' | 'rejected') => {
    try {
      setProcessing(true);

      const { error } = await supabase
        .from('products')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      Alert.alert(
        'Success!',
        `Product ${newStatus} successfully`,
        [{ text: 'OK', onPress: onStatusUpdate }]
      );
    } catch (error) {
      console.error('Error updating product:', error);
      Alert.alert('Error', 'Failed to update product status');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Product Image */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>📷</Text>
          </View>
        )}

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
          <Text style={styles.statusText}>{getStatusText(status)}</Text>
        </View>
      </View>

      {/* Product Info */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.productName} numberOfLines={2}>
            {name}
          </Text>
          {category && (
            <Text style={styles.category}>{category}</Text>
          )}
        </View>

        <Text style={styles.price}>
          {formatPrice(price)} per {unit}
        </Text>

        {farmer && (
          <Text style={styles.farmer} numberOfLines={1}>
            🌾 {farmer}
          </Text>
        )}

        {quantity !== undefined && (
          <Text style={styles.quantity}>
            Stock: {quantity} {unit}
          </Text>
        )}

        {description && (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        )}

        {/* Admin Actions */}
        <View style={styles.actionButtons}>
          {/* Show approve/reject for pending products */}
          {status === 'pending' && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleProductAction('rejected')}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Reject</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleProductAction('approved')}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Approve</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Delete button - show for all products if onDelete is provided */}
          {onDelete && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton, status === 'pending' && { marginTop: 8 }]}
              onPress={() => onDelete(id)}
              disabled={processing}
            >
              <Text style={styles.actionButtonText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
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
  imageContainer: {
    position: 'relative',
    height: 160,
    backgroundColor: Theme.colors.surfaceVariant,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceVariant,
  },
  placeholderText: {
    fontSize: 48,
    opacity: 0.5,
  },
  statusBadge: {
    position: 'absolute',
    top: Theme.spacing.sm,
    right: Theme.spacing.sm,
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Theme.spacing.xs,
  },
  productName: {
    ...Theme.typography.h6,
    color: Theme.colors.text.primary,
    fontWeight: '600',
    flex: 1,
    marginRight: Theme.spacing.sm,
  },
  category: {
    ...Theme.typography.caption,
    color: Theme.colors.text.secondary,
    backgroundColor: Theme.colors.surfaceVariant,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.sm,
  },
  price: {
    ...Theme.typography.body1,
    color: Theme.colors.primary,
    fontWeight: 'bold',
    marginBottom: Theme.spacing.xs,
  },
  farmer: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    fontWeight: '500',
    marginBottom: Theme.spacing.xs,
  },
  quantity: {
    ...Theme.typography.caption,
    color: Theme.colors.text.tertiary,
    marginBottom: Theme.spacing.xs,
  },
  description: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    lineHeight: 20,
    marginBottom: Theme.spacing.md,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    flexWrap: 'wrap',
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
  rejectButton: {
    backgroundColor: Theme.colors.error,
  },
  approveButton: {
    backgroundColor: Theme.colors.success,
  },
  deleteButton: {
    backgroundColor: '#dc2626', // Red color for delete
    minWidth: '100%', // Full width when standalone
  },
  actionButtonText: {
    color: Theme.colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
});