import { useLocalSearchParams, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import PurchaseSuccessModal from '../../../components/PurchaseSuccessModal';
import { generateUniquePurchaseCode } from '../../../utils/purchaseCode';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity_available: number;
  unit: string;
  category: string;
  farmer_id: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    farm_name: string | null;
    barangay: string | null;
  };
}

export default function OrderProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [purchaseCode, setPurchaseCode] = useState<string>('');

  const [orderData, setOrderData] = useState({
    quantity: '1',
    notes: '',
    deliveryAddress: '',
  });

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
        .eq('status', 'approved')
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

  const calculateTotal = () => {
    if (!product) return 0;
    const quantity = parseInt(orderData.quantity) || 0;
    return product.price * quantity;
  };

  const handleOrder = async () => {
    if (!product || !user) return;

    const quantity = parseInt(orderData.quantity);

    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (quantity > product.quantity_available) {
      Alert.alert('Error', 'Requested quantity exceeds available stock');
      return;
    }

    if (!orderData.deliveryAddress.trim()) {
      Alert.alert('Error', 'Please enter a delivery address');
      return;
    }

    try {
      setOrdering(true);

      // Generate unique purchase code
      const uniquePurchaseCode = generateUniquePurchaseCode();

      // Create order record with purchase code
      const { error: orderError } = await (supabase as any)
        .from('orders')
        .insert({
          buyer_id: user.id,
          farmer_id: product.farmer_id,
          product_id: product.id,
          quantity: quantity,
          total_price: calculateTotal(),
          delivery_address: orderData.deliveryAddress,
          notes: orderData.notes,
          status: 'pending',
          purchase_code: uniquePurchaseCode,
        });

      if (orderError) {
        console.error('Error creating order:', orderError);
        Alert.alert('Error', 'Failed to create order. Please try again.');
        return;
      }

      // Update product quantity
      const { error: updateError } = await (supabase as any)
        .from('products')
        .update({
          quantity_available: product.quantity_available - quantity
        })
        .eq('id', product.id);

      if (updateError) {
        console.error('Error updating product quantity:', updateError);
        // Note: Order was created but quantity wasn't updated
        // In a real app, you'd want to handle this with a transaction
      }

      // Set purchase code and show success modal
      setPurchaseCode(uniquePurchaseCode);
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Order error:', err);
      Alert.alert('Error', 'An error occurred while placing the order');
    } finally {
      setOrdering(false);
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Place Order</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Product Summary */}
        <View style={styles.productSummary}>
          <Text style={styles.sectionTitle}>Product Summary</Text>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productPrice}>₱{product.price.toLocaleString()} per {product.unit}</Text>
          <Text style={styles.availableStock}>Available: {product.quantity_available} {product.unit}(s)</Text>

          {product.profiles && (
            <Text style={styles.farmerName}>
              by {product.profiles.first_name} {product.profiles.last_name}
            </Text>
          )}
        </View>

        {/* Order Form */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Order Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Quantity ({product.unit}) <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={orderData.quantity}
              onChangeText={(text) => setOrderData({ ...orderData, quantity: text })}
              placeholder="Enter quantity"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Delivery Address <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={orderData.deliveryAddress}
              onChangeText={(text) => setOrderData({ ...orderData, deliveryAddress: text })}
              placeholder="Enter your full delivery address"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={orderData.notes}
              onChangeText={(text) => setOrderData({ ...orderData, notes: text })}
              placeholder="Any special instructions or notes"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Order Total */}
          <View style={styles.totalSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Quantity:</Text>
              <Text style={styles.totalValue}>{orderData.quantity || 0} {product.unit}(s)</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Price per unit:</Text>
              <Text style={styles.totalValue}>₱{product.price.toLocaleString()}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total Amount:</Text>
              <Text style={styles.grandTotalValue}>₱{calculateTotal().toLocaleString()}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.orderButton, ordering && styles.orderButtonDisabled]}
          onPress={handleOrder}
          disabled={ordering}
        >
          <Text style={styles.orderButtonText}>
            {ordering ? 'Placing Order...' : 'Place Order'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Purchase Success Modal */}
      {product && (
        <PurchaseSuccessModal
          visible={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          purchaseCode={purchaseCode}
          orderDetails={{
            farmName: product.profiles?.farm_name ||
                     `${product.profiles?.first_name || ''} ${product.profiles?.last_name || ''}`.trim() ||
                     'Unknown Farm',
            totalAmount: calculateTotal(),
            purchaseDate: new Date().toISOString(),
            productName: product.name,
            quantity: parseInt(orderData.quantity) || 0,
            unit: product.unit,
          }}
          onViewOrders={() => {
            setShowSuccessModal(false);
            router.push('/buyer/my-orders');
          }}
          onBackToMarketplace={() => {
            setShowSuccessModal(false);
            router.push('/buyer/marketplace');
          }}
        />
      )}
    </KeyboardAvoidingView>
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
    flex: 1,
    padding: 16,
  },
  productSummary: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  productName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
    marginBottom: 4,
  },
  availableStock: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  farmerName: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
  },
  formSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#dc2626',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  totalSection: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 16,
    marginTop: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: '#374151',
  },
  totalValue: {
    fontSize: 16,
    color: '#111827',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    marginTop: 8,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },
  orderButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  orderButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  orderButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});