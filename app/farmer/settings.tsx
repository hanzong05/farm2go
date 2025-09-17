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
import { supabase } from '../../lib/supabase';
import { getUserWithProfile, logoutUser } from '../../services/auth';
import { Database } from '../../types/database';
import NavBar from '../../components/NavBar';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function FarmerSettingsScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    farm_name: '',
    farm_location: '',
    farm_size: '',
    crop_types: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const userData = await getUserWithProfile();
      if (userData?.profile) {
        setProfile(userData.profile);
        setFormData({
          first_name: userData.profile.first_name || '',
          last_name: userData.profile.last_name || '',
          phone: userData.profile.phone || '',
          farm_name: userData.profile.farm_name || '',
          farm_location: userData.profile.farm_location || '',
          farm_size: userData.profile.farm_size || '',
          crop_types: userData.profile.crop_types || '',
        });
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
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          farm_name: formData.farm_name,
          farm_location: formData.farm_location,
          farm_size: formData.farm_size,
          crop_types: formData.crop_types,
          updated_at: new Date().toISOString(),
        })
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
      <NavBar currentRoute="/farmer/settings" />

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
            <Text style={styles.sectionTitle}>Farm Profile</Text>
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
            <View style={styles.row}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={[styles.input, !isEditing && styles.inputDisabled]}
                  value={formData.first_name}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, first_name: text }))}
                  editable={isEditing}
                  placeholder="Enter first name"
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={[styles.input, !isEditing && styles.inputDisabled]}
                  value={formData.last_name}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, last_name: text }))}
                  editable={isEditing}
                  placeholder="Enter last name"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={[styles.input, !isEditing && styles.inputDisabled]}
                value={formData.phone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                editable={isEditing}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Farm Name</Text>
              <TextInput
                style={[styles.input, !isEditing && styles.inputDisabled]}
                value={formData.farm_name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, farm_name: text }))}
                editable={isEditing}
                placeholder="Enter farm name"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Farm Location</Text>
              <TextInput
                style={[styles.input, !isEditing && styles.inputDisabled]}
                value={formData.farm_location}
                onChangeText={(text) => setFormData(prev => ({ ...prev, farm_location: text }))}
                editable={isEditing}
                placeholder="Enter farm location"
              />
            </View>

            <View style={styles.row}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Farm Size</Text>
                <TextInput
                  style={[styles.input, !isEditing && styles.inputDisabled]}
                  value={formData.farm_size}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, farm_size: text }))}
                  editable={isEditing}
                  placeholder="e.g., 5 hectares"
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Crop Types</Text>
                <TextInput
                  style={[styles.input, !isEditing && styles.inputDisabled]}
                  value={formData.crop_types}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, crop_types: text }))}
                  editable={isEditing}
                  placeholder="e.g., Rice, Corn"
                />
              </View>
            </View>

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
                Receive notifications about new orders and updates
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
                Receive tips and updates about farming and selling
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
            <Text style={styles.actionArrow}>’</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={handleLogout}>
            <Text style={[styles.actionText, styles.logoutText]}>Logout</Text>
            <Text style={styles.actionArrow}>’</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={handleDeleteAccount}>
            <Text style={[styles.actionText, styles.deleteText]}>Delete Account</Text>
            <Text style={styles.actionArrow}>’</Text>
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