import React, { useState, useEffect } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Camera, CameraView } from 'expo-camera';

const { width, height } = Dimensions.get('window');

interface OrderQRScannerProps {
  visible: boolean;
  onClose: () => void;
  onOrderScanned: (orderData: any) => void;
}

export default function OrderQRScanner({ visible, onClose, onOrderScanned }: OrderQRScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    if (visible) {
      getCameraPermissions();
      setScanned(false); // Reset scanned state when modal opens
    }
  }, [visible]);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return; // Prevent multiple scans

    setScanned(true);

    try {
      // Parse the QR code data - expecting JSON format with order information
      const qrData = JSON.parse(data);

      // Validate that this is a Farm2Go purchase QR code
      if (qrData.type === 'FARM2GO_PURCHASE' && qrData.code) {
        console.log('Farm2Go QR scanned:', qrData);

        // Transform the QR data to match what OrderVerificationModal expects
        const orderData = {
          purchaseCode: qrData.code,
          farmName: qrData.farm,
          totalAmount: qrData.amount,
          purchaseDate: qrData.date,
          productName: qrData.product,
          verified: qrData.verified
        };

        onOrderScanned(orderData);
      } else {
        Alert.alert(
          'Invalid QR Code',
          'This QR code is not a valid Farm2Go purchase code.',
          [
            { text: 'Scan Again', onPress: () => setScanned(false) },
            { text: 'Close', onPress: onClose }
          ]
        );
      }
    } catch (error) {
      console.error('Error parsing QR code:', error);
      Alert.alert(
        'Invalid QR Code',
        'Unable to read QR code. Please try again.',
        [
          { text: 'Scan Again', onPress: () => setScanned(false) },
          { text: 'Close', onPress: onClose }
        ]
      );
    }
  };

  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.container}>
          <Text style={styles.message}>Requesting camera permission...</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.container}>
          <Text style={styles.message}>No access to camera</Text>
          <Text style={styles.subMessage}>
            Please enable camera permissions to scan QR codes
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Scan Order QR Code</Text>
          <TouchableOpacity style={styles.headerCloseButton} onPress={onClose}>
            <Text style={styles.headerCloseButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Camera View */}
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          />

          {/* Scanning Overlay */}
          <View style={styles.overlay}>
            <View style={styles.overlayTop} />
            <View style={styles.overlayMiddle}>
              <View style={styles.overlaySide} />
              <View style={styles.scanArea}>
                <View style={styles.scanFrame}>
                  {/* Corner indicators */}
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
              </View>
              <View style={styles.overlaySide} />
            </View>
            <View style={styles.overlayBottom} />
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>
            {scanned ? 'Processing...' : 'Point camera at QR code'}
          </Text>
          <Text style={styles.instructionText}>
            {scanned ?
              'Please wait while we verify the order' :
              'Make sure the QR code is clearly visible within the frame'
            }
          </Text>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          {scanned ? (
            <TouchableOpacity
              style={styles.scanAgainButton}
              onPress={() => setScanned(false)}
            >
              <Text style={styles.scanAgainButtonText}>Scan Again</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#000',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  headerCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCloseButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: 250,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanArea: {
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 200,
    height: 200,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#10B981',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  instructions: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#000',
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 40,
    backgroundColor: '#000',
  },
  scanAgainButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  scanAgainButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  message: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  subMessage: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
  },
  closeButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    alignSelf: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});