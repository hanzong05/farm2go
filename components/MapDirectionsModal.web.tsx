import React from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface MapDirectionsModalProps {
  visible: boolean;
  onClose: () => void;
  deliveryAddress: string;
  orderInfo?: any;
}

// Web fallback - just show address and link to Google Maps
export default function MapDirectionsModal({
  visible,
  onClose,
  deliveryAddress,
  orderInfo,
}: MapDirectionsModalProps) {
  const handleOpenGoogleMaps = () => {
    const encodedAddress = encodeURIComponent(deliveryAddress);
    const url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    window.open(url, '_blank');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Delivery Location</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {orderInfo && (
            <View style={styles.orderInfo}>
              <Text style={styles.orderLabel}>Order ID:</Text>
              <Text style={styles.orderValue}>{orderInfo.orderId?.slice(-8)}</Text>
            </View>
          )}

          <View style={styles.addressContainer}>
            <Text style={styles.addressLabel}>Delivery Address:</Text>
            <Text style={styles.addressText}>{deliveryAddress}</Text>
          </View>

          <Text style={styles.webNote}>
            Maps are only available on mobile devices. Click below to open in Google Maps.
          </Text>

          <TouchableOpacity
            style={styles.openMapsButton}
            onPress={handleOpenGoogleMaps}
          >
            <Text style={styles.openMapsButtonText}>Open in Google Maps</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748b',
    fontWeight: 'bold',
  },
  orderInfo: {
    flexDirection: 'row',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  orderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginRight: 8,
  },
  orderValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  addressContainer: {
    marginBottom: 20,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 16,
    color: '#0f172a',
    lineHeight: 24,
  },
  webNote: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  openMapsButton: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  openMapsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});
