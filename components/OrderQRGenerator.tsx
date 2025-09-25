import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const { width } = Dimensions.get('window');

interface OrderQRGeneratorProps {
  orderData: {
    type: string;
    orderId: string;
    quantity?: number;
  };
}

export default function OrderQRGenerator({ orderData }: OrderQRGeneratorProps) {
  const qrData = JSON.stringify(orderData);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order QR Code</Text>
      <View style={styles.qrContainer}>
        <QRCode
          value={qrData}
          size={200}
          color="black"
          backgroundColor="white"
        />
      </View>
      <Text style={styles.orderInfo}>
        Order ID: {orderData.orderId}
      </Text>
      {orderData.quantity && (
        <Text style={styles.orderInfo}>
          Quantity: {orderData.quantity}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  orderInfo: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
});