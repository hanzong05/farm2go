import { useLocalSearchParams, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity_available: number;
  unit: string;
  category: string;
  farmer_id: string;
  created_at: string;
  updated_at: string;
  image_url?: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    farm_name: string | null;
    barangay: string | null;
  };
}

export default function BuyerProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          profiles:farmer_id (
            first_name,
            last_name,
            farm_name,
            barangay
          )
        `)
        .eq('id', id)
        .eq('status', 'approved') // Only show approved products to buyers
        .single();

      if (error) {
        console.error('Error fetching product:', error);
        setError('Failed to load product');
        return;
      }

      setProduct(data);
    } catch (err) {
      console.error('Product fetch error:', err);
      setError('An error occurred while loading the product');
    } finally {
      setLoading(false);
    }
  };

  const handleContactFarmer = () => {
    if (product?.farmer_id) {
      router.push(`/buyer/contact-farmer/${product.farmer_id}` as any);
    }
  };

  const handleOrderNow = () => {
    if (product?.id) {
      router.push(`/buyer/order/${product.id}` as any);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading product...</Text>
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Product not found'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Product Details</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.productCard}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productCategory}>{product.category}</Text>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Description:</Text>
            <Text style={styles.value}>{product.description}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Price:</Text>
            <Text style={styles.priceValue}>₱{product.price.toLocaleString()} per {product.unit}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Available Quantity:</Text>
            <Text style={styles.value}>{product.quantity_available} {product.unit}(s)</Text>
          </View>

          {product.profiles && (
            <>
              <View style={styles.separator} />
              <Text style={styles.farmerSectionTitle}>Farmer Information</Text>

              <View style={styles.detailRow}>
                <Text style={styles.label}>Farmer:</Text>
                <Text style={styles.value}>
                  {product.profiles.first_name} {product.profiles.last_name}
                </Text>
              </View>

              {product.profiles.farm_name && (
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Farm:</Text>
                  <Text style={styles.value}>{product.profiles.farm_name}</Text>
                </View>
              )}

              {product.profiles.barangay && (
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Location:</Text>
                  <Text style={styles.value}>{product.profiles.barangay}</Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.contactButton} onPress={handleContactFarmer}>
            <Text style={styles.contactButtonText}>Contact Farmer</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.orderButton} onPress={handleOrderNow}>
            <Text style={styles.orderButtonText}>Order Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 24,
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    padding: 16,
  },
  productCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  productName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  productCategory: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    width: 120,
  },
  value: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  priceValue: {
    fontSize: 18,
    color: '#10b981',
    fontWeight: '700',
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 20,
  },
  farmerSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  actions: {
    gap: 12,
  },
  contactButton: {
    backgroundColor: '#6b7280',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  contactButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  orderButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  orderButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});