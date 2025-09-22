import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';

interface WebFileInputProps {
  onFileSelected: (fileUri: string) => void;
  type: 'id' | 'face';
}

export default function WebFileInput({ onFileSelected, type }: WebFileInputProps) {
  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Select {type === 'id' ? 'ID Document' : 'Face Photo'}
      </Text>
      <Text style={styles.subtitle}>
        Choose an image file from your computer
      </Text>

      {React.createElement('input', {
        type: 'file',
        accept: 'image/*',
        onChange: (e: any) => {
          const file = e.target.files?.[0];
          if (file) {
            const fileUri = URL.createObjectURL(file);
            onFileSelected(fileUri);
          }
        },
        style: {
          width: '100%',
          padding: 16,
          borderRadius: 8,
          border: '2px dashed #d1d5db',
          backgroundColor: '#f9fafb',
          cursor: 'pointer',
          fontSize: 16,
          color: '#374151',
        },
      })}

      <Text style={styles.hint}>
        Supported formats: JPG, PNG, GIF (Max 20MB)
      </Text>
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
});