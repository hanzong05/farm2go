import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Share,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { generateQRCodeData } from '../utils/purchaseCode';

const { width, height } = Dimensions.get('window');

interface OrderQRCodeModalProps {
  visible: boolean;
  onClose: () => void;
  order: {
    id: string;
    purchase_code?: string;
    total_amount: number;
    created_at: string;
    status: string;
    farmer_profile?: {
      first_name: string | null;
      last_name: string | null;
      farm_name: string | null;
      barangay: string | null;
    };
    order_items?: Array<{
      product: {
        name: string;
        unit: string;
      };
      quantity: number;
    }>;
  };
}

export default function OrderQRCodeModal({
  visible,
  onClose,
  order,
}: OrderQRCodeModalProps) {
  // Debug the order data
  console.log('🔍 OrderQRCodeModal - Order data:', {
    orderId: order.id,
    purchaseCodeFromDB: order.purchase_code,
    orderKeys: Object.keys(order)
  });

  // Generate purchase code if not exists (for backward compatibility)
  const purchaseCode = order.purchase_code || `FG-${new Date(order.created_at).getFullYear()}-${order.id.slice(-6).toUpperCase()}`;

  console.log('📝 Final purchase code used:', {
    fromDatabase: order.purchase_code,
    generated: `FG-${new Date(order.created_at).getFullYear()}-${order.id.slice(-6).toUpperCase()}`,
    final: purchaseCode
  });

  const farmName = order.farmer_profile?.farm_name ||
    `${order.farmer_profile?.first_name || ''} ${order.farmer_profile?.last_name || ''}`.trim() ||
    'Unknown Farm';

  const productName = order.order_items?.[0]?.product?.name || 'Farm Products';

  const qrCodeData = generateQRCodeData(purchaseCode, {
    farmName,
    totalAmount: order.total_amount,
    purchaseDate: order.created_at,
    productName,
  });

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Farm2Go Order Verification\n\nOrder ID: ${order.id.slice(-8)}\nPurchase Code: ${purchaseCode}\nFarm: ${farmName}\nProduct: ${productName}\nTotal: ₱${order.total_amount.toLocaleString()}\nDate: ${new Date(order.created_at).toLocaleDateString()}\nStatus: ${order.status.toUpperCase()}\n\nScan the QR code to verify this order.`,
        title: 'Farm2Go Order Verification',
      });
    } catch (error) {
      console.error('Error sharing:', error);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'ready': return '#3b82f6';
      case 'preparing': return '#8b5cf6';
      case 'confirmed': return '#f59e0b';
      case 'pending': return '#6b7280';
      case 'cancelled': return '#dc2626';
      default: return '#6b7280';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Order Verification</Text>
              <Text style={styles.subtitle}>Show this QR code to verify your order</Text>
            </View>

            {/* Purchase Code Section */}
            <View style={styles.codeSection}>
              <Text style={styles.codeLabel}>Purchase Code</Text>
              <View style={styles.codeContainer}>
                <Text style={styles.code}>{purchaseCode}</Text>
              </View>
            </View>

            {/* QR Code Section */}
            <View style={styles.qrSection}>
              <Text style={styles.qrLabel}>Verification QR Code</Text>
              <View style={styles.qrContainer}>
                <QRCode
                  value={qrCodeData}
                  size={200}
                  color="#000000"
                  backgroundColor="#ffffff"
                />
              </View>
              <Text style={styles.qrDescription}>
                Scan this code to verify order authenticity
              </Text>
            </View>

            {/* Order Details */}
            <View style={styles.detailsSection}>
              <Text style={styles.detailsTitle}>Order Information</Text>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Order ID:</Text>
                <Text style={styles.detailValue}>#{order.id.slice(-8)}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status:</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                  <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Farm:</Text>
                <Text style={styles.detailValue}>{farmName}</Text>
              </View>

              {order.farmer_profile?.barangay && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Location:</Text>
                  <Text style={styles.detailValue}>{order.farmer_profile.barangay}</Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Product:</Text>
                <Text style={styles.detailValue}>{productName}</Text>
              </View>

              {order.order_items?.[0] && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Quantity:</Text>
                  <Text style={styles.detailValue}>
                    {order.order_items[0].quantity} {order.order_items[0].product.unit}
                  </Text>
                </View>
              )}

              <View style={[styles.detailRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Amount:</Text>
                <Text style={styles.totalValue}>
                  ₱{order.total_amount.toLocaleString()}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Order Date:</Text>
                <Text style={styles.detailValue}>
                  {formatDate(order.created_at)}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionSection}>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <Text style={styles.shareButtonText}>📤 Share Order Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
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
    width: width * 0.9,
    maxHeight: height * 0.85,
    backgroundColor: '#ffffff',
    borderRadius: 20,
  },
  scrollContent: {
    padding: 24,
  },

  // Header Section
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },

  // Code Section
  codeSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  codeLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  codeContainer: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  code: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },

  // QR Section
  qrSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  qrLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  qrContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  qrDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Details Section
  detailsSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 16,
    color: '#6b7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
    flex: 1,
    textAlign: 'right',
  },

  // Action Section
  actionSection: {
    gap: 12,
  },
  shareButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
});