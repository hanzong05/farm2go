import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import ConfirmationModal from '../../../../components/ConfirmationModal';
import { useCustomAlert } from '../../../../components/CustomAlert';
import HeaderComponent from '../../../../components/HeaderComponent';
import { supabase } from '../../../../lib/supabase';
import { getUserWithProfile } from '../../../../services/auth';
import { notifyUserAction, notifyAllAdmins } from '../../../../services/notifications';
import { Database } from '../../../../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

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
  image_url?: string;
}

export default function AdminEditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    unit: 'kg',
    quantity_available: '',
    category: 'Vegetables',
    status: 'pending' as 'pending' | 'approved' | 'rejected',
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [webImageFile, setWebImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageChanged, setImageChanged] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    isDestructive: boolean;
    confirmText: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    isDestructive: false,
    confirmText: '',
    onConfirm: () => {},
  });

  const { showAlert, AlertComponent } = useCustomAlert();

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (id && profile) {
      fetchProduct();
    }
  }, [id, profile]);

  const loadProfile = async () => {
    try {
      const userData = await getUserWithProfile();
      if (userData?.profile) {
        if (userData.profile.user_type !== 'admin') {
          showAlert('Access Denied', 'Only admins can access this page', [
            { text: 'OK', style: 'default', onPress: () => router.replace('/' as any) }
          ]);
          return;
        }
        setProfile(userData.profile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const fetchProduct = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching product:', error);
        showAlert('Error', 'Product not found', [
          { text: 'OK', style: 'default', onPress: () => router.back() }
        ]);
        return;
      }

      setProduct(data);
      setFormData({
        name: data.name,
        description: data.description || '',
        price: data.price.toString(),
        unit: data.unit,
        quantity_available: data.quantity_available.toString(),
        category: data.category,
        status: data.status,
      });
      setSelectedImage(data.image_url);
    } catch (err) {
      console.error('Product fetch error:', err);
      showAlert('Error', 'Failed to load product', [
        { text: 'OK', style: 'default', onPress: () => router.back() }
      ]);
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
        showAlert('Permission needed', 'Sorry, we need camera roll permissions to add product images.', [
          { text: 'OK', style: 'default' }
        ]);
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
        setImageChanged(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showAlert('Error', 'Failed to select image', [
        { text: 'OK', style: 'default' }
      ]);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission needed', 'Sorry, we need camera permissions to take product photos.', [
          { text: 'OK', style: 'default' }
        ]);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setImageChanged(true);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      showAlert('Error', 'Failed to take photo', [
        { text: 'OK', style: 'default' }
      ]);
    }
  };

  const uploadImage = async (imageUri: string): Promise<string | null> => {
    try {
      setUploadingImage(true);

      // Get session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showAlert('Error', 'You must be logged in to upload images', [
          { text: 'OK', style: 'default' }
        ]);
        return null;
      }

      const filename = `product_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const contentType = 'image/jpeg';

      let arrayBuffer: ArrayBuffer;

      // Handle file reading differently for web vs mobile
      if (Platform.OS === 'web') {
        if (webImageFile) {
          // Use stored File object
          console.log('📁 Web file size:', (webImageFile.size / (1024 * 1024)).toFixed(2) + 'MB');
          arrayBuffer = await webImageFile.arrayBuffer();
        } else {
          // Fallback to fetching blob URL
          const response = await fetch(imageUri);
          const blob = await response.blob();
          console.log('📁 Web blob size:', (blob.size / (1024 * 1024)).toFixed(2) + 'MB');
          arrayBuffer = await blob.arrayBuffer();
        }
      } else {
        // Mobile: Use FileSystem to read as base64, then convert to ArrayBuffer
        const fileInfo = await FileSystem.getInfoAsync(imageUri);
        if (fileInfo.exists && 'size' in fileInfo) {
          console.log('📁 Mobile file size:', (fileInfo.size / (1024 * 1024)).toFixed(2) + 'MB');
        }
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        arrayBuffer = decode(base64);
      }

      console.log('✅ ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');
      console.log('📤 Uploading to Supabase Storage...');

      // Upload using fetch API with ArrayBuffer - direct upload method
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const uploadUrl = `${supabaseUrl}/storage/v1/object/product-images/${filename}`;

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': contentType,
          'x-upsert': 'false',
        },
        body: arrayBuffer,
      });

      console.log('📡 Upload response:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('❌ Upload failed:', errorText);
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      console.log('✅ Product image uploaded successfully');

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filename);

      console.log('🔗 Product image URL:', publicUrl);

      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      showAlert('Error', error.message || 'Failed to upload image', [
        { text: 'OK', style: 'default' }
      ]);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const showImageOptions = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            showAlert('Error', 'Image size must be less than 5MB', [
              { text: 'OK', style: 'default' }
            ]);
            return;
          }
          if (!file.type.startsWith('image/')) {
            showAlert('Error', 'Please select a valid image file', [
              { text: 'OK', style: 'default' }
            ]);
            return;
          }
          const imageUrl = URL.createObjectURL(file);
          setSelectedImage(imageUrl);
          setWebImageFile(file);
          setImageChanged(true);
        }
      };
      input.click();
    } else {
      showAlert(
        'Change Product Image',
        'Choose how you want to change the product image',
        [
          { text: 'Camera', onPress: takePhoto },
          { text: 'Photo Library', onPress: pickImage },
          { text: 'Remove Image', onPress: () => { setSelectedImage(null); setImageChanged(true); }, style: 'destructive' },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setConfirmModal({
      visible: true,
      title: 'Update Product?',
      message: `Are you sure you want to update "${formData.name.trim()}" as an admin?`,
      isDestructive: false,
      confirmText: 'Update Product',
      onConfirm: () => {
        processSubmit();
        setConfirmModal(prev => ({ ...prev, visible: false }));
      }
    });
  };

  const processSubmit = async () => {
    if (!product || !profile) return;

    setIsSubmitting(true);

    try {
      let imageUrl = product.image_url;

      if (imageChanged) {
        if (selectedImage) {
          const newImageUrl = await uploadImage(selectedImage);
          if (!newImageUrl) {
            throw new Error('Failed to upload image');
          }
          imageUrl = newImageUrl;
        } else {
          imageUrl = null;
        }
      }

      const updatedData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        unit: formData.unit,
        quantity_available: parseInt(formData.quantity_available),
        category: formData.category,
        status: formData.status,
        image_url: imageUrl,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('products')
        .update(updatedData)
        .eq('id', id);

      if (error) throw error;

      // Send notifications
      try {
        // Notify the farmer about the product update
        await notifyUserAction(
          product.farmer_id,
          'updated',
          'product',
          formData.name,
          profile.id,
          `Your product "${formData.name}" has been updated by an administrator${product.status !== updatedData.status ? ` and status changed to ${updatedData.status}` : ''}`
        );

        // Notify all other admins
        await notifyAllAdmins(
          'Product Updated by Admin',
          `Admin ${profile.first_name} ${profile.last_name} updated the product "${formData.name}"${product.status !== updatedData.status ? ` (status: ${updatedData.status})` : ''}`,
          profile.id,
          {
            action: 'admin_product_updated',
            productId: id,
            productName: formData.name,
            farmerId: product.farmer_id,
            statusChanged: product.status !== updatedData.status,
            newStatus: updatedData.status
          }
        );

        console.log('✅ Product update notifications sent');
      } catch (notifError) {
        console.error('⚠️ Failed to send notifications:', notifError);
      }

      showAlert(
        'Success',
        'Product updated successfully!',
        [{ text: 'OK', style: 'default', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error updating product:', error);
      showAlert('Error', 'Failed to update product. Please try again.', [
        { text: 'OK', style: 'default' }
      ]);
    } finally {
      setIsSubmitting(false);
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
    key: 'category' | 'unit' | 'status',
    label: string,
    options: string[] | { value: string; label: string }[]
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
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value;
          const displayLabel = typeof option === 'string' ? option : option.label;
          return (
            <TouchableOpacity
              key={value}
              style={[
                styles.selectorOption,
                formData[key] === value && styles.selectorOptionSelected,
              ]}
              onPress={() => setFormData(prev => ({ ...prev, [key]: value as any }))}
            >
              <Text
                style={[
                  styles.selectorOptionText,
                  formData[key] === value && styles.selectorOptionTextSelected,
                ]}
              >
                {displayLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const getStatusBackgroundColor = (status: string) => {
    switch (status) {
      case 'approved': return '#dcfce7';
      case 'pending': return '#fef3c7';
      case 'rejected': return '#fee2e2';
      default: return '#f3f4f6';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'approved': return '#166534';
      case 'pending': return '#92400e';
      case 'rejected': return '#991b1b';
      default: return '#374151';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading product...</Text>
      </View>
    );
  }

  if (!profile || !product) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Product not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <HeaderComponent profile={profile} showAddButton={false} showMessages={true} showNotifications={true} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.formTitle}>Edit Product (Admin)</Text>
          <Text style={styles.formSubtitle}>Update product details as administrator. All fields marked with * are required.</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Product Image</Text>
            <TouchableOpacity style={styles.imagePickerButton} onPress={showImageOptions} disabled={uploadingImage}>
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
                  <Text style={styles.imagePlaceholderSubtext}>
                    {Platform.OS === 'web' ? 'Click to select image file' : 'Tap to select from gallery or take photo'}
                  </Text>
                </View>
              )}
              {uploadingImage && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="large" color="#10b981" />
                  <Text style={styles.uploadingText}>Uploading...</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {renderInput('name', 'Product Name')}
          {renderInput('description', 'Description', { multiline: true, numberOfLines: 4 })}

          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 12 }]}>
              <Text style={styles.inputLabel}>
                Price<Text style={styles.requiredStar}> *</Text>
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
              {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
            </View>

            <View style={[styles.inputContainer, { flex: 1, marginLeft: 12 }]}>
              {renderInput('quantity_available', 'Quantity', { keyboardType: 'numeric' })}
            </View>
          </View>

          {renderSelector('unit', 'Unit', UNITS)}
          {renderSelector('category', 'Category', CATEGORIES)}
          {renderSelector('status', 'Status', [
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' }
          ])}

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>🛡️ Admin Note</Text>
            <Text style={styles.infoText}>
              You are editing this product as an administrator. Changes will be applied immediately.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()} disabled={isSubmitting}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Updating...' : 'Update Product'}
          </Text>
        </TouchableOpacity>
      </View>

      {AlertComponent}

      <ConfirmationModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#6b7280', fontWeight: '500' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flex: 1, backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -15 },
  form: { padding: 24, paddingTop: 32 },
  formTitle: { fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 8, letterSpacing: -0.5 },
  formSubtitle: { fontSize: 16, color: '#6b7280', marginBottom: 24, lineHeight: 24 },
  statusInfo: { borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  statusText: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  statusSubtext: { fontSize: 14, color: '#6b7280' },
  inputContainer: { marginBottom: 24 },
  inputLabel: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 },
  requiredStar: { color: '#ef4444' },
  input: { borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', backgroundColor: '#ffffff' },
  inputFocused: { borderColor: '#10b981', shadowColor: '#10b981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  inputError: { borderColor: '#ef4444' },
  multilineInput: { minHeight: 100, textAlignVertical: 'top' },
  priceInputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#ffffff' },
  currencySymbol: { fontSize: 18, fontWeight: '600', color: '#6b7280', paddingLeft: 16, paddingRight: 8 },
  priceInput: { flex: 1, borderWidth: 0, paddingLeft: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  selectorContainer: { paddingVertical: 4, gap: 12 },
  selectorOption: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, backgroundColor: '#f3f4f6', borderWidth: 2, borderColor: '#e5e7eb' },
  selectorOptionSelected: { backgroundColor: '#10b981', borderColor: '#10b981' },
  selectorOptionText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  selectorOptionTextSelected: { color: '#ffffff' },
  errorText: { fontSize: 14, color: '#ef4444', marginTop: 6, fontWeight: '500' },
  infoBox: { backgroundColor: '#fef3c7', borderRadius: 16, padding: 20, marginTop: 8, borderWidth: 1, borderColor: '#fde68a' },
  infoTitle: { fontSize: 16, fontWeight: '700', color: '#92400e', marginBottom: 8 },
  infoText: { fontSize: 14, color: '#92400e', lineHeight: 20 },
  footer: { flexDirection: 'row', padding: 24, paddingTop: 16, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 16 },
  cancelButton: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 2, borderColor: '#e5e7eb' },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#6b7280' },
  submitButton: { flex: 2, paddingVertical: 16, borderRadius: 12, alignItems: 'center', backgroundColor: '#10b981', shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitButtonDisabled: { backgroundColor: '#9ca3af', shadowOpacity: 0, elevation: 0 },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#ffffff', letterSpacing: 0.5 },
  imagePickerButton: { borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 12, borderStyle: 'dashed', backgroundColor: '#ffffff', overflow: 'hidden' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  imagePlaceholderIcon: { fontSize: 48, marginBottom: 16 },
  imagePlaceholderText: { fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 8 },
  imagePlaceholderSubtext: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
  imagePreviewContainer: { position: 'relative', aspectRatio: 1, width: '100%' },
  imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', paddingVertical: 12, alignItems: 'center' },
  changeImageText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  uploadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 255, 255, 0.9)', alignItems: 'center', justifyContent: 'center' },
  uploadingText: { marginTop: 12, fontSize: 16, fontWeight: '600', color: '#10b981' },
});
