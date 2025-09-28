import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { messageService } from '../services/messageService';
import { realtimeManager } from '../services/realtimeManager';
import RealtimeStatus from './RealtimeStatus';

const colors = {
  primary: '#059669',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  white: '#ffffff',
  gray100: '#f3f4f6',
  gray600: '#4b5563',
  gray800: '#1f2937',
};

export default function RealtimeTest() {
  const [messages, setMessages] = useState<any[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  const startRealtimeTest = () => {
    console.log('🧪 Starting real-time test...');

    const sub = messageService.subscribeToAllMessageChanges(
      (message, type) => {
        console.log(`🧪 Test received ${type}:`, message);
        setMessages(prev => [...prev, {
          ...message,
          type,
          timestamp: new Date().toISOString()
        }]);
      }
    );

    setSubscription(sub);
    setIsSubscribed(true);
  };

  const stopRealtimeTest = () => {
    if (subscription) {
      subscription.unsubscribe();
      setSubscription(null);
    }
    setIsSubscribed(false);
    console.log('🧪 Real-time test stopped');
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const sendTestMessage = async () => {
    try {
      console.log('🧪 Sending test message...');
      const result = await messageService.sendMessage({
        receiverId: 'test-receiver-id', // This will likely fail, but shows the flow
        content: `Test message at ${new Date().toLocaleTimeString()}`
      });
      console.log('🧪 Test message result:', result);
    } catch (error) {
      console.error('🧪 Test message error:', error);
    }
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [subscription]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Real-time Testing</Text>
        <RealtimeStatus showLabel={true} size="medium" />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, isSubscribed ? styles.buttonDanger : styles.buttonPrimary]}
          onPress={isSubscribed ? stopRealtimeTest : startRealtimeTest}
        >
          <Text style={styles.buttonText}>
            {isSubscribed ? 'Stop Listening' : 'Start Listening'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={sendTestMessage}
        >
          <Text style={styles.buttonText}>Send Test Message</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonWarning]}
          onPress={clearMessages}
        >
          <Text style={styles.buttonText}>Clear Log</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.status}>
        <Text style={styles.statusText}>
          Status: {isSubscribed ? 'Listening' : 'Not listening'}
        </Text>
        <Text style={styles.statusText}>
          Messages received: {messages.length}
        </Text>
        <Text style={styles.statusText}>
          Connection: {realtimeManager.getConnectionState()}
        </Text>
      </View>

      <ScrollView style={styles.messageLog}>
        <Text style={styles.logTitle}>Real-time Message Log:</Text>
        {messages.length === 0 ? (
          <Text style={styles.emptyText}>No messages received yet...</Text>
        ) : (
          messages.map((msg, index) => (
            <View key={index} style={styles.logEntry}>
              <Text style={styles.logType}>[{msg.type}]</Text>
              <Text style={styles.logContent}>
                {JSON.stringify(msg, null, 2)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.white,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.gray800,
  },

  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },

  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 100,
  },

  buttonPrimary: {
    backgroundColor: colors.primary,
  },

  buttonSecondary: {
    backgroundColor: colors.gray600,
  },

  buttonDanger: {
    backgroundColor: colors.danger,
  },

  buttonWarning: {
    backgroundColor: colors.warning,
  },

  buttonText: {
    color: colors.white,
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 14,
  },

  status: {
    backgroundColor: colors.gray100,
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },

  statusText: {
    fontSize: 14,
    color: colors.gray800,
    marginBottom: 4,
  },

  messageLog: {
    flex: 1,
    backgroundColor: colors.gray100,
    borderRadius: 6,
    padding: 12,
  },

  logTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray800,
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 14,
    color: colors.gray600,
    fontStyle: 'italic',
  },

  logEntry: {
    backgroundColor: colors.white,
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },

  logType: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },

  logContent: {
    fontSize: 11,
    color: colors.gray800,
    fontFamily: 'monospace',
  },
});