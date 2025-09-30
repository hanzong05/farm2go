import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { messageService, Message } from '../services/messageService';

interface WorkflowChatComponentProps {
  currentUserId: string;
  otherUserId: string;
  currentUserName: string;
  otherUserName: string;
}

/**
 * Chat component that follows the exact workflow diagram:
 *
 * 1. User opens a chat
 * 2. Does conversation exist?
 *    - YES: Load existing conversation
 *    - NO: Create conversation automatically (trigger)
 * 3. User sends a message
 * 4. Message stored in database (with conversation ID, sender, receiver, content, timestamp)
 * 5. Database broadcasts new message to conversation users
 * 6. Sender's chat UI updates instantly
 * 7. Receiver's chat UI updates instantly
 */
export default function WorkflowChatComponent({
  currentUserId,
  otherUserId,
  currentUserName,
  otherUserName
}: WorkflowChatComponentProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [workflowStep, setWorkflowStep] = useState<string>('initializing');
  const [conversationExists, setConversationExists] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeWorkflow();
  }, [currentUserId, otherUserId]);

  const initializeWorkflow = async () => {
    try {
      setWorkflowStep('User opens a chat');

      // Step 1: Check if conversation exists
      setWorkflowStep('Checking if conversation exists...');

      const chatData = await messageService.initializeChat(currentUserId, otherUserId);

      if (chatData.exists && chatData.conversationId) {
        // YES: Load existing conversation
        setWorkflowStep('Loading existing conversation');

        setConversationId(chatData.conversationId);
        setMessages(chatData.messages);
        setConversationExists(true);

        // Set up real-time subscription for existing conversation
        setupRealtimeSubscription(chatData.conversationId);
      } else {
        // NO: Will create conversation automatically via trigger
        setWorkflowStep('No conversation exists - will be created automatically');

        setConversationId(null);
        setMessages([]);
        setConversationExists(false);

        // Set up subscription that will activate once conversation is created
        setupGeneralSubscription();
      }

      setWorkflowStep('Ready to send messages');

    } catch (error) {
      console.error('❌ Error in workflow initialization:', error);
      setWorkflowStep('Error initializing chat');
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscription = (convId: string) => {

    const subscription = messageService.subscribeToConversationChanges(
      convId,
      (newMessage: Message, type: 'INSERT' | 'UPDATE') => {

        if (type === 'INSERT') {
          setMessages(prev => {
            const exists = prev.find(m => m.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  };

  const setupGeneralSubscription = () => {

    const subscription = messageService.subscribeToMessages(
      (newMessage: Message) => {
        // Check if this message is for our conversation
        if ((newMessage.sender_id === currentUserId && newMessage.receiver_id === otherUserId) ||
            (newMessage.sender_id === otherUserId && newMessage.receiver_id === currentUserId)) {


          // Update conversation state
          setConversationId(newMessage.conversation_id);
          setConversationExists(true);
          setMessages([newMessage]);

          // Now set up specific conversation subscription
          setupRealtimeSubscription(newMessage.conversation_id);
        }
      },
      currentUserId
    );

    return () => {
      subscription?.unsubscribe();
    };
  };

  const sendMessage = async () => {
    if (!messageText.trim()) return;

    try {
      setWorkflowStep('User sends a message');

      const message = await messageService.sendMessage({
        receiverId: otherUserId,
        content: messageText.trim(),
      });

      if (message) {
        setMessageText('');

        // If this was the first message and conversation didn't exist,
        // the trigger will have created it and set the conversation_id
        if (!conversationExists && message.conversation_id) {
          setConversationId(message.conversation_id);
          setConversationExists(true);
          // Switch to conversation-specific subscription
          setupRealtimeSubscription(message.conversation_id);
        }

        setWorkflowStep('Message sent - waiting for real-time updates');
      } else {
        console.error('Failed to send message');
        setWorkflowStep('Error sending message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setWorkflowStep('Error sending message');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Initializing chat workflow...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Workflow Chat Implementation</Text>

      <View style={styles.workflowCard}>
        <Text style={styles.cardTitle}>Current Workflow Step:</Text>
        <Text style={styles.workflowStep}>{workflowStep}</Text>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Conversation Exists:</Text>
          <Text style={[styles.statusValue, conversationExists ? styles.statusYes : styles.statusNo]}>
            {conversationExists ? 'YES' : 'NO'}
          </Text>
        </View>

        {conversationId && (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Conversation ID:</Text>
            <Text style={styles.statusValue}>{conversationId}</Text>
          </View>
        )}

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Messages:</Text>
          <Text style={styles.statusValue}>{messages.length}</Text>
        </View>
      </View>

      <View style={styles.participantsCard}>
        <Text style={styles.cardTitle}>Chat Participants:</Text>
        <Text style={styles.participantText}>👤 {currentUserName} (You)</Text>
        <Text style={styles.participantText}>👤 {otherUserName}</Text>
      </View>

      <View style={styles.messagesContainer}>
        <Text style={styles.sectionTitle}>Messages:</Text>
        <ScrollView style={styles.messagesList} contentContainerStyle={styles.messagesContent}>
          {messages.length === 0 ? (
            <Text style={styles.emptyText}>
              {conversationExists
                ? 'No messages yet in this conversation'
                : 'Send the first message to create the conversation'
              }
            </Text>
          ) : (
            messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageItem,
                  message.sender_id === currentUserId ? styles.messageFromCurrent : styles.messageFromOther
                ]}
              >
                <Text style={styles.messageSender}>
                  {message.sender_id === currentUserId ? currentUserName : otherUserName}:
                </Text>
                <Text style={styles.messageContent}>{message.content}</Text>
                <Text style={styles.messageTime}>
                  {new Date(message.created_at).toLocaleTimeString()}
                </Text>
                <Text style={styles.messageConversationId}>
                  Conv: {message.conversation_id?.substring(0, 8)}...
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message to test the workflow..."
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, messageText.trim() ? styles.sendButtonActive : styles.sendButtonInactive]}
          onPress={sendMessage}
          disabled={!messageText.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.workflowDiagramCard}>
        <Text style={styles.cardTitle}>Workflow Steps:</Text>
        <Text style={styles.diagramText}>1. ✅ User opens a chat</Text>
        <Text style={styles.diagramText}>2. ✅ Check if conversation exists</Text>
        <Text style={styles.diagramText}>3. ✅ Load existing OR prepare for creation</Text>
        <Text style={styles.diagramText}>4. 🔄 User sends a message</Text>
        <Text style={styles.diagramText}>5. 🔄 Message stored in database</Text>
        <Text style={styles.diagramText}>6. 🔄 Database broadcasts to users</Text>
        <Text style={styles.diagramText}>7. 🔄 Both UIs update instantly</Text>
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
  workflowCard: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#27ae60',
  },
  participantsCard: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  workflowDiagramCard: {
    backgroundColor: '#fff3e0',
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  workflowStep: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#27ae60',
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  statusLabel: {
    fontSize: 14,
    color: '#34495e',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusYes: {
    color: '#27ae60',
  },
  statusNo: {
    color: '#e74c3c',
  },
  participantText: {
    fontSize: 14,
    marginBottom: 3,
    color: '#2196f3',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    minHeight: 200,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingBottom: 10,
  },
  emptyText: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontStyle: 'italic',
    marginTop: 20,
  },
  messageItem: {
    padding: 10,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  messageFromCurrent: {
    backgroundColor: '#e3f2fd',
    borderLeftColor: '#2196f3',
    marginLeft: 20,
  },
  messageFromOther: {
    backgroundColor: '#f3e5f5',
    borderLeftColor: '#9c27b0',
    marginRight: 20,
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
  messageConversationId: {
    fontSize: 9,
    color: '#95a5a6',
    fontFamily: 'monospace',
  },
  inputContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  sendButtonActive: {
    backgroundColor: '#27ae60',
  },
  sendButtonInactive: {
    backgroundColor: '#bdc3c7',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  diagramText: {
    fontSize: 12,
    marginBottom: 2,
    color: '#e67e22',
  },
});