import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import { useNotifications } from '../hooks/useNotifications';
import { createNotification } from '../services/notifications';

interface Props {
  userId: string | null;
}

export default function RealtimeNotificationTest({ userId }: Props) {
  const [testResults, setTestResults] = useState<string[]>([]);
  const {
    notifications,
    unreadCount,
    connectionStatus,
    forceReconnect
  } = useNotifications(userId);

  const addTestResult = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 9)]);
  };

  const testDatabaseNotification = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID is required for testing');
      return;
    }

    try {
      addTestResult('🧪 Creating test notification...');

      await createNotification({
        recipientId: userId,
        type: 'system_message',
        title: '🧪 Real-time Test',
        message: `Test notification created at ${new Date().toLocaleTimeString()}`,
        actionData: {
          test: true,
          timestamp: Date.now()
        }
      });

      addTestResult('✅ Test notification created successfully');
      addTestResult('⏰ Waiting for real-time delivery...');

    } catch (error) {
      addTestResult(`❌ Failed to create test notification: ${error}`);
    }
  };

  const testBroadcastNotification = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID is required for testing');
      return;
    }

    try {
      addTestResult('📡 Testing broadcast notification...');

      const { broadcastNotification } = await import('../services/notifications');

      const testNotification = {
        id: `test-${Date.now()}`,
        recipient_id: userId,
        type: 'system_message',
        title: '📡 Broadcast Test',
        message: `Broadcast test at ${new Date().toLocaleTimeString()}`,
        created_at: new Date().toISOString(),
        is_read: false,
        sender_id: userId,
        action_url: null,
        action_data: { broadcast_test: true }
      };

      await broadcastNotification(userId, testNotification);
      addTestResult('✅ Broadcast test sent');

    } catch (error) {
      addTestResult(`❌ Broadcast test failed: ${error}`);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'SUBSCRIBED':
      case 'OPEN':
        return '#10b981'; // Green
      case 'CONNECTING':
        return '#f59e0b'; // Yellow
      case 'CLOSED':
      case 'CHANNEL_ERROR':
        return '#dc2626'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔔 Real-time Notification Test</Text>

      {/* Connection Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Connection Status:</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Supabase:</Text>
          <Text style={[styles.statusValue, { color: getStatusColor(connectionStatus.supabase) }]}>
            {connectionStatus.supabase}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>WebSocket:</Text>
          <Text style={[styles.statusValue, { color: getStatusColor(connectionStatus.websocket) }]}>
            {connectionStatus.websocket}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Polling:</Text>
          <Text style={[styles.statusValue, { color: connectionStatus.polling ? '#10b981' : '#dc2626' }]}>
            {connectionStatus.polling ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{notifications.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{unreadCount}</Text>
          <Text style={styles.statLabel}>Unread</Text>
        </View>
      </View>

      {/* Test Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.testButton}
          onPress={testDatabaseNotification}
        >
          <Text style={styles.buttonText}>🧪 Test Database</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.testButton}
          onPress={testBroadcastNotification}
        >
          <Text style={styles.buttonText}>📡 Test Broadcast</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, styles.reconnectButton]}
          onPress={forceReconnect}
        >
          <Text style={styles.buttonText}>🔄 Reconnect</Text>
        </TouchableOpacity>
      </View>

      {/* Test Results */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Test Results:</Text>
        <ScrollView style={styles.resultsScroll}>
          {testResults.map((result, index) => (
            <Text key={index} style={styles.resultItem}>
              {result}
            </Text>
          ))}
          {testResults.length === 0 && (
            <Text style={styles.noResults}>No test results yet</Text>
          )}
        </ScrollView>
      </View>

      {/* Recent Notifications */}
      <View style={styles.notificationsContainer}>
        <Text style={styles.notificationsTitle}>Recent Notifications:</Text>
        <ScrollView style={styles.notificationsScroll}>
          {notifications.slice(0, 3).map((notification) => (
            <View key={notification.id} style={styles.notificationItem}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              <Text style={styles.notificationMessage}>{notification.message}</Text>
              <Text style={styles.notificationTime}>
                {new Date(notification.created_at).toLocaleTimeString()}
              </Text>
            </View>
          ))}
          {notifications.length === 0 && (
            <Text style={styles.noNotifications}>No notifications yet</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1f2937',
  },
  statusContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#374151',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10b981',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  testButton: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  reconnectButton: {
    backgroundColor: '#f59e0b',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
  },
  resultsContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    flex: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#374151',
  },
  resultsScroll: {
    flex: 1,
  },
  resultItem: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  noResults: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 20,
  },
  notificationsContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    flex: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  notificationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#374151',
  },
  notificationsScroll: {
    flex: 1,
  },
  notificationItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 8,
    marginBottom: 8,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  notificationMessage: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  notificationTime: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4,
  },
  noNotifications: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 20,
  },
});