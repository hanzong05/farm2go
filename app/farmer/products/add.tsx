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
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import ConfirmationModal from '../../../components/ConfirmationModal';
import HeaderComponent from '../../../components/HeaderComponent';
import VerificationGuard from '../../../components/VerificationGuard';
import { supabase } from '../../../lib/supabase';
import { getUserWithProfile } from '../../../services/auth';
import { notifyProductCreated } from '../../../services/notifications';
import { Database } from '../../../types/database';

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

export default function AddProductScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
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

  useEffect(() => {
    loadProfile();
  }, []);

  // Cleanup blob URLs on unmount (web only)
  useEffect(() => {
    return () => {
      if (Platform.OS === 'web' && selectedImage && selectedImage.startsWith('blob:')) {
        URL.revokeObjectURL(selectedImage);
      }
    };
  }, [selectedImage]);

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
  const [uploadingImage, setUploadingImage] = useState(false);
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

  const [successModal, setSuccessModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

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

  const uploadImageWeb = async (file: File): Promise<string | null> => {
    try {
      setUploadingImage(true);
      console.log('📤 Starting web upload for product image');

      // Get session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Session expired. Please log in again.');
      }

      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const filename = `product_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      console.log('✅ Web file size:', (arrayBuffer.byteLength / (1024 * 1024)).toFixed(2) + 'MB');

      // Upload using fetch API with ArrayBuffer
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const uploadUrl = `${supabaseUrl}/storage/v1/object/product-images/${filename}`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': file.type,
          'x-upsert': 'false',
        },
        body: arrayBuffer,
      });

      console.log('📡 Upload response:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload failed:', errorText);
        throw new Error(`Upload failed: ${response.status}`);
      }

      console.log('✅ Product image uploaded successfully');

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filename);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const uploadImage = async (imageUri: string): Promise<string | null> => {
    try {
      setUploadingImage(true);
      console.log('📤 Starting upload for product image');
      console.log('Platform:', Platform.OS);
      console.log('URI:', imageUri.substring(0, 50) + '...');

      // Get session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Session expired. Please log in again.');
      }

      // Create a unique filename
      const filename = `product_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const contentType = 'image/jpeg';
      let arrayBuffer: ArrayBuffer;

      // Handle file reading differently for web vs mobile
      if (Platform.OS === 'web') {
        console.log('📖 Reading file for web...');
        const response = await fetch(imageUri);
        const blob = await response.blob();
        arrayBuffer = await blob.arrayBuffer();
        console.log('✅ Web file size:', (arrayBuffer.byteLength / (1024 * 1024)).toFixed(2) + 'MB');
      } else {
        console.log('📖 Reading file for mobile...');
        try {
          // On mobile, use FileSystem
          const fileInfo = await FileSystem.getInfoAsync(imageUri);
          console.log('📁 File info:', fileInfo);

          if (fileInfo.exists && 'size' in fileInfo) {
            console.log('📁 Mobile file size:', (fileInfo.size / (1024 * 1024)).toFixed(2) + 'MB');
          }

          console.log('📖 Reading file as base64...');
          const base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          console.log('✅ Base64 length:', base64.length);

          console.log('🔄 Decoding base64 to ArrayBuffer...');
          arrayBuffer = decode(base64);
          console.log('✅ ArrayBuffer created, size:', arrayBuffer.byteLength);
        } catch (fileError) {
          console.error('❌ File reading error:', fileError);
          throw new Error(`Failed to read image file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
        }
      }

      console.log('✅ ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');
      console.log('📤 Uploading to Supabase Storage...');

      // Upload using fetch API with ArrayBuffer - direct upload method
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const uploadUrl = `${supabaseUrl}/storage/v1/object/product-images/${filename}`;

      console.log('📡 Upload URL:', uploadUrl);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': contentType,
          'x-upsert': 'false',
        },
        body: arrayBuffer,
      });

      console.log('📡 Upload response status:', response.status);
      console.log('📡 Upload response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload failed with status:', response.status);
        console.error('❌ Upload error details:', errorText);
        Alert.alert('Upload Error', `Failed to upload image: ${response.status}. ${errorText}`);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      console.log('✅ Product image uploaded successfully');

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filename);

      return publicUrl;
    } catch (error) {
      console.error('❌ Error uploading image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ Error details:', errorMessage);
      Alert.alert('Upload Failed', `Failed to upload image: ${errorMessage}`);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const pickWebImage = async () => {
    // Only available on web platform
    if (Platform.OS !== 'web') return;

    // Create a file input element for web
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        // Check file size (limit to 10MB)
        if (file.size > 10 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Please select an image smaller than 10MB.');
          return;
        }

        // Check file type
        if (!file.type.startsWith('image/')) {
          Alert.alert('Invalid File', 'Please select an image file.');
          return;
        }

        // Upload the file directly
        const publicUrl = await uploadImageWeb(file);

        if (publicUrl) {
          setSelectedImage(publicUrl);
        }
      }
    };
    input.click();
  };

  const showImageOptions = () => {
    if (Platform.OS === 'web') {
      pickWebImage();
    } else {
      Alert.alert(
        'Add Product Image',
        'Choose how you want to add a product image',
        [
          { text: 'Camera', onPress: takePhoto },
          { text: 'Photo Library', onPress: pickImage },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    // Show confirmation modal
    const productName = formData.name.trim() || 'this product';
    const price = parseFloat(formData.price) || 0;

    setConfirmModal({
      visible: true,
      title: 'Add Product?',
      message: `Are you sure you want to add "${productName}" for ₱${price}/${formData.unit}? It will be submitted for admin review before appearing in the marketplace.`,
      isDestructive: false,
      confirmText: 'Add Product',
      onConfirm: () => {
        processSubmit();
        setConfirmModal(prev => ({ ...prev, visible: false }));
      }
    });
  };

  const processSubmit = async () => {
    setIsSubmitting(true);

    try {
      const userData = await getUserWithProfile();
      if (!userData?.user) {
        throw new Error('User not authenticated');
      }

      let imageUrl = null;
      if (selectedImage) {
        // Check if image is already a URL (web) or needs upload (mobile)
        if (selectedImage.startsWith('http://') || selectedImage.startsWith('https://')) {
          // Already uploaded (web)
          imageUrl = selectedImage;
        } else {
          // Need to upload (mobile)
          imageUrl = await uploadImage(selectedImage);
          if (!imageUrl) {
            throw new Error('Failed to upload image');
          }
        }
      }

      const productData = {
        farmer_id: userData.user.id,
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        unit: formData.unit,
        quantity_available: parseInt(formData.quantity_available),
        category: formData.category,
        status: 'pending' as const,
        image_url: imageUrl,
      };

      const { data: insertedProduct, error } = await (supabase as any)
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (error) throw error;

      // Send notifications about product creation
      try {
        // Get all admin IDs for notification
        const { data: adminProfiles, error: adminError } = await supabase
          .from('profiles')
          .select('id')
          .in('user_type', ['admin', 'super-admin']);

        const adminIds = adminProfiles?.map(admin => admin.id) || [];

        // Notify about product creation
        await notifyProductCreated(
          insertedProduct.id,
          formData.name.trim(),
          userData.user.id,
          adminIds
        );

        console.log('✅ Notifications sent for product creation');
      } catch (notifError) {
        console.error('⚠️ Failed to send notifications:', notifError);
        // Don't fail the product creation if notifications fail
      }

      setSuccessModal({
        visible: true,
        title: 'Success!',
        message: 'Product added successfully! You will be notified once it is reviewed.',
        onConfirm: () => {
          setSuccessModal(prev => ({ ...prev, visible: false }));
          router.back();
        }
      });
    } catch (error) {
      console.error('Error adding product:', error);
      Alert.alert('Error', 'Failed to add product. Please try again.');
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

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <VerificationGuard
      userId={profile.id}
      userType="farmer"
      action="sell"
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <HeaderComponent
          profile={profile}
          showAddButton={false}
          showMessages={true}
          showNotifications={true}
        />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <Text style={styles.formTitle}>Product Information</Text>
          <Text style={styles.formSubtitle}>
            Add details about your product. All fields marked with * are required.
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
                  <Text style={styles.imagePlaceholderSubtext}>
                    {Platform.OS === 'web'
                      ? 'Click to select image file from your computer'
                      : 'Tap to select from gallery or take photo'}
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

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>📋 Review Process</Text>
            <Text style={styles.infoText}>
              Your product will be reviewed by our team before it appears in the marketplace.
              This usually takes 1-2 business days. You'll be notified once it's approved.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={isSubmitting}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Adding Product...' : 'Add Product'}
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

      <ConfirmationModal
        visible={successModal.visible}
        title={successModal.title}
        message={successModal.message}
        confirmText="OK"
        isDestructive={false}
        onConfirm={successModal.onConfirm}
        onCancel={successModal.onConfirm}
      />
    </KeyboardAvoidingView>
    </VerificationGuard>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    backgroundColor: '#1f2937',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 80,
  },
  content: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -15,
  },
  form: {
    padding: 24,
    paddingTop: 32,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  formSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 32,
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  requiredStar: {
    color: '#ef4444',
  },
  input: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  inputFocused: {
    borderColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
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
    borderColor: '#e5e7eb',
  },
  selectorOptionSelected: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  selectorOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  selectorOptionTextSelected: {
    color: '#ffffff',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    marginTop: 6,
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0369a1',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#0369a1',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  submitButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  // Image Picker Styles
  imagePickerButton: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderStyle: 'dashed',
    backgroundColor: '#ffffff',
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
    color: '#374151',
    marginBottom: 8,
  },
  imagePlaceholderSubtext: {
    fontSize: 14,
    color: '#6b7280',
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
    color: '#ffffff',
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
    color: '#10b981',
  },
});