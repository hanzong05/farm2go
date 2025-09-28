import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import ChatModal, { ChatParticipant, ChatMessage } from './ChatModal';

interface ContactButtonSimpleProps {
  contactPerson: {
    id: string;
    name: string;
    type: 'farmer' | 'buyer' | 'admin';
    isOnline?: boolean;
  };
  currentUserId?: string;
  currentUserName?: string;
  currentUserType?: 'farmer' | 'buyer' | 'admin';
  title?: string;
  onSendMessage?: (message: string, contactPersonId: string) => void;
  style?: any;
  disabled?: boolean;
}

export default function ContactButtonSimple({
  contactPerson,
  currentUserId,
  currentUserName = 'User',
  currentUserType = 'buyer',
  title = 'Contact',
  onSendMessage,
  style,
  disabled = false,
}: ContactButtonSimpleProps) {
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const handleContactPress = () => {
    console.log('🔥 Contact button pressed!', {
      contactPerson: contactPerson.name,
      currentUserId,
    });

    if (!currentUserId || currentUserId === '00000000-0000-0000-0000-000000000000') {
      Alert.alert('Login Required', `Please log in to contact the ${contactPerson.type}.`);
      return;
    }

    setChatModalVisible(true);
  };

  const handleSendMessage = (content: string) => {
    console.log('💬 Sending message:', content);

    if (!currentUserId) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: currentUserId,
      senderName: currentUserName,
      senderType: currentUserType,
      content,
      timestamp: new Date().toISOString(),
      read: false,
    };

    setChatMessages(prev => [...prev, newMessage]);

    if (onSendMessage) {
      onSendMessage(content, contactPerson.id);
    }
  };

  const handleCloseModal = () => {
    setChatModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.button, style]}
        onPress={handleContactPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Icon name="comment" size={16} color="#059669" />
        <Text style={styles.buttonText}>{title}</Text>
      </TouchableOpacity>

      <ChatModal
        visible={chatModalVisible}
        onClose={handleCloseModal}
        participant={contactPerson}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        currentUserId={currentUserId || 'anonymous'}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#9ca3af',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
  },
});