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

interface PurchaseSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  purchaseCode: string;
  orderDetails: {
    farmName?: string;
    totalAmount: number;
    purchaseDate: string;
    productName?: string;
    quantity: number;
    unit: string;
  };
  onViewOrders: () => void;
  onBackToMarketplace: () => void;
}

export default function PurchaseSuccessModal({
  visible,
  onClose,
  purchaseCode,
  orderDetails,
  onViewOrders,
  onBackToMarketplace,
}: PurchaseSuccessModalProps) {
  const qrCodeData = generateQRCodeData(purchaseCode, orderDetails);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `My Farm2Go Purchase Receipt\n\nPurchase Code: ${purchaseCode}\nFarm: ${orderDetails.farmName}\nProduct: ${orderDetails.productName}\nQuantity: ${orderDetails.quantity} ${orderDetails.unit}\nTotal: ₱${orderDetails.totalAmount.toLocaleString()}\nDate: ${new Date(orderDetails.purchaseDate).toLocaleDateString()}\n\nVerify this purchase with the QR code below.`,
        title: 'Farm2Go Purchase Receipt',
      });
    } catch (error) {
      console.error('Error sharing:', error);
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
            {/* Success Header */}
            <View style={styles.header}>
              <View style={styles.successIcon}>
                <Text style={styles.checkmark}>✓</Text>
              </View>
              <Text style={styles.title}>Order Placed Successfully!</Text>
              <Text style={styles.subtitle}>
                Your order has been sent to the farmer
              </Text>
            </View>

            {/* Purchase Code Section */}
            <View style={styles.codeSection}>
              <Text style={styles.codeLabel}>Your Purchase Code</Text>
              <View style={styles.codeContainer}>
                <Text style={styles.code}>{purchaseCode}</Text>
              </View>
              <Text style={styles.codeDescription}>
                Keep this code for your records. It's unique to your purchase.
              </Text>
            </View>

            {/* QR Code Section */}
            <View style={styles.qrSection}>
              <Text style={styles.qrLabel}>Verification QR Code</Text>
              <View style={styles.qrContainer}>
                <QRCode
                  value={qrCodeData}
                  size={180}
                  color="#000000"
                  backgroundColor="#ffffff"
                  logo={undefined}
                />
              </View>
              <Text style={styles.qrDescription}>
                Show this QR code to verify your purchase
              </Text>
            </View>

            {/* Order Details */}
            <View style={styles.detailsSection}>
              <Text style={styles.detailsTitle}>Order Summary</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Farm:</Text>
                <Text style={styles.detailValue}>{orderDetails.farmName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Product:</Text>
                <Text style={styles.detailValue}>{orderDetails.productName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Quantity:</Text>
                <Text style={styles.detailValue}>
                  {orderDetails.quantity} {orderDetails.unit}
                </Text>
              </View>
              <View style={[styles.detailRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Amount:</Text>
                <Text style={styles.totalValue}>
                  ₱{orderDetails.totalAmount.toLocaleString()}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date:</Text>
                <Text style={styles.detailValue}>
                  {new Date(orderDetails.purchaseDate).toLocaleDateString()}
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
                <Text style={styles.shareButtonText}>📤 Share Receipt</Text>
              </TouchableOpacity>

              <View style={styles.navigationButtons}>
                <TouchableOpacity
                  style={styles.ordersButton}
                  onPress={onViewOrders}
                  activeOpacity={0.8}
                >
                  <Text style={styles.ordersButtonText}>View Orders</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.marketplaceButton}
                  onPress={onBackToMarketplace}
                  activeOpacity={0.8}
                >
                  <Text style={styles.marketplaceButtonText}>Continue Shopping</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
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
    position: 'relative',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: 'bold',
  },

  // Header Section
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkmark: {
    fontSize: 40,
    color: '#ffffff',
    fontWeight: 'bold',
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
    marginBottom: 12,
  },
  code: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  codeDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
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
    gap: 16,
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
  navigationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  ordersButton: {
    flex: 1,
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ordersButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  marketplaceButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  marketplaceButtonText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
});