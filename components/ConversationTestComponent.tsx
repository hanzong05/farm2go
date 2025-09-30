import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { messageService, Message } from '../services/messageService';

interface ConversationTestComponentProps {
  user1Id: string;
  user2Id: string;
  user1Name: string;
  user2Name: string;
}

/**
 * Test component to demonstrate conflict-free conversation model
 *
 * This component simulates two users in the same conversation to verify:
 * 1. Both users connect to the same conversation_id
 * 2. No message conflicts or duplicates
 * 3. Real-time updates work correctly for both users
 * 4. Messages appear instantly for both participants
 */
export default function ConversationTestComponent({
  user1Id,
  user2Id,
  user1Name,
  user2Name
}: ConversationTestComponentProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [user1Input, setUser1Input] = useState('');
  const [user2Input, setUser2Input] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeTest();
  }, [user1Id, user2Id]);

  const initializeTest = async () => {
    try {
      setIsLoading(true);

      // Get conversation ID (should be same for both users)
      const convId = await messageService.getOrCreateConversationId(user1Id, user2Id);
      if (!convId) {
        console.error('Failed to create conversation ID');
        return;
      }

      console.log('🔥 TEST: Conversation ID:', convId);
      setConversationId(convId);

      // Load existing messages
      const existingMessages = await messageService.getConversationMessages(user2Id);
      setMessages(existingMessages);

      // Set up real-time subscription for this conversation
      const subscription = messageService.subscribeToConversationChanges(
        convId,
        (newMessage: Message, type: 'INSERT' | 'UPDATE') => {
          console.log('🔥 TEST: Real-time message received:', type, {
            id: newMessage.id,
            conversation_id: newMessage.conversation_id,
            sender_id: newMessage.sender_id,
            receiver_id: newMessage.receiver_id,
            content: newMessage.content
          });

          if (type === 'INSERT') {
            setMessages(prev => {
              // Check for duplicates
              const exists = prev.find(m => m.id === newMessage.id);
              if (exists) {
                console.log('🔥 TEST: Duplicate message detected, ignoring');
                return prev;
              }
              console.log('🔥 TEST: Adding new message to UI');
              return [...prev, newMessage];
            });
          } else if (type === 'UPDATE') {
            setMessages(prev =>
              prev.map(m => m.id === newMessage.id ? newMessage : m)
            );
          }
        }
      );

      console.log('🔥 TEST: Conversation initialized with real-time subscription');

    } catch (error) {
      console.error('🔥 TEST: Error initializing:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessageAsUser1 = async () => {
    if (!user1Input.trim()) return;

    try {
      console.log('🔥 TEST: User1 sending message:', user1Input);

      const message = await messageService.sendMessage({
        receiverId: user2Id,
        content: user1Input.trim(),
      });

      if (message) {
        console.log('🔥 TEST: User1 message sent successfully:', message.id);
        setUser1Input('');
      } else {
        console.error('🔥 TEST: User1 message send failed');
      }
    } catch (error) {
      console.error('🔥 TEST: User1 send error:', error);
    }
  };

  const sendMessageAsUser2 = async () => {
    if (!user2Input.trim()) return;

    try {
      console.log('🔥 TEST: User2 sending message:', user2Input);

      const message = await messageService.sendMessage({
        receiverId: user1Id,
        content: user2Input.trim(),
      });

      if (message) {
        console.log('🔥 TEST: User2 message sent successfully:', message.id);
        setUser2Input('');
      } else {
        console.error('🔥 TEST: User2 message send failed');
      }
    } catch (error) {
      console.error('🔥 TEST: User2 send error:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Initializing conversation test...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Conversation Model Test</Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoText}>Conversation ID: {conversationId}</Text>
        <Text style={styles.infoText}>Participants: {user1Name} ↔ {user2Name}</Text>
        <Text style={styles.infoText}>Messages: {messages.length}</Text>
      </View>

      <View style={styles.instructionsCard}>
        <Text style={styles.cardTitle}>Test Instructions:</Text>
        <Text style={styles.instructionText}>1. Send messages from both users</Text>
        <Text style={styles.instructionText}>2. Verify messages appear for both users instantly</Text>
        <Text style={styles.instructionText}>3. Check console for subscription logs</Text>
        <Text style={styles.instructionText}>4. Confirm no duplicate messages</Text>
      </View>

      <View style={styles.messagesContainer}>
        <Text style={styles.sectionTitle}>Messages:</Text>
        <ScrollView style={styles.messagesList} contentContainerStyle={styles.messagesContent}>
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageItem,
                message.sender_id === user1Id ? styles.messageFromUser1 : styles.messageFromUser2
              ]}
            >
              <Text style={styles.messageSender}>
                {message.sender_id === user1Id ? user1Name : user2Name}:
              </Text>
              <Text style={styles.messageContent}>{message.content}</Text>
              <Text style={styles.messageTime}>
                {new Date(message.created_at).toLocaleTimeString()}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.inputsContainer}>
        <View style={styles.userInputSection}>
          <Text style={styles.userLabel}>{user1Name}:</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={user1Input}
              onChangeText={setUser1Input}
              placeholder="Type message..."
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, styles.sendButtonUser1]}
              onPress={sendMessageAsUser1}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.userInputSection}>
          <Text style={styles.userLabel}>{user2Name}:</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={user2Input}
              onChangeText={setUser2Input}
              placeholder="Type message..."
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, styles.sendButtonUser2]}
              onPress={sendMessageAsUser2}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#2c3e50',
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#7f8c8d',
    marginTop: 50,
  },
  infoCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#34495e',
  },
  instructionsCard: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  instructionText: {
    fontSize: 14,
    marginBottom: 3,
    color: '#27ae60',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  messagesList: {
    flex: 1,
    maxHeight: 200,
  },
  messagesContent: {
    paddingBottom: 10,
  },
  messageItem: {
    padding: 10,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  messageFromUser1: {
    backgroundColor: '#e3f2fd',
    borderLeftColor: '#2196f3',
  },
  messageFromUser2: {
    backgroundColor: '#f3e5f5',
    borderLeftColor: '#9c27b0',
  },
  messageSender: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
    color: '#2c3e50',
  },
  messageContent: {
    fontSize: 14,
    marginBottom: 2,
    color: '#34495e',
  },
  messageTime: {
    fontSize: 10,
    color: '#7f8c8d',
  },
  inputsContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
  },
  userInputSection: {
    marginBottom: 15,
  },
  userLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2c3e50',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    maxHeight: 60,
    marginRight: 10,
    fontSize: 14,
  },
  sendButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
  },
  sendButtonUser1: {
    backgroundColor: '#2196f3',
  },
  sendButtonUser2: {
    backgroundColor: '#9c27b0',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
});