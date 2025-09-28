import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import HeaderComponent from '../../components/HeaderComponent';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface BackupInfo {
  id: string;
  name: string;
  size: string;
  date: string;
  type: 'manual' | 'automatic';
  status: 'completed' | 'in_progress' | 'failed';
}

export default function SuperAdminBackup() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  useEffect(() => {
    loadProfile();
    loadBackups();
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

  const loadBackups = async () => {
    // TODO: Implement actual backup data fetching
    setBackups([
      {
        id: '1',
        name: 'Daily Backup - 2024-01-15',
        size: '256 MB',
        date: '2024-01-15 02:00 AM',
        type: 'automatic',
        status: 'completed',
      },
      {
        id: '2',
        name: 'Manual Backup - 2024-01-14',
        size: '254 MB',
        date: '2024-01-14 11:30 AM',
        type: 'manual',
        status: 'completed',
      },
      {
        id: '3',
        name: 'Daily Backup - 2024-01-14',
        size: '252 MB',
        date: '2024-01-14 02:00 AM',
        type: 'automatic',
        status: 'completed',
      },
      {
        id: '4',
        name: 'Daily Backup - 2024-01-13',
        size: '248 MB',
        date: '2024-01-13 02:00 AM',
        type: 'automatic',
        status: 'failed',
      },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    await loadBackups();
    setRefreshing(false);
  };

  const createManualBackup = async () => {
    setIsCreatingBackup(true);
    // TODO: Implement actual backup creation
    setTimeout(() => {
      setIsCreatingBackup(false);
      Alert.alert('Success', 'Backup created successfully');
      loadBackups();
    }, 3000);
  };

  const downloadBackup = (backup: BackupInfo) => {
    // TODO: Implement backup download
    Alert.alert('Download', `Downloading ${backup.name}`);
  };

  const deleteBackup = (backup: BackupInfo) => {
    Alert.alert(
      'Delete Backup',
      `Are you sure you want to delete ${backup.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement backup deletion
            console.log('Deleting backup:', backup.id);
            loadBackups();
          },
        },
      ]
    );
  };

  const restoreBackup = (backup: BackupInfo) => {
    Alert.alert(
      'Restore Backup',
      `Are you sure you want to restore from ${backup.name}? This will overwrite current data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement backup restoration
            Alert.alert('Restore', 'Backup restoration started');
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#059669';
      case 'in_progress':
        return '#f59e0b';
      case 'failed':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <HeaderComponent profile={profile} />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>Loading backup system...</Text>
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
          <Text style={styles.title}>Backup & Restore</Text>
          <Text style={styles.subtitle}>Manage system backups and data recovery</Text>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton]}
              onPress={createManualBackup}
              disabled={isCreatingBackup}
            >
              {isCreatingBackup ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Manual Backup</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
              <Text style={styles.secondaryButtonText}>Configure Auto Backup</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Backup List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Backups</Text>
          {backups.map((backup) => (
            <View key={backup.id} style={styles.backupItem}>
              <View style={styles.backupInfo}>
                <View style={styles.backupHeader}>
                  <Text style={styles.backupName}>{backup.name}</Text>
                  <View style={styles.backupMeta}>
                    <Text
                      style={[
                        styles.backupStatus,
                        { color: getStatusColor(backup.status) }
                      ]}
                    >
                      {getStatusText(backup.status)}
                    </Text>
                    <Text style={styles.backupType}>
                      {backup.type === 'automatic' ? '🤖 Auto' : '👤 Manual'}
                    </Text>
                  </View>
                </View>
                <View style={styles.backupDetails}>
                  <Text style={styles.backupDate}>{backup.date}</Text>
                  <Text style={styles.backupSize}>{backup.size}</Text>
                </View>
              </View>

              {backup.status === 'completed' && (
                <View style={styles.backupActions}>
                  <TouchableOpacity
                    style={styles.actionIcon}
                    onPress={() => downloadBackup(backup)}
                  >
                    <Text style={styles.actionIconText}>⬇️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionIcon}
                    onPress={() => restoreBackup(backup)}
                  >
                    <Text style={styles.actionIconText}>🔄</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionIcon}
                    onPress={() => deleteBackup(backup)}
                  >
                    <Text style={styles.actionIconText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* System Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Storage Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Total Backup Size:</Text>
              <Text style={styles.infoValue}>1.2 GB</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Available Storage:</Text>
              <Text style={styles.infoValue}>8.8 GB</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Auto Backup:</Text>
              <Text style={styles.infoValue}>Today, 2:00 AM</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Next Auto Backup:</Text>
              <Text style={styles.infoValue}>Tomorrow, 2:00 AM</Text>
            </View>
          </View>
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
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#059669',
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  backupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backupInfo: {
    flex: 1,
  },
  backupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  backupName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  backupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backupStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  backupType: {
    fontSize: 12,
    color: '#6b7280',
  },
  backupDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  backupDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  backupSize: {
    fontSize: 14,
    color: '#6b7280',
  },
  backupActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconText: {
    fontSize: 16,
  },
  infoCard: {
    marginHorizontal: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  bottomSpacing: {
    height: 40,
  },
});