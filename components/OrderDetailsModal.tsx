import React from 'react';
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface OrderDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  order: {
    id: string;
    status: string;
    total_price: number;
    created_at: string;
    delivery_address: string | null;
    notes?: string | null;
    farmer_profile?: {
      first_name: string | undefined;
      last_name: string | undefined;
      farm_name: string | undefined;
      barangay: string | undefined;
    };
    order_items?: Array<{
      product: {
        name: string;
        unit: string;
      };
      quantity: number;
      unit_price: number;
    }>;
  };
}

export default function OrderDetailsModal({
  visible,
  onClose,
  order,
}: OrderDetailsModalProps) {
  const getTrackingSteps = () => {
    const steps = [
      {
        id: 1,
        title: 'Order Placed',
        description: 'Your order has been successfully placed',
        status: 'placed',
        icon: '📝',
      },
      {
        id: 2,
        title: 'Approved by Admin',
        description: 'Order has been reviewed and approved',
        status: 'confirmed',
        icon: '✅',
      },
      {
        id: 3,
        title: 'Shipped by Farmer',
        description: `Product shipped to ${order.farmer_profile?.barangay || 'barangay'}`,
        status: 'preparing',
        icon: '🚚',
      },
      {
        id: 4,
        title: 'Ready for Pickup',
        description: `Available for pickup at ${order.farmer_profile?.barangay || 'barangay'}`,
        status: 'ready',
        icon: '📦',
      },
      {
        id: 5,
        title: 'Finished',
        description: 'Order completed successfully',
        status: 'completed',
        icon: '🎉',
      },
    ];

    return steps;
  };

  const getCurrentStepIndex = () => {
    switch (order.status) {
      case 'pending': return 0;
      case 'confirmed': return 1;
      case 'preparing': return 2;
      case 'ready': return 3;
      case 'completed': return 4;
      default: return 0;
    }
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(price);
  };

  const steps = getTrackingSteps();
  const currentStepIndex = getCurrentStepIndex();

  return (
    <Modal
      visible={visible}
      animationKeyframesType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Order Details</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Order Summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Summary</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Order ID:</Text>
                  <Text style={styles.summaryValue}>#{order.id.slice(-8).toUpperCase()}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Order Date:</Text>
                  <Text style={styles.summaryValue}>{formatDate(order.created_at)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Farm:</Text>
                  <Text style={styles.summaryValue}>
                    {order.farmer_profile?.farm_name ||
                     `${order.farmer_profile?.first_name || ''} ${order.farmer_profile?.last_name || ''}`.trim() ||
                     'Unknown Farm'}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Location:</Text>
                  <Text style={styles.summaryValue}>
                    {order.farmer_profile?.barangay || 'Not specified'}
                  </Text>
                </View>
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total Amount:</Text>
                  <Text style={styles.totalValue}>{formatPrice(order.total_price)}</Text>
                </View>
              </View>
            </View>

            {/* Product Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Product Details</Text>
              <View style={styles.productCard}>
                {order.order_items?.map((item, index) => (
                  <View key={index} style={styles.productItem}>
                    <View style={styles.productIcon}>
                      <Text style={styles.productIconText}>🌾</Text>
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{item.product.name}</Text>
                      <Text style={styles.productDetails}>
                        Quantity: {item.quantity} {item.product.unit}
                      </Text>
                      <Text style={styles.productPrice}>
                        Unit Price: {formatPrice(item.unit_price)}
                      </Text>
                      <Text style={styles.productTotal}>
                        Subtotal: {formatPrice(item.quantity * item.unit_price)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Delivery Information */}
            {(order.delivery_address || order.notes) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Delivery Information</Text>
                <View style={styles.deliveryCard}>
                  {order.delivery_address && (
                    <View style={styles.deliveryRow}>
                      <Text style={styles.deliveryIcon}>📍</Text>
                      <View style={styles.deliveryInfo}>
                        <Text style={styles.deliveryLabel}>Delivery Address</Text>
                        <Text style={styles.deliveryText}>{order.delivery_address}</Text>
                      </View>
                    </View>
                  )}
                  {order.notes && (
                    <View style={styles.deliveryRow}>
                      <Text style={styles.deliveryIcon}>📝</Text>
                      <View style={styles.deliveryInfo}>
                        <Text style={styles.deliveryLabel}>Special Instructions</Text>
                        <Text style={styles.deliveryText}>{order.notes}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Order Tracking */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Tracking</Text>
              <View style={styles.trackingCard}>
                {steps.map((step, index) => {
                  const isCompleted = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;

                  return (
                    <View key={step.id} style={styles.trackingStep}>
                      <View style={styles.stepLeft}>
                        <View style={[
                          styles.stepIcon,
                          isCompleted && styles.stepIconCompleted,
                          isCurrent && styles.stepIconCurrent,
                        ]}>
                          <Text style={[
                            styles.stepIconText,
                            isCompleted && styles.stepIconTextCompleted,
                          ]}>
                            {isCompleted ? step.icon : step.id}
                          </Text>
                        </View>
                        {index < steps.length - 1 && (
                          <View style={[
                            styles.stepLine,
                            isCompleted && styles.stepLineCompleted,
                          ]} />
                        )}
                      </View>
                      <View style={styles.stepRight}>
                        <Text style={[
                          styles.stepTitle,
                          isCompleted && styles.stepTitleCompleted,
                          isCurrent && styles.stepTitleCurrent,
                        ]}>
                          {step.title}
                        </Text>
                        <Text style={[
                          styles.stepDescription,
                          isCompleted && styles.stepDescriptionCompleted,
                        ]}>
                          {step.description}
                        </Text>
                        {isCurrent && (
                          <View style={styles.currentBadge}>
                            <Text style={styles.currentBadgeText}>Current</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.95,
    maxHeight: height * 0.9,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },

  // Order Summary
  summaryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
    flex: 1,
    textAlign: 'right',
  },

  // Product Details
  productCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  productItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  productIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  productIconText: {
    fontSize: 20,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  productDetails: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  productTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },

  // Delivery Information
  deliveryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deliveryRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  deliveryIcon: {
    fontSize: 16,
    marginRight: 12,
    marginTop: 2,
  },
  deliveryInfo: {
    flex: 1,
  },
  deliveryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  deliveryText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },

  // Order Tracking
  trackingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  trackingStep: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepLeft: {
    alignItems: 'center',
    marginRight: 16,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconCompleted: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  stepIconCurrent: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  stepIconText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  stepIconTextCompleted: {
    color: '#ffffff',
  },
  stepLine: {
    width: 2,
    height: 24,
    backgroundColor: '#d1d5db',
    marginTop: 8,
  },
  stepLineCompleted: {
    backgroundColor: '#10b981',
  },
  stepRight: {
    flex: 1,
    paddingTop: 8,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6b7280',
    marginBottom: 4,
  },
  stepTitleCompleted: {
    color: '#1f2937',
  },
  stepTitleCurrent: {
    color: '#3b82f6',
  },
  stepDescription: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
  },
  stepDescriptionCompleted: {
    color: '#6b7280',
  },
  currentBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  currentBadgeText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '600',
  },
});