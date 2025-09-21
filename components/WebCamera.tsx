import React, { useRef, useState, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert, Platform } from 'react-native';

interface WebCameraProps {
  onPhotoTaken: (photoUri: string) => void;
  type: 'id' | 'face';
}

export default function WebCamera({ onPhotoTaken, type }: WebCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const startCamera = useCallback(async () => {
    if (!Platform.OS === 'web') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: type === 'face' ? 'user' : 'environment'
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        streamRef.current = stream;
        setIsStreaming(true);
        setHasPermission(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasPermission(false);
      Alert.alert(
        'Camera Access Denied',
        'Please allow camera access to take verification photos. You can enable it in your browser settings.',
        [{ text: 'OK' }]
      );
    }
  }, [type]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions based on video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob and create URL
    canvas.toBlob((blob) => {
      if (blob) {
        const photoUri = URL.createObjectURL(blob);
        onPhotoTaken(photoUri);
        stopCamera();
      }
    }, 'image/jpeg', 0.8);
  }, [onPhotoTaken, stopCamera]);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={styles.container}>
      {!isStreaming ? (
        <TouchableOpacity
          style={styles.startButton}
          onPress={startCamera}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>
            📷 Open Camera for {type === 'id' ? 'ID Document' : 'Face Photo'}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.cameraContainer}>
          <video
            ref={videoRef}
            style={styles.video}
            autoPlay
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            style={styles.hiddenCanvas}
          />
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
});