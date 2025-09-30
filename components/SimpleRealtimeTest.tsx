import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';

export default function SimpleRealtimeTest() {
  const [messages, setMessages] = useState<any[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  const startListening = () => {
    console.log('🔥 Starting SIMPLE real-time test...');

    const channel = supabase.channel('simple_messages_test');

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages'
      },
      (payload) => {
        console.log('🚀 REAL-TIME MESSAGE EVENT:', payload);
        setMessages(prev => [
          {
            id: Date.now(),
            event: payload.eventType,
            data: payload.new || payload.old,
            timestamp: new Date().toLocaleTimeString()
          },
          ...prev.slice(0, 9)
        ]);
      }
    );

    const sub = channel.subscribe((status) => {
      console.log('📡 Subscription status:', status);
      setIsListening(status === 'SUBSCRIBED');
    });

    setSubscription(sub);
  };

  const stopListening = () => {
    if (subscription) {
      subscription.unsubscribe();
      setSubscription(null);
    }
    setIsListening(false);
    console.log('🛑 Stopped listening');
  };

  const sendTestMessage = async () => {
    try {
      console.log('📤 Sending test message...');

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        alert('You need to be logged in to send test messages');
        return;
      }

      // Get a test receiver (any other user)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .neq('id', user.user.id)
        .limit(1);

      const receiverId = profiles?.[0]?.id || user.user.id;

      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.user.id,
          receiver_id: receiverId,
          content: `Test message at ${new Date().toLocaleTimeString()}`,
          message_type: 'text'
        });

      if (error) {
        console.error('❌ Error sending test message:', error);
        alert('Error: ' + error.message);
      } else {
        console.log('✅ Test message sent');
      }
    } catch (error) {
      console.error('❌ Send message error:', error);
      alert('Error sending message');
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  useEffect(() => {
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [subscription]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔥 Simple Real-time Test</Text>

      <View style={styles.status}>
        <Text style={styles.statusText}>
          Status: {isListening ? '🟢 LISTENING' : '🔴 NOT LISTENING'}
        </Text>
        <Text style={styles.statusText}>
          Events: {messages.length}
        </Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, isListening ? styles.stopButton : styles.startButton]}
          onPress={isListening ? stopListening : startListening}
        >
          <Text style={styles.buttonText}>
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.sendButton]}
          onPress={sendTestMessage}
        >
          <Text style={styles.buttonText}>Send Test Message</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearMessages}
        >
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.messageLog}>
        <Text style={styles.logTitle}>Real-time Events:</Text>
        {messages.length === 0 ? (
          <Text style={styles.noMessages}>
            {isListening
              ? 'Listening for real-time events...'
              : 'Click "Start Listening" then "Send Test Message"'
            }
          </Text>
        ) : (
          messages.map((msg, index) => (
            <View key={index} style={styles.logEntry}>
              <Text style={styles.logEvent}>[{msg.event}] {msg.timestamp}</Text>
              <Text style={styles.logContent}>
                {JSON.stringify(msg.data, null, 2)}
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
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#1f2937',
  },
  status: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
  },
  statusText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    minWidth: 100,
  },
  startButton: {
    backgroundColor: '#10b981',
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  sendButton: {
    backgroundColor: '#3b82f6',
  },
  clearButton: {
    backgroundColor: '#6b7280',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 12,
  },
  messageLog: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    elevation: 2,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1f2937',
  },
  noMessages: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 20,
  },
  logEntry: {
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  logEvent: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 4,
  },
  logContent: {
    fontSize: 10,
    color: '#374151',
    fontFamily: 'monospace',
  },
});