import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
  RefreshControl,
  Image,
  Alert,
  Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { getUserWithProfile, logoutUser } from '../services/auth';
import { Database } from '../types/database';
import HeaderComponent from './HeaderComponent';
import { useCustomAlert } from './CustomAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface FieldConfig {
  key: string;
  label: string;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  multiline?: boolean;
}

interface SettingsProps {
  userType: 'farmer' | 'buyer' | 'admin';
  currentRoute: string;
  onNavigateBack?: () => void;
}

const FIELD_CONFIGS: Record<string, FieldConfig[]> = {
  farmer: [
    { key: 'first_name', label: 'First Name', placeholder: 'Enter first name' },
    { key: 'last_name', label: 'Last Name', placeholder: 'Enter last name' },
    { key: 'phone', label: 'Phone Number', placeholder: 'Enter phone number', keyboardType: 'phone-pad' },
    { key: 'barangay', label: 'Barangay', placeholder: 'Enter barangay' },
    { key: 'farm_name', label: 'Farm Name', placeholder: 'Enter farm name' },
    { key: 'farm_size', label: 'Farm Size', placeholder: 'e.g., 5 hectares' },
  ],
  buyer: [
    { key: 'first_name', label: 'First Name', placeholder: 'Enter first name' },
    { key: 'last_name', label: 'Last Name', placeholder: 'Enter last name' },
    { key: 'phone', label: 'Phone Number', placeholder: 'Enter phone number', keyboardType: 'phone-pad' },
    { key: 'barangay', label: 'Barangay', placeholder: 'Enter barangay' },
  ],
  admin: [
    { key: 'first_name', label: 'First Name', placeholder: 'Enter first name' },
    { key: 'last_name', label: 'Last Name', placeholder: 'Enter last name' },
    { key: 'phone', label: 'Phone Number', placeholder: 'Enter phone number', keyboardType: 'phone-pad' },
  ],
};

const SECTION_TITLES: Record<string, string> = {
  farmer: 'Farm Profile',
  buyer: 'Business Profile',
  admin: 'Admin Profile',
};

export default function Settings({ userType, currentRoute, onNavigateBack }: SettingsProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  const { showAlert, AlertComponent } = useCustomAlert();

  const fieldConfigs = FIELD_CONFIGS[userType] || FIELD_CONFIGS.farmer;
  const sectionTitle = SECTION_TITLES[userType] || 'Profile';

  useEffect(() => {
    loadProfile();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadProfile = async () => {
    try {
      const userData = await getUserWithProfile();
      if (userData?.profile) {
        setProfile(userData.profile);
        setAvatarUrl(userData.profile.avatar_url || null);

        const initialFormData: Record<string, string> = {};
        fieldConfigs.forEach(field => {
          initialFormData[field.key] = (userData.profile as any)[field.key] || '';
        });
        setFormData(initialFormData);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProfilePicture = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      await uploadProfilePicture(result.assets[0].uri);
    } catch (error: any) {
      console.error('Error selecting profile picture:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const uploadProfilePicture = async (uri: string) => {
    if (!profile) return;

    setUploadingImage(true);
    try {
      console.log('📤 Uploading avatar...');

      // Get file extension
      const uriWithoutParams = uri.split('?')[0].split('#')[0];
      const parts = uriWithoutParams.split('.');
      const fileExt = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'jpg';
      const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      const finalExt = validExtensions.includes(fileExt) ? fileExt : 'jpg';

      const fileName = `${profile.id}_${Date.now()}.${finalExt}`;
      const filePath = `${fileName}`;

      const mimeTypes: { [key: string]: string } = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
      };
      const contentType = mimeTypes[finalExt] || 'image/jpeg';

      // Get session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'You must be logged in to upload photos');
        return;
      }

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('📁 Avatar file size:', fileInfo.size ? (fileInfo.size / (1024 * 1024)).toFixed(2) + 'MB' : 'unknown');

      // Create FormData
      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        type: contentType,
        name: fileName
      } as any);

      console.log('📤 Uploading to Supabase Storage...');

      // Upload using fetch directly
      const uploadUrl = `https://lipviwhsjgvcmdggecqn.supabase.co/storage/v1/object/avatars/${filePath}`;

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: formData,
      });

      console.log('📡 Upload response:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('❌ Upload failed:', errorText);
        Alert.alert('Upload Error', `Failed to upload image (${uploadResponse.status})`);
        return;
      }

      console.log('✅ Avatar uploaded successfully');

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      console.log('🔗 Avatar URL:', publicUrl);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) {
        console.error('❌ Profile update error:', updateError);
        Alert.alert('Error', 'Failed to update profile: ' + updateError.message);
        return;
      }

      setAvatarUrl(publicUrl);
      Alert.alert('Success', 'Profile picture updated successfully');
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      Alert.alert('Error', error.message || 'Failed to upload profile picture');
    } finally {
      setUploadingImage(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const updateData = {
        ...formData,
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id);

      if (error) throw error;

      Alert.alert('Success', 'Profile updated successfully');
      setIsEditing(false);
      await loadProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    showAlert(
      'Confirm Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logoutUser();
              router.replace('/auth/login');
            } catch (error) {
              console.error('Logout error:', error);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    showAlert(
      'Delete Account',
      'This action cannot be undone. Are you sure you want to delete your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            showAlert('Feature Coming Soon', 'Account deletion will be available in a future update.', [
              { text: 'OK', style: 'default' }
            ]);
          },
        },
      ]
    );
  };

  const renderFormField = (field: FieldConfig, index: number) => {
    if (field.key === 'first_name') {
      const lastNameField = fieldConfigs.find(f => f.key === 'last_name');
      if (!lastNameField) return null;

      return (
        <View key="name-row" style={styles.row}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData[field.key] || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, [field.key]: text }))}
              editable={isEditing}
              placeholder={field.placeholder}
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{lastNameField.label}</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData[lastNameField.key] || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, [lastNameField.key]: text }))}
              editable={isEditing}
              placeholder={lastNameField.placeholder}
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>
      );
    }

    if (field.key === 'last_name') return null;

    if (field.key === 'farm_size') {
      const farmNameField = fieldConfigs.find(f => f.key === 'farm_name');
      if (!farmNameField) return null;

      return (
        <View key="farm-row" style={styles.row}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{farmNameField.label}</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData[farmNameField.key] || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, [farmNameField.key]: text }))}
              editable={isEditing}
              placeholder={farmNameField.placeholder}
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData[field.key] || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, [field.key]: text }))}
              editable={isEditing}
              placeholder={field.placeholder}
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>
      );
    }

    if (field.key === 'farm_name') return null;

    return (
      <View key={field.key} style={styles.inputContainer}>
        <Text style={styles.label}>{field.label}</Text>
        <TextInput
          style={[styles.input, !isEditing && styles.inputDisabled]}
          value={formData[field.key] || ''}
          onChangeText={(text) => setFormData(prev => ({ ...prev, [field.key]: text }))}
          editable={isEditing}
          placeholder={field.placeholder}
          keyboardType={field.keyboardType}
          multiline={field.multiline}
          placeholderTextColor="#9ca3af"
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        showSearch={false}
        showMessages={true}
        showNotifications={true}
      />
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#16a34a"
            colors={['#16a34a']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Profile Header with Gradient */}
          <View style={styles.profileHeader}>
            <View style={styles.gradientOverlay} />
            <View style={styles.profilePictureContainer}>
              <View style={styles.avatarContainer}>
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={styles.avatar}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarPlaceholderText}>
                      {profile?.first_name?.charAt(0) || '?'}
                      {profile?.last_name?.charAt(0) || ''}
                    </Text>
                  </View>
                )}
                {uploadingImage && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color="#ffffff" />
                  </View>
                )}
                <View style={styles.avatarBadge}>
                  <Ionicons name="checkmark" size={18} color="#ffffff" />
                </View>
              </View>
              <TouchableOpacity
                style={styles.changePhotoButton}
                onPress={handleSelectProfilePicture}
                disabled={uploadingImage}
                activeOpacity={0.7}
              >
                <View style={styles.changePhotoContent}>
                  <Ionicons name={avatarUrl ? "camera" : "add-circle"} size={16} color="#ffffff" />
                  <Text style={styles.changePhotoText}>
                    {avatarUrl ? 'Change Photo' : 'Add Photo'}
                  </Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.profileName}>
                {profile?.first_name} {profile?.last_name}
              </Text>
              <Text style={styles.profileType}>
                {userType.charAt(0).toUpperCase() + userType.slice(1)} Account
              </Text>
            </View>
          </View>

          {/* Profile Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <View style={styles.sectionIconContainer}>
                  <Ionicons name="document-text-outline" size={22} color="#16a34a" />
                </View>
                <Text style={styles.sectionTitle}>{sectionTitle}</Text>
              </View>
              <TouchableOpacity
                style={[styles.editButton, isEditing && styles.editButtonActive]}
                onPress={() => setIsEditing(!isEditing)}
                activeOpacity={0.7}
              >
                <Ionicons name={isEditing ? "close" : "create-outline"} size={16} color={isEditing ? '#ef4444' : '#16a34a'} />
                <Text style={[styles.editButtonText, isEditing && styles.editButtonTextActive]}>
                  {isEditing ? 'Cancel' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              {fieldConfigs.map((field, index) => renderFormField(field, index))}

              {isEditing && (
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <View style={styles.saveButtonContent}>
                      <Ionicons name="save-outline" size={18} color="#ffffff" />
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Account Actions */}
          <View style={styles.section}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.sectionIconContainer}>
                <Ionicons name="person-outline" size={22} color="#16a34a" />
              </View>
              <Text style={styles.sectionTitle}>Account</Text>
            </View>

            {userType !== 'admin' && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => router.push('/auth/forgot-password')}
                activeOpacity={0.6}
              >
                <View style={styles.actionLeft}>
                  <View style={styles.actionIconContainer}>
                    <Ionicons name="key-outline" size={20} color="#16a34a" />
                  </View>
                  <Text style={styles.actionText}>Change Password</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleLogout}
              activeOpacity={0.6}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconContainer, styles.logoutIconBg]}>
                  <Ionicons name="log-out-outline" size={20} color="#f59e0b" />
                </View>
                <Text style={[styles.actionText, styles.logoutText]}>Logout</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionItem, styles.lastActionItem]}
              onPress={handleDeleteAccount}
              activeOpacity={0.6}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconContainer, styles.deleteIconBg]}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </View>
                <Text style={[styles.actionText, styles.deleteText]}>Delete Account</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSpacing} />
        </Animated.View>
      </ScrollView>

      {AlertComponent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },

  // Profile Header
  profileHeader: {
    backgroundColor: '#ffffff',
    marginBottom: 16,
    paddingBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: '#16a34a',
    opacity: 0.05,
  },
  profilePictureContainer: {
    alignItems: 'center',
    paddingTop: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarPlaceholderText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#16a34a',
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#16a34a',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  changePhotoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  changePhotoText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
  },
  profileType: {
    fontSize: 14,
    color: '#16a34a',
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Sections
  section: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#16a34a',
  },
  editButtonActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  editButtonText: {
    color: '#16a34a',
    fontWeight: '600',
    fontSize: 14,
  },
  editButtonTextActive: {
    color: '#ef4444',
  },

  // Form
  formContainer: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#111827',
  },
  inputDisabled: {
    backgroundColor: '#f9fafb',
    color: '#6b7280',
    borderColor: '#f3f4f6',
  },
  saveButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Preferences
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  preferenceIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  preferenceInfo: {
    flex: 1,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 14,
    color: '#6b7280',
  },

  // Account Actions
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  lastActionItem: {
    borderBottomWidth: 0,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoutIconBg: {
    backgroundColor: '#fef3c7',
  },
  deleteIconBg: {
    backgroundColor: '#fee2e2',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  logoutText: {
    color: '#f59e0b',
  },
  deleteText: {
    color: '#ef4444',
  },

  bottomSpacing: {
    height: 40,
  },
});