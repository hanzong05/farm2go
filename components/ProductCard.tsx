import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../constants/theme';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  unit: string;
  imageUrl?: string;
  farmer?: string;
  rating?: number;
  sold?: number;
  discount?: number;
  onPress?: () => void;
  style?: any;
}

export default function ProductCard({
  id,
  name,
  price,
  unit,
  imageUrl,
  farmer,
  rating = 0,
  sold = 0,
  discount,
  onPress,
  style,
}: ProductCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const discountedPrice = discount ? price - (price * discount / 100) : price;

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Product Image */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>🥬</Text>
          </View>
        )}

        {/* Discount Badge */}
        {discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discount}% OFF</Text>
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.content}>
        {/* Product Name */}
        <Text style={styles.productName} numberOfLines={2}>
          {name}
        </Text>

        {/* Price Section */}
        <View style={styles.priceSection}>
          <Text style={styles.currentPrice}>
            {formatPrice(discountedPrice)}
          </Text>
          {discount && (
            <Text style={styles.originalPrice}>
              {formatPrice(price)}
            </Text>
          )}
          <Text style={styles.unit}>per {unit}</Text>
        </View>

        {/* Farmer & Stats */}
        <View style={styles.metaSection}>
          {farmer && (
            <Text style={styles.farmer} numberOfLines={1}>
              🌾 {farmer}
            </Text>
          )}

          <View style={styles.statsRow}>
            {rating > 0 && (
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingText}>⭐ {rating.toFixed(1)}</Text>
              </View>
            )}
            {sold > 0 && (
              <Text style={styles.soldText}>{sold} sold</Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    ...Theme.shadows.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
    width: '48%', // Shopee-style 2-column grid
    marginBottom: Theme.spacing.md,
  },

  imageContainer: {
    position: 'relative',
    aspectRatio: 1,
    backgroundColor: Theme.colors.surfaceVariant,
  },

  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceVariant,
  },

  placeholderText: {
    fontSize: 32,
  },

  discountBadge: {
    position: 'absolute',
    top: Theme.spacing.sm,
    left: 0,
    backgroundColor: Theme.colors.error,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderTopRightRadius: Theme.borderRadius.sm,
    borderBottomRightRadius: Theme.borderRadius.sm,
  },

  discountText: {
    color: Theme.colors.text.inverse,
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },

  content: {
    padding: Theme.spacing.sm,
  },

  productName: {
    ...Theme.typography.body2,
    color: Theme.colors.text.primary,
    fontWeight: '500',
    marginBottom: Theme.spacing.xs,
    minHeight: 32, // Ensure consistent height
  },

  priceSection: {
    marginBottom: Theme.spacing.xs,
  },

  currentPrice: {
    ...Theme.typography.body1,
    color: Theme.colors.primary,
    fontWeight: 'bold',
  },

  originalPrice: {
    ...Theme.typography.caption,
    color: Theme.colors.text.tertiary,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },

  unit: {
    ...Theme.typography.caption,
    color: Theme.colors.text.secondary,
    marginTop: 2,
  },

  metaSection: {
    gap: Theme.spacing.xs,
  },

  farmer: {
    ...Theme.typography.caption,
    color: Theme.colors.text.secondary,
    fontWeight: '500',
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  ratingText: {
    ...Theme.typography.caption,
    color: Theme.colors.secondary,
    fontWeight: '500',
  },

  soldText: {
    ...Theme.typography.caption,
    color: Theme.colors.text.tertiary,
  },
});