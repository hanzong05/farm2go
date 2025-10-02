import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

interface MapDirectionsModalProps {
  visible: boolean;
  onClose: () => void;
  deliveryAddress: string;
  orderInfo?: {
    orderId: string;
    productName: string;
    status: string;
  };
}

interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
  maneuver?: string;
}

// Import MapView for native platforms
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';

export default function MapDirectionsModal({
  visible,
  onClose,
  deliveryAddress,
  orderInfo,
}: MapDirectionsModalProps) {
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [distance, setDistance] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [locationSubscription, setLocationSubscription] = useState<any>(null);

  useEffect(() => {
    if (visible) {
      initializeMap();
      startLiveTracking();
    } else {
      stopLiveTracking();
    }

    return () => {
      stopLiveTracking();
    };
  }, [visible]);

  // Automatically fetch route when both locations are available
  useEffect(() => {
    if (currentLocation && destinationLocation) {
      console.log('🗺️ Both locations available, fetching route...');
      fetchRoute(currentLocation, destinationLocation);
    }
  }, [currentLocation, destinationLocation]);

  const initializeMap = async () => {
    try {
      setLoading(true);
      console.log('Initializing map...');

      // Get current location first
      const location = await getCurrentLocation();
      console.log('✅ Current location obtained:', location);

      // Geocode delivery address
      console.log('📍 Geocoding address:', deliveryAddress);
      await geocodeAddress(deliveryAddress);

      setLoading(false);
      console.log('✅ Map initialization complete');
    } catch (error) {
      console.error('❌ Map initialization error:', error);
      setLoading(false);
    }
  };

  const startLiveTracking = async () => {
    try {
      console.log('🔴 Starting live location tracking...');

      if (Platform.OS === 'web') {
        // Web live tracking using watchPosition
        if (navigator && navigator.geolocation) {
          const watchId = navigator.geolocation.watchPosition(
            (position) => {
              console.log('📍 Live location update:', position.coords);
              setCurrentLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
            },
            (error) => {
              console.warn('⚠️ Live tracking error:', error.message);
            },
            {
              enableHighAccuracy: true,
              maximumAge: 0,
              timeout: 5000,
            }
          );
          setLocationSubscription(watchId);
          console.log('✅ Web live tracking started, watchId:', watchId);
        }
      } else {
        // Native live tracking
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.BestForNavigation,
              distanceInterval: 10, // Update every 10 meters
              timeInterval: 5000, // Update every 5 seconds
            },
            (location) => {
              console.log('📍 Live location update:', location.coords);
              setCurrentLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });
            }
          );
          setLocationSubscription(subscription);
          console.log('✅ Native live tracking started');
        }
      }
    } catch (error) {
      console.error('❌ Error starting live tracking:', error);
    }
  };

  const stopLiveTracking = () => {
    console.log('🛑 Stopping live location tracking...');
    if (locationSubscription) {
      if (Platform.OS === 'web') {
        navigator.geolocation.clearWatch(locationSubscription);
      } else {
        locationSubscription.remove();
      }
      setLocationSubscription(null);
      console.log('✅ Live tracking stopped');
    }
  };

  const getCurrentLocation = async () => {
    try {
      console.log('🔍 Getting current location, Platform:', Platform.OS);

      if (Platform.OS === 'web') {
        // Use browser geolocation for web
        if (navigator && navigator.geolocation) {
          return new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                console.log('✅ Browser location obtained:', position.coords);
                const loc = {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                };
                setCurrentLocation(loc);
                resolve();
              },
              (error) => {
                console.warn('⚠️ Browser geolocation failed:', error.message, '- using default location');
                // Default to Manila
                const loc = {
                  latitude: 14.5995,
                  longitude: 120.9842,
                };
                setCurrentLocation(loc);
                resolve();
              }
            );
          });
        } else {
          console.warn('⚠️ No geolocation available, using default location');
          // No geolocation available, use default
          setCurrentLocation({
            latitude: 14.5995,
            longitude: 120.9842,
          });
        }
      } else {
        // Native platform
        console.log('📱 Requesting location permission...');
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log('📱 Permission status:', status);

        if (status === 'granted') {
          console.log('📱 Getting current position...');
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          console.log('✅ Native location obtained:', location.coords);

          const loc = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setCurrentLocation(loc);
        } else {
          console.warn('⚠️ Location permission denied, using default location');
          setCurrentLocation({
            latitude: 14.5995,
            longitude: 120.9842,
          });
        }
      }
    } catch (error) {
      console.error('❌ Error getting location:', error);
      const defaultLoc = {
        latitude: 14.5995,
        longitude: 120.9842,
      };
      setCurrentLocation(defaultLoc);
      console.log('⚠️ Using default location:', defaultLoc);
    }
  };

  const geocodeAddress = async (address: string) => {
    try {
      console.log('🔍 Geocoding address:', address);
      if (!address || address.trim() === '') {
        console.warn('Empty address provided, using default location');
        Alert.alert(
          'No Address',
          'This order does not have a delivery address set.',
          [{ text: 'OK' }]
        );
        onClose();
        return;
      }

      setLoading(true);

      // Try Nominatim with proximity bias based on current location
      const searchAddress = address.includes('Philippines') ? address : `${address}, Philippines`;
      const encodedAddress = encodeURIComponent(searchAddress);

      // If we have current location, use it for proximity bias
      let nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=5&countrycodes=ph`;
      if (currentLocation) {
        nominatimUrl += `&viewbox=${currentLocation.longitude - 0.5},${currentLocation.latitude + 0.5},${currentLocation.longitude + 0.5},${currentLocation.latitude - 0.5}&bounded=1`;
        console.log('🌐 Using proximity bias from current location:', currentLocation);
      }

      console.log('🌐 Trying Nominatim geocoding:', nominatimUrl);

      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'Farm2Go App'
        }
      });
      const data = await response.json();

      console.log('📍 Nominatim result:', data);
      console.log('📍 Full address details:', data.length > 0 ? data[0].display_name : 'none');

      if (data && data.length > 0) {
        const dest = {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        };
        setDestinationLocation(dest);
        setLoading(false);
        console.log('✅ Destination location set from Nominatim:', dest);
        console.log('📍 Matched address:', data[0].display_name);
        return;
      }

      // Fallback to Expo Location.geocodeAsync
      console.log('⚠️ Nominatim failed, trying Expo geocoding');
      const geocoded = await Location.geocodeAsync(searchAddress);
      console.log('📍 Expo geocoding result:', geocoded);

      if (geocoded.length > 0) {
        const dest = {
          latitude: geocoded[0].latitude,
          longitude: geocoded[0].longitude,
        };
        setDestinationLocation(dest);
        setLoading(false);
        console.log('✅ Destination location set from Expo:', dest);
      } else {
        console.warn('⚠️ No geocoding results found for:', address);
        setLoading(false);
        Alert.alert(
          'Location Not Found',
          `Could not find location for "${address}". The address may be too vague or incomplete. Please provide a more specific address (e.g., include barangay, municipality/city, and province).`,
          [{ text: 'OK', onPress: onClose }]
        );
      }
    } catch (error) {
      console.error('❌ Geocoding error:', error);
      setLoading(false);
      Alert.alert(
        'Geocoding Error',
        'Failed to find the delivery location. Please try again.',
        [{ text: 'OK', onPress: onClose }]
      );
    }
  };

  const fetchRoute = async (origin: any, destination: any) => {
    try {
      console.log('🗺️ Fetching route from', origin, 'to', destination);

      // Use OSRM (Open Source Routing Machine) for routing
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&steps=true`;
      console.log('🌐 OSRM URL:', url);

      const response = await fetch(url);
      const data = await response.json();

      console.log('📊 Route response code:', data.code);

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        console.log('✅ Route found:', route);

        // Set distance and duration
        const distKm = (route.distance / 1000).toFixed(2);
        const durationMin = Math.ceil(route.duration / 60);
        setDistance(`${distKm} km`);
        setDuration(`${durationMin} min`);
        console.log(`📏 Distance: ${distKm} km, ⏱️ Duration: ${durationMin} min`);

        // Decode the route geometry
        const coordinates = decodePolyline(route.geometry);
        console.log(`🛣️ Route coordinates decoded: ${coordinates.length} points`);
        setRouteCoordinates(coordinates);

        // Extract turn-by-turn directions
        const steps: RouteStep[] = [];
        route.legs.forEach((leg: any) => {
          leg.steps.forEach((step: any) => {
            steps.push({
              instruction: step.maneuver.type === 'depart'
                ? 'Start on ' + (step.name || 'road')
                : step.maneuver.type === 'arrive'
                ? 'Arrive at destination'
                : formatInstruction(step.maneuver.type, step.name),
              distance: `${(step.distance / 1000).toFixed(2)} km`,
              duration: `${Math.ceil(step.duration / 60)} min`,
              maneuver: step.maneuver.type,
            });
          });
        });
        setRouteSteps(steps);
        console.log(`✅ ${steps.length} turn-by-turn steps extracted`);
      } else {
        console.warn('⚠️ No route found from OSRM, using straight line fallback');
        // Fallback: straight line
        setRouteCoordinates([origin, destination]);
        const dist = calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
        setDistance(`${dist.toFixed(2)} km`);
        setDuration(`${Math.ceil(dist * 2)} min`);
        setRouteSteps([
          {
            instruction: 'Head towards destination',
            distance: `${dist.toFixed(2)} km`,
            duration: `${Math.ceil(dist * 2)} min`,
          }
        ]);
        console.log(`⚠️ Using straight line: ${dist.toFixed(2)} km`);
      }
    } catch (error) {
      console.error('❌ Error fetching route:', error);
      // Fallback: straight line
      setRouteCoordinates([origin, destination]);
      const dist = calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
      setDistance(`${dist.toFixed(2)} km`);
      setDuration(`${Math.ceil(dist * 2)} min`);
      setRouteSteps([
        {
          instruction: 'Head towards destination',
          distance: `${dist.toFixed(2)} km`,
          duration: `${Math.ceil(dist * 2)} min`,
        }
      ]);
      console.log(`⚠️ Error fallback: using straight line ${dist.toFixed(2)} km`);
    }
  };

  const formatInstruction = (type: string, roadName?: string) => {
    const road = roadName || 'road';
    switch (type) {
      case 'turn':
      case 'new name':
        return `Continue on ${road}`;
      case 'turn-right':
        return `Turn right onto ${road}`;
      case 'turn-left':
        return `Turn left onto ${road}`;
      case 'slight right':
        return `Slight right onto ${road}`;
      case 'slight left':
        return `Slight left onto ${road}`;
      case 'sharp right':
        return `Sharp right onto ${road}`;
      case 'sharp left':
        return `Sharp left onto ${road}`;
      case 'roundabout':
        return `Take roundabout to ${road}`;
      case 'fork':
        return `At fork, continue on ${road}`;
      default:
        return `Continue on ${road}`;
    }
  };

  const decodePolyline = (encoded: string) => {
    // Decode polyline algorithm
    const poly = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      poly.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }
    return poly;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
  };

  const getManeuverIcon = (maneuver?: string) => {
    switch (maneuver) {
      case 'depart': return '🚗';
      case 'arrive': return '🏁';
      case 'turn-right': return '➡️';
      case 'turn-left': return '⬅️';
      case 'slight right': return '↗️';
      case 'slight left': return '↖️';
      case 'sharp right': return '⤴️';
      case 'sharp left': return '⤵️';
      case 'roundabout': return '🔄';
      default: return '⬆️';
    }
  };

  const renderWebMap = () => {
    console.log('🗺️ renderWebMap called');
    console.log('📍 currentLocation:', currentLocation);
    console.log('📍 destinationLocation:', destinationLocation);
    console.log('🛣️ routeCoordinates:', routeCoordinates.length, 'points');

    if (!currentLocation || !destinationLocation) {
      console.warn('⚠️ Cannot render map: missing location data');
      return null;
    }

    const origin = `${currentLocation.latitude},${currentLocation.longitude}`;
    const destination = `${destinationLocation.latitude},${destinationLocation.longitude}`;

    // Create bounds for the map
    const allCoords = routeCoordinates.length > 0 ? routeCoordinates : [currentLocation, destinationLocation];
    const lats = allCoords.map(c => c.latitude);
    const lngs = allCoords.map(c => c.longitude);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

    // Calculate zoom level based on distance
    const latDiff = Math.max(...lats) - Math.min(...lats);
    const lngDiff = Math.max(...lngs) - Math.min(...lngs);
    const maxDiff = Math.max(latDiff, lngDiff);
    const zoom = maxDiff > 0.1 ? 11 : maxDiff > 0.05 ? 12 : 13;

    // Build Leaflet map URL with route visualization
    const routePoints = routeCoordinates.length > 0
      ? routeCoordinates.map(c => `${c.latitude},${c.longitude}`).join(';')
      : `${currentLocation.latitude},${currentLocation.longitude};${destinationLocation.latitude},${destinationLocation.longitude}`;

    return (
      <ScrollView style={styles.webContainer}>
        <View style={styles.webMapSection}>
          {/* Interactive map with route */}
          <View style={styles.mapPlaceholder}>
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
                    const map = L.map('map').setView([${centerLat}, ${centerLng}], ${zoom});

                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                      attribution: '© OpenStreetMap contributors',
                      maxZoom: 19
                    }).addTo(map);

                    // Add markers
                    const startIcon = L.divIcon({
                      html: '<div style="background: #3b82f6; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 16px;">A</div>',
                      iconSize: [30, 30],
                      iconAnchor: [15, 15]
                    });

                    const endIcon = L.divIcon({
                      html: '<div style="background: #ef4444; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 16px;">B</div>',
                      iconSize: [30, 30],
                      iconAnchor: [15, 15]
                    });

                    L.marker([${currentLocation.latitude}, ${currentLocation.longitude}], {icon: startIcon})
                      .addTo(map)
                      .bindPopup('<b>Your Location</b>');

                    L.marker([${destinationLocation.latitude}, ${destinationLocation.longitude}], {icon: endIcon})
                      .addTo(map)
                      .bindPopup('<b>Destination</b><br>${deliveryAddress}');

                    // Draw route line
                    const routeCoords = ${JSON.stringify(routeCoordinates.map(c => [c.latitude, c.longitude]))};
                    if (routeCoords.length > 0) {
                      L.polyline(routeCoords, {
                        color: '#3b82f6',
                        weight: 5,
                        opacity: 0.8,
                        lineJoin: 'round',
                        lineCap: 'round'
                      }).addTo(map);
                    }

                    // Fit map to show entire route
                    const bounds = L.latLngBounds([
                      [${Math.min(...lats)}, ${Math.min(...lngs)}],
                      [${Math.max(...lats)}, ${Math.max(...lngs)}]
                    ]);
                    map.fitBounds(bounds, { padding: [30, 30] });
                  </script>
                </body>
                </html>
              `}
              width="100%"
              height="300"
              style={{ border: 0, borderRadius: 12 }}
            />
          </View>

          {/* Route Summary */}
          <View style={styles.routeSummary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>📍 Distance</Text>
              <Text style={styles.summaryValue}>{distance || 'Calculating...'}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>⏱️ Duration</Text>
              <Text style={styles.summaryValue}>{duration || 'Calculating...'}</Text>
            </View>
          </View>

          {/* Turn-by-turn directions */}
          <View style={styles.directionsSection}>
            <Text style={styles.directionsTitle}>Turn-by-Turn Directions</Text>
            {routeSteps.length > 0 ? (
              routeSteps.map((step, index) => (
                <View key={index} style={styles.directionStep}>
                  <Text style={styles.stepNumber}>{getManeuverIcon(step.maneuver)}</Text>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepInstruction}>{step.instruction}</Text>
                    <Text style={styles.stepDistance}>{step.distance} · {step.duration}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.loadingDirections}>Loading directions...</Text>
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderNativeMap = () => {
    if (!currentLocation || !destinationLocation) {
      return null;
    }

    // Calculate proper region to fit both markers and route
    const allCoords = routeCoordinates.length > 0 ? routeCoordinates : [currentLocation, destinationLocation];
    const lats = allCoords.map(c => c.latitude);
    const lngs = allCoords.map(c => c.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latDelta = (maxLat - minLat) * 1.5 || 0.05; // Add 50% padding
    const lngDelta = (maxLng - minLng) * 1.5 || 0.05;

    return (
      <>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={{
            latitude: centerLat,
            longitude: centerLng,
            latitudeDelta: latDelta,
            longitudeDelta: lngDelta,
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsTraffic={false}
          showsCompass={true}
          loadingEnabled={true}
        >
          {/* Draw route polyline first (behind markers) */}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#3b82f6"
              strokeWidth={5}
            />
          )}

          {/* Start marker */}
          <Marker
            coordinate={currentLocation}
            title="Your Location"
            description="Starting point"
          />

          {/* End marker */}
          <Marker
            coordinate={destinationLocation}
            title="Delivery Address"
            description={deliveryAddress}
          />
        </MapView>

        {/* Route info overlay */}
        <View style={styles.routeInfoCard}>
          <Text style={styles.routeInfoTitle}>📍 {deliveryAddress}</Text>
          <View style={styles.routeInfoRow}>
            <Text style={styles.routeInfoText}>📏 {distance}</Text>
            <Text style={styles.routeInfoText}>·</Text>
            <Text style={styles.routeInfoText}>⏱️ {duration}</Text>
          </View>
        </View>
      </>
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
            <Text style={styles.headerTitle}>Directions</Text>
            <Text style={styles.headerSubtitle}>{deliveryAddress}</Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Map Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Loading directions...</Text>
          </View>
        ) : (
          Platform.OS === 'web' ? renderWebMap() : renderNativeMap()
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
  webContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  webMapSection: {
    padding: 16,
  },
  mapPlaceholder: {
    width: '100%',
    height: 300,
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  routeSummary: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
  },
  directionsSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  directionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  directionStep: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  stepNumber: {
    fontSize: 24,
    marginRight: 12,
  },
  stepContent: {
    flex: 1,
  },
  stepInstruction: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
    marginBottom: 4,
  },
  stepDistance: {
    fontSize: 12,
    color: '#64748b',
  },
  loadingDirections: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 20,
  },
  routeInfoCard: {
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
  routeInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeInfoText: {
    fontSize: 14,
    color: '#64748b',
  },
});
