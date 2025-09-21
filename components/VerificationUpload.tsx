import * as ImagePicker from 'expo-image-picker';
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
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';
import VisionCamera from './VisionCamera';
import WebFileInput from './WebFileInput';

const { width } = Dimensions.get('window');

type VerificationSubmission = Database['public']['Tables']['verification_submissions']['Insert'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

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

    // Use VisionCamera for all platforms
    console.log('Using VisionCamera for platform:', Platform.OS);
    setShowVisionCamera(type);
  };

  const takePhoto = async (type: 'id' | 'face') => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'id' ? [4, 3] : [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        updateVerificationData(type, result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickImage = async (type: 'id' | 'face') => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'id' ? [4, 3] : [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        updateVerificationData(type, result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
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

        // Add a small delay before setting showVisionCamera to null
        // to ensure the photo URI is properly processed
        setTimeout(() => {
          console.log('📸 Setting showVisionCamera to null to return to main view');
          setShowVisionCamera(null);
        }, 100);
      } else {
        console.warn('📸 No showVisionCamera state, cannot process photo');
      }
    } catch (error) {
      console.error('📸 Error handling vision camera photo:', error);
      Alert.alert('Error', 'Failed to process photo. Please try again.');
      setShowVisionCamera(null);
    }
  };

  const handleFileInput = (fileUri: string) => {
    if (showFileInput) {
      updateVerificationData(showFileInput, fileUri);
      setShowFileInput(null);
    }
  };

  const uploadImageToSupabase = async (uri: string, fileName: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();

    const fileExt = uri.split('.').pop();
    const filePath = `verification/${userId}/${fileName}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('verification-documents')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from('verification-documents')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const submitVerification = async () => {
    if (!verificationData.idDocument.uri || !verificationData.facePhoto.uri) {
      Alert.alert('Missing Photos', 'Please upload both ID document and face photo.');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress('Uploading ID document...');

      // Upload ID document
      const idDocumentUrl = await uploadImageToSupabase(
        verificationData.idDocument.uri,
        `id_document_${Date.now()}`
      );

      setUploadProgress('Uploading face photo...');

      // Upload face photo
      const facePhotoUrl = await uploadImageToSupabase(
        verificationData.facePhoto.uri,
        `face_photo_${Date.now()}`
      );

      setUploadProgress('Submitting verification...');

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

      // Update profile verification status
      const profileUpdate: ProfileUpdate = {
        verification_status: 'pending',
        verification_submitted_at: new Date().toISOString(),
      };

      const { error: profileError } = await (supabase
        .from('profiles') as any)
        .update(profileUpdate)
        .eq('id', userId);

      if (profileError) {
        throw profileError;
      }

      Alert.alert(
        'Verification Submitted',
        'Your verification documents have been submitted successfully. You will be notified once an admin reviews your submission.',
        [{
          text: 'OK',
          onPress: () => {
            // Add a small delay to ensure alert dismisses cleanly before navigation
            setTimeout(() => {
              onVerificationSubmitted();
            }, 200);
          }
        }]
      );
    } catch (error) {
      console.error('Error submitting verification:', error);
      Alert.alert('Error', 'Failed to submit verification. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const selectIdDocumentType = () => {
    Alert.alert(
      'Select ID Document Type',
      'Choose the type of ID document you want to upload',
      [
        ...ID_DOCUMENT_TYPES.map(type => ({
          text: type.label,
          onPress: () => setVerificationData(prev => ({
            ...prev,
            idDocument: { ...prev.idDocument, type: type.key },
          })),
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

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
});