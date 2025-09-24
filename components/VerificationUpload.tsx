import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';
import WebFileInput from './WebFileInput';

// Import legacy FileSystem methods if available
let legacyFileSystem: any = null;
try {
  if (Platform.OS !== 'web') {
    legacyFileSystem = require('expo-file-system/legacy');
  }
} catch (error) {
  console.warn('Legacy FileSystem not available, will use current API');
}

// Platform-specific import to prevent VisionCamera loading on web
const VisionCamera = Platform.OS === 'web'
  ? require('./VisionCameraMock').default
  : require('./VisionCamera').default;

type VerificationSubmission = Database['public']['Tables']['verification_submissions']['Insert'];

interface VerificationUploadProps {
  userId: string;
  userType: 'farmer' | 'buyer';
  onVerificationSubmitted: () => void;
}

interface VerificationData {
  idDocument: {
    uri: string | null;
    type: string;
  };
  facePhoto: {
    uri: string | null;
  };
  notes: string;
}

const ID_DOCUMENT_TYPES = [
  { key: 'drivers_license', label: 'Driver\'s License' },
  { key: 'national_id', label: 'National ID' },
  { key: 'passport', label: 'Passport' },
  { key: 'voters_id', label: 'Voter\'s ID' },
  { key: 'postal_id', label: 'Postal ID' },
];

const compressImage = async (blob: Blob, quality: number = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve(blob);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new (window as any).Image() as HTMLImageElement;

    img.onload = () => {
      // Calculate new dimensions (max 1920x1080 for mobile)
      const maxWidth = 1920;
      const maxHeight = 1080;
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (compressedBlob) => {
          if (compressedBlob) {
            resolve(compressedBlob);
          } else {
            reject(new Error('Image compression failed'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(blob);
  });
};

export default function VerificationUpload({
  userId,
  userType,
  onVerificationSubmitted,
}: VerificationUploadProps) {
  const [verificationData, setVerificationData] = useState<VerificationData>({
    idDocument: { uri: null, type: 'drivers_license' },
    facePhoto: { uri: null },
    notes: '',
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [showVisionCamera, setShowVisionCamera] = useState<'id' | 'face' | null>(null);
  const [showFileInput, setShowFileInput] = useState<'id' | 'face' | null>(null);
  const [fileSystemAvailable, setFileSystemAvailable] = useState(false);

  // Check FileSystem availability on component mount
  useEffect(() => {
    const checkFileSystem = async () => {
      try {
        if (Platform.OS !== 'web') {
          // Check for modern FileSystem API first, then legacy
          const hasModernAPI = FileSystem && 
                              typeof FileSystem.readAsStringAsync === 'function' &&
                              FileSystem.EncodingType;
                              
          const hasLegacyAPI = legacyFileSystem &&
                              typeof legacyFileSystem.readAsStringAsync === 'function' &&
                              legacyFileSystem.EncodingType;
          
          if (hasModernAPI || hasLegacyAPI) {
            console.log('✅ FileSystem is properly loaded');
            setFileSystemAvailable(true);
          } else {
            console.warn('⚠️ FileSystem methods not available');
            setFileSystemAvailable(false);
          }
        } else {
          setFileSystemAvailable(true); // Web doesn't need FileSystem
        }
      } catch (error) {
        console.error('❌ FileSystem check failed:', error);
        setFileSystemAvailable(false);
      }
    };

    checkFileSystem();
  }, []);

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access to take verification photos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Media Library Permission Required',
        'Please allow media library access to select photos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const showImagePickerOptions = (type: 'id' | 'face') => {
    console.log('Platform.OS:', Platform.OS);
    console.log('showImagePickerOptions called for type:', type);

    // Always use file input on web
    if (Platform.OS === 'web') {
      console.log('Using WebFileInput for web platform');
      setShowFileInput(type);
    } else {
      // For native platforms, show options
      Alert.alert(
        'Select Image',
        'Choose how you want to add your photo',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Take Photo',
            onPress: () => takePhoto(type)
          },
          {
            text: 'Choose from Gallery',
            onPress: () => pickImage(type)
          }
        ]
      );
    }
  };

  const takePhoto = async (type: 'id' | 'face') => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: type === 'id' ? [4, 3] : [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        updateVerificationData(type, result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert(
        'Error',
        'Failed to take photo. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const pickImage = async (type: 'id' | 'face') => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: type === 'id' ? [4, 3] : [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        updateVerificationData(type, result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(
        'Error',
        'Failed to select image. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const updateVerificationData = (type: 'id' | 'face', uri: string) => {
    console.log('📸 updateVerificationData called:', { type, uri: uri?.substring(0, 50) + '...' });

    if (type === 'id') {
      setVerificationData(prev => {
        const newData = {
          ...prev,
          idDocument: { ...prev.idDocument, uri },
        };
        console.log('📸 Updated ID document data:', newData.idDocument);
        return newData;
      });
    } else {
      setVerificationData(prev => {
        const newData = {
          ...prev,
          facePhoto: { uri },
        };
        console.log('📸 Updated face photo data:', newData.facePhoto);
        return newData;
      });
    }
  };

  const handleVisionCameraPhoto = (photoUri: string) => {
    console.log('📸 handleVisionCameraPhoto called with:', {
      photoUri: photoUri?.substring(0, 50) + '...',
      showVisionCamera,
      currentPhotoType: showVisionCamera
    });

    try {
      if (showVisionCamera) {
        console.log('📸 Updating verification data for type:', showVisionCamera);
        updateVerificationData(showVisionCamera, photoUri);

        setTimeout(() => {
          console.log('📸 Setting showVisionCamera to null to return to main view');
          setShowVisionCamera(null);
        }, 100);
      } else {
        console.warn('📸 No showVisionCamera state, cannot process photo');
      }
    } catch (error) {
      console.error('📸 Error handling vision camera photo:', error);
      Alert.alert(
        'Error',
        'Failed to process photo. Please try again.',
        [{ text: 'OK' }]
      );
      setShowVisionCamera(null);
    }
  };

  const handleFileInput = (fileUri: string) => {
    if (showFileInput) {
      updateVerificationData(showFileInput, fileUri);
      setShowFileInput(null);
    }
  };

  // Enhanced upload function with better error handling
  const uploadImageToSupabase = async (uri: string, fileName: string, retryCount = 0): Promise<string> => {
    const maxRetries = 3;
    const isMobile = Platform.OS !== 'web' || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator?.userAgent || '');
    const timeoutDuration = isMobile ? 60000 : 90000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`Upload timeout reached (${timeoutDuration}ms) for:`, fileName);
      controller.abort();
    }, timeoutDuration);

    try {
      console.log(`Starting upload attempt ${retryCount + 1}/${maxRetries + 1} for:`, fileName);
      console.log('Platform:', Platform.OS);
      console.log('FileSystem available:', fileSystemAvailable);
      console.log('URI format:', uri.substring(0, 50) + '...');

      let fileData: ArrayBuffer;
      let mimeType = 'image/jpeg';

      // Handle different platforms and URI formats
      if (Platform.OS === 'web') {
        // Web platform - use fetch
        const response = await fetch(uri, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        
        const blob = await response.blob();
        fileData = await blob.arrayBuffer();
        mimeType = blob.type || 'image/jpeg';
        console.log('Web: Created ArrayBuffer, size:', fileData.byteLength);
        
      } else {
        // React Native platform - use FileSystem if available, otherwise fallback to fetch
        if (fileSystemAvailable) {
          try {
            let fileUri = uri;
            
            // Determine which API to use
            const useModernAPI = FileSystem && typeof FileSystem.readAsStringAsync === 'function';
            const fsAPI = useModernAPI ? FileSystem : legacyFileSystem;
            
            // Handle content:// URIs by copying to cache first
            if (uri.startsWith('content://') || uri.startsWith('ph://')) {
              console.log('Converting content/photo URI to file URI...');
              const tempFileName = `temp_${Date.now()}.jpg`;
              
              // Use the appropriate cacheDirectory
              const cacheDir = useModernAPI 
                ? (FileSystem.cacheDirectory || FileSystem.documentDirectory)
                : (legacyFileSystem?.cacheDirectory || FileSystem.documentDirectory);
              
              const tempUri = `${cacheDir}${tempFileName}`;
              
              // Use the appropriate copy method
              if (useModernAPI && FileSystem.copyAsync) {
                await FileSystem.copyAsync({
                  from: uri,
                  to: tempUri
                });
              } else if (legacyFileSystem?.copyAsync) {
                await legacyFileSystem.copyAsync({
                  from: uri,
                  to: tempUri
                });
              } else {
                throw new Error('Copy function not available');
              }
              
              fileUri = tempUri;
              console.log('Copied to temp file:', fileUri);
            }
            
            console.log('Reading file as base64...');
            
            // Read file as base64 using the appropriate API
            const encodingType = useModernAPI 
              ? FileSystem.EncodingType?.Base64 
              : legacyFileSystem?.EncodingType?.Base64;
            
            if (!encodingType) {
              throw new Error('Base64 encoding type not available');
            }
            
            const base64String = await fsAPI.readAsStringAsync(fileUri, {
              encoding: encodingType,
            });
            
            console.log('Read file as base64, length:', base64String.length);
            
            if (!base64String || base64String.length === 0) {
              throw new Error('File is empty or could not be read');
            }
            
            // Convert base64 to ArrayBuffer
            const binaryString = atob(base64String);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            fileData = bytes.buffer;
            console.log('Native FileSystem: Created ArrayBuffer, size:', fileData.byteLength);
            
            // Clean up temp file if we created one
            if (fileUri !== uri && fileUri.includes('temp_')) {
              try {
                // Use the appropriate delete method
                if (useModernAPI && FileSystem.deleteAsync) {
                  await FileSystem.deleteAsync(fileUri, { idempotent: true });
                } else if (legacyFileSystem?.deleteAsync) {
                  await legacyFileSystem.deleteAsync(fileUri, { idempotent: true });
                }
              } catch (deleteError) {
                console.warn('Failed to delete temp file:', deleteError);
              }
            }
            
          } catch (fileError: unknown) {
            console.error('FileSystem error:', fileError);
            const errorMessage = fileError instanceof Error ? fileError.message : 'Unknown file system error';
            throw new Error(`FileSystem failed: ${errorMessage}. Please restart the app and try again.`);
          }
        } else {
          // FileSystem not available - use fetch as fallback
          console.log('FileSystem not available, using fetch fallback...');
          try {
            const response = await fetch(uri, { signal: controller.signal });
            if (!response.ok) {
              throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
            }
            const blob = await response.blob();
            fileData = await blob.arrayBuffer();
            console.log('Fetch fallback successful, size:', fileData.byteLength);
          } catch (fetchError: unknown) {
            const fetchErrorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
            throw new Error(`Cannot read file - FileSystem unavailable and fetch failed: ${fetchErrorMessage}`);
          }
        }
      }

      // Validate file data
      if (fileData.byteLength === 0) {
        throw new Error('Image file is empty. Please try taking another photo.');
      }

      if (fileData.byteLength > 20 * 1024 * 1024) {
        throw new Error('File size too large. Please select an image smaller than 20MB.');
      }

      console.log('File data prepared, size:', Math.round(fileData.byteLength / 1024) + 'KB');

      // Create file path
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${userId}/${fileName}.${fileExt}`;

      console.log('Starting Supabase upload:', filePath);

      // Upload to Supabase using ArrayBuffer
      const uploadOptions = {
        cacheControl: '3600',
        upsert: true,
        contentType: mimeType,
      };

      const { data, error } = await supabase.storage
        .from('verification-documents')
        .upload(filePath, fileData, uploadOptions);

      if (error) {
        console.error('Storage upload error:', error);
        
        if (error.message.includes('Bucket not found')) {
          throw new Error('Storage bucket not configured. Please contact support.');
        }
        
        // Handle duplicate files
        if (error.message.includes('duplicate') || error.message.includes('already exists')) {
          console.log('File exists, trying with unique name...');
          const uniqueFileName = `${fileName}_${Date.now()}`;
          const uniquePath = `${userId}/${uniqueFileName}.${fileExt}`;
          
          const { data: retryData, error: retryError } = await supabase.storage
            .from('verification-documents')
            .upload(uniquePath, fileData, uploadOptions);
            
          if (retryError) {
            throw retryError;
          }
          
          const { data: urlData } = supabase.storage
            .from('verification-documents')
            .getPublicUrl(retryData.path);
          
          return urlData.publicUrl;
        }
        
        throw error;
      }

      console.log('Upload successful:', data.path);

      const { data: urlData } = supabase.storage
        .from('verification-documents')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
      
    } catch (uploadError) {
      console.error('Upload process error:', uploadError);

      // Handle timeout/abort errors with retry logic
      if (uploadError instanceof Error && (uploadError.name === 'AbortError' || uploadError.message.includes('timeout'))) {
        if (retryCount < maxRetries) {
          console.log(`Upload timeout, retrying... (${retryCount + 1}/${maxRetries})`);
          clearTimeout(timeoutId);
          const backoffTime = Math.min(2000 * Math.pow(2, retryCount), 10000);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          return uploadImageToSupabase(uri, fileName, retryCount + 1);
        }
        throw new Error('Upload timeout after retries. Please try with a smaller image or better internet connection.');
      }

      // Handle specific errors
      if (uploadError instanceof Error) {
        if (uploadError.message.includes('FileSystem failed')) {
          throw new Error('App restart required. Please close and reopen the app, then try again.');
        }
        
        if (uploadError.message.includes('Cannot read file')) {
          throw new Error('Cannot read the selected image. Please try selecting a different image.');
        }
      }

      // Retry on network errors
      if (uploadError instanceof Error &&
          (uploadError.message.includes('fetch') ||
           uploadError.message.includes('network') ||
           uploadError.message.includes('Failed to fetch')) &&
          retryCount < maxRetries) {
        console.log(`Network error, retrying... (${retryCount + 1}/${maxRetries})`);
        clearTimeout(timeoutId);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return uploadImageToSupabase(uri, fileName, retryCount + 1);
      }

      // Generic error
      throw new Error('Failed to upload image. Please try again.');
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const submitVerification = async () => {
    console.log('📄 Submit verification started');

    if (!verificationData.idDocument.uri || !verificationData.facePhoto.uri) {
      Alert.alert(
        'Missing Photos',
        'Please upload both ID document and face photo.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check if FileSystem is available for native platforms
    if (Platform.OS !== 'web' && !fileSystemAvailable) {
      Alert.alert(
        'App Restart Required',
        'The file system is not available. Please close and reopen the app, then try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    const isMobile = Platform.OS !== 'web' || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator?.userAgent || '');
    const totalTimeout = isMobile ? 180000 : 240000;
    let timeoutId: number | undefined;

    try {
      setUploading(true);
      setUploadProgress('Preparing upload... (1/4)');

      console.log('Starting verification submission...');

      // Set overall timeout
      timeoutId = setTimeout(() => {
        throw new Error('Overall submission timeout');
      }, totalTimeout);

      setUploadProgress('Uploading ID document... (2/4)');
      console.log('Starting ID document upload');

      const idDocumentUrl = await uploadImageToSupabase(
        verificationData.idDocument.uri,
        `id_document_${Date.now()}`
      );

      console.log('ID document uploaded successfully');
      setUploadProgress('Uploading face photo... (3/4)');

      const facePhotoUrl = await uploadImageToSupabase(
        verificationData.facePhoto.uri,
        `face_photo_${Date.now()}`
      );

      console.log('Face photo uploaded successfully');
      setUploadProgress('Submitting verification... (4/4)');

      // Submit verification to database
      const submissionData: VerificationSubmission = {
        user_id: userId,
        id_document_url: idDocumentUrl,
        face_photo_url: facePhotoUrl,
        id_document_type: verificationData.idDocument.type,
        submission_notes: verificationData.notes || null,
        status: 'pending',
      };

      const { error } = await (supabase
        .from('verification_submissions') as any)
        .insert(submissionData);

      if (error) {
        throw error;
      }

      console.log('Verification submitted successfully');

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }

      Alert.alert(
        'Verification Submitted!',
        'Your verification documents have been submitted successfully. You will be notified once an admin reviews your submission.',
        [{
          text: 'OK',
          onPress: () => {
            setTimeout(() => {
              onVerificationSubmitted();
            }, 200);
          }
        }]
      );
    } catch (error) {
      console.error('Error submitting verification:', error);

      let errorMessage = 'Failed to submit verification. Please try again.';
      let showRetry = true;

      if (error instanceof Error) {
        if (error.message.includes('App restart required') || error.message.includes('FileSystem failed')) {
          errorMessage = 'Please close and reopen the app, then try again.';
          showRetry = false;
        } else if (error.message.includes('Cannot read the selected image')) {
          errorMessage = 'Cannot read the selected image. Please try selecting a different photo.';
        } else if (error.message.includes('timeout')) {
          errorMessage = isMobile
            ? 'Upload timeout on mobile. Try using WiFi or a better signal area.'
            : 'Upload timeout. Please check your internet connection.';
        } else if (error.message.includes('File size too large')) {
          errorMessage = error.message;
          showRetry = false;
        }
      }

      if (showRetry) {
        Alert.alert(
          'Submission Failed',
          errorMessage,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Try Again', onPress: submitVerification }
          ]
        );
      } else {
        Alert.alert(
          'Submission Failed',
          errorMessage,
          [{ text: 'OK' }]
        );
      }
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      setUploading(false);
      setUploadProgress('');
    }
  };

  const selectIdDocumentType = () => {
    Alert.alert(
      'ID Document Type',
      'Using default ID document type for mobile verification.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Continue',
          onPress: () => {
            setVerificationData(prev => ({
              ...prev,
              idDocument: { ...prev.idDocument, type: 'drivers_license' },
            }));
          }
        }
      ]
    );
  };

  // Show FileSystem warning for native platforms
  if (Platform.OS !== 'web' && !fileSystemAvailable) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>System Error</Text>
          <Text style={styles.subtitle}>
            The file system is not available. Please restart the app to continue with verification.
          </Text>
        </View>
        
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ App Restart Required</Text>
          <Text style={styles.errorText}>
            The file handling system is not properly loaded. Please close this app completely and reopen it to resolve this issue.
          </Text>
          <Text style={styles.errorText}>
            If the problem persists, try restarting your device.
          </Text>
        </View>
      </ScrollView>
    );
  }

  if (showVisionCamera) {
    console.log('📸 Rendering VisionCamera for type:', showVisionCamera);
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {showVisionCamera === 'id' ? 'Capture ID Document' : 'Take Face Photo'}
          </Text>
          <Text style={styles.subtitle}>
            Position your {showVisionCamera === 'id' ? 'ID document' : 'face'} in the camera frame and take a photo
          </Text>
        </View>

        <VisionCamera
          type={showVisionCamera}
          onPhotoTaken={handleVisionCameraPhoto}
        />

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            console.log('Back button pressed');
            setShowVisionCamera(null);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.backButtonText}>← Back to Upload Options</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (showFileInput) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {showFileInput === 'id' ? 'Select ID Document' : 'Select Face Photo'}
          </Text>
          <Text style={styles.subtitle}>
            Choose an image file from your computer
          </Text>
        </View>

        <WebFileInput
          type={showFileInput}
          onFileSelected={handleFileInput}
        />

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setShowFileInput(null)}
          activeOpacity={0.8}
        >
          <Text style={styles.backButtonText}>← Back to Upload Options</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  console.log('📸 Rendering main upload view - showVisionCamera:', showVisionCamera, 'showFileInput:', showFileInput);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Account Verification</Text>
        <Text style={styles.subtitle}>
          {userType === 'farmer'
            ? 'Verify your identity to start selling products'
            : 'Verify your identity to start buying products'}
        </Text>
      </View>

      {/* ID Document Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Upload Valid ID Document</Text>
        <Text style={styles.sectionDescription}>
          Upload a clear photo of your government-issued ID
        </Text>

        <TouchableOpacity
          style={styles.documentTypeButton}
          onPress={selectIdDocumentType}
          activeOpacity={0.8}
        >
          <Text style={styles.documentTypeText}>
            📄 {ID_DOCUMENT_TYPES.find(t => t.key === verificationData.idDocument.type)?.label}
          </Text>
          <Text style={styles.changeText}>Change</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => showImagePickerOptions('id')}
          activeOpacity={0.8}
        >
          {verificationData.idDocument.uri ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: verificationData.idDocument.uri }} style={styles.previewImage} />
              <View style={styles.imageOverlay}>
                <Text style={styles.imageOverlayText}>✓ ID Document Uploaded</Text>
              </View>
            </View>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Text style={styles.uploadIcon}>📷</Text>
              <Text style={styles.uploadText}>Upload ID Document</Text>
              <Text style={styles.uploadSubtext}>Tap to take photo or choose from gallery</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Face Photo Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Take Face Photo</Text>
        <Text style={styles.sectionDescription}>
          Take a clear selfie for face verification
        </Text>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => showImagePickerOptions('face')}
          activeOpacity={0.8}
        >
          {verificationData.facePhoto.uri ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: verificationData.facePhoto.uri }} style={styles.facePreviewImage} />
              <View style={styles.imageOverlay}>
                <Text style={styles.imageOverlayText}>✓ Face Photo Uploaded</Text>
              </View>
            </View>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Text style={styles.uploadIcon}>🤳</Text>
              <Text style={styles.uploadText}>Take Face Photo</Text>
              <Text style={styles.uploadSubtext}>Make sure your face is clearly visible</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Verification Guidelines */}
      <View style={styles.guidelines}>
        <Text style={styles.guidelinesTitle}>📋 Verification Guidelines</Text>
        <View style={styles.guidelinesList}>
          <Text style={styles.guideline}>• ID document must be valid and not expired</Text>
          <Text style={styles.guideline}>• Photo should be clear and readable</Text>
          <Text style={styles.guideline}>• Face photo should show your face clearly</Text>
          <Text style={styles.guideline}>• No filters or editing allowed</Text>
          <Text style={styles.guideline}>• Review may take 1-3 business days</Text>
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          (!verificationData.idDocument.uri || !verificationData.facePhoto.uri || uploading) &&
            styles.submitButtonDisabled,
        ]}
        onPress={submitVerification}
        disabled={!verificationData.idDocument.uri || !verificationData.facePhoto.uri || uploading}
        activeOpacity={0.8}
      >
        {uploading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#ffffff" />
            <Text style={styles.submitButtonText}>{uploadProgress}</Text>
          </View>
        ) : (
          <Text style={styles.submitButtonText}>Submit for Verification</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  documentTypeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  documentTypeText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  changeText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  uploadButton: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: '#f9fafb',
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  uploadText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  uploadSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  imagePreview: {
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  facePreviewImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  imageOverlayText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  guidelines: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#fbbf24',
    marginBottom: 32,
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 12,
  },
  guidelinesList: {
    gap: 8,
  },
  guideline: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  backButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#fca5a5',
    marginBottom: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    lineHeight: 20,
    marginBottom: 8,
  },
});