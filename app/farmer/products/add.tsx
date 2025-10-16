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

  const uploadImage = async (imageUri: string): Promise<string | null> => {
    try {
      setUploadingImage(true);

      // Check if user is authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('Authentication error:', sessionError);
        Alert.alert('Error', 'You must be logged in to upload images');
        return null;
      }

      // Create a unique filename with proper extension
      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${filename}`;

      // Read file data for React Native
      let fileData: any;
      let mimeType = 'image/jpeg';

      if (Platform.OS === 'web') {
        // Web: use the stored File object if available, otherwise fetch the blob URL
        const webFile = (setSelectedImage as any).webFile;
        if (webFile) {
          fileData = webFile;
          mimeType = webFile.type;
        } else {
          // Fallback: convert blob URL to blob
          const response = await fetch(imageUri);
          fileData = await response.blob();
          mimeType = response.headers.get('content-type') || 'image/jpeg';
        }

        console.log('📤 Uploading image (web):', {
          filename: filePath,
          mimeType,
          size: fileData.size || 'unknown'
        });

        // Upload to Supabase storage
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(filePath, fileData, {
            contentType: mimeType,
            upsert: false,
            cacheControl: '3600'
          });

        if (error) {
          console.error('❌ Upload error:', error);
          throw error;
        }

        console.log('✅ Upload successful:', data.path);

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(data.path);

        console.log('🔗 Public URL:', publicUrl);

        return publicUrl;
      } else {
        // React Native: use FileSystem to read as base64
        console.log('📱 Reading file for React Native upload...');

        // Determine mime type from extension
        if (fileExt === 'png') {
          mimeType = 'image/png';
        } else if (fileExt === 'jpg' || fileExt === 'jpeg') {
          mimeType = 'image/jpeg';
        } else if (fileExt === 'webp') {
          mimeType = 'image/webp';
        }

        console.log('📤 Preparing upload (React Native)...');

        // Verify authentication before upload
        console.log('🔐 Verifying auth token...');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        console.log('🔐 Auth status:', {
          hasSession: !!currentSession,
          hasAccessToken: !!currentSession?.access_token,
          userId: currentSession?.user?.id
        });

        if (!currentSession) {
          throw new Error('No active session found. Please log in again.');
        }

        // Get file info
        const fileInfo = await FileSystem.getInfoAsync(imageUri);
        console.log('📁 File info:', {
          exists: fileInfo.exists,
          size: fileInfo.size,
          sizeInMB: fileInfo.size ? (fileInfo.size / (1024 * 1024)).toFixed(2) : 'unknown'
        });

        // Check file size - Supabase has limits
        const maxSizeInMB = 50;
        if (fileInfo.size && fileInfo.size / (1024 * 1024) > maxSizeInMB) {
          throw new Error(`File size (${(fileInfo.size / (1024 * 1024)).toFixed(2)}MB) exceeds maximum allowed (${maxSizeInMB}MB)`);
        }

        // For React Native, create a FormData object
        console.log('📦 Creating FormData for upload...');
        const formData = new FormData();

        // Add file to FormData - React Native way
        formData.append('file', {
          uri: imageUri,
          type: mimeType,
          name: filename
        } as any);

        console.log('📤 Starting upload to Supabase Storage...');
        console.log('   Path:', filePath);
        console.log('   Type:', mimeType);

        // Upload using fetch directly with FormData
        const uploadUrl = `https://lipviwhsjgvcmdggecqn.supabase.co/storage/v1/object/product-images/${filePath}`;

        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentSession.access_token}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: formData,
        });

        console.log('📡 Upload response status:', uploadResponse.status);

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error('❌ Upload failed:', errorText);
          throw new Error(`Upload failed with status ${uploadResponse.status}: ${errorText}`);
        }

        const uploadResult = await uploadResponse.json();
        console.log('✅ Upload successful:', uploadResult);

        console.log('✅ Upload completed successfully!');

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        console.log('🔗 Public URL:', publicUrl);

        return publicUrl;
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      const errorMessage = error?.message || 'Failed to upload image';
      Alert.alert('Upload Error', errorMessage);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const pickWebImage = () => {
    // Only available on web platform
    if (Platform.OS !== 'web') return;

    // Create a file input element for web
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        // Check file size (limit to 5MB)
        if (file.size > 5 * 1024 * 1024) {
          Alert.alert('Error', 'Image size must be less than 5MB');
          return;
        }

        // Check file type
        if (!file.type.startsWith('image/')) {
          Alert.alert('Error', 'Please select a valid image file');
          return;
        }

        // Create object URL for preview
        const imageUrl = URL.createObjectURL(file);
        setSelectedImage(imageUrl);

        // Store the file for later upload
        (setSelectedImage as any).webFile = file;
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
        imageUrl = await uploadImage(selectedImage);
        if (!imageUrl) {
          throw new Error('Failed to upload image');
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

      Alert.alert(
        'Success',
        'Product added successfully! You will be notified once it is reviewed.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
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