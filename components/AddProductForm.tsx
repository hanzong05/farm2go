import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  'Vegetables',
  'Fruits',
  'Grains',
  'Herbs',
  'Livestock',
  'Dairy',
  'Other'
];

const UNITS = [
  'kg',
  'lbs',
  'pieces',
  'bundles',
  'sacks',
  'liters',
  'gallons'
];

interface AddProductFormProps {
  farmerId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AddProductForm({ farmerId, onSuccess, onCancel }: AddProductFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    unit: 'kg',
    quantity: '',
    category: 'Vegetables',
    image: null as string | null,
  });

  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const pickImage = async () => {
    try {
      // On web, use native file input
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (file) {
            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
              Alert.alert('File Too Large', 'Please select an image smaller than 10MB.');
              return;
            }

            // Validate it's an image
            if (!file.type.startsWith('image/')) {
              Alert.alert('Invalid File', 'Please select an image file.');
              return;
            }

            // Upload the file directly (not the blob URL)
            const publicUrl = await uploadImageToSupabaseWeb(file);

            if (publicUrl) {
              setFormData(prev => ({ ...prev, image: publicUrl }));
            }
          }
        };

        input.click();
        return;
      }

      // Mobile: use ImagePicker
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to add images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        const publicUrl = await uploadImageToSupabase(imageUri);

        if (publicUrl) {
          setFormData(prev => ({ ...prev, image: publicUrl }));
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const uploadImageToSupabaseWeb = async (file: File): Promise<string | null> => {
    try {
      setUploadingImage(true);

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Image size must be less than 10MB');
        return null;
      }

      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Authentication Error', 'Please log in to upload images');
        return null;
      }

      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const filename = `product_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      console.log('📤 Uploading product image:', filename);

      // Upload file directly
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filename, file, {
          contentType: file.type,
          upsert: false
        });

      if (error) {
        console.error('❌ Supabase upload error:', error);
        throw error;
      }

      console.log('✅ Image uploaded successfully:', data.path);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error: any) {
      console.error('❌ Error uploading image:', error);
      const errorMessage = error?.message || 'Failed to upload image';
      Alert.alert('Upload Error', errorMessage);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const uploadImageToSupabase = async (imageUri: string): Promise<string | null> => {
    try {
      setUploadingImage(true);

      // Get file info to check size
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      const fileSize = (fileInfo as any).size || 0;

      // Validate file size (10MB limit)
      if (fileSize > 10 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Image size must be less than 10MB');
        return null;
      }

      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Authentication Error', 'Please log in to upload images');
        return null;
      }

      // Create a unique filename
      const filename = `product_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

      console.log('📤 Uploading product image:', filename, 'Size:', fileSize, 'bytes');

      // React Native: read file as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to ArrayBuffer (React Native compatible)
      const arrayBuffer = decode(base64);

      // Upload using fetch API (React Native compatible)
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const uploadUrl = `${supabaseUrl}/storage/v1/object/product-images/${filename}`;

      console.log('📡 Uploading to:', uploadUrl);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'image/jpeg',
          'x-upsert': 'false',
        },
        body: arrayBuffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const uploadResult = await response.json();
      console.log('✅ Image uploaded successfully:', uploadResult);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filename);

      return publicUrl;
    } catch (error: any) {
      console.error('❌ Error uploading image:', error);
      const errorMessage = error?.message || 'Failed to upload image';
      Alert.alert('Upload Error', errorMessage);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Product name is required');
      return;
    }

    if (!formData.price || isNaN(Number(formData.price)) || Number(formData.price) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid price');
      return;
    }

    if (!formData.quantity || isNaN(Number(formData.quantity)) || Number(formData.quantity) < 0) {
      Alert.alert('Validation Error', 'Please enter a valid quantity');
      return;
    }

    try {
      setSubmitting(true);

      const productData = {
        farmer_id: farmerId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: Number(formData.price),
        unit: formData.unit,
        quantity_available: Number(formData.quantity),
        category: formData.category,
        image_url: formData.image,
        status: 'pending' as const,
      };

      const { error } = await supabase
        .from('products')
        .insert([productData]);

      if (error) throw error;

      Alert.alert(
        'Success!',
        'Product added successfully and is pending admin approval.',
        [{ text: 'OK', onPress: onSuccess }]
      );
    } catch (error) {
      console.error('Error adding product:', error);
      Alert.alert('Error', 'Failed to add product. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Add New Product</Text>
          <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Image Upload */}
        <View style={styles.imageSection}>
          <Text style={styles.sectionTitle}>Product Image</Text>
          <TouchableOpacity
            style={styles.imageUpload}
            onPress={pickImage}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <View style={styles.imageLoading}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>Uploading...</Text>
              </View>
            ) : formData.image ? (
              <Image source={{ uri: formData.image }} style={styles.uploadedImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imageIcon}>📷</Text>
                <Text style={styles.imageText}>Tap to add image</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Product Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Product Name *</Text>
          <TextInput
            style={styles.textInput}
            value={formData.name}
            onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
            placeholder="Enter product name"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
            placeholder="Describe your product"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Price and Unit */}
        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Price *</Text>
            <TextInput
              style={styles.textInput}
              value={formData.price}
              onChangeText={(text) => setFormData(prev => ({ ...prev, price: text }))}
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Unit</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitSelector}>
              {UNITS.map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[
                    styles.unitButton,
                    formData.unit === unit && styles.unitButtonActive
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, unit }))}
                >
                  <Text style={[
                    styles.unitButtonText,
                    formData.unit === unit && styles.unitButtonTextActive
                  ]}>
                    {unit}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Quantity */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Available Quantity *</Text>
          <TextInput
            style={styles.textInput}
            value={formData.quantity}
            onChangeText={(text) => setFormData(prev => ({ ...prev, quantity: text }))}
            placeholder="Enter quantity"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
          />
        </View>

        {/* Category */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  formData.category === category && styles.categoryButtonActive
                ]}
                onPress={() => setFormData(prev => ({ ...prev, category }))}
              >
                <Text style={[
                  styles.categoryButtonText,
                  formData.category === category && styles.categoryButtonTextActive
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Submit Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            disabled={submitting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Add Product</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6B7280',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  imageSection: {
    marginBottom: 24,
  },
  imageUpload: {
    height: 200,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLoading: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#6B7280',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imageIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  imageText: {
    color: '#6B7280',
    fontSize: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  unitSelector: {
    flexDirection: 'row',
  },
  unitButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    marginRight: 8,
  },
  unitButtonActive: {
    backgroundColor: '#10B981',
  },
  unitButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  unitButtonTextActive: {
    color: '#fff',
  },
  categorySelector: {
    flexDirection: 'row',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#10B981',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});