import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface VisionCameraProps {
  onPhotoTaken: (photoUri: string) => void;
  type: 'id' | 'face';
}

// Mock component that prevents VisionCamera import on web
export default function VisionCameraMock({ onPhotoTaken, type }: VisionCameraProps) {
  const handleFileUpload = () => {
    if (typeof window !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = type === 'face' ? 'user' : 'environment';

      input.onchange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
          const photoUri = URL.createObjectURL(file);
          onPhotoTaken(photoUri);
        }
      };

      input.click();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={handleFileUpload}>
        <Text style={styles.buttonText}>
          📱 {type === 'id' ? 'Capture ID Document' : 'Take Selfie'}
        </Text>
        <Text style={styles.subText}>Tap to use camera or choose photo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
});