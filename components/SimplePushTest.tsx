import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useSimplePush } from '../hooks/useSimplePush';

interface SimplePushTestProps {
  userId: string | null;
}

export default function SimplePushTest({ userId }: SimplePushTestProps) {
  const {
    pushToken,
    isInitialized,
    sendTestNotification,
    sendDirectNotification,
    clearToken,
  } = useSimplePush(userId);

  const [targetUserId, setTargetUserId] = useState('');
  const [notificationTitle, setNotificationTitle] = useState('Simple Push Test');
  const [notificationBody, setNotificationBody] = useState('This is a simple push notification!');
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: () => Promise<void>, actionName: string) => {
    setLoading(true);
    try {
      await action();
      Alert.alert('Success', `${actionName} completed successfully!`);
    } catch (error) {
      console.error(`${actionName} failed:`, error);
      Alert.alert('Error', `${actionName} failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Please log in to test push notifications</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="rocket" size={24} color="#10b981" />
        <Text style={styles.title}>Simple Push Notifications</Text>
      </View>

      {/* Status Section */}
      <View style={styles.statusSection}>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Platform:</Text>
          <Text style={styles.statusValue}>{Platform.OS}</Text>
        </View>

        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Initialized:</Text>
          <Icon
            name={isInitialized ? 'check-circle' : 'times-circle'}
            size={16}
            color={isInitialized ? '#10b981' : '#ef4444'}
          />
        </View>

        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Push Token:</Text>
          <Text style={styles.tokenText}>
            {pushToken ? '✅ Available' : '❌ Not available'}
          </Text>
        </View>
      </View>

      {/* Test Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Tests</Text>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => handleAction(sendTestNotification, 'Send test notifications')}
          disabled={!isInitialized || loading}
        >
          <Icon name="paper-plane" size={16} color="#ffffff" />
          <Text style={styles.buttonText}>Send Test (Local + Push)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={() => handleAction(clearToken, 'Clear push token')}
          disabled={loading}
        >
          <Icon name="trash" size={16} color="#ffffff" />
          <Text style={styles.buttonText}>Clear Token</Text>
        </TouchableOpacity>
      </View>

      {/* Direct Notification */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Send to User</Text>

        <TextInput
          style={styles.input}
          placeholder="Target User ID"
          value={targetUserId}
          onChangeText={setTargetUserId}
        />

        <TextInput
          style={styles.input}
          placeholder="Notification Title"
          value={notificationTitle}
          onChangeText={setNotificationTitle}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Notification Body"
          value={notificationBody}
          onChangeText={setNotificationBody}
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => handleAction(
            () => sendDirectNotification(targetUserId, notificationTitle, notificationBody),
            'Send direct notification'
          )}
          disabled={!targetUserId || !notificationTitle || !notificationBody || loading}
        >
          <Icon name="bullhorn" size={16} color="#10b981" />
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Send to User</Text>
        </TouchableOpacity>
      </View>

      {/* Token Display */}
      {pushToken && (
        <View style={styles.tokenSection}>
          <Text style={styles.tokenLabel}>Expo Push Token (first 50 chars):</Text>
          <Text style={styles.tokenDisplay}>
            {pushToken.substring(0, 50)}...
          </Text>
        </View>
      )}

      {/* Instructions */}
      <View style={styles.instructionsSection}>
        <Text style={styles.instructionsTitle}>💡 How it works:</Text>
        <Text style={styles.instructionsText}>
          1. Push token is automatically registered when you log in{'\n'}
          2. Notifications are sent via Expo Push API (no Firebase needed!){'\n'}
          3. Test with the buttons above{'\n'}
          4. Real notifications happen when order status changes
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginLeft: 8,
  },

  statusSection: {
    marginBottom: 20,
  },

  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },

  statusLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  statusValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  tokenText: {
    fontSize: 14,
    fontWeight: '600',
  },

  section: {
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },

  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: '#f9fafb',
  },

  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    marginBottom: 8,
  },

  primaryButton: {
    backgroundColor: '#10b981',
  },

  secondaryButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#10b981',
  },

  dangerButton: {
    backgroundColor: '#ef4444',
  },

  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },

  secondaryButtonText: {
    color: '#10b981',
  },

  tokenSection: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },

  tokenLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 4,
  },

  tokenDisplay: {
    fontSize: 12,
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  instructionsSection: {
    padding: 12,
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },

  instructionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#065f46',
    marginBottom: 8,
  },

  instructionsText: {
    fontSize: 12,
    color: '#047857',
    lineHeight: 18,
  },

  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    fontWeight: '500',
  },
});