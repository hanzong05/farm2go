import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';

interface WebFileInputProps {
  onFileSelected: (fileUri: string, file?: File) => void;
  type: 'id' | 'face';
  acceptedTypes?: string; // Allow custom file types
}

export default function WebFileInput({ onFileSelected, type, acceptedTypes = 'image/*' }: WebFileInputProps) {
  if (Platform.OS !== 'web') {
    return null;
  }

  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator?.userAgent || '');
  const isImageOnly = acceptedTypes === 'image/*';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Select {type === 'id' ? 'ID Document' : 'Face Photo'}
      </Text>
      <Text style={styles.subtitle}>
        Choose {isImageOnly ? 'an image' : 'a'} file from your computer
      </Text>

      {React.createElement('input', {
        type: 'file',
        accept: acceptedTypes,
        capture: isMobile && isImageOnly ? (type === 'face' ? 'user' : 'environment') : undefined,
        multiple: false,
        onChange: (e: any) => {
          const file = e.target.files?.[0];
          if (file) {
            // Validate file size (max 20MB)
            if (file.size > 20 * 1024 * 1024) {
              alert('File size too large. Please select a file smaller than 20MB.');
              return;
            }

            // Validate file type if image only
            if (isImageOnly && !file.type.startsWith('image/')) {
              alert('Please select a valid image file.');
              return;
            }

            const fileUri = URL.createObjectURL(file);
            onFileSelected(fileUri, file);
          }
        },
        style: {
          width: '100%',
          padding: isMobile ? 20 : 16,
          borderRadius: 8,
          border: '2px dashed #d1d5db',
          backgroundColor: '#f9fafb',
          cursor: 'pointer',
          fontSize: isMobile ? 18 : 16,
          color: '#374151',
          minHeight: isMobile ? 60 : 'auto',
        },
      })}

      <Text style={styles.hint}>
        {isMobile
          ? `Tap to ${type === 'face' ? 'take selfie or' : 'capture ID or'} choose from gallery`
          : 'Supported formats: JPG, PNG, GIF (Max 20MB)'
        }
      </Text>

      {isMobile && (
        <Text style={styles.mobileHint}>
          📱 Mobile tip: For best results, ensure good lighting and hold device steady
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 12,
    textAlign: 'center',
  },
  mobileHint: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});