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

interface AdminInventoryCardProps {
  id: string;
  name: string;
  price: number;
  unit: string;
  stockQuantity: number;
  category: string;
  imageUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  description?: string;
  farmer?: string;
  createdAt?: string;
  onUpdate?: () => void;
}

export default function AdminInventoryCard({
  id,
  name,
  price,
  unit,
  stockQuantity,
  category,
  imageUrl,
  status,
  description,
  farmer,
  createdAt,
  onUpdate,
}: AdminInventoryCardProps) {
  const [processing, setProcessing] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
      case 'approved': return 'Active';
      case 'rejected': return 'Rejected';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { text: 'Out of Stock', color: Theme.colors.error };
    if (quantity <= 10) return { text: 'Low Stock', color: Theme.colors.warning };
    return { text: 'In Stock', color: Theme.colors.success };
  };

  const handleUpdateStock = () => {
    Alert.prompt(
      'Update Stock',
      `Current stock: ${stockQuantity} ${unit}\nEnter new stock quantity:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: (value) => {
            const newStock = parseInt(value || '0');
            if (!isNaN(newStock) && newStock >= 0) {
              updateStock(newStock);
            } else {
              Alert.alert('Error', 'Please enter a valid number');
            }
          }
        }
      ],
      'plain-text',
      stockQuantity.toString()
    );
  };

  const updateStock = async (newStock: number) => {
    try {
      setProcessing(true);

      const { error } = await supabase
        .from('products')
        .update({
          quantity_available: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      Alert.alert(
        'Success!',
        `Stock updated to ${newStock} ${unit}`,
        [{ text: 'OK', onPress: onUpdate }]
      );
    } catch (error) {
      console.error('Error updating stock:', error);
      Alert.alert('Error', 'Failed to update stock');
    } finally {
      setProcessing(false);
    }
  };

  const stockStatus = getStockStatus(stockQuantity);

  return (
    <View style={styles.container}>
      {/* Product Image */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>📦</Text>
          </View>
        )}

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
          <Text style={styles.statusText}>{getStatusText(status)}</Text>
        </View>

        {/* Stock Status Badge */}
        <View style={[styles.stockBadge, { backgroundColor: stockStatus.color }]}>
          <Text style={styles.stockBadgeText}>{stockStatus.text}</Text>
        </View>
      </View>

      {/* Product Info */}
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              {name}
            </Text>
            <Text style={styles.category}>{category}</Text>
          </View>
        </View>

        <View style={styles.priceSection}>
          <Text style={styles.price}>
            {formatPrice(price)} per {unit}
          </Text>
          {farmer && (
            <Text style={styles.farmer} numberOfLines={1}>
              🌾 {farmer}
            </Text>
          )}
        </View>

        {/* Stock Information */}
        <View style={styles.stockSection}>
          <View style={styles.stockRow}>
            <Text style={styles.stockLabel}>Current Stock:</Text>
            <Text style={[styles.stockValue, { color: stockStatus.color }]}>
              {stockQuantity} {unit}
            </Text>
          </View>

          {createdAt && (
            <Text style={styles.dateText}>
              Added: {formatDate(createdAt)}
            </Text>
          )}
        </View>

        {description && (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.updateButton]}
            onPress={handleUpdateStock}
            disabled={processing || status !== 'approved'}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={styles.updateIcon}>📝</Text>
                <Text style={styles.actionButtonText}>Update Stock</Text>
              </>
            )}
          </TouchableOpacity>

          {status === 'approved' && stockQuantity === 0 && (
            <TouchableOpacity
              style={[styles.actionButton, styles.restockButton]}
              onPress={() => handleUpdateStock()}
              disabled={processing}
            >
              <Text style={styles.restockIcon}>📦</Text>
              <Text style={styles.actionButtonText}>Restock</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Low Stock Warning */}
        {status === 'approved' && stockQuantity > 0 && stockQuantity <= 10 && (
          <View style={styles.warningBox}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>
              Low stock alert! Only {stockQuantity} {unit} remaining
            </Text>
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
  imageContainer: {
    position: 'relative',
    height: 140,
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
    fontSize: 11,
    fontWeight: '600',
  },
  stockBadge: {
    position: 'absolute',
    bottom: Theme.spacing.sm,
    left: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.full,
  },
  stockBadgeText: {
    color: Theme.colors.text.inverse,
    fontSize: 10,
    fontWeight: '600',
  },
  content: {
    padding: Theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Theme.spacing.sm,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    ...Theme.typography.h6,
    color: Theme.colors.text.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  category: {
    ...Theme.typography.caption,
    color: Theme.colors.text.secondary,
    backgroundColor: Theme.colors.surfaceVariant,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  priceSection: {
    marginBottom: Theme.spacing.sm,
  },
  price: {
    ...Theme.typography.body1,
    color: Theme.colors.primary,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  farmer: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    fontWeight: '500',
  },
  stockSection: {
    marginBottom: Theme.spacing.sm,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stockLabel: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    fontWeight: '500',
  },
  stockValue: {
    ...Theme.typography.body2,
    fontWeight: '600',
  },
  dateText: {
    ...Theme.typography.caption,
    color: Theme.colors.text.tertiary,
  },
  description: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    lineHeight: 20,
    marginBottom: Theme.spacing.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    minHeight: 36,
  },
  updateButton: {
    backgroundColor: Theme.colors.primary,
  },
  restockButton: {
    backgroundColor: Theme.colors.warning,
  },
  updateIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  restockIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  actionButtonText: {
    color: Theme.colors.text.inverse,
    fontSize: 13,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderColor: Theme.colors.warning,
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.sm,
  },
  warningIcon: {
    fontSize: 14,
    marginRight: Theme.spacing.sm,
  },
  warningText: {
    ...Theme.typography.caption,
    color: '#92400E',
    flex: 1,
    fontWeight: '500',
  },
});