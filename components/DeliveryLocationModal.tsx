import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

interface DeliveryLocationModalProps {
  visible: boolean;
  onClose: () => void;
  deliveryAddress: string;
  orderInfo?: {
    orderId: string;
    buyerName?: string;
  };
}

// Conditionally import MapView only for native platforms
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  try {
    const maps = require('react-native-maps');
    MapView = maps.default || maps.MapView;
    Marker = maps.Marker;
    PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.error('❌ react-native-maps not available:', e);
  }
}

export default function DeliveryLocationModal({
  visible,
  onClose,
  deliveryAddress,
  orderInfo,
}: DeliveryLocationModalProps) {
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    if (visible) {
      loadLocation();
    }
  }, [visible, deliveryAddress]);

  const loadLocation = async () => {
    try {
      setLoading(true);
      console.log('📍 Geocoding delivery address:', deliveryAddress);

      const searchAddress = deliveryAddress.includes('Philippines')
        ? deliveryAddress
        : `${deliveryAddress}, Philippines`;

      const geocoded = await Location.geocodeAsync(searchAddress);
      console.log('✅ Geocoding result:', geocoded);

      if (geocoded.length > 0) {
        setLocation({
          latitude: geocoded[0].latitude,
          longitude: geocoded[0].longitude,
        });
      } else {
        console.warn('⚠️ No geocoding results, using default location');
        setLocation({
          latitude: 14.5995,
          longitude: 120.9842,
        });
      }
    } catch (error) {
      console.error('❌ Error geocoding address:', error);
      setLocation({
        latitude: 14.5995,
        longitude: 120.9842,
      });
    } finally {
      setLoading(false);
    }
  };

  const renderWebMap = () => {
    if (!location) return null;

    return (
      <View style={styles.webMapContainer}>
        <iframe
          srcDoc={`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
              <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
              <style>
                body { margin: 0; padding: 0; }
                #map { width: 100%; height: 100vh; }
              </style>
            </head>
            <body>
              <div id="map"></div>
              <script>
                const map = L.map('map').setView([${location.latitude}, ${location.longitude}], 15);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                  attribution: '© OpenStreetMap contributors',
                  maxZoom: 19
                }).addTo(map);

                // Custom marker icon
                const markerIcon = L.divIcon({
                  html: '<div style="background: #ef4444; width: 40px; height: 40px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.3); position: relative;"><div style="position: absolute; width: 10px; height: 10px; background: white; border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(45deg);"></div></div>',
                  iconSize: [40, 40],
                  iconAnchor: [20, 40],
                  popupAnchor: [0, -40]
                });

                const marker = L.marker([${location.latitude}, ${location.longitude}], {icon: markerIcon})
                  .addTo(map)
                  .bindPopup('<b>Delivery Location</b><br>${deliveryAddress}')
                  .openPopup();
              </script>
            </body>
            </html>
          `}
          width="100%"
          height="100%"
          style={{ border: 0 }}
        />
      </View>
    );
  };

  const renderNativeMap = () => {
    if (!MapView || !location) return null;

    return (
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        <Marker
          coordinate={location}
          title="Delivery Location"
          description={deliveryAddress}
          pinColor="red"
        />
      </MapView>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Delivery Location</Text>
            {orderInfo && (
              <Text style={styles.headerSubtitle}>
                Order #{orderInfo.orderId.slice(-8)}
                {orderInfo.buyerName && ` • ${orderInfo.buyerName}`}
              </Text>
            )}
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Map Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Loading location...</Text>
          </View>
        ) : (
          Platform.OS === 'web' ? renderWebMap() : renderNativeMap()
        )}

        {/* Address Info Card */}
        {!loading && location && (
          <View style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <Text style={styles.addressIcon}>📍</Text>
              <Text style={styles.addressTitle}>Delivery Address</Text>
            </View>
            <Text style={styles.addressText}>{deliveryAddress}</Text>
            <View style={styles.coordinatesRow}>
              <Text style={styles.coordinatesText}>
                📐 {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#0f172a',
    fontWeight: 'bold',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  map: {
    flex: 1,
  },
  webMapContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#64748b',
  },
  addressCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  addressText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  coordinatesRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  coordinatesText: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
