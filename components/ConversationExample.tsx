import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { messageService, Message } from '../services/messageService';

interface ConversationExampleProps {
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserType: 'farmer' | 'buyer' | 'admin';
}

/**
 * Example component demonstrating the conversation model implementation
 *
 * Features:
 * 1. Both users connect to the same conversation using conversation_id
 * 2. Real-time messaging with proper subscription filtering
 * 3. Automatic conversation creation if it doesn't exist
 * 4. Independent message sending for both users
 */
export default function ConversationExample({
  currentUserId,
  otherUserId,
  otherUserName,
  otherUserType
}: ConversationExampleProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeConversation();
    return () => {
      // Cleanup subscription when component unmounts
      if (conversationId) {
        // The subscription cleanup would be handled by the component using this
      }
    };
  }, [currentUserId, otherUserId]);

  const initializeConversation = async () => {
    try {
      setIsLoading(true);

      // Step 1: Get or create conversation ID
      const convId = await messageService.getOrCreateConversationId(currentUserId, otherUserId);
      if (!convId) {
        console.error('Failed to get conversation ID');
        return;
      }

      console.log('📝 Conversation ID:', convId);
      setConversationId(convId);

      // Step 2: Load existing messages for this conversation
      const existingMessages = await messageService.getConversationMessages(otherUserId);
      setMessages(existingMessages);

      // Step 3: Subscribe to real-time updates for this specific conversation
      const subscription = messageService.subscribeToConversationChanges(
        convId,
        (newMessage: Message, type: 'INSERT' | 'UPDATE') => {
          console.log('🔄 Real-time message received:', type, newMessage);

          if (type === 'INSERT') {
            // Add new message to the list
            setMessages(prev => [...prev, newMessage]);
          } else if (type === 'UPDATE') {
            // Update existing message (e.g., read status)
            setMessages(prev =>
              prev.map(msg => msg.id === newMessage.id ? newMessage : msg)
            );
          }
        }
      );

      console.log('✅ Conversation initialized and subscribed to real-time updates');

    } catch (error) {
      console.error('Error initializing conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    try {
      console.log('📤 Sending message:', content);

      const sentMessage = await messageService.sendMessage({
        receiverId: otherUserId,
        content: content,
      });

      if (sentMessage) {
        console.log('✅ Message sent successfully:', sentMessage.id);
        // The message will be added to the UI via real-time subscription
      } else {
        console.error('❌ Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading conversation...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Conversation Model Example</Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Conversation Details</Text>
        <Text style={styles.infoText}>Conversation ID: {conversationId}</Text>
        <Text style={styles.infoText}>Participants: You ↔ {otherUserName} ({otherUserType})</Text>
        <Text style={styles.infoText}>Messages: {messages.length}</Text>
      </View>

      <View style={styles.howItWorksCard}>
        <Text style={styles.cardTitle}>How the Conversation Model Works:</Text>

        <View style={styles.step}>
          <Text style={styles.stepNumber}>1.</Text>
          <Text style={styles.stepText}>
            <Text style={styles.bold}>Conversation Creation:</Text> When users first message each other,
            a conversation record is automatically created with both user IDs.
          </Text>
        </View>

        <View style={styles.step}>
          <Text style={styles.stepNumber}>2.</Text>
          <Text style={styles.stepText}>
            <Text style={styles.bold}>Message Linking:</Text> All messages are linked to the conversation
            via conversation_id, making queries more efficient.
          </Text>
        </View>

        <View style={styles.step}>
          <Text style={styles.stepNumber}>3.</Text>
          <Text style={styles.stepText}>
            <Text style={styles.bold}>Real-time Subscription:</Text> Both users subscribe to the same
            conversation_id channel, eliminating conflicts and ensuring both see messages instantly.
          </Text>
        </View>

        <View style={styles.step}>
          <Text style={styles.stepNumber}>4.</Text>
          <Text style={styles.stepText}>
            <Text style={styles.bold}>Database Structure:</Text> Uses a conversations table and
            conversation_id foreign key in messages for better organization and performance.
          </Text>
        </View>
      </View>

      <View style={styles.codeExampleCard}>
        <Text style={styles.cardTitle}>Implementation Example:</Text>
        <Text style={styles.codeText}>
          {`// Get conversation ID
const conversationId = "123"; // Generated automatically

// Subscribe to conversation
supabase
  .channel(\`conversation-\${conversationId}\`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'messages',
    filter: \`conversation_id=eq.\${conversationId}\`
  }, (payload) => {
    setMessages(prev => [...prev, payload.new]);
  })
  .subscribe();

// Send message
await supabase
  .from("messages")
  .insert({
    conversation_id: conversationId,
    sender_id: currentUserId,
    receiver_id: otherUserId,
    content: messageText,
  });`}
        </Text>
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
    marginBottom: 20,
    textAlign: 'center',
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
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  infoText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#34495e',
  },
  howItWorksCard: {
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
  codeExampleCard: {
    backgroundColor: '#2c3e50',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
  },
  step: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3498db',
    marginRight: 8,
    minWidth: 20,
  },
  stepText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
    color: '#34495e',
  },
  bold: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  codeText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#ecf0f1',
    lineHeight: 16,
  },
});