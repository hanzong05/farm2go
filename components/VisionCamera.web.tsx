import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface VisionCameraProps {
  onPhotoTaken: (photoUri: string) => void;
  type: 'id' | 'face';
}

// Web-only version that doesn't import VisionCamera
export default function VisionCamera({ onPhotoTaken, type }: VisionCameraProps) {
  const handleFileUpload = () => {
    if (typeof window !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = type === 'face' ? 'user' : 'environment';
      input.multiple = false;

      input.onchange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
          // Validate file size (max 20MB)
          if (file.size > 20 * 1024 * 1024) {
            alert('File size too large. Please select an image smaller than 20MB.');
            return;
          }

          // Validate file type
          if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
          }

          const photoUri = URL.createObjectURL(file);
          onPhotoTaken(photoUri);
        }
      };

      input.click();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {type === 'id' ? '📄 ID Document Upload' : '👤 Face Photo Upload'}
        </Text>
        <Text style={styles.headerSubtitle}>
          Chrome Mobile - Tap to use your camera or choose from gallery
        </Text>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleFileUpload}
          activeOpacity={0.8}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>📷</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.primaryButtonText}>
                {type === 'id' ? 'Capture ID Document' : 'Take Selfie'}
              </Text>
              <Text style={styles.buttonSubtext}>
                Tap to use camera or choose existing photo
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.tipContainer}>
        <Text style={styles.tipTitle}>📱 Mobile Tips:</Text>
        <Text style={styles.tipText}>• Ensure good lighting</Text>
        <Text style={styles.tipText}>• Hold device steady</Text>
        <Text style={styles.tipText}>• Make sure {type === 'id' ? 'all ID corners are visible' : 'your face is clearly centered'}</Text>
      </View>
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
    flex: 1,
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#3b82f6',
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
    fontSize: 32,
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
    marginBottom: 4,
  },
  buttonSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  tipContainer: {
    padding: 20,
    backgroundColor: '#fffbeb',
    borderTopWidth: 1,
    borderTopColor: '#fbbf24',
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 12,
    color: '#92400e',
    marginBottom: 4,
  },
});