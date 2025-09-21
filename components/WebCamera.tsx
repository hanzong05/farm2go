import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert, Platform } from 'react-native';

interface WebCameraProps {
  onPhotoTaken: (photoUri: string) => void;
  type: 'id' | 'face';
}

export default function WebCamera({ onPhotoTaken, type }: WebCameraProps) {
  const videoRef = useRef<any>(null);
  const canvasRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isWebPlatform, setIsWebPlatform] = useState(false);

  useEffect(() => {
    const webPlatform = Platform.OS === 'web' || typeof window !== 'undefined';
    console.log('WebCamera Platform.OS:', Platform.OS, 'isWebPlatform:', webPlatform);
    setIsWebPlatform(webPlatform);
  }, []);

  const startCamera = useCallback(async () => {
    if (!isWebPlatform) return;

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
      const constraintSets = [
        // Try with specific facing mode first
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

      let stream = null;
      let lastError = null;

      for (const constraints of constraintSets) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (error) {
          lastError = error;
          console.warn('Failed with constraints:', constraints, error);
        }
      }

      if (!stream) {
        throw lastError || new Error('Failed to access camera with any constraints');
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        streamRef.current = stream;
        setIsStreaming(true);
        setHasPermission(true);
      }
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      setHasPermission(false);

      let errorMessage = 'Failed to access camera. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera access in your browser settings and refresh the page.';
      } else if (error.name === 'NotFoundError' || error.message.includes('No camera found')) {
        errorMessage += 'No camera was detected on this device. You can still upload a photo from your files using the "Choose File" option.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage += 'Camera is not supported by this browser. Try using a modern browser like Chrome, Firefox, or Safari.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is being used by another application. Please close other camera applications and try again.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage += 'Camera constraints could not be satisfied. Try refreshing the page.';
      } else if (error.message.includes('HTTPS')) {
        errorMessage += 'This site needs to be accessed via HTTPS to use the camera. You can still upload photos using the "Choose File" option.';
      } else {
        errorMessage += 'Please check your camera permissions and try again. You can also use the "Choose File" option to upload a photo.';
      }

      Alert.alert('Camera Access Error', errorMessage, [{ text: 'OK' }]);
    }
  }, [isWebPlatform, type]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

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

  if (!isWebPlatform) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={styles.optionButton}
          onPress={startCamera}
          activeOpacity={0.8}
        >
          <Text style={styles.optionButtonText}>
            📷 Use Camera
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionButton}
          onPress={() => {
            // Create file input dynamically
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e: any) => {
              const file = e.target.files?.[0];
              if (file) {
                const photoUri = URL.createObjectURL(file);
                onPhotoTaken(photoUri);
              }
            };
            input.click();
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.optionButtonText}>
            📁 Choose File
          </Text>
        </TouchableOpacity>
      </View>

      {isStreaming && (
        <View style={styles.cameraContainer}>
          {React.createElement('video', {
            ref: videoRef,
            style: styles.video,
            autoPlay: true,
            playsInline: true,
            muted: true,
          })}
          {React.createElement('canvas', {
            ref: canvasRef,
            style: styles.hiddenCanvas,
          })}
          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={takePhoto}
              activeOpacity={0.8}
            >
              <Text style={styles.captureButtonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={stopCamera}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}


      {hasPermission === false && (
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

          {/* Fallback file input for browsers without camera support */}
          <View style={styles.fallbackSection}>
            <Text style={styles.fallbackText}>Or select image from files:</Text>
            {React.createElement('input', {
              type: 'file',
              accept: 'image/*',
              capture: type === 'face' ? 'user' : 'environment',
              onChange: (e: any) => {
                const file = e.target.files?.[0];
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
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as any,
  hiddenCanvas: {
    display: 'none',
  } as any,
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
  optionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});