import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Camera, PhotoFile, TakePhotoOptions, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

interface VisionCameraProps {
  onPhotoTaken: (photoUri: string) => void;
  type: 'id' | 'face';
}

export default function VisionCamera({ onPhotoTaken, type }: VisionCameraProps) {
  const cameraRef = useRef<Camera>(null);
  const [isActive, setIsActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [currentCameraPosition, setCurrentCameraPosition] = useState<'front' | 'back'>(
    type === 'face' ? 'front' : 'back'
  );
  const [showPermissionDenied, setShowPermissionDenied] = useState(false);
  const [isNativePlatform, setIsNativePlatform] = useState(false);

  // Get camera permission status and request function
  const { hasPermission, requestPermission } = useCameraPermission();

  // Get camera device based on current position
  const device = useCameraDevice(currentCameraPosition);

  // Check if we're on a native platform
  useEffect(() => {
    const nativePlatform = Platform.OS === 'ios' || Platform.OS === 'android';
    console.log('VisionCamera Platform.OS:', Platform.OS, 'isNativePlatform:', nativePlatform);
    setIsNativePlatform(nativePlatform);

    // Set initial camera position based on type
    setCurrentCameraPosition(type === 'face' ? 'front' : 'back');
  }, [type]);

  // Handle camera permission
  useEffect(() => {
    if (!isNativePlatform) return;

    if (hasPermission === false) {
      console.log('📱 Camera permission not granted');
      setShowPermissionDenied(true);
    } else if (hasPermission === true) {
      console.log('✅ Camera permission granted');
      setShowPermissionDenied(false);
    }
  }, [hasPermission, isNativePlatform]);

  const requestCameraPermission = useCallback(async () => {
    console.log('📱 Requesting camera permission...');
    const permission = await requestPermission();

    if (permission) {
      console.log('✅ Camera permission granted');
      setShowPermissionDenied(false);
      return true;
    } else {
      console.log('❌ Camera permission denied');
      setShowPermissionDenied(true);
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access to use this feature.',
        [{ text: 'OK' }]
      );
      return false;
    }
  }, [requestPermission]);

  const startCamera = useCallback(async () => {
    if (!isNativePlatform) return;

    setIsInitializing(true);
    console.log('📷 Starting camera initialization...');

    try {
      // Check and request permission if needed
      if (!hasPermission) {
        const granted = await requestCameraPermission();
        if (!granted) {
          setIsInitializing(false);
          return;
        }
      }

      // Check if device is available
      if (!device) {
        throw new Error(`No ${currentCameraPosition} camera found on this device`);
      }

      console.log('📱 Using camera device:', {
        position: device.position,
        id: device.id,
        name: device.name || 'Unknown'
      });

      setIsActive(true);
      setIsInitializing(false);
      console.log('✅ Camera started successfully');

    } catch (error: any) {
      console.error('❌ Error starting camera:', error);
      setIsInitializing(false);

      let errorMessage = 'Failed to start camera. ';
      if (error.message.includes('No') && error.message.includes('camera found')) {
        errorMessage += `${currentCameraPosition === 'back' ? 'Back' : 'Front'} camera not available on this device.`;
      } else {
        errorMessage += 'Please check your camera permissions and try again.';
      }

      Alert.alert('Camera Error', errorMessage, [{ text: 'OK' }]);
      setShowPermissionDenied(true);
    }
  }, [isNativePlatform, hasPermission, device, currentCameraPosition, requestCameraPermission]);

  const stopCamera = useCallback(() => {
    console.log('📹 Stopping camera...');
    setIsActive(false);
    setIsInitializing(false);
  }, []);

  const switchCamera = useCallback(async () => {
    if (!isActive || isInitializing) return;

    const newPosition = currentCameraPosition === 'front' ? 'back' : 'front';
    console.log('📱 Switching camera from', currentCameraPosition, 'to', newPosition);

    try {
      setIsInitializing(true);

      // Stop current camera
      setIsActive(false);

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 300));

      // Update camera position
      setCurrentCameraPosition(newPosition);

      // Wait for device to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Start with new position
      setIsActive(true);
      setIsInitializing(false);

      console.log('✅ Camera switched successfully to', newPosition);

    } catch (error) {
      console.error('❌ Error switching camera:', error);
      setIsInitializing(false);
      Alert.alert('Camera Switch Error', 'Failed to switch camera. Please try again.', [{ text: 'OK' }]);
    }
  }, [currentCameraPosition, isActive, isInitializing]);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || !isActive) return;

    try {
      console.log('📷 Taking photo...');

      const options: TakePhotoOptions = {
        // Add valid TakePhotoOptions properties here if needed
      };

      const photo: PhotoFile = await cameraRef.current.takePhoto(options);

      console.log('✅ Photo taken:', photo.path);

      // Convert file path to URI format
      const photoUri = Platform.OS === 'ios' ? photo.path : `file://${photo.path}`;

      onPhotoTaken(photoUri);
      stopCamera();

    } catch (error) {
      console.error('❌ Error taking photo:', error);
      Alert.alert('Photo Error', 'Failed to take photo. Please try again.', [{ text: 'OK' }]);
    }
  }, [isActive, onPhotoTaken, stopCamera]);

  const handleFileUpload = useCallback(() => {
    // For file upload, we'll use the existing expo-image-picker logic
    Alert.alert(
      'Upload Photo',
      'File upload is handled by the parent component.',
      [{ text: 'OK' }]
    );
  }, []);

  // If not on native platform, show message
  if (!isNativePlatform) {
    return (
      <View style={styles.container}>
        <View style={styles.messageContainer}>
          <Text style={styles.messageTitle}>Camera Not Available</Text>
          <Text style={styles.messageText}>
            Vision Camera requires iOS or Android platform. Please use the file upload option instead.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with type indicator */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {type === 'id' ? '📄 ID Document Verification' : '👤 Face Verification'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {type === 'id'
            ? 'Position your ID clearly within the frame'
            : 'Position your face within the guide'
          }
        </Text>
      </View>

      {/* Main action buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            isInitializing && styles.primaryButtonDisabled
          ]}
          onPress={startCamera}
          disabled={isInitializing}
          activeOpacity={0.8}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>
              {isInitializing ? '⏳' : '📷'}
            </Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.primaryButtonText}>
                {isInitializing ? 'Starting Camera...' : 'Use Camera'}
              </Text>
              <Text style={styles.buttonSubtext}>
                {isInitializing ? 'Please wait' : `${currentCameraPosition === 'back' ? 'Back' : 'Front'} camera`}
              </Text>
            </View>
          </View>
          {isInitializing && (
            <ActivityIndicator size="small" color="#ffffff" style={styles.buttonSpinner} />
          )}
        </TouchableOpacity>

        {hasPermission === false && (
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestCameraPermission}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.buttonIcon}>🔐</Text>
              <View style={styles.buttonTextContainer}>
                <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
                <Text style={styles.buttonSubtext}>Allow camera permissions</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Loading overlay */}
      {isInitializing && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingTitle}>Initializing Camera</Text>
            <Text style={styles.loadingSubtext}>
              Setting up your {currentCameraPosition} camera...
            </Text>
          </View>
        </View>
      )}

      {/* Camera View */}
      {isActive && device && hasPermission && (
        <View style={styles.cameraContainer}>
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isActive}
            photo={true}
            video={false}
            enableZoomGesture={false}
          />

          {/* Camera Guide Overlay */}
          <View style={styles.guideOverlay}>
            {type === 'id' ? (
              // Rectangle guide for ID
              <View style={styles.rectangleGuide}>
                <View style={styles.guideCorners}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
                <View style={styles.guideTextContainer}>
                  <Text style={styles.guideText}>Position your ID within this frame</Text>
                  <Text style={styles.guideSubtext}>Make sure all corners are visible</Text>
                </View>
              </View>
            ) : (
              // Oval guide for face
              <View style={styles.ovalGuide}>
                <View style={styles.guideTextContainer}>
                  <Text style={styles.guideText}>Position your face here</Text>
                  <Text style={styles.guideSubtext}>Keep your face centered and well-lit</Text>
                </View>
              </View>
            )}
          </View>

          {/* Camera controls overlay */}
          <View style={styles.cameraControls}>
            {/* Top controls */}
            <View style={styles.topControls}>
              <TouchableOpacity
                style={styles.switchButton}
                onPress={switchCamera}
                activeOpacity={0.8}
                disabled={isInitializing}
              >
                <Text style={styles.controlIcon}>🔄</Text>
                <Text style={styles.switchButtonText}>
                  Switch to {currentCameraPosition === 'front' ? 'Back' : 'Front'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Bottom controls */}
            <View style={styles.bottomControls}>
              <TouchableOpacity
                style={styles.cancelControlButton}
                onPress={stopCamera}
                activeOpacity={0.8}
              >
                <Text style={styles.controlIcon}>✕</Text>
                <Text style={styles.controlButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.captureControlButton}
                onPress={takePhoto}
                activeOpacity={0.8}
                disabled={isInitializing}
              >
                <View style={styles.captureInner} />
              </TouchableOpacity>

              <View style={styles.placeholderButton} />
            </View>
          </View>
        </View>
      )}

      {/* Permission denied screen */}
      {showPermissionDenied && (
        <View style={styles.permissionScreen}>
          <View style={styles.permissionCard}>
            <Text style={styles.permissionIcon}>🚫</Text>
            <Text style={styles.permissionTitle}>Camera Access Required</Text>
            <Text style={styles.permissionMessage}>
              Camera access is needed for verification. Please allow camera permissions and try again.
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={requestCameraPermission}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 400,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    padding: 24,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  actionContainer: {
    padding: 24,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0.1,
  },
  permissionButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  buttonTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  permissionButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  buttonSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  buttonSpinner: {
    position: 'absolute',
    right: 20,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 4,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  cameraContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  guideOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    pointerEvents: 'none',
  } as ViewStyle,
  rectangleGuide: {
    width: '85%',
    height: '55%',
    maxWidth: 400,
    maxHeight: 250,
    borderWidth: 3,
    borderColor: '#10b981',
    borderStyle: 'solid',
    borderRadius: 16,
    justifyContent: 'flex-end',
    paddingBottom: 20,
    position: 'relative',
  },
  guideCorners: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#ffffff',
    borderWidth: 3,
  },
  topLeft: {
    top: -3,
    left: -3,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: -3,
    right: -3,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: -3,
    left: -3,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: -3,
    right: -3,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  ovalGuide: {
    width: '70%',
    height: '50%',
    maxWidth: 300,
    maxHeight: 400,
    borderWidth: 3,
    borderColor: '#10b981',
    borderStyle: 'solid',
    borderRadius: 150,
    justifyContent: 'flex-end',
    paddingBottom: 40,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  guideTextContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  guideText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  guideSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  cameraControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    zIndex: 1001,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  topControls: {
    alignItems: 'center',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  switchButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    backdropFilter: 'blur(10px)' as any,
  },
  switchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  controlIcon: {
    fontSize: 18,
    color: '#ffffff',
  },
  cancelControlButton: {
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  captureControlButton: {
    backgroundColor: '#ffffff',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureInner: {
    backgroundColor: '#ef4444',
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  controlButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  placeholderButton: {
    width: 60,
    height: 60,
  },
  permissionScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 200,
  },
  permissionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  permissionIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  messageContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  messageText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
});