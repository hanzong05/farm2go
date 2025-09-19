import { useLocalSearchParams, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';

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

// Farm2Go green color scheme
const colors = {
  primary: '#059669',
  secondary: '#10b981',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  white: '#ffffff',
  background: '#f0f9f4',
  surface: '#ffffff',
  text: '#0f172a',
  textSecondary: '#6b7280',
  border: '#d1fae5',
  shadow: 'rgba(0,0,0,0.1)',
};

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity_available: number;
  unit: string;
  category: string;
  farmer_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  image_url?: string;
}

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    quantity_available: '',
    unit: 'kg',
    category: 'Vegetables',
  });

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('farmer_id', user?.id)
        .single();

      if (error) {
        console.error('Error fetching product:', error);
        setError('Failed to load product');
        return;
      }

      setFormData({
        name: data.name,
        description: data.description,
        price: data.price.toString(),
        quantity_available: data.quantity_available.toString(),
        unit: data.unit,
        category: data.category,
      });

      if (data.image_url) {
        setSelectedImage(data.image_url);
      }
    } catch (err) {
      console.error('Product fetch error:', err);
      setError('An error occurred while loading the product');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.price || isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
      newErrors.price = 'Valid price is required';
    }

    if (!formData.quantity_available || isNaN(parseInt(formData.quantity_available)) || parseInt(formData.quantity_available) <= 0) {
      newErrors.quantity_available = 'Valid quantity is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to add product images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera permissions to take product photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadImage = async (imageUri: string): Promise<string | null> => {
    try {
      setUploadingImage(true);

      // Create a unique filename
      const filename = `product_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

      // Convert image to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Update Product Image',
      'Choose how you want to update the product image',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      let imageUrl = selectedImage;

      // Only upload if it's a new local image (not already a URL)
      if (selectedImage && !selectedImage.startsWith('http')) {
        imageUrl = await uploadImage(selectedImage);
        if (!imageUrl) {
          throw new Error('Failed to upload image');
        }
      }

      const { error } = await supabase
        .from('products')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim(),
          price: parseFloat(formData.price),
          quantity_available: parseInt(formData.quantity_available),
          unit: formData.unit,
          category: formData.category,
          image_url: imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('farmer_id', user?.id);

      if (error) {
        console.error('Error updating product:', error);
        Alert.alert('Error', 'Failed to update product');
        return;
      }

      Alert.alert('Success', 'Product updated successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (err) {
      console.error('Update error:', err);
      Alert.alert('Error', 'An error occurred while updating the product');
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (
    key: keyof typeof formData,
    placeholder: string,
    options?: {
      multiline?: boolean;
      keyboardType?: 'default' | 'numeric' | 'decimal-pad';
      numberOfLines?: number;
    }
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {placeholder}
        <Text style={styles.requiredStar}> *</Text>
      </Text>
      <TextInput
        style={[
          styles.input,
          options?.multiline && styles.multilineInput,
          focusedInput === key && styles.inputFocused,
          errors[key] && styles.inputError,
        ]}
        value={formData[key]}
        onChangeText={(text) => {
          setFormData(prev => ({ ...prev, [key]: text }));
          if (errors[key]) {
            setErrors(prev => ({ ...prev, [key]: '' }));
          }
        }}
        placeholder={`Enter ${placeholder.toLowerCase()}`}
        placeholderTextColor="#9ca3af"
        onFocus={() => setFocusedInput(key)}
        onBlur={() => setFocusedInput(null)}
        multiline={options?.multiline}
        numberOfLines={options?.numberOfLines}
        keyboardType={options?.keyboardType}
      />
      {errors[key] && (
        <Text style={styles.errorText}>{errors[key]}</Text>
      )}
    </View>
  );

  const renderSelector = (
    key: 'category' | 'unit',
    label: string,
    options: string[]
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {label}
        <Text style={styles.requiredStar}> *</Text>
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.selectorContainer}
      >
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.selectorOption,
              formData[key] === option && styles.selectorOptionSelected,
            ]}
            onPress={() => setFormData(prev => ({ ...prev, [key]: option }))}
          >
            <Text
              style={[
                styles.selectorOptionText,
                formData[key] === option && styles.selectorOptionTextSelected,
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading product...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
        <View style={styles.errorContent}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Product</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <Text style={styles.formTitle}>Update Product Information</Text>
          <Text style={styles.formSubtitle}>
            Edit your product details. All fields marked with * are required.
          </Text>

          {/* Image Section */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Product Image</Text>
            <TouchableOpacity
              style={styles.imagePickerButton}
              onPress={showImageOptions}
              disabled={uploadingImage}
            >
              {selectedImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                  <View style={styles.imageOverlay}>
                    <Text style={styles.changeImageText}>Tap to change</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderIcon}>📷</Text>
                  <Text style={styles.imagePlaceholderText}>Add Product Photo</Text>
                  <Text style={styles.imagePlaceholderSubtext}>Tap to select from gallery or take photo</Text>
                </View>
              )}
              {uploadingImage && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.uploadingText}>Uploading...</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {renderInput('name', 'Product Name')}
          {renderInput('description', 'Description', {
            multiline: true,
            numberOfLines: 4,
          })}

          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 12 }]}>
              <Text style={styles.inputLabel}>
                Price
                <Text style={styles.requiredStar}> *</Text>
              </Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.currencySymbol}>₱</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.priceInput,
                    focusedInput === 'price' && styles.inputFocused,
                    errors.price && styles.inputError,
                  ]}
                  value={formData.price}
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, price: text }));
                    if (errors.price) {
                      setErrors(prev => ({ ...prev, price: '' }));
                    }
                  }}
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  onFocus={() => setFocusedInput('price')}
                  onBlur={() => setFocusedInput(null)}
                  keyboardType="decimal-pad"
                />
              </View>
              {errors.price && (
                <Text style={styles.errorText}>{errors.price}</Text>
              )}
            </View>

            <View style={[styles.inputContainer, { flex: 1, marginLeft: 12 }]}>
              {renderInput('quantity_available', 'Quantity', {
                keyboardType: 'numeric',
              })}
            </View>
          </View>

          {renderSelector('unit', 'Unit', UNITS)}
          {renderSelector('category', 'Category', CATEGORIES)}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={saving}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Loading States
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // Error States
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 18,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 10,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 80,
  },

  // Content
  content: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -15,
  },

  // Form
  form: {
    padding: 24,
    paddingTop: 32,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  formSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
    lineHeight: 24,
  },

  // Input Fields
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  requiredStar: {
    color: colors.danger,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputFocused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: colors.danger,
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingLeft: 16,
    paddingRight: 8,
  },
  priceInput: {
    flex: 1,
    borderWidth: 0,
    paddingLeft: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  // Selector
  selectorContainer: {
    paddingVertical: 4,
    gap: 12,
  },
  selectorOption: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: colors.border,
  },
  selectorOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectorOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  selectorOptionTextSelected: {
    color: colors.white,
  },
  errorText: {
    fontSize: 14,
    color: colors.danger,
    marginTop: 6,
    fontWeight: '500',
  },

  // Image Picker
  imagePickerButton: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  imagePlaceholderIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  imagePlaceholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  imagePlaceholderSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  imagePreviewContainer: {
    position: 'relative',
    aspectRatio: 1,
    width: '100%',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  changeImageText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.5,
  },

  // Utility
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});