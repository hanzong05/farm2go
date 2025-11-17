import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
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
import VerificationGuard from '../../../../components/VerificationGuard';
import { supabase } from '../../../../lib/supabase';
import { getUserWithProfile } from '../../../../services/auth';
import { notifyAllAdmins } from '../../../../services/notifications';
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

export default function EditProductScreen() {
  const { showAlert, AlertComponent } = useCustomAlert();

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
        .eq('farmer_id', profile.id)
        .single();

      if (error) {
        console.error('Error fetching product:', error);
        Alert.alert('Error', 'Product not found or you do not have permission to edit it');
        router.back();
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
      });
      setSelectedImage(data.image_url);
    } catch (err) {
      console.error('Product fetch error:', err);
      Alert.alert('Error', 'Failed to load product');
      router.back();
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
        mediaTypes: ['images'],
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
        setImageChanged(true);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadImage = async (imageUri: string): Promise<string | null> => {
    try {
      setUploadingImage(true);
      console.log('📤 Uploading product image...');

      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showAlert('Error', 'You must be logged in to upload images', [
          { text: 'OK', style: 'default' }
        ]);
        return null;
      }

      // Get file extension
      const uriWithoutParams = imageUri.split('?')[0].split('#')[0];
      const parts = uriWithoutParams.split('.');
      const fileExt = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'jpg';
      const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      const finalExt = validExtensions.includes(fileExt) ? fileExt : 'jpg';

      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${finalExt}`;
      const filePath = `products/${filename}`;

      const mimeTypes: { [key: string]: string } = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
      };
      const contentType = mimeTypes[finalExt] || 'image/jpeg';

      let arrayBuffer: ArrayBuffer;

      // Handle file reading differently for web vs mobile
      if (Platform.OS === 'web') {
        console.log('📖 Reading file for web...');
        // Use stored web file if available
        if (webImageFile) {
          arrayBuffer = await webImageFile.arrayBuffer();
        } else {
          // Fallback to fetch the blob URL
          const response = await fetch(imageUri);
          const blob = await response.blob();
          arrayBuffer = await blob.arrayBuffer();
        }
        console.log('✅ Web file size:', (arrayBuffer.byteLength / (1024 * 1024)).toFixed(2) + 'MB');
      } else {
        console.log('📖 Reading file for mobile...');
        // On mobile, use FileSystem
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

      // Upload using fetch API with ArrayBuffer
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const uploadUrl = `${supabaseUrl}/storage/v1/object/product-images/${filePath}`;

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
        showAlert('Upload Error', `Failed to upload image (${uploadResponse.status})`, [
          { text: 'OK', style: 'default' }
        ]);
        return null;
      }

      console.log('✅ Product image uploaded successfully');

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      console.log('🔗 Public URL:', publicUrl);
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
            Alert.alert('Error', 'Image size must be less than 5MB');
            return;
          }
          if (!file.type.startsWith('image/')) {
            Alert.alert('Error', 'Please select a valid image file');
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
      Alert.alert(
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
      message: `Are you sure you want to update "${formData.name.trim()}" with these changes?`,
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
        image_url: imageUrl,
        status: product.status === 'rejected' ? 'pending' : product.status,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('products')
        .update(updatedData)
        .eq('id', id)
        .eq('farmer_id', profile.id);

      if (error) throw error;

      // Send notifications to admins about product update
      try {
        await notifyAllAdmins(
          'Product Updated',
          `${profile.first_name} ${profile.last_name} updated their product "${formData.name}"${product.status === 'rejected' ? ' (resubmitted for review)' : ''}`,
          profile.id,
          {
            action: 'product_updated',
            productId: id,
            productName: formData.name,
            farmerId: profile.id,
            farmerName: `${profile.first_name} ${profile.last_name}`,
            wasRejected: product.status === 'rejected',
            newStatus: product.status === 'rejected' ? 'pending' : product.status
          }
        );
        console.log('✅ Product update notification sent to admins');
      } catch (notifError) {
        console.error('⚠️ Failed to send product update notification:', notifError);
        // Don't fail the update if notifications fail
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Approved (Live)';
      case 'pending': return 'Pending Review';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

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
    <VerificationGuard userId={profile.id} userType="farmer" action="sell">
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <HeaderComponent profile={profile} showAddButton={false} showMessages={true} showNotifications={true} />

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Text style={styles.formTitle}>Edit Product</Text>
            <Text style={styles.formSubtitle}>Update your product details. All fields marked with * are required.</Text>

            {product.status && (
              <View style={[styles.statusInfo, { backgroundColor: getStatusBackgroundColor(product.status) }]}>
                <Text style={[styles.statusText, { color: getStatusTextColor(product.status) }]}>
                  Current Status: {getStatusText(product.status)}
                </Text>
                {product.status === 'rejected' && (
                  <Text style={styles.statusSubtext}>
                    This product was rejected. Updating it will resubmit for review.
                  </Text>
                )}
              </View>
            )}

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

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>📝 Update Notes</Text>
              <Text style={styles.infoText}>
                Significant changes to your product may require admin review before the updates appear in the marketplace.
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

        <ConfirmationModal
          visible={confirmModal.visible}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          isDestructive={confirmModal.isDestructive}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
        />

        {AlertComponent}
      </KeyboardAvoidingView>
    </VerificationGuard>
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
  infoBox: { backgroundColor: '#f0f9ff', borderRadius: 16, padding: 20, marginTop: 8, borderWidth: 1, borderColor: '#e0f2fe' },
  infoTitle: { fontSize: 16, fontWeight: '700', color: '#0369a1', marginBottom: 8 },
  infoText: { fontSize: 14, color: '#0369a1', lineHeight: 20 },
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