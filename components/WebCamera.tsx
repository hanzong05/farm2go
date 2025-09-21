import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

interface WebCameraProps {
  onPhotoTaken: (photoUri: string) => void;
  type: 'id' | 'face';
}

export default function WebCamera({ onPhotoTaken, type }: WebCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showPermissionDenied, setShowPermissionDenied] = useState(false);
  const [isWebPlatform, setIsWebPlatform] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastError, setLastError] = useState<string>('');
  const [currentCamera, setCurrentCamera] = useState<'user' | 'environment'>('environment');

  // Debug logging for state changes
  useEffect(() => {
    console.log('🔍 State Debug:', {
      isStreaming,
      hasPermission,
      showPermissionDenied,
      isInitializing,
      isWebPlatform
    });
  }, [isStreaming, hasPermission, showPermissionDenied, isInitializing, isWebPlatform]);

  useEffect(() => {
    const webPlatform = Platform.OS === 'web' || typeof window !== 'undefined';
    console.log('WebCamera Platform.OS:', Platform.OS, 'isWebPlatform:', webPlatform);
    setIsWebPlatform(webPlatform);

    // Set initial camera based on type
    setCurrentCamera(type === 'face' ? 'user' : 'environment');
  }, [type]);

  const stopCamera = useCallback(() => {
    console.log('📹 Stopping camera...');

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clean up video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    // Remove video element from container
    if (videoContainerRef.current) {
      const videoElement = videoContainerRef.current.querySelector('video');
      if (videoElement) {
        videoElement.remove();
      }
    }

    setIsStreaming(false);
    setIsInitializing(false);
    setShowPermissionDenied(false);
    console.log('📹 Camera stopped');
  }, []);

  const startCamera = useCallback(async () => {
    if (!isWebPlatform) return;

    setIsInitializing(true);
    console.log('✅ Clearing showPermissionDenied - starting camera');
    setShowPermissionDenied(false);
    setLastError(''); // Clear any previous errors
    console.log('📷 Starting camera initialization...');

    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported by this browser');
      }

      // Check if we're in a secure context (HTTPS or localhost)
      if (!window.isSecureContext && location.hostname !== 'localhost') {
        throw new Error('Camera access requires HTTPS. Please use a secure connection.');
      }

      // First, check if any video input devices are available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      if (videoDevices.length === 0) {
        throw new Error('No camera found on this device');
      }

      // Try different constraint sets, starting with the most specific
      const constraintSets: MediaStreamConstraints[] = [
        // Try with current camera selection first
        {
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: currentCamera
          }
        },
        // Fallback to type-based camera selection
        {
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: type === 'face' ? 'user' : 'environment'
          }
        },
        // Fallback to any camera without facing mode constraint
        {
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 }
          }
        },
        // Final fallback with minimal constraints
        {
          video: true
        }
      ];

      let stream: MediaStream | null = null;
      let lastError: Error | null = null;

      for (const constraints of constraintSets) {
        try {
          console.log('🔄 Trying camera with constraints:', constraints);
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('✅ Camera stream obtained successfully');
          break;
        } catch (error) {
          lastError = error as Error;
          console.warn('❌ Failed with constraints:', constraints, error);
        }
      }

      if (!stream) {
        throw lastError || new Error('Failed to access camera with any constraints');
      }

      // Create video element directly for better mobile compatibility
      console.log('📹 Creating video element...');

      if (typeof window !== 'undefined') {
        // Check immediately since container is now always rendered
        if (!videoContainerRef.current) {
          console.error('❌ Video container not found');
          setIsInitializing(false);
          console.log('❌ Setting showPermissionDenied to true - video container not found');
          setLastError('Video container not found');
          setShowPermissionDenied(true);
          return;
        }

        // Remove any existing video element
        const existingVideo = videoContainerRef.current.querySelector('video');
        if (existingVideo) {
          existingVideo.remove();
        }

        // Create new video element
        const videoElement = document.createElement('video');
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'cover';
        videoElement.style.backgroundColor = '#000000';
        videoElement.style.borderRadius = '8px';
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.muted = true;
        videoElement.controls = false;

        // Mobile-specific attributes
        videoElement.setAttribute('webkit-playsinline', 'true');
        videoElement.setAttribute('x-webkit-airplay', 'deny');

        console.log('📹 Setting up video element...');
        videoElement.srcObject = stream;

        // Wait for video to be ready before playing
        videoElement.onloadedmetadata = () => {
          console.log('📹 Video metadata loaded, starting playback...');
          videoElement.play().then(() => {
            console.log('📹 Video playback started successfully');
            setIsStreaming(true);
            setHasPermission(true);
            setIsInitializing(false);
          }).catch((playError) => {
            console.error('❌ Video play error:', playError);
            setIsInitializing(false);
            // Don't automatically set hasPermission to false for play errors
            // as the stream might be working fine
          });
        };

        // Store reference for later use
        videoRef.current = videoElement;
        streamRef.current = stream;

        // Add video to container
        videoContainerRef.current.appendChild(videoElement);

        // Fallback - try to play immediately
        try {
          await videoElement.play();
          console.log('📹 Video playing immediately');
          setIsStreaming(true);
          setHasPermission(true);
          setIsInitializing(false);
        } catch (playError) {
          console.log('📹 Immediate play failed, waiting for metadata...');
          // The onloadedmetadata handler will handle this
        }
      }
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      setIsInitializing(false);

      let errorMessage = 'Failed to access camera. ';
      let shouldShowPermissionDenied = false;

      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera access in your browser settings and refresh the page.';
        shouldShowPermissionDenied = true;
        setHasPermission(false);
      } else if (error.name === 'NotFoundError' || error.message.includes('No camera found')) {
        errorMessage += 'No camera was detected on this device. You can still upload a photo from your files using the "Choose File" option.';
        shouldShowPermissionDenied = true;
        setHasPermission(false);
      } else if (error.name === 'NotSupportedError') {
        errorMessage += 'Camera is not supported by this browser. Try using a modern browser like Chrome, Firefox, or Safari.';
        shouldShowPermissionDenied = true;
        setHasPermission(false);
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is being used by another application. Please close other camera applications and try again.';
        shouldShowPermissionDenied = true;
        setHasPermission(false);
      } else if (error.name === 'OverconstrainedError') {
        errorMessage += 'Camera constraints could not be satisfied. Try refreshing the page.';
        shouldShowPermissionDenied = true;
        setHasPermission(false);
      } else if (error.message.includes('HTTPS')) {
        errorMessage += 'This site needs to be accessed via HTTPS to use the camera. You can still upload photos using the "Choose File" option.';
        shouldShowPermissionDenied = true;
        setHasPermission(false);
      } else {
        errorMessage += 'Please check your camera permissions and try again. You can also use the "Choose File" option to upload a photo.';
        console.log('🤔 Unknown camera error - not showing permission denied UI');
        // For unknown errors, don't show permission denied UI
      }

      console.log('❌ Setting showPermissionDenied to:', shouldShowPermissionDenied, 'due to error:', error.name);
      setLastError(`${error.name}: ${error.message}`);
      setShowPermissionDenied(shouldShowPermissionDenied);
      Alert.alert('Camera Access Error', errorMessage, [{ text: 'OK' }]);
    }
  }, [isWebPlatform, type, currentCamera]);

  const switchCamera = useCallback(async () => {
    if (!isStreaming) return;

    console.log('📱 Switching camera from', currentCamera, 'to', currentCamera === 'user' ? 'environment' : 'user');
    setCurrentCamera(currentCamera === 'user' ? 'environment' : 'user');

    // Restart camera with new settings
    stopCamera();
    setTimeout(() => startCamera(), 100);
  }, [currentCamera, isStreaming, stopCamera, startCamera]);

  const takePhoto = useCallback(() => {
    if (!isWebPlatform || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    try {
      const context = canvas.getContext('2d');
      if (!context) {
        Alert.alert('Error', 'Unable to access canvas context');
        return;
      }

      // Set canvas dimensions based on video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      // Draw the video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to blob and create URL
      canvas.toBlob((blob: Blob | null) => {
        if (blob) {
          const photoUri = URL.createObjectURL(blob);
          onPhotoTaken(photoUri);
          stopCamera();
        } else {
          Alert.alert('Error', 'Failed to capture photo');
        }
      }, 'image/jpeg', 0.8);
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  }, [isWebPlatform, onPhotoTaken, stopCamera]);

  const handleFileUpload = useCallback(() => {
    // Create file input dynamically
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        const photoUri = URL.createObjectURL(file);
        onPhotoTaken(photoUri);
      }
    };
    input.click();
  }, [onPhotoTaken]);

  if (!isWebPlatform) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Debug Panel for Mobile - Show camera states */}
      <View style={styles.debugPanel}>
        <Text style={styles.debugTitle}>📱 Camera Debug Info:</Text>
        <Text style={styles.debugText}>
          • isStreaming: {isStreaming ? '✅' : '❌'} {isStreaming.toString()}
        </Text>
        <Text style={styles.debugText}>
          • hasPermission: {hasPermission === null ? '⏳' : hasPermission ? '✅' : '❌'} {String(hasPermission)}
        </Text>
        <Text style={styles.debugText}>
          • showPermissionDenied: {showPermissionDenied ? '🚫' : '✅'} {showPermissionDenied.toString()}
        </Text>
        <Text style={styles.debugText}>
          • isInitializing: {isInitializing ? '⏳' : '✅'} {isInitializing.toString()}
        </Text>
        <Text style={styles.debugText}>
          • isWebPlatform: {isWebPlatform ? '✅' : '❌'} {isWebPlatform.toString()}
        </Text>
        {lastError && (
          <Text style={styles.debugTextError}>
            • Last Error: {lastError}
          </Text>
        )}
      </View>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={isInitializing ? [styles.optionButton, styles.optionButtonDisabled] : styles.optionButton}
          onPress={startCamera}
          disabled={isInitializing}
          activeOpacity={0.8}
        >
          <Text style={styles.optionButtonText}>
            {isInitializing ? '⏳ Starting Camera...' : '📷 Use Camera'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionButton}
          onPress={handleFileUpload}
          activeOpacity={0.8}
        >
          <Text style={styles.optionButtonText}>
            📁 Choose File
          </Text>
        </TouchableOpacity>
      </View>

      {isInitializing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Initializing camera...</Text>
        </View>
      )}

      {/* Always render video container but only show it when streaming */}
      <View style={[styles.cameraContainer, !isStreaming && styles.hidden]}>
        {React.createElement('div', {
          ref: videoContainerRef,
          style: {
            width: '100%',
            height: '100%',
            position: 'relative',
            borderRadius: 8,
            overflow: 'hidden',
            backgroundColor: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxHeight: '70vh',
            minHeight: '300px',
          },
        }, 'Camera Loading...')}

        {/* Camera Guide Overlay */}
        {isStreaming && (
          <View style={styles.guideOverlay}>
            {type === 'id' ? (
              // Rectangle guide for ID
              <View style={styles.rectangleGuide}>
                <Text style={styles.guideText}>Position your ID within this frame</Text>
              </View>
            ) : (
              // Oval guide for face
              <View style={styles.ovalGuide}>
                <Text style={styles.guideText}>Position your face within this oval</Text>
              </View>
            )}
          </View>
        )}

        {React.createElement('canvas', {
          ref: canvasRef,
          style: styles.hiddenCanvas,
        })}

        {isStreaming && (
          <View style={styles.controls}>
            {/* Camera Switch Button */}
            <TouchableOpacity
              style={styles.switchButton}
              onPress={switchCamera}
              activeOpacity={0.8}
            >
              <Text style={styles.switchButtonText}>
                🔄 {currentCamera === 'user' ? 'Back' : 'Front'}
              </Text>
            </TouchableOpacity>

            <View style={styles.mainControls}>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={takePhoto}
                activeOpacity={0.8}
              >
                <Text style={styles.captureButtonText}>📷 Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={stopCamera}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>✕ Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {showPermissionDenied && (
        <View style={styles.permissionDenied}>
          <Text style={styles.permissionText}>
            Camera access is required for verification. Please allow camera access in your browser settings and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={startCamera}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>

          <View style={styles.fallbackSection}>
            <Text style={styles.fallbackText}>Or select image from files:</Text>
            {React.createElement('input', {
              type: 'file',
              accept: 'image/*',
              capture: type === 'face' ? 'user' : 'environment',
              onChange: (e: Event) => {
                const target = e.target as HTMLInputElement;
                const file = target.files?.[0];
                if (file) {
                  const photoUri = URL.createObjectURL(file);
                  onPhotoTaken(photoUri);
                }
              },
              style: {
                marginTop: 10,
                padding: 10,
                borderRadius: 5,
                border: '1px solid #ccc',
                backgroundColor: '#f9f9f9',
              },
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 300,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    overflow: 'hidden',
  },
  startButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  cameraContainer: {
    position: 'relative',
    width: '100%',
    height: 400,
    maxHeight: '70vh' as any,
    minHeight: 300,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)' as any,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'column',
    alignItems: 'center',
  },
  captureButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  captureButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionDenied: {
    padding: 24,
    alignItems: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  fallbackSection: {
    marginTop: 20,
    alignItems: 'center',
  },
  fallbackText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 10,
    textAlign: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  optionButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  optionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
    textAlign: 'center',
  },
  debugPanel: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#4b5563',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  debugTextError: {
    fontSize: 12,
    color: '#dc2626',
    marginBottom: 4,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  hidden: {
    position: 'absolute',
    top: -10000,
    left: -10000,
    opacity: 0,
  },
  hiddenCanvas: {
    position: 'absolute',
    top: -10000,
    left: -10000,
    opacity: 0,
  },
  switchButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)' as any,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)' as any,
  },
  switchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  mainControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 12,
  },
  guideOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  } as ViewStyle,
  rectangleGuide: {
    width: '80%',
    height: '60%',
    borderWidth: 3,
    borderColor: '#10b981',
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 20,
  },
  ovalGuide: {
    width: 250,
    height: 320,
    borderWidth: 3,
    borderColor: '#10b981',
    borderStyle: 'dashed',
    borderRadius: 125,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  guideText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)' as any,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
});