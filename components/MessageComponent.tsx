import React, { useRef, useState } from 'react';
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

const { width } = Dimensions.get('window');
const isDesktop = width >= 1024;

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
};

export default function MessageComponent({
  conversations,
  onConversationPress,
  onSendMessage,
  onMarkAsRead,
  onNewConversation,
}: MessageComponentProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState('');
  const buttonRef = useRef<View>(null);

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

  const handleToggleMessages = () => {
    if (isDesktop) {
      setDropdownVisible(!dropdownVisible);
    } else {
      setModalVisible(true);
    }
  };

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
    <View style={[styles.emptyContainer, isDesktop && styles.dropdownEmptyContainer]}>
      <Icon name="comments" size={isDesktop ? 40 : 48} color={colors.gray400} />
      <Text style={[styles.emptyTitle, isDesktop && styles.dropdownEmptyTitle]}>No Messages</Text>
      <Text style={[styles.emptyDescription, isDesktop && styles.dropdownEmptyDescription]}>
        {isDesktop ? 'Your conversations will appear here' : 'Start a conversation with farmers or buyers to get your business growing!'}
      </Text>
      {!isDesktop && (
        <TouchableOpacity
          style={styles.newMessageButton}
          onPress={onNewConversation}
        >
          <Icon name="plus" size={16} color={colors.white} />
          <Text style={styles.newMessageButtonText}>Start New Conversation</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderDesktopDropdownContent = () => (
    <View style={styles.desktopDropdownContainer}>
      <View style={styles.desktopDropdownHeader}>
        <Text style={styles.desktopDropdownTitle}>Messages</Text>
        <TouchableOpacity
          style={styles.desktopNewMessageButton}
          onPress={() => {
            onNewConversation?.();
            setDropdownVisible(false);
          }}
        >
          <Icon name="edit" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {conversations.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          <View style={styles.desktopConversationsList}>
            {conversations.slice(0, 6).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.desktopConversationItem,
                  item.unreadCount > 0 && styles.desktopConversationItemUnread
                ]}
                onPress={() => {
                  handleConversationPress(item);
                  setDropdownVisible(false);
                  setModalVisible(true);
                }}
                activeOpacity={0.9}
              >
                <View style={styles.desktopAvatarContainer}>
                  <View style={[
                    styles.desktopAvatar,
                    { backgroundColor: getUserIconColor(item.participantType) + '20' }
                  ]}>
                    <Icon
                      name={getUserIcon(item.participantType)}
                      size={20}
                      color={getUserIconColor(item.participantType)}
                    />
                  </View>
                  {item.unreadCount > 0 && (
                    <View style={styles.desktopUnreadIndicator} />
                  )}
                </View>

                <View style={styles.desktopConversationContent}>
                  <Text style={[
                    styles.desktopParticipantName,
                    item.unreadCount > 0 && styles.desktopParticipantNameUnread
                  ]} numberOfLines={1}>
                    {item.participantName}
                  </Text>
                  <View style={styles.desktopLastMessageContainer}>
                    <Text style={[
                      styles.desktopLastMessage,
                      item.unreadCount > 0 && styles.desktopLastMessageUnread
                    ]} numberOfLines={1}>
                      {item.lastMessage.content}
                    </Text>
                    <Text style={styles.desktopTimestamp}>
                      · {formatTimestamp(item.lastMessage.timestamp)}
                    </Text>
                  </View>
                </View>

                {item.unreadCount > 0 && (
                  <View style={styles.desktopUnreadBadge}>
                    <Text style={styles.desktopUnreadBadgeText}>
                      {item.unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {conversations.length > 6 && (
            <View style={styles.desktopDropdownFooter}>
              <TouchableOpacity
                style={styles.desktopViewAllButton}
                onPress={() => {
                  setDropdownVisible(false);
                  setModalVisible(true);
                }}
              >
                <Text style={styles.desktopViewAllText}>See all in Messenger</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );

  return (
    <View style={styles.messageWrapper}>
      <View ref={buttonRef}>
        <TouchableOpacity
          style={styles.messageButton}
          onPress={handleToggleMessages}
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
      </View>

      {/* Desktop Dropdown */}
      {isDesktop && dropdownVisible && (
        <>
          <TouchableOpacity
            style={styles.dropdownBackdrop}
            activeOpacity={1}
            onPress={() => setDropdownVisible(false)}
          />
          {renderDesktopDropdownContent()}
        </>
      )}

      {/* Mobile/Tablet Modal */}
      <Modal
        visible={modalVisible}
        animationKeyframesType="slide"
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
              <View style={styles.conversationViewHeader}>
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
  messageWrapper: {
    position: 'relative',
  },

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

  // Desktop Dropdown Styles (Facebook-like)
  dropdownBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 9999,
    ...Platform.select({
      web: {},
      default: {
        position: 'absolute',
      },
    }),
  },

  desktopDropdownContainer: {
    position: 'absolute',
    top: 45,
    right: 0,
    width: 360,
    maxHeight: 500,
    backgroundColor: colors.white,
    borderRadius: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)',
      },
      default: {
        elevation: 999,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
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
  },

  desktopDropdownTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },

  desktopNewMessageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
      },
    }),
  },

  desktopConversationsList: {
    maxHeight: 384,
    paddingVertical: 8,
  },

  desktopConversationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginHorizontal: 8,
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
      },
    }),
  },

  desktopConversationItemUnread: {
    backgroundColor: colors.gray50,
  },

  desktopAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },

  desktopAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  desktopUnreadIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
  },

  desktopConversationContent: {
    flex: 1,
    paddingTop: 4,
  },

  desktopParticipantName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },

  desktopParticipantNameUnread: {
    fontWeight: '600',
  },

  desktopLastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  desktopLastMessage: {
    fontSize: 13,
    color: colors.gray600,
    flex: 1,
  },

  desktopLastMessageUnread: {
    color: colors.text,
    fontWeight: '500',
  },

  desktopTimestamp: {
    fontSize: 13,
    color: colors.gray500,
    marginLeft: 4,
  },

  desktopUnreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 8,
    marginLeft: 8,
  },

  desktopUnreadBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },

  desktopDropdownFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    paddingVertical: 8,
  },

  desktopViewAllButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  desktopViewAllText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500',
  },

  // Empty state adjustments for dropdown
  dropdownEmptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
  },

  dropdownEmptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },

  dropdownEmptyDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.gray600,
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

  conversationViewHeader: {
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