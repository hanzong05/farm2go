import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'farmer' | 'buyer' | 'admin';
  subject: string;
  content: string;
  timestamp: string;
  read: boolean;
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    url: string;
  }>;
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantType: 'farmer' | 'buyer' | 'admin';
  lastMessage: Message;
  unreadCount: number;
  messages: Message[];
}

interface MessageComponentProps {
  conversations: Conversation[];
  onConversationPress?: (conversation: Conversation) => void;
  onSendMessage?: (conversationId: string, content: string) => void;
  onMarkAsRead?: (conversationId: string) => void;
  onNewConversation?: () => void;
}

const colors = {
  primary: '#059669',
  secondary: '#10b981',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  white: '#ffffff',
  black: '#000000',
  gray100: '#f9fafb',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  background: '#f0f9f4',
  surface: '#ffffff',
  text: '#0f172a',
  textSecondary: '#6b7280',
  border: '#d1fae5',
  shadow: 'rgba(0,0,0,0.1)',
};

export default function MessageComponent({
  conversations,
  onConversationPress,
  onSendMessage,
  onMarkAsRead,
  onNewConversation,
}: MessageComponentProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState('');

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getUserIcon = (userType: 'farmer' | 'buyer' | 'admin') => {
    switch (userType) {
      case 'farmer':
        return 'leaf';
      case 'buyer':
        return 'shopping-cart';
      case 'admin':
        return 'user-shield';
      default:
        return 'user';
    }
  };

  const getUserIconColor = (userType: 'farmer' | 'buyer' | 'admin') => {
    switch (userType) {
      case 'farmer':
        return colors.success;
      case 'buyer':
        return colors.info;
      case 'admin':
        return colors.warning;
      default:
        return colors.gray500;
    }
  };

  const handleConversationPress = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    if (conversation.unreadCount > 0 && onMarkAsRead) {
      onMarkAsRead(conversation.id);
    }
    if (onConversationPress) {
      onConversationPress(conversation);
    }
  };

  const handleSendMessage = () => {
    if (messageText.trim() && selectedConversation && onSendMessage) {
      onSendMessage(selectedConversation.id, messageText.trim());
      setMessageText('');
    }
  };

  const totalUnreadCount = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[
        styles.conversationItem,
        item.unreadCount > 0 && styles.conversationItemUnread
      ]}
      onPress={() => handleConversationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <View style={[
          styles.avatar,
          { backgroundColor: getUserIconColor(item.participantType) + '20' }
        ]}>
          <Icon
            name={getUserIcon(item.participantType)}
            size={16}
            color={getUserIconColor(item.participantType)}
          />
        </View>
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {item.unreadCount > 9 ? '9+' : item.unreadCount}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={[
            styles.participantName,
            item.unreadCount > 0 && styles.participantNameUnread
          ]}>
            {item.participantName}
          </Text>
          <Text style={styles.timestamp}>
            {formatTimestamp(item.lastMessage.timestamp)}
          </Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage.content}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === 'current-user'; // This should be replaced with actual user ID logic

    return (
      <View style={[
        styles.messageItem,
        isOwn ? styles.messageItemOwn : styles.messageItemOther
      ]}>
        <View style={[
          styles.messageBubble,
          isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther
        ]}>
          <Text style={[
            styles.messageText,
            isOwn ? styles.messageTextOwn : styles.messageTextOther
          ]}>
            {item.content}
          </Text>
          <Text style={[
            styles.messageTime,
            isOwn ? styles.messageTimeOwn : styles.messageTimeOther
          ]}>
            {formatTimestamp(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="comments" size={48} color={colors.gray400} />
      <Text style={styles.emptyTitle}>No Messages</Text>
      <Text style={styles.emptyDescription}>
        Start a conversation with farmers or buyers to get your business growing!
      </Text>
      <TouchableOpacity
        style={styles.newMessageButton}
        onPress={onNewConversation}
      >
        <Icon name="plus" size={16} color={colors.white} />
        <Text style={styles.newMessageButtonText}>Start New Conversation</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View>
      <TouchableOpacity
        style={styles.messageButton}
        onPress={() => setModalVisible(true)}
      >
        <Icon name="comment" size={18} color={colors.white} />
        {totalUnreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setModalVisible(false);
          setSelectedConversation(null);
        }}
      >
        <View style={styles.modalContainer}>
          {!selectedConversation ? (
            // Conversations List View
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Messages</Text>
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    style={styles.headerButton}
                    onPress={onNewConversation}
                  >
                    <Icon name="plus" size={14} color={colors.white} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setModalVisible(false)}
                  >
                    <Icon name="times" size={20} color={colors.gray600} />
                  </TouchableOpacity>
                </View>
              </View>

              {conversations.length === 0 ? (
                renderEmptyState()
              ) : (
                <FlatList
                  data={conversations}
                  renderItem={renderConversationItem}
                  keyExtractor={(item) => item.id}
                  style={styles.conversationsList}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </>
          ) : (
            // Individual Conversation View
            <>
              <View style={styles.conversationHeader}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setSelectedConversation(null)}
                >
                  <Icon name="chevron-left" size={20} color={colors.white} />
                </TouchableOpacity>
                <View style={styles.conversationInfo}>
                  <Text style={styles.conversationTitle}>
                    {selectedConversation.participantName}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setModalVisible(false);
                    setSelectedConversation(null);
                  }}
                >
                  <Icon name="times" size={20} color={colors.gray600} />
                </TouchableOpacity>
              </View>

              <FlatList
                data={selectedConversation.messages}
                renderItem={renderMessageItem}
                keyExtractor={(item) => item.id}
                style={styles.messagesList}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                inverted
              />

              <View style={styles.messageInputContainer}>
                <TextInput
                  style={styles.messageInput}
                  placeholder="Type a message..."
                  value={messageText}
                  onChangeText={setMessageText}
                  multiline
                  maxLength={500}
                  placeholderTextColor={colors.gray400}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    messageText.trim() ? styles.sendButtonActive : styles.sendButtonInactive
                  ]}
                  onPress={handleSendMessage}
                  disabled={!messageText.trim()}
                >
                  <Icon
                    name="paper-plane"
                    size={16}
                    color={messageText.trim() ? colors.white : colors.gray400}
                  />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  messageButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.white,
  },

  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  modalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 60,
    backgroundColor: colors.primary,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  headerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  conversationsList: {
    flex: 1,
  },

  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    backgroundColor: colors.white,
  },

  conversationItemUnread: {
    backgroundColor: colors.gray100,
  },

  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.white,
  },

  unreadBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },

  conversationContent: {
    flex: 1,
  },

  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },

  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },

  participantNameUnread: {
    fontWeight: 'bold',
  },

  timestamp: {
    fontSize: 12,
    color: colors.gray500,
  },

  lastMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 60,
    backgroundColor: colors.primary,
  },

  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  conversationInfo: {
    flex: 1,
  },

  conversationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
  },

  messagesList: {
    flex: 1,
    backgroundColor: colors.gray100,
  },

  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  messageItem: {
    marginVertical: 4,
  },

  messageItemOwn: {
    alignItems: 'flex-end',
  },

  messageItemOther: {
    alignItems: 'flex-start',
  },

  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },

  messageBubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },

  messageBubbleOther: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    elevation: 1,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  messageText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 4,
  },

  messageTextOwn: {
    color: colors.white,
  },

  messageTextOther: {
    color: colors.text,
  },

  messageTime: {
    fontSize: 11,
  },

  messageTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },

  messageTimeOther: {
    color: colors.gray500,
  },

  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },

  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    color: colors.text,
    backgroundColor: colors.gray100,
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  sendButtonActive: {
    backgroundColor: colors.primary,
  },

  sendButtonInactive: {
    backgroundColor: colors.gray300,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },

  emptyDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },

  newMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },

  newMessageButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});