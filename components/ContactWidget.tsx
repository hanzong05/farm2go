import React, { useRef, useState, useEffect } from 'react';
import {
    Dimensions,
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { messageService, Message, SendMessageParams } from '../services/messageService';

const { width } = Dimensions.get('window');
const isDesktop = width >= 1024;

export interface ContactPerson {
  id: string;
  name: string;
  type: 'farmer' | 'buyer' | 'admin';
  isOnline?: boolean;
}

export interface ContactMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'farmer' | 'buyer' | 'admin';
  content: string;
  timestamp: string;
  read: boolean;
}

interface ContactWidgetProps {
  contactPerson?: ContactPerson;
  currentUserId?: string;
  currentUserName?: string;
  currentUserType?: 'farmer' | 'buyer' | 'admin';
  visible?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  relatedProductId?: string;
  relatedOrderId?: string;
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
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
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
  // Facebook-like colors
  facebookBlue: '#1877f2',
  facebookGray: '#f0f2f5',
  messageBubbleSent: '#1877f2',
  messageBubbleReceived: '#e4e6ea',
};

export default function ContactWidget({
  contactPerson,
  currentUserId = 'current-user',
  currentUserName = 'User',
  currentUserType = 'buyer',
  visible = false,
  onOpen,
  onClose,
  relatedProductId,
  relatedOrderId,
}: ContactWidgetProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef<View>(null);
  const flatListRef = useRef<FlatList>(null);

  // Sync internal state with visible prop
  useEffect(() => {
    if (visible) {
      if (isDesktop) {
        setDropdownVisible(true);
      } else {
        setModalVisible(true);
      }
    }
  }, [visible]);

  // Load conversation messages when contact person changes
  useEffect(() => {
    const loadMessages = async () => {
      if (contactPerson?.id) {
        setLoading(true);
        try {
          const conversationMessages = await messageService.getConversationMessages(contactPerson.id);
          setMessages(conversationMessages);
        } catch (error) {
          console.error('Error loading messages:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadMessages();
  }, [contactPerson?.id]);

  // Subscribe to real-time messages
  useEffect(() => {
    if (!contactPerson?.id || !currentUserId) return;

    console.log('Setting up real-time subscription for conversation:', {
      contactPersonId: contactPerson.id,
      currentUserId
    });

    const subscription = messageService.subscribeToAllMessageChanges(
      (message: Message, type: 'INSERT' | 'UPDATE') => {
        // Only handle messages for current conversation
        if (
          (message.sender_id === contactPerson.id && message.receiver_id === currentUserId) ||
          (message.sender_id === currentUserId && message.receiver_id === contactPerson.id)
        ) {
          console.log(`Real-time message ${type}:`, message);

          if (type === 'INSERT') {
            // Add new message
            setMessages(prev => {
              // Check if message already exists to prevent duplicates
              const exists = prev.find(m => m.id === message.id);
              if (exists) return prev;
              return [...prev, message];
            });

            // Mark as read if user received it and modal is open
            if (message.receiver_id === currentUserId && (modalVisible || dropdownVisible)) {
              messageService.markMessageAsRead(message.id);
            }
          } else if (type === 'UPDATE') {
            // Update existing message (e.g., read status)
            setMessages(prev =>
              prev.map(m => m.id === message.id ? message : m)
            );
          }
        }
      },
      currentUserId
    );

    return () => {
      console.log('Cleaning up real-time subscription');
      subscription?.unsubscribe();
    };
  }, [contactPerson?.id, currentUserId]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
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

  const handleSendMessage = async () => {
    if (!messageText.trim() || !contactPerson || loading) return;

    try {
      setLoading(true);
      const messageParams: SendMessageParams = {
        receiverId: contactPerson.id,
        content: messageText.trim(),
        relatedProductId,
        relatedOrderId,
      };

      const newMessage = await messageService.sendMessage(messageParams);
      if (newMessage) {
        setMessages(prev => [...prev, newMessage]);
        setMessageText('');

        // Scroll to bottom after sending
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleContact = () => {
    if (isDesktop) {
      setDropdownVisible(!dropdownVisible);
      if (onOpen && !dropdownVisible) {
        onOpen();
      }
    } else {
      setModalVisible(true);
      if (onOpen) {
        onOpen();
      }
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setDropdownVisible(false);
    if (onClose) {
      onClose();
    }
  };

  const renderMessageItem = ({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.sender_id === currentUserId;
    const nextMessage = messages[index + 1];
    const showAvatar = !nextMessage || nextMessage.sender_id !== item.sender_id;

    return (
      <View style={[
        styles.messageContainer,
        isOwn ? styles.messageContainerOwn : styles.messageContainerOther
      ]}>
        {!isOwn && showAvatar && (
          <View style={styles.avatarContainer}>
            <View style={[
              styles.avatar,
              { backgroundColor: getUserIconColor(item.sender_profile?.user_type || 'buyer') + '20' }
            ]}>
              <Icon
                name={getUserIcon(item.sender_profile?.user_type || 'buyer')}
                size={16}
                color={getUserIconColor(item.sender_profile?.user_type || 'buyer')}
              />
            </View>
          </View>
        )}

        {!isOwn && !showAvatar && (
          <View style={styles.avatarSpacer} />
        )}

        <View style={[
          styles.messageBubble,
          isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther
        ]}>
          {!isOwn && showAvatar && (
            <Text style={styles.senderName}>
              {`${item.sender_profile?.first_name || ''} ${item.sender_profile?.last_name || ''}`.trim() || 'User'}
            </Text>
          )}
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
            {formatTimestamp(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyAvatarContainer}>
        <View style={[
          styles.emptyAvatar,
          contactPerson && { backgroundColor: getUserIconColor(contactPerson.type) + '20' }
        ]}>
          <Icon
            name={contactPerson ? getUserIcon(contactPerson.type) : 'comment'}
            size={32}
            color={contactPerson ? getUserIconColor(contactPerson.type) : colors.gray500}
          />
        </View>
      </View>
      <Text style={styles.emptyTitle}>
        {contactPerson ? contactPerson.name : 'Start a Conversation'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {contactPerson
          ? `Chat with ${contactPerson.name} about your order or products`
          : 'Send a message to get started'
        }
      </Text>
    </View>
  );

  const renderDesktopDropdownContent = () => (
    <View style={styles.desktopDropdownContainer}>
      <View style={styles.desktopDropdownHeader}>
        <Text style={styles.desktopDropdownTitle}>
          {contactPerson ? `Chat with ${contactPerson.name}` : 'Contact'}
        </Text>
        <TouchableOpacity
          style={styles.desktopCloseButton}
          onPress={handleCloseModal}
        >
          <Icon name="times" size={14} color={colors.gray600} />
        </TouchableOpacity>
      </View>

      <View style={styles.desktopMessagesContainer}>
        {messages.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id}
            style={styles.desktopMessagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}
      </View>

      {/* Desktop Input */}
      <View style={styles.desktopInputContainer}>
        <TextInput
          style={styles.desktopMessageInput}
          placeholder="Type a message..."
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={500}
          placeholderTextColor={colors.gray400}
          onSubmitEditing={handleSendMessage}
        />
        <TouchableOpacity
          style={[
            styles.desktopSendButton,
            messageText.trim() ? styles.sendButtonActive : styles.sendButtonInactive
          ]}
          onPress={handleSendMessage}
          disabled={!messageText.trim()}
        >
          <Icon
            name="paper-plane"
            size={14}
            color={messageText.trim() ? colors.white : colors.gray400}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!visible || !contactPerson) {
    return null;
  }

  return (
    <View style={styles.contactWrapper}>
      {/* Floating Contact Button */}
      <View ref={buttonRef} style={styles.floatingButtonContainer}>
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={handleToggleContact}
        >
          <Icon name="comment" size={20} color={colors.white} />
          <Text style={styles.floatingButtonText}>Chat</Text>
        </TouchableOpacity>
      </View>

      {/* Desktop Dropdown */}
      {isDesktop && dropdownVisible && (
        <View style={styles.dropdownContainer}>
          <TouchableOpacity
            style={styles.dropdownBackdrop}
            activeOpacity={1}
            onPress={handleCloseModal}
          />
          <View style={styles.dropdownContentWrapper}>
            {renderDesktopDropdownContent()}
          </View>
        </View>
      )}

      {/* Mobile/Tablet Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleCloseModal}
            >
              <Icon name="arrow-left" size={20} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {contactPerson ? `Chat with ${contactPerson.name}` : 'Contact'}
            </Text>
            <View style={styles.headerRight} />
          </View>

          {/* Messages */}
          <View style={styles.messagesContainer}>
            {messages.length === 0 ? (
              renderEmptyState()
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessageItem}
                keyExtractor={(item) => item.id}
                style={styles.messagesList}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              />
            )}
          </View>

          {/* Mobile Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
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
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  contactWrapper: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 9999,
    elevation: 9999,
  },

  // Floating Button
  floatingButtonContainer: {
    position: 'relative',
  },

  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        cursor: 'pointer',
      },
      default: {
        elevation: 8,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
    }),
  },

  floatingButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },

  // Desktop Dropdown Styles
  dropdownContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
  },

  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },

  dropdownContentWrapper: {
    position: 'absolute',
    bottom: 70,
    right: 0,
    zIndex: 9999,
  },

  desktopDropdownContainer: {
    width: 360,
    height: 480,
    backgroundColor: colors.white,
    borderRadius: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
      },
      default: {
        elevation: 24,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
    }),
    borderWidth: 1,
    borderColor: colors.gray200,
  },

  desktopDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    backgroundColor: colors.primary,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },

  desktopDropdownTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
    flex: 1,
  },

  desktopCloseButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  desktopMessagesContainer: {
    flex: 1,
    backgroundColor: colors.gray50,
  },

  desktopMessagesList: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  desktopInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    gap: 8,
  },

  desktopMessageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
    color: colors.text,
  },

  desktopSendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Mobile Modal Styles
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

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    flex: 1,
    textAlign: 'center',
  },

  headerRight: {
    width: 40,
  },

  messagesContainer: {
    flex: 1,
    backgroundColor: colors.gray50,
  },

  messagesList: {
    flex: 1,
  },

  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  // Message Styles
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 2,
    alignItems: 'flex-end',
  },

  messageContainerOwn: {
    justifyContent: 'flex-end',
  },

  messageContainerOther: {
    justifyContent: 'flex-start',
  },

  avatarContainer: {
    marginRight: 8,
    marginBottom: 4,
  },

  avatarSpacer: {
    width: 32,
  },

  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  messageBubble: {
    maxWidth: '70%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    marginVertical: 1,
  },

  messageBubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },

  messageBubbleOther: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.gray200,
  },

  senderName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray600,
    marginBottom: 2,
  },

  messageText: {
    fontSize: 14,
    lineHeight: 18,
  },

  messageTextOwn: {
    color: colors.white,
  },

  messageTextOther: {
    color: colors.text,
  },

  messageTime: {
    fontSize: 10,
    marginTop: 2,
  },

  messageTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },

  messageTimeOther: {
    color: colors.gray500,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  emptyAvatarContainer: {
    marginBottom: 16,
  },

  emptyAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },

  emptySubtitle: {
    fontSize: 12,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Input Container
  inputContainer: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.gray100,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },

  messageInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
    paddingVertical: 4,
    paddingHorizontal: 8,
    lineHeight: 20,
  },

  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sendButtonActive: {
    backgroundColor: colors.primary,
  },

  sendButtonInactive: {
    backgroundColor: colors.gray300,
  },
});