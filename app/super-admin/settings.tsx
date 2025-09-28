import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import HeaderComponent from '../../components/HeaderComponent';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function SuperAdminSettings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    registrationEnabled: true,
    emailNotifications: true,
    autoBackup: true,
    debugMode: false,
    maxFileUploadSize: '10',
    sessionTimeout: '30',
    passwordMinLength: '8',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const userData = await getUserWithProfile();
      if (userData?.profile) {
        setProfile(userData.profile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveSettings = () => {
    // TODO: Implement save settings functionality
    console.log('Saving settings:', settings);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <HeaderComponent profile={profile} />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>Loading system settings...</Text>
        </View>
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
            tintColor="#059669"
            colors={['#059669']}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>System Settings</Text>
          <Text style={styles.subtitle}>Configure platform-wide settings</Text>
        </View>

        {/* General Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General Settings</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Maintenance Mode</Text>
              <Text style={styles.settingDescription}>
                Disable public access for system maintenance
              </Text>
            </View>
            <Switch
              value={settings.maintenanceMode}
              onValueChange={(value) => handleSettingChange('maintenanceMode', value)}
              trackColor={{ false: '#d1d5db', true: '#10b981' }}
              thumbColor={settings.maintenanceMode ? '#059669' : '#f3f4f6'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>User Registration</Text>
              <Text style={styles.settingDescription}>
                Allow new users to register accounts
              </Text>
            </View>
            <Switch
              value={settings.registrationEnabled}
              onValueChange={(value) => handleSettingChange('registrationEnabled', value)}
              trackColor={{ false: '#d1d5db', true: '#10b981' }}
              thumbColor={settings.registrationEnabled ? '#059669' : '#f3f4f6'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Email Notifications</Text>
              <Text style={styles.settingDescription}>
                Send system notifications via email
              </Text>
            </View>
            <Switch
              value={settings.emailNotifications}
              onValueChange={(value) => handleSettingChange('emailNotifications', value)}
              trackColor={{ false: '#d1d5db', true: '#10b981' }}
              thumbColor={settings.emailNotifications ? '#059669' : '#f3f4f6'}
            />
          </View>
        </View>

        {/* System Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Configuration</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto Backup</Text>
              <Text style={styles.settingDescription}>
                Automatically backup system data daily
              </Text>
            </View>
            <Switch
              value={settings.autoBackup}
              onValueChange={(value) => handleSettingChange('autoBackup', value)}
              trackColor={{ false: '#d1d5db', true: '#10b981' }}
              thumbColor={settings.autoBackup ? '#059669' : '#f3f4f6'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Debug Mode</Text>
              <Text style={styles.settingDescription}>
                Enable detailed logging for troubleshooting
              </Text>
            </View>
            <Switch
              value={settings.debugMode}
              onValueChange={(value) => handleSettingChange('debugMode', value)}
              trackColor={{ false: '#d1d5db', true: '#10b981' }}
              thumbColor={settings.debugMode ? '#059669' : '#f3f4f6'}
            />
          </View>
        </View>

        {/* Security Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security Settings</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Max File Upload Size (MB)</Text>
            <TextInput
              style={styles.input}
              value={settings.maxFileUploadSize}
              onChangeText={(value) => handleSettingChange('maxFileUploadSize', value)}
              keyboardType="numeric"
              placeholder="10"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Session Timeout (minutes)</Text>
            <TextInput
              style={styles.input}
              value={settings.sessionTimeout}
              onChangeText={(value) => handleSettingChange('sessionTimeout', value)}
              keyboardType="numeric"
              placeholder="30"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Minimum Password Length</Text>
            <TextInput
              style={styles.input}
              value={settings.passwordMinLength}
              onChangeText={(value) => handleSettingChange('passwordMinLength', value)}
              keyboardType="numeric"
              placeholder="8"
            />
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSaveSettings}>
            <Text style={styles.saveButtonText}>Save Settings</Text>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  section: {
    backgroundColor: '#ffffff',
    marginTop: 12,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  inputGroup: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  actions: {
    padding: 20,
  },
  saveButton: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 40,
  },
});