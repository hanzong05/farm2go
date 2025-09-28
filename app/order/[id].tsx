import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ConfirmationModal from '../../components/ConfirmationModal';
import PurchaseSuccessModal from '../../components/PurchaseSuccessModal';
import VerificationGuard from '../../components/VerificationGuard';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { notifyOrderCreated, notifyLowStock } from '../../services/notifications';
import { generateUniquePurchaseCode } from '../../utils/purchaseCode';

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

interface Profile {
  id: string;
  user_type: 'buyer' | 'farmer' | 'admin' | 'super-admin';
  first_name: string | null;
  last_name: string | null;
}

export default function OrderProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [purchaseCode, setPurchaseCode] = useState<string>('');
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

  const [orderData, setOrderData] = useState({
    quantity: '1',
    notes: '',
  });

  useEffect(() => {
    if (id && user) {
      fetchUserProfile();
      fetchProduct();
    }
  }, [id, user]);

  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_type, first_name, last_name')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      setUserProfile(data);
    } catch (err) {
      console.error('User profile fetch error:', err);
    }
  };

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

      // Prevent users from ordering their own products
      if (user && data.farmer_id === user.id) {
        setError('You cannot order your own products');
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
    if (!product || !user || !userProfile) return;

    const quantity = parseInt(orderData.quantity);

    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (quantity > product.quantity_available) {
      Alert.alert('Error', 'Requested quantity exceeds available stock');
      return;
    }

    // Show confirmation modal
    const totalAmount = calculateTotal();
    setConfirmModal({
      visible: true,
      title: 'Confirm Order?',
      message: `Are you sure you want to place this order for ${quantity} ${product.unit} of ${product.name} at ₱${totalAmount.toLocaleString()}?`,
      isDestructive: false,
      confirmText: 'Yes, Place Order',
      onConfirm: () => {
        processOrder();
        setConfirmModal(prev => ({ ...prev, visible: false }));
      }
    });
  };

  const processOrder = async () => {
    if (!product || !user || !userProfile) return;

    const quantity = parseInt(orderData.quantity);

    try {
      setOrdering(true);

      // Generate unique purchase code
      const uniquePurchaseCode = generateUniquePurchaseCode();

      // Create order record with purchase code
      const { data: newOrder, error: orderError } = await (supabase as any)
        .from('orders')
        .insert({
          buyer_id: user.id,
          farmer_id: product.farmer_id,
          product_id: product.id,
          quantity: quantity,
          total_price: calculateTotal(),
          delivery_address: product.profiles?.barangay || 'Delivery location not available',
          notes: orderData.notes,
          status: 'pending',
          purchase_code: uniquePurchaseCode,
        })
        .select()
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        console.error('Error details:', JSON.stringify(orderError, null, 2));
        Alert.alert('Error', `Failed to create order: ${orderError.message || 'Please try again.'}`);
        return;
      }

      // Send notifications about order creation
      try {
        await notifyOrderCreated(
          newOrder.id,
          user.id,
          product.farmer_id,
          {
            totalAmount: calculateTotal(),
            itemCount: 1, // Single product order
            buyerName: userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : undefined,
            farmerName: product.profiles ? `${product.profiles.first_name} ${product.profiles.last_name}` : undefined,
            productName: product.name,
            farmerBarangay: product.profiles?.barangay || undefined
          }
        );

        console.log('✅ Order creation notification sent');
      } catch (notifError) {
        console.error('⚠️ Failed to send order notification:', notifError);
        // Don't fail the order creation if notifications fail
      }

      // Update product quantity
      const newQuantity = product.quantity_available - quantity;
      const { error: updateError } = await (supabase as any)
        .from('products')
        .update({
          quantity_available: newQuantity
        })
        .eq('id', product.id);

      if (updateError) {
        console.error('Error updating product quantity:', updateError);
        // Note: Order was created but quantity wasn't updated
        // In a real app, you'd want to handle this with a transaction
      } else {
        // Check for low stock and notify farmer
        const lowStockThreshold = 5; // Default threshold
        if (newQuantity <= lowStockThreshold && newQuantity > 0) {
          try {
            await notifyLowStock(
              product.farmer_id,
              product.name,
              newQuantity,
              lowStockThreshold
            );
            console.log('✅ Low stock notification sent');
          } catch (stockNotifError) {
            console.error('⚠️ Failed to send low stock notification:', stockNotifError);
          }
        }
      }

      // Set purchase code and show success modal immediately
      setPurchaseCode(uniquePurchaseCode);
      setShowSuccessModal(true);

      // Also show a quick alert for immediate feedback
      Alert.alert(
        '✅ Success!',
        'Your order has been placed successfully! You can view your purchase details and QR code in the modal that just opened.',
        [{ text: 'OK', style: 'default' }]
      );
    } catch (err) {
      console.error('Order error:', err);
      Alert.alert('Error', 'An error occurred while placing the order');
    } finally {
      setOrdering(false);
    }
  };

  const getMyOrdersRoute = () => {
    if (!userProfile) return '/';

    switch (userProfile.user_type) {
      case 'buyer':
        return '/buyer/my-orders';
      case 'farmer':
        return '/farmer/my-orders';
      default:
        return '/';
    }
  };

  const getUserTypeForVerification = () => {
    return userProfile?.user_type === 'farmer' ? 'farmer' : 'buyer';
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

  if (!user || !userProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <VerificationGuard
      userId={user.id}
      userType={getUserTypeForVerification()}
      action="buy"
    >
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
            <Text style={styles.label}>Delivery Location</Text>
            <View style={styles.deliveryLocationDisplay}>
              <Text style={styles.deliveryLocationText}>
                📍 {product.profiles?.barangay || 'Delivery location not available'}
              </Text>
              <Text style={styles.deliveryLocationNote}>
                Delivery will be arranged within the farmer's barangay
              </Text>
            </View>
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
            router.push(getMyOrdersRoute());
          }}
          onBackToMarketplace={() => {
            setShowSuccessModal(false);
            router.push('/');
          }}
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
    </KeyboardAvoidingView>
    </VerificationGuard>
  );
}

const styles = StyleSheet.create({
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
    fontWeight: '500',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
  deliveryLocationDisplay: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  deliveryLocationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 4,
  },
  deliveryLocationNote: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
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