import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { getUserWithProfile, logoutUser } from '../services/auth';
import { Database } from '../types/database';
import HeaderComponent from './HeaderComponent';

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
    { key: 'farm_name', label: 'Farm Name', placeholder: 'Enter farm name' },
    { key: 'barangay', label: 'Farm Location', placeholder: 'Enter farm location' },
    { key: 'farm_size', label: 'Farm Size', placeholder: 'e.g., 5 hectares' },
    { key: 'crop_types', label: 'Crop Types', placeholder: 'e.g., Rice, Corn' },
  ],
  buyer: [
    { key: 'first_name', label: 'First Name', placeholder: 'Enter first name' },
    { key: 'last_name', label: 'Last Name', placeholder: 'Enter last name' },
    { key: 'phone', label: 'Phone Number', placeholder: 'Enter phone number', keyboardType: 'phone-pad' },
    { key: 'company_name', label: 'Company Name', placeholder: 'Enter company name' },
    { key: 'business_type', label: 'Business Type', placeholder: 'e.g., Restaurant, Retailer' },
    { key: 'business_location', label: 'Business Location', placeholder: 'Enter business location' },
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

  const fieldConfigs = FIELD_CONFIGS[userType] || FIELD_CONFIGS.farmer;
  const sectionTitle = SECTION_TITLES[userType] || 'Profile';

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const userData = await getUserWithProfile();
      if (userData?.profile) {
        setProfile(userData.profile);

        // Initialize form data with profile values
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
    Alert.alert(
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
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. Are you sure you want to delete your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Feature Coming Soon', 'Account deletion will be available in a future update.');
          },
        },
      ]
    );
  };

  const renderFormField = (field: FieldConfig, index: number) => {
    const isLastInRow = index % 2 === 1;
    const isInRow = field.key === 'first_name' || field.key === 'last_name' ||
                   field.key === 'farm_size' || field.key === 'crop_types';

    if (field.key === 'first_name') {
      // Render first and last name in a row
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
              keyboardType={field.keyboardType}
              multiline={field.multiline}
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
              keyboardType={lastNameField.keyboardType}
              multiline={lastNameField.multiline}
            />
          </View>
        </View>
      );
    }

    if (field.key === 'last_name') {
      return null; // Already rendered in first_name row
    }

    // For farmer: render farm_size and crop_types in a row
    if (userType === 'farmer' && field.key === 'farm_size') {
      const cropTypesField = fieldConfigs.find(f => f.key === 'crop_types');
      if (!cropTypesField) return null;

      return (
        <View key="farm-row" style={styles.row}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData[field.key] || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, [field.key]: text }))}
              editable={isEditing}
              placeholder={field.placeholder}
              keyboardType={field.keyboardType}
              multiline={field.multiline}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{cropTypesField.label}</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData[cropTypesField.key] || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, [cropTypesField.key]: text }))}
              editable={isEditing}
              placeholder={cropTypesField.placeholder}
              keyboardType={cropTypesField.keyboardType}
              multiline={cropTypesField.multiline}
            />
          </View>
        </View>
      );
    }

    if (userType === 'farmer' && field.key === 'crop_types') {
      return null; // Already rendered in farm_size row
    }

    // Render single field
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
      {/* Profile Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsEditing(!isEditing)}
          >
            <Text style={styles.editButtonText}>
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
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Text style={styles.preferenceTitle}>Push Notifications</Text>
            <Text style={styles.preferenceDescription}>
              Receive notifications about new {userType === 'farmer' ? 'orders' : userType === 'buyer' ? 'products' : 'system'} and updates
            </Text>
          </View>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: '#e5e5e5', true: '#16a34a' }}
            thumbColor={notifications ? '#ffffff' : '#f4f3f4'}
          />
        </View>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Text style={styles.preferenceTitle}>Marketing Emails</Text>
            <Text style={styles.preferenceDescription}>
              Receive tips and updates about {userType === 'farmer' ? 'farming and selling' : userType === 'buyer' ? 'sourcing and buying' : 'platform management'}
            </Text>
          </View>
          <Switch
            value={marketingEmails}
            onValueChange={setMarketingEmails}
            trackColor={{ false: '#e5e5e5', true: '#16a34a' }}
            thumbColor={marketingEmails ? '#ffffff' : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Account Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/auth/forgot-password')}>
          <Text style={styles.actionText}>Change Password</Text>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={handleLogout}>
          <Text style={[styles.actionText, styles.logoutText]}>Logout</Text>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={handleDeleteAccount}>
          <Text style={[styles.actionText, styles.deleteText]}>Delete Account</Text>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomSpacing} />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },

  // Sections
  section: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  editButtonText: {
    color: '#16a34a',
    fontWeight: '600',
    fontSize: 14,
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
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  inputDisabled: {
    backgroundColor: '#f9fafb',
    color: '#6b7280',
  },
  saveButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Preferences
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 16,
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

  // Actions
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  actionText: {
    fontSize: 16,
    color: '#111827',
  },
  logoutText: {
    color: '#f59e0b',
  },
  deleteText: {
    color: '#dc2626',
  },
  actionArrow: {
    fontSize: 16,
    color: '#9ca3af',
  },
  bottomSpacing: {
    height: 40,
  },
});