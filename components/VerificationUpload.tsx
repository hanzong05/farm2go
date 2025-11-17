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
import Icon from 'react-native-vector-icons/FontAwesome5';
import { router } from 'expo-router';
import { decode } from 'base64-arraybuffer';
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
    try {
      console.log('📤 Starting upload for:', fileName);
      console.log('Platform:', Platform.OS);
      console.log('URI:', uri.substring(0, 50) + '...');

      // Get session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Session expired. Please log in again.');
      }

      const contentType = 'image/jpeg';
      let arrayBuffer: ArrayBuffer;

      // Handle file reading differently for web vs mobile
      if (Platform.OS === 'web') {
        console.log('📖 Reading file for web...');
        const response = await fetch(uri);
        const blob = await response.blob();
        arrayBuffer = await blob.arrayBuffer();
        console.log('✅ Web file size:', (arrayBuffer.byteLength / (1024 * 1024)).toFixed(2) + 'MB');
      } else {
        console.log('📖 Reading file for mobile...');
        // On mobile, use FileSystem
        const fileInfo = await LegacyFileSystem.getInfoAsync(uri);
        if (fileInfo.exists && 'size' in fileInfo) {
          console.log('📁 Mobile file size:', (fileInfo.size / (1024 * 1024)).toFixed(2) + 'MB');
        }

        const base64 = await LegacyFileSystem.readAsStringAsync(uri, {
          encoding: LegacyFileSystem.EncodingType.Base64,
        });
        arrayBuffer = decode(base64);
      }

      console.log('✅ ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');
      console.log('📤 Uploading to Supabase Storage...');

      // Upload using fetch API with ArrayBuffer - direct upload method
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${fileName}`;

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

      console.log('📡 Upload response:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload failed:', errorText);
        throw new Error(`Upload failed: ${response.status}`);
      }

      console.log('✅ Verification document uploaded successfully');

      return fileName;
    } catch (error: any) {
      console.error('Upload error:', error);
      throw new Error(error.message || 'Failed to upload image');
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

      const idFileName = `id_document_${userId}_${Date.now()}.jpg`;
      const idPath = await uploadImageToSupabase(
        verificationData.idDocument.uri,
        idFileName
      );
      setUploadProgress(prev => ({ ...prev, id: 100 }));

      // Upload face photo
      setUploadProgress(prev => ({ ...prev, face: 0 }));
      console.log('Starting face photo upload');

      const faceFileName = `face_photo_${userId}_${Date.now()}.jpg`;
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
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Icon name="arrow-left" size={20} color="#10b981" />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
  },
  header: {
    padding: 24,
    paddingTop: 12,
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