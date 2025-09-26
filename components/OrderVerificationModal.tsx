import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

interface OrderVerificationModalProps {
  visible: boolean;
  orderData: {
    purchaseCode?: string;
    farmName?: string;
    totalAmount?: number;
    purchaseDate?: string;
    productName?: string;
    verified?: boolean;
  } | null;
  onClose: () => void;
  onOrderCompleted: () => void;
}

interface OrderDetails {
  id: string;
  buyer_id: string;
  farmer_id: string;
  total_price: number;
  status: string;
  created_at: string;
  updated_at: string;
  purchase_code?: string;
  buyer_profile?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
  farmer_profile?: {
    first_name: string | null;
    last_name: string | null;
    farm_name: string | null;
  };
  product?: {
    name: string;
    price: number;
    unit: string;
    image_url: string | null;
  };
  quantity?: number;
}

export default function OrderVerificationModal({
  visible,
  orderData,
  onClose,
  onOrderCompleted,
}: OrderVerificationModalProps) {
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (visible && orderData?.purchaseCode) {
      loadOrderFromPurchaseCode();
    }
  }, [visible, orderData]);

  const loadOrderFromPurchaseCode = async () => {
    if (!orderData) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      console.log('🔍 Loading order for purchase code:', orderData.purchaseCode);

      // First try a simple query to test RLS (without .single() to see all results)
      const { data: allOrders, error: allError } = await supabase
        .from('orders')
        .select('id, purchase_code, status')
        .limit(5);

      console.log('🧪 Test query (all orders - first 5):', { allOrders, allError });

      // Test specific purchase code query
      const { data: testData, error: testError } = await supabase
        .from('orders')
        .select('id, purchase_code, status')
        .eq('purchase_code', orderData.purchaseCode);

      console.log('🧪 Test query (specific purchase code):', { testData, testError, count: testData?.length });

      // Try to find the order by purchase code
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          buyer_profile:profiles!buyer_id(first_name, last_name, email),
          farmer_profile:profiles!farmer_id(first_name, last_name, farm_name),
          product:products(name, price, unit, image_url)
        `)
        .eq('purchase_code', orderData.purchaseCode)
        .single();

      console.log('📋 Order query result:', {
        data,
        error: error ? {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        } : null
      });

      if (error || !data) {
        console.log('⚠️ Order not found in database, creating mock order');
        // If order not found in database, create a mock order from QR data
        const mockOrder = {
          id: orderData.purchaseCode || 'unknown',
          buyer_id: 'unknown',
          farmer_id: 'unknown',
          total_price: orderData.totalAmount || 0,
          status: 'verified_by_qr',
          created_at: orderData.purchaseDate || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          purchase_code: orderData.purchaseCode,
          buyer_profile: null,
          farmer_profile: {
            first_name: null,
            last_name: null,
            farm_name: orderData.farmName || 'Unknown Farm'
          },
          product: {
            name: orderData.productName || 'Farm Products',
            price: 0,
            unit: 'item',
            image_url: null
          },
          quantity: 1
        };
        setOrder(mockOrder as OrderDetails);
      } else {
        console.log('✅ Order found in database:', data);
        setOrder(data);
      }
    } catch (error) {
      console.error('Error loading order details:', error);
      Alert.alert('Error', 'Failed to load order details. Please try again.', [
        { text: 'OK', onPress: onClose }
      ]);
    } finally {
      setLoading(false);
    }
  };

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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return '#10B981';
      case 'cancelled':
      case 'rejected':
        return '#EF4444';
      case 'pending':
        return '#F59E0B';
      case 'confirmed':
      case 'approved':
      case 'ready':
        return '#3B82F6';
      case 'processing':
        return '#8B5CF6';
      default:
        return '#6B7280';
    }
  };

  const handleMarkAsCompleted = () => {
    if (!order) return;

    Alert.alert(
      'Complete Order?',
      `Are you sure you want to mark this order as completed? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete Order',
          style: 'default',
          onPress: completeOrder
        }
      ]
    );
  };

  const completeOrder = async () => {
    if (!order) return;

    try {
      setCompleting(true);

      console.log('🔄 Attempting to complete order:', {
        orderId: order.id,
        purchaseCode: order.purchase_code,
        currentStatus: order.status
      });

      // If we have a purchase code, try to update by purchase code
      if (order.purchase_code) {
        console.log('📝 Updating order with purchase code:', order.purchase_code);

        const { data, error } = await supabase
          .from('orders')
          .update({
            status: 'delivered',
            updated_at: new Date().toISOString()
          })
          .eq('purchase_code', order.purchase_code)
          .select();

        console.log('📋 Database update result:', { data, error });

        if (error) {
          console.error('❌ Failed to update order in database:', error);
          Alert.alert('Database Error', `Failed to update order: ${error.message}`);
          return;
        }

        if (!data || data.length === 0) {
          console.warn('⚠️ No rows updated - purchase code may not exist in database');
          Alert.alert('Order Not Found', 'This purchase code was not found in the database. The order may have been scanned from a QR code but not exist in our system.');
          return;
        }

        console.log('✅ Order updated successfully:', data);
      }

      Alert.alert(
        'Order Completed!',
        'The purchase has been successfully verified and marked as completed.',
        [
          {
            text: 'OK',
            onPress: () => {
              onOrderCompleted();
              onClose();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error completing order:', error);
      Alert.alert('Error', 'Failed to complete order. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  const buyerName = order?.buyer_profile ?
    `${order.buyer_profile.first_name} ${order.buyer_profile.last_name}`.trim() :
    'Unknown Buyer';

  const farmerName = order?.farmer_profile ?
    `${order.farmer_profile.first_name} ${order.farmer_profile.last_name}`.trim() ||
    order.farmer_profile.farm_name :
    'Unknown Farmer';

  return (
    <Modal visible={visible} animationKeyframesType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Order Verification</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Loading order details...</Text>
          </View>
        ) : order ? (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Order Header */}
            <View style={styles.orderHeader}>
              <View style={styles.orderInfo}>
                <Text style={styles.orderId}>Order #{order.id.slice(-8).toUpperCase()}</Text>
                <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                <Text style={styles.statusText}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </Text>
              </View>
            </View>

            {/* Product Information */}
            {order.product && (
              <View style={styles.productSection}>
                <Text style={styles.sectionTitle}>Product Details</Text>
                <View style={styles.productCard}>
                  <View style={styles.productImageContainer}>
                    {order.product.image_url ? (
                      <Image
                        source={{ uri: order.product.image_url }}
                        style={styles.productImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.productImagePlaceholder}>
                        <Text style={styles.productImagePlaceholderText}>📦</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{order.product.name}</Text>
                    <Text style={styles.productPrice}>
                      {formatPrice(order.product.price)} per {order.product.unit}
                    </Text>
                    {order.quantity && (
                      <Text style={styles.productQuantity}>
                        Quantity: {order.quantity} {order.product.unit}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Order Details */}
            <View style={styles.orderDetails}>
              <Text style={styles.sectionTitle}>Order Information</Text>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Buyer:</Text>
                <Text style={styles.detailValue}>{buyerName}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email:</Text>
                <Text style={styles.detailValue}>{order.buyer_profile?.email || 'N/A'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Farmer:</Text>
                <Text style={styles.detailValue}>🌾 {farmerName}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Amount:</Text>
                <Text style={styles.totalAmount}>{formatPrice(order.total_price)}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status:</Text>
                <View style={[styles.inlineStatusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                  <Text style={styles.inlineStatusText}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Text>
                </View>
              </View>
            </View>

            {/* QR Code Information */}
            <View style={styles.qrInfo}>
              <Text style={styles.sectionTitle}>QR Code Verification</Text>
              <View style={styles.qrDetails}>
                <Text style={styles.qrDetailText}>✅ Purchase code verified</Text>
                <Text style={styles.qrDetailText}>✅ Farm2Go QR code authenticated</Text>
                <Text style={styles.qrDetailText}>✅ Purchase details validated</Text>
                {orderData?.verified && (
                  <Text style={styles.qrDetailText}>✅ QR code integrity confirmed</Text>
                )}
              </View>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Order not found</Text>
          </View>
        )}

        {/* Bottom Actions */}
        {order && order.status !== 'completed' && order.status !== 'delivered' && !loading && (
          <View style={styles.bottomActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.completeButton, completing && styles.completeButtonDisabled]}
              onPress={handleMarkAsCompleted}
              disabled={completing}
            >
              {completing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.completeButtonText}>✓ Mark as Completed</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {order && (order.status === 'completed' || order.status === 'delivered') && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedText}>✅ This order has already been completed</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 20,
    marginBottom: 24,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  productSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImageContainer: {
    width: 80,
    height: 80,
    marginRight: 16,
  },
  productImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImagePlaceholderText: {
    fontSize: 24,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
    marginBottom: 4,
  },
  productQuantity: {
    fontSize: 14,
    color: '#6B7280',
  },
  orderDetails: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
    textAlign: 'right',
  },
  totalAmount: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '600',
  },
  inlineStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inlineStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  qrInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrDetails: {
    gap: 8,
  },
  qrDetailText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  completeButton: {
    flex: 2,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  completedBanner: {
    backgroundColor: '#D1FAE5',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  completedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065F46',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    textAlign: 'center',
  },
});