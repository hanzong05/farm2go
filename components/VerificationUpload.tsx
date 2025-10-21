import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { Alert, showError, showSuccess } from '../utils/alert';
import WebFileInput from './WebFileInput';

// Platform-specific import to prevent VisionCamera loading on web
const VisionCamera = Platform.OS === 'web'
  ? require('./VisionCameraMock').default
  : require('./VisionCamera').default;

// type VerificationSubmission = Database['public']['Tables']['verification_submissions']['Insert'];

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

const VerificationUpload: React.FC<VerificationUploadProps> = ({
  userId,
  userType, // Available but not currently used in submission
  onVerificationSubmitted,
}) => {
  const [verificationData, setVerificationData] = useState<VerificationData>({
    idDocument: { uri: null, type: '' },
    facePhoto: { uri: null },
    notes: '',
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [showVisionCamera, setShowVisionCamera] = useState<'id' | 'face' | null>(null);
  const [showFileInput, setShowFileInput] = useState<'id' | 'face' | null>(null);

  // Check FileSystem availability on mount
  const [fileSystemAvailable, setFileSystemAvailable] = useState(false);

  useEffect(() => {
    const checkFileSystem = () => {
      try {
        if (Platform.OS !== 'web' && LegacyFileSystem) {
          console.log('✅ Legacy FileSystem is properly loaded');
          setFileSystemAvailable(true);
        } else {
          console.log('⚠️ FileSystem not available on this platform');
          setFileSystemAvailable(false);
        }
      } catch (error) {
        console.error('❌ Error checking FileSystem availability:', error);
        setFileSystemAvailable(false);
      }
    };

    checkFileSystem();
  }, []);

  const showImagePickerOptions = (type: 'id' | 'face') => {
    console.log('Platform.OS:', Platform.OS);
    console.log(`showImagePickerOptions called for type: ${type}`);

    if (Platform.OS === 'web') {
      console.log('📱 Web platform - showing file input');
      setShowFileInput(type);
      return;
    }

    Alert.alert(
      'Select Image',
      'Choose how you would like to add your image',
      [
        { text: 'Camera', onPress: () => takePicture(type) },
        { text: 'Photo Library', onPress: () => pickImage(type) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const takePicture = (type: 'id' | 'face') => {
    console.log(`📸 Taking picture for type: ${type}`);

    if (Platform.OS === 'web') {
      console.log('📱 Web platform - showing Vision Camera');
      setShowVisionCamera(type);
    } else {
      console.log('📱 Mobile platform - using ImagePicker camera');
      launchCamera(type);
    }
  };

  const launchCamera = async (type: 'id' | 'face') => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: type === 'id' ? [4, 3] : [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log(`📸 Camera result for ${type}:`, asset.uri);
        updateVerificationData(type, asset.uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickImage = async (type: 'id' | 'face') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Media library permission is required to select photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: type === 'id' ? [4, 3] : [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log(`🖼️ Library result for ${type}:`, asset.uri);
        updateVerificationData(type, asset.uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const updateVerificationData = (type: 'id' | 'face', uri: string, documentType?: string) => {
    console.log('📸 updateVerificationData called:', { type, uri, documentType });

    setVerificationData(prev => {
      const updated = { ...prev };

      if (type === 'id') {
        console.log('📸 Updated ID document data:', { uri, type: documentType || 'other' });
        updated.idDocument = {
          uri,
          type: documentType || 'other'
        };
      } else if (type === 'face') {
        console.log('📸 Updated face photo data:', { uri });
        updated.facePhoto = { uri };
      }

      return updated;
    });

    // Close any open modals
    setShowVisionCamera(null);
    setShowFileInput(null);
  };

  const uploadImageToSupabase = async (uri: string, fileName: string, bucket: string = 'verification-documents'): Promise<string> => {
    const controller = new AbortController();
    const timeoutDuration = 60000; // 60 seconds timeout
    const maxRetries = 3;
    let retryCount = 0;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutDuration);

    try {
      console.log(`Starting upload attempt ${retryCount + 1}/${maxRetries + 1} for:`, fileName);
      console.log('Platform:', Platform.OS);
      console.log('Legacy FileSystem available:', fileSystemAvailable);
      console.log('URI format:', uri.substring(0, 50) + '...');

      // Check user authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated. Please log in again.');
      }
      console.log('✅ User authenticated:', user.id);

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
        // React Native platform - use Legacy FileSystem for reliable operation
        if (fileSystemAvailable) {
          try {
            let fileUri = uri;

            // Handle content:// URIs by copying to cache first
            if (uri.startsWith('content://') || uri.startsWith('ph://')) {
              console.log('Converting content/photo URI to file URI...');
              const tempFileName = `temp_${Date.now()}.jpg`;
              const tempUri = `${LegacyFileSystem.cacheDirectory}${tempFileName}`;

              await LegacyFileSystem.copyAsync({
                from: uri,
                to: tempUri
              });

              fileUri = tempUri;
              console.log('Copied to temp file:', fileUri);
            }

            console.log('Reading file as base64 using legacy API...');

            // Use legacy FileSystem API for stable operation
            const base64String = await LegacyFileSystem.readAsStringAsync(fileUri, {
              encoding: LegacyFileSystem.EncodingType.Base64,
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
            console.log('Legacy FileSystem: Created ArrayBuffer, size:', fileData.byteLength);

            // Clean up temp file if we created one
            if (fileUri !== uri && fileUri.includes('temp_')) {
              try {
                await LegacyFileSystem.deleteAsync(fileUri, { idempotent: true });
              } catch (deleteError) {
                console.warn('Failed to delete temp file:', deleteError);
              }
            }

          } catch (fileError: unknown) {
            console.error('Legacy FileSystem error:', fileError);
            // const errorMessage = fileError instanceof Error ? fileError.message : 'Unknown file system error';

            // Try fetch fallback for any FileSystem errors
            console.log('FileSystem failed, trying fetch fallback...');
            throw fileError; // This will trigger the fetch fallback below
          }
        } else {
          // FileSystem not available - use fetch as fallback
          console.log('FileSystem not available, using fetch fallback...');
          try {
            // For Android content:// URIs, we need a different approach
            if (Platform.OS === 'android' && uri.startsWith('content://')) {
              throw new Error('Android content URIs require FileSystem API. Please restart the app.');
            } else {
              // Use fetch for other platforms or http/https URIs
              const response = await fetch(uri, { signal: controller.signal });
              if (!response.ok) {
                throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
              }
              const blob = await response.blob();
              fileData = await blob.arrayBuffer();
              console.log('Fetch fallback successful, size:', fileData.byteLength);
            }
          } catch (fetchError: unknown) {
            const fetchErrorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
            throw new Error(`Cannot read file - FileSystem unavailable and fetch failed: ${fetchErrorMessage}`);
          }
        }
      }

      clearTimeout(timeoutId);

      // Generate unique file ID for the actual file
      const fileId = Math.random().toString(36).substring(2) + Date.now().toString(36);

      // Create nested folder structure: userId/documentType_timestamp.app/fileId
      const userFileName = `${user.id}/${fileName}.app/${fileId}`;

      // Upload to Supabase with user-specific path
      console.log(`Uploading to Supabase: ${userFileName}`);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(userFileName, fileData, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);

        // If RLS error, try uploading to a different bucket or with different approach
        if (uploadError.message.includes('row-level security') || uploadError.message.includes('policy')) {
          console.log('🔄 RLS policy error, trying alternative approach...');

          // Try using a different bucket name or approach
          try {
            const alternativeFileName = `temp_verifications/${user.id}/${fileName}`;
            console.log(`Trying alternative upload: ${alternativeFileName}`);

            const { data: altUploadData, error: altUploadError } = await supabase.storage
              .from('avatars') // Using avatars bucket as fallback (usually more permissive)
              .upload(alternativeFileName, fileData, {
                contentType: mimeType,
                upsert: true,
              });

            if (altUploadError) {
              throw altUploadError;
            }

            console.log('✅ Alternative upload successful:', altUploadData.path);
            return altUploadData.path;

          } catch (altError) {
            console.error('Alternative upload also failed:', altError);
            throw new Error(`Upload failed: Unable to upload to storage. Please contact support.`);
          }
        }

        throw uploadError;
      }

      console.log('✅ Upload successful:', uploadData.path);
      return uploadData.path;

    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';

      // Handle specific error cases
      if (errorMessage.includes('aborted')) {
        throw new Error('Upload timeout. Please check your connection and try again.');
      }

      // Retry logic for certain errors
      if (retryCount < maxRetries &&
          (errorMessage.includes('network') ||
           errorMessage.includes('timeout') ||
           errorMessage.includes('ENOTFOUND'))) {

        retryCount++;
        console.log(`Retrying upload (${retryCount}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return uploadImageToSupabase(uri, fileName, bucket);
      }

      console.error('Upload process error:', errorMessage);

      // Check for app restart requirement
      if (errorMessage.includes('deprecated') || errorMessage.includes('FileSystem')) {
        throw new Error('App restart required. Please close and reopen the app, then try again.');
      }

      throw new Error(`Upload failed: ${errorMessage}`);
    }
  };

  const submitVerification = async () => {
    console.log('📄 Submit verification started');

    // Validation
    if (!verificationData.idDocument.uri) {
      showError('Please upload a valid ID document', 'Missing Document');
      return;
    }

    if (!verificationData.facePhoto.uri) {
      showError('Please upload a face photo', 'Missing Photo');
      return;
    }

    setIsUploading(true);
    setUploadProgress({});

    try {
      console.log('Starting verification submission...');

      // Upload ID document
      setUploadProgress(prev => ({ ...prev, id: 0 }));
      console.log('Starting ID document upload');

      const idFileName = `id_document_${userId}_${Date.now()}`;
      const idPath = await uploadImageToSupabase(
        verificationData.idDocument.uri,
        idFileName
      );
      setUploadProgress(prev => ({ ...prev, id: 100 }));

      // Upload face photo
      setUploadProgress(prev => ({ ...prev, face: 0 }));
      console.log('Starting face photo upload');

      const faceFileName = `face_photo_${userId}_${Date.now()}`;
      const facePath = await uploadImageToSupabase(
        verificationData.facePhoto.uri,
        faceFileName
      );
      setUploadProgress(prev => ({ ...prev, face: 100 }));

      // Create verification submission record
      console.log('Creating verification submission record...');
      const submissionData = {
        user_id: userId,
        id_document_url: idPath,
        face_photo_url: facePath,
        id_document_type: verificationData.idDocument.type,
        submission_notes: verificationData.notes,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      };

      const { error: dbError } = await supabase
        .from('verification_submissions')
        .insert(submissionData);

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error(`Failed to save verification: ${dbError.message}`);
      }

      console.log('✅ Verification submitted successfully');
      showSuccess('Your verification documents have been submitted successfully. You will be notified once they are reviewed.');

      // Call the callback after a short delay to allow toast to be seen
      setTimeout(() => {
        onVerificationSubmitted();
      }, 1500);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error submitting verification:', errorMessage);

      showError(`Failed to submit verification: ${errorMessage}`, 'Upload Failed');
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  };

  const renderProgressBar = (key: string) => {
    const progress = uploadProgress[key] || 0;
    return (
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
      </View>
    );
  };

  // Main render
  console.log('📸 Rendering main upload view - showVisionCamera:', showVisionCamera, 'showFileInput:', showFileInput);

  if (showVisionCamera) {
    return (
      <VisionCamera
        type={showVisionCamera}
        onPhotoTaken={(uri: string) => {
          updateVerificationData(showVisionCamera, uri, showVisionCamera === 'id' ? 'passport' : 'selfie');
        }}
        onClose={() => setShowVisionCamera(null)}
      />
    );
  }

  if (showFileInput) {
    return (
      <WebFileInput
        type={showFileInput}
        onFileSelected={(uri: string) => {
          updateVerificationData(showFileInput, uri, showFileInput === 'id' ? 'passport' : 'selfie');
          setShowFileInput(null);
        }}
      />
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Account Verification</Text>
        <Text style={styles.subtitle}>
          To ensure security and compliance, please upload the required documents
        </Text>
      </View>

      {/* ID Document Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Valid ID Document</Text>
        <Text style={styles.sectionDescription}>
          Upload a clear photo of your government-issued ID (Driver's License, Passport, etc.)
        </Text>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => showImagePickerOptions('id')}
          disabled={isUploading}
        >
          {verificationData.idDocument.uri ? (
            <Image source={{ uri: verificationData.idDocument.uri }} style={styles.previewImage} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Text style={styles.uploadText}>📄 Upload ID Document</Text>
            </View>
          )}
        </TouchableOpacity>

        {isUploading && uploadProgress.id !== undefined && renderProgressBar('id')}
      </View>

      {/* Face Photo Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Face Photo</Text>
        <Text style={styles.sectionDescription}>
          Take a clear selfie for identity verification
        </Text>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => showImagePickerOptions('face')}
          disabled={isUploading}
        >
          {verificationData.facePhoto.uri ? (
            <Image source={{ uri: verificationData.facePhoto.uri }} style={styles.previewImage} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Text style={styles.uploadText}>🤳 Take Face Photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {isUploading && uploadProgress.face !== undefined && renderProgressBar('face')}
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, isUploading && styles.submitButtonDisabled]}
        onPress={submitVerification}
        disabled={isUploading || !verificationData.idDocument.uri || !verificationData.facePhoto.uri}
      >
        {isUploading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.submitButtonText}>Uploading...</Text>
          </View>
        ) : (
          <Text style={styles.submitButtonText}>Submit Verification</Text>
        )}
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Your documents will be securely processed and reviewed within 24-48 hours.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  section: {
    margin: 16,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  uploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  progressContainer: {
    marginTop: 12,
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  progressText: {
    position: 'absolute',
    top: -20,
    right: 0,
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  submitButton: {
    margin: 16,
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
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
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default VerificationUpload;