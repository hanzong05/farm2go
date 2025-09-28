import React, { useRef, useState, useEffect } from 'react';
import {
    Dimensions,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    FlatList,
    KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

const { width } = Dimensions.get('window');
const isDesktop = width >= 1024;

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'farmer' | 'buyer' | 'admin';
  content: string;
  timestamp: string;
  read: boolean;
}

export interface ChatParticipant {
  id: string;
  name: string;
  type: 'farmer' | 'buyer' | 'admin';
  isOnline?: boolean;
}

interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
  participant: ChatParticipant;
  messages: ChatMessage[];
  onSendMessage?: (content: string) => void;
  currentUserId?: string;
  loading?: boolean;
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
  onlineGreen: '#42b883',
};

export default function ChatModal({
  visible,
  onClose,
  participant,
  messages,
  onSendMessage,
  currentUserId = 'current-user',
  loading = false,
}: ChatModalProps) {
  const [messageText, setMessageText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

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

  const handleSendMessage = () => {
    if (messageText.trim() && onSendMessage) {
      onSendMessage(messageText.trim());
      setMessageText('');
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

  const renderMessageItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isOwn = item.senderId === currentUserId;
    const nextMessage = messages[index + 1];
    const showAvatar = !nextMessage || nextMessage.senderId !== item.senderId;
    const showTimestamp = index === 0 ||
      new Date(item.timestamp).getTime() - new Date(messages[index - 1]?.timestamp || 0).getTime() > 300000; // 5 minutes

    return (
      <View style={styles.messageWrapper}>
        {showTimestamp && (
          <Text style={styles.timestampText}>
            {formatTimestamp(item.timestamp)}
          </Text>
        )}

        <View style={[
          styles.messageContainer,
          isOwn ? styles.messageContainerOwn : styles.messageContainerOther
        ]}>
          {!isOwn && showAvatar && (
            <View style={styles.avatarContainer}>
              <View style={[
                styles.avatar,
                { backgroundColor: getUserIconColor(item.senderType) + '20' }
              ]}>
                <Icon
                  name={getUserIcon(item.senderType)}
                  size={16}
                  color={getUserIconColor(item.senderType)}
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
              <Text style={styles.senderName}>{item.senderName}</Text>
            )}
            <Text style={[
              styles.messageText,
              isOwn ? styles.messageTextOwn : styles.messageTextOther
            ]}>
              {item.content}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyAvatarContainer}>
        <View style={[
          styles.emptyAvatar,
          { backgroundColor: getUserIconColor(participant.type) + '20' }
        ]}>
          <Icon
            name={getUserIcon(participant.type)}
            size={32}
            color={getUserIconColor(participant.type)}
          />
        </View>
      </View>
      <Text style={styles.emptyTitle}>{participant.name}</Text>
      <Text style={styles.emptySubtitle}>
        {participant.type === 'buyer'
          ? 'Start a conversation with this buyer about their order'
          : 'Start a conversation with this farmer'
        }
      </Text>

      {/* Quick message suggestions */}
      <View style={styles.suggestedMessages}>
        {participant.type === 'buyer' ? (
          <>
            <TouchableOpacity
              style={styles.suggestedMessage}
              onPress={() => setMessageText("Hello! Thank you for your order. How can I assist you today?")}
            >
              <Text style={styles.suggestedMessageText}>
                👋 Thank you for your order
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.suggestedMessage}
              onPress={() => setMessageText("When would you prefer your order to be delivered?")}
            >
              <Text style={styles.suggestedMessageText}>
                📦 Ask about delivery preferences
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.suggestedMessage}
              onPress={() => setMessageText("Do you have any special requirements for your order?")}
            >
              <Text style={styles.suggestedMessageText}>
                ❓ Ask about special requirements
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.suggestedMessage}
              onPress={() => setMessageText("Hello! I'm interested in your products. Are they available?")}
            >
              <Text style={styles.suggestedMessageText}>
                👋 Ask about product availability
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.suggestedMessage}
              onPress={() => setMessageText("What are your delivery options and schedule?")}
            >
              <Text style={styles.suggestedMessageText}>
                🚚 Ask about delivery options
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={isDesktop ? "overFullScreen" : "pageSheet"}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContainer,
            isDesktop && styles.modalContainerDesktop
          ]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Icon name="arrow-left" size={20} color={colors.white} />
              </TouchableOpacity>

              <View style={styles.headerInfo}>
                <View style={[
                  styles.headerAvatar,
                  { backgroundColor: getUserIconColor(participant.type) + '20' }
                ]}>
                  <Icon
                    name={getUserIcon(participant.type)}
                    size={20}
                    color={getUserIconColor(participant.type)}
                  />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.headerName}>{participant.name}</Text>
                  <Text style={styles.headerStatus}>
                    {participant.isOnline ? (
                      <>
                        <View style={styles.onlineIndicator} />
                        <Text style={styles.onlineText}>Active now</Text>
                      </>
                    ) : (
                      `${participant.type.charAt(0).toUpperCase() + participant.type.slice(1)}`
                    )}
                  </Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.headerActionButton}>
                  <Icon name="phone" size={16} color={colors.white} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerActionButton}>
                  <Icon name="info-circle" size={16} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Messages Area */}
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

            {/* Message Input */}
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <TouchableOpacity style={styles.attachButton}>
                  <Icon name="paperclip" size={18} color={colors.primary} />
                </TouchableOpacity>

                <TextInput
                  style={styles.textInput}
                  placeholder="Type a message..."
                  value={messageText}
                  onChangeText={setMessageText}
                  multiline
                  maxLength={500}
                  placeholderTextColor={colors.gray500}
                  onSubmitEditing={handleSendMessage}
                  blurOnSubmit={false}
                />

                <TouchableOpacity style={styles.emojiButton}>
                  <Icon name="smile" size={18} color={colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    messageText.trim() ? styles.sendButtonActive : styles.sendButtonInactive
                  ]}
                  onPress={handleSendMessage}
                  disabled={!messageText.trim()}
                  activeOpacity={0.7}
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: isDesktop ? 'rgba(0,0,0,0.5)' : colors.white,
    justifyContent: isDesktop ? 'center' : 'flex-start',
    alignItems: isDesktop ? 'center' : 'stretch',
  },

  modalContainer: {
    flex: 1,
    backgroundColor: colors.white,
    width: '100%',
    height: '100%',
  },

  modalContainerDesktop: {
    width: 480,
    height: 640,
    borderRadius: 12,
    overflow: 'hidden',
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
  },

  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' && !isDesktop ? 44 : 12,
    backgroundColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  headerText: {
    flex: 1,
  },

  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    marginBottom: 2,
  },

  headerStatus: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    flexDirection: 'row',
    alignItems: 'center',
  },

  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.onlineGreen,
    marginRight: 4,
  },

  onlineText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },

  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },

  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Messages Container
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
  messageWrapper: {
    marginVertical: 2,
  },

  timestampText: {
    fontSize: 12,
    color: colors.gray500,
    textAlign: 'center',
    marginVertical: 8,
  },

  messageContainer: {
    flexDirection: 'row',
    marginVertical: 1,
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
    width: 36,
  },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray600,
    marginBottom: 2,
  },

  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },

  messageTextOwn: {
    color: colors.white,
  },

  messageTextOther: {
    color: colors.text,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },

  emptyAvatarContainer: {
    marginBottom: 16,
  },

  emptyAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },

  emptySubtitle: {
    fontSize: 14,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },

  suggestedMessages: {
    width: '100%',
    gap: 8,
  },

  suggestedMessage: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.gray300,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },

  suggestedMessageText: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
  },

  // Input Container
  inputContainer: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' && !isDesktop ? 24 : 12,
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

  attachButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
    paddingVertical: 4,
    paddingHorizontal: 4,
    lineHeight: 20,
  },

  emojiButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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