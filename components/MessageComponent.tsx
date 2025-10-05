import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
    Dimensions,
    FlatList,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Alert,
    Image
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../lib/supabase';
import { messageService, Conversation as DBConversation, Message as DBMessage } from '../services/messageService';
import ChatModal, { ChatMessage, ChatParticipant } from './ChatModal';

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
  onConversationPress?: (conversation: DBConversation) => void;
  onNewConversation?: () => void;
  currentUserId?: string;
  visible?: boolean;
}

export interface MessageComponentRef {
  openChatWithUser: (userId: string, userName: string, userType: 'farmer' | 'buyer' | 'admin') => Promise<void>;
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

const MessageComponent = forwardRef<MessageComponentRef, MessageComponentProps>(({
  onConversationPress,
  onNewConversation,
  currentUserId = 'current-user',
  visible = true,
}, ref) => {
  // Create stable unique keys for this user's state to prevent conflicts
  const userStateKey = `user_${currentUserId}`;
  const componentInstanceIdRef = useRef(`msg_comp_${currentUserId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const componentInstanceId = componentInstanceIdRef.current;

  // Reset sending state when user changes to prevent cross-user blocking
  useEffect(() => {
    sendingStateRef.current = false;
    lastSendTimeRef.current = 0;
    console.log('🔄 TWO-USER DEBUG: Reset sending state for user change:', currentUserId);
  }, [currentUserId]);

  // Cleanup all state when component unmounts
  useEffect(() => {
    return () => {
      sendingStateRef.current = false;
      lastSendTimeRef.current = 0;
      setActiveSubscriptions(new Set());
      console.log('🧹 TWO-USER DEBUG: Component cleanup for user:', currentUserId);
    };
  }, []);

  // User-isolated state with unique keys to prevent cross-user conflicts
  const [modalVisible, setModalVisible] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<DBConversation | null>(null);
  const [conversations, setConversations] = useState<DBConversation[]>([]);
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [userAvatars, setUserAvatars] = useState<{ [key: string]: string | null }>({});

  // Per-user isolated sending state using refs to prevent cross-user interference
  const sendingStateRef = useRef<boolean>(false);
  const lastSendTimeRef = useRef<number>(0);
  const [activeSubscriptions, setActiveSubscriptions] = useState<Set<string>>(new Set());
  const buttonRef = useRef<View>(null);

  // Expose methods to parent components via ref
  useImperativeHandle(ref, () => ({
    openChatWithUser: async (userId: string, userName: string, userType: 'farmer' | 'buyer' | 'admin') => {
      try {
        // Create a conversation object
        const conversation: DBConversation = {
          other_user_id: userId,
          other_user_name: userName,
          other_user_type: userType,
          last_message: '',
          last_message_at: new Date().toISOString(),
          unread_count: 0,
          last_message_sender_id: '',
          conversation_id: '',
        };

        // Use the existing handleConversationPress logic
        const realConversationId = await messageService.getOrCreateConversationId(currentUserId, userId);

        const updatedConversation = {
          ...conversation,
          conversation_id: realConversationId || ''
        };

        setSelectedConversation(updatedConversation);

        const chatData = await messageService.initializeChat(currentUserId, userId);

        if (chatData.exists) {
          setMessages(chatData.messages);
        } else {
          setMessages([]);
        }

        // Open the chat modal
        setDropdownVisible(false);
        setModalVisible(false);
        setChatModalVisible(true);

        if (onConversationPress) {
          onConversationPress(conversation);
        }
      } catch (error) {
        console.error('Error opening chat with user:', error);
      }
    }
  }), [currentUserId, onConversationPress]);

  // Load conversations on component mount
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoading(true);
        const userConversations = await messageService.getUserConversations();
        setConversations(userConversations);

        // Fetch avatars for all conversation participants
        const userIds = userConversations.map(conv => conv.other_user_id);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, avatar_url')
            .in('id', userIds);

          if (profiles) {
            const avatarsMap: { [key: string]: string | null } = {};
            profiles.forEach((profile: any) => {
              avatarsMap[profile.id] = profile.avatar_url;
            });
            setUserAvatars(avatarsMap);
          }
        }
      } catch (error) {
        console.error('❌ Error loading conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, []);

  // Load messages for selected conversation
  useEffect(() => {
    const loadMessages = async () => {
      if (selectedConversation) {
        try {
          setLoading(true);
          const conversationMessages = await messageService.getConversationMessages(selectedConversation.other_user_id);
          setMessages(conversationMessages);

          // Mark conversation as read
          await messageService.markConversationAsRead(selectedConversation.other_user_id);
        } catch (error) {
          console.error('Error loading messages:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadMessages();
  }, [selectedConversation]);

  // WORKFLOW: Subscribe to real-time updates following the exact workflow diagram
  useEffect(() => {
    if (!currentUserId || !selectedConversation) return;

    const subscriptionKey = `conv_${selectedConversation.other_user_id}_${componentInstanceId}`;

    const setupWorkflowSubscription = async () => {
      try {
        const conversationId = await messageService.getOrCreateConversationId(
          currentUserId,
          selectedConversation.other_user_id
        );

        if (!conversationId) {
          return;
        }

        // Check if this subscription is already active to prevent duplicates
        if (activeSubscriptions.has(subscriptionKey)) {
          return;
        }

        const subscription = messageService.subscribeToConversationChanges(
          conversationId,
          (message: DBMessage, type: 'INSERT' | 'UPDATE') => {
            // Add user validation to prevent cross-user message processing
            const isRelevantForThisUser = message.sender_id === currentUserId || message.receiver_id === currentUserId;
            if (!isRelevantForThisUser) {
              return;
            }

            if (type === 'INSERT') {

              // Update conversations list with new message (instant update)
              setConversations(prev => {
                const updated = [...prev];
                const otherUserId = message.sender_id === currentUserId
                  ? message.receiver_id
                  : message.sender_id;

                const convIndex = updated.findIndex(c => c.other_user_id === otherUserId);

                if (convIndex >= 0) {
                  updated[convIndex] = {
                    ...updated[convIndex],
                    last_message: message.content,
                    last_message_at: message.created_at,
                    last_message_sender_id: message.sender_id,
                    unread_count: message.receiver_id === currentUserId
                      ? updated[convIndex].unread_count + 1
                      : updated[convIndex].unread_count
                  };
                  const [conversation] = updated.splice(convIndex, 1);
                  updated.unshift(conversation);
                }

                return updated;
              });

              // Update messages list (instant update)
              setMessages(prev => {
                const exists = prev.find(m => m.id === message.id);
                if (exists) return prev;
                return [...prev, message];
              });

              // Mark as read if user received it and chat is open
              if (message.receiver_id === currentUserId && chatModalVisible) {
                setTimeout(() => messageService.markMessageAsRead(message.id), 100);
              }
            } else if (type === 'UPDATE') {
              // Handle message updates (like read status)
              setMessages(prev =>
                prev.map(m => m.id === message.id ? message : m)
              );

              // Update unread counts
              if (message.is_read && message.receiver_id === currentUserId) {
                setConversations(prev =>
                  prev.map(conv => {
                    if (conv.other_user_id === message.sender_id) {
                      return { ...conv, unread_count: Math.max(0, conv.unread_count - 1) };
                    }
                    return conv;
                  })
                );
              }
            }
          }
        );

        // Track this subscription
        setActiveSubscriptions(prev => new Set([...prev, subscriptionKey]));

        return subscription;
      } catch (error) {
        console.error('❌ WORKFLOW: Error setting up conversation subscription:', error);
      }
    };

    const subscriptionPromise = setupWorkflowSubscription();

    return () => {
      subscriptionPromise.then(subscription => {
        subscription?.unsubscribe();
        setActiveSubscriptions(prev => {
          const newSet = new Set(prev);
          newSet.delete(subscriptionKey);
          return newSet;
        });
      });
    };
  }, [currentUserId, selectedConversation?.other_user_id, chatModalVisible, componentInstanceId]);

  // Subscribe to general message changes for conversation list updates (USER-ISOLATED)
  useEffect(() => {
    if (!currentUserId) return;

    const generalSubscriptionKey = `general_${currentUserId}_${componentInstanceId}`;

    console.log('🎯 SETUP: Setting up general subscription for user:', currentUserId);
    console.log('🎯 SETUP: Subscription key:', generalSubscriptionKey);
    console.log('🎯 SETUP: Active subscriptions:', Array.from(activeSubscriptions));

    // Check for duplicate subscription
    if (activeSubscriptions.has(generalSubscriptionKey)) {
      console.log('⚠️ SETUP: Subscription already exists, skipping');
      return;
    }

    console.log('✅ SETUP: Creating new subscription');
    const subscription = messageService.subscribeToMessages(
      (message: DBMessage) => {
        console.log('🔥 CONVERSATION LIST CALLBACK: Message received in MessageComponent:', {
          messageId: message.id,
          senderId: message.sender_id,
          receiverId: message.receiver_id,
          currentUserId,
          content: message.content?.substring(0, 30)
        });

        // STRICT user validation - only process messages relevant to THIS user
        const isForThisUser = message.sender_id === currentUserId || message.receiver_id === currentUserId;
        console.log('🔥 CONVERSATION LIST CALLBACK: Is for this user?', isForThisUser);

        if (!isForThisUser) {
          console.log('❌ CONVERSATION LIST CALLBACK: Message not for this user, ignoring');
          return;
        }

        // Only update conversations list, not individual messages
        const otherUserId = message.sender_id === currentUserId
          ? message.receiver_id
          : message.sender_id;

        console.log('🔥 CONVERSATION LIST CALLBACK: Updating conversations for otherUserId:', otherUserId);

        setConversations(prev => {
          console.log('🔥 CONVERSATION LIST CALLBACK: Current conversations count:', prev.length);
          const updated = [...prev];
          const convIndex = updated.findIndex(c => c.other_user_id === otherUserId);
          console.log('🔥 CONVERSATION LIST CALLBACK: Found conversation at index:', convIndex);

          if (convIndex >= 0) {
            // Update existing conversation
            console.log('🔥 CONVERSATION LIST CALLBACK: Updating existing conversation');
            updated[convIndex] = {
              ...updated[convIndex],
              last_message: message.content,
              last_message_at: message.created_at,
              last_message_sender_id: message.sender_id,
              unread_count: message.receiver_id === currentUserId
                ? updated[convIndex].unread_count + 1
                : updated[convIndex].unread_count
            };
            const [conversation] = updated.splice(convIndex, 1);
            updated.unshift(conversation);
            console.log('🔥 CONVERSATION LIST CALLBACK: Updated conversations count:', updated.length);
          } else if (message.receiver_id === currentUserId || message.sender_id === currentUserId) {
            // Create new conversation
            const otherUserProfile = message.sender_id === currentUserId
              ? message.receiver_profile
              : message.sender_profile;

            const newConversation = {
              conversation_id: [currentUserId, otherUserId].sort().join('-'),
              other_user_id: otherUserId,
              other_user_name: `${otherUserProfile?.first_name || ''} ${otherUserProfile?.last_name || ''}`.trim() || 'Unknown User',
              other_user_type: otherUserProfile?.user_type || 'buyer',
              last_message: message.content,
              last_message_at: message.created_at,
              last_message_sender_id: message.sender_id,
              unread_count: message.receiver_id === currentUserId ? 1 : 0,
            };
            updated.unshift(newConversation);
          }

          return updated;
        });
      },
      currentUserId
    );

    console.log('✅ SETUP: Subscription created:', subscription);

    // Track this subscription
    setActiveSubscriptions(prev => {
      const newSet = new Set([...prev, generalSubscriptionKey]);
      console.log('✅ SETUP: Updated active subscriptions:', Array.from(newSet));
      return newSet;
    });

    return () => {
      console.log('🧹 CLEANUP: Unsubscribing from:', generalSubscriptionKey);
      subscription?.unsubscribe();
      setActiveSubscriptions(prev => {
        const newSet = new Set(prev);
        newSet.delete(generalSubscriptionKey);
        return newSet;
      });
    };
  }, [currentUserId, componentInstanceId]);

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

  const handleConversationPress = async (conversation: DBConversation) => {
    try {
      // Get the REAL UUID conversation ID from database
      const realConversationId = await messageService.getOrCreateConversationId(currentUserId, conversation.other_user_id);

      // Update conversation object with real UUID
      const updatedConversation = {
        ...conversation,
        conversation_id: realConversationId || conversation.conversation_id
      };

      setSelectedConversation(updatedConversation);

      // Check if conversation exists and load accordingly
      const chatData = await messageService.initializeChat(currentUserId, conversation.other_user_id);

      if (chatData.exists) {
        // Load messages for existing conversation
        setMessages(chatData.messages);

        // Mark as read since user is opening the chat
        if (conversation.unread_count > 0) {
          messageService.markConversationAsRead(conversation.other_user_id);
        }
      } else {
        // No existing conversation - will be created when first message is sent
        setMessages([]);
      }

      // Close dropdown/modal and open chat modal
      setDropdownVisible(false);
      setModalVisible(false);
      setChatModalVisible(true);

      if (onConversationPress) {
        onConversationPress(conversation);
      }

    } catch (error) {
      console.error('Error opening chat:', error);
    }
  };


  const totalUnreadCount = conversations.reduce((sum, conv) => sum + conv.unread_count, 0);

  const handleToggleMessages = () => {
    if (isDesktop) {
      setDropdownVisible(!dropdownVisible);
    } else {
      setModalVisible(true);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setDropdownVisible(false);
    setSelectedConversation(null);
  };

  const handleCloseChatModal = () => {
    setChatModalVisible(false);
    setSelectedConversation(null);
  };

  const renderConversationItem = ({ item }: { item: DBConversation }) => (
    <TouchableOpacity
      style={[
        styles.conversationItem,
        item.unread_count > 0 && styles.conversationItemUnread
      ]}
      onPress={() => handleConversationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <View style={[
          styles.avatar,
          { backgroundColor: getUserIconColor(item.other_user_type) + '20' }
        ]}>
          {userAvatars[item.other_user_id] ? (
            <Image
              source={{ uri: userAvatars[item.other_user_id]! }}
              style={styles.conversationAvatarImage}
            />
          ) : (
            <Icon
              name={getUserIcon(item.other_user_type)}
              size={16}
              color={getUserIconColor(item.other_user_type)}
            />
          )}
        </View>
        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {item.unread_count > 9 ? '9+' : item.unread_count}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={[
            styles.participantName,
            item.unread_count > 0 && styles.participantNameUnread
          ]}>
            {item.other_user_name}
          </Text>
          <Text style={styles.timestamp}>
            {formatTimestamp(item.last_message_at)}
          </Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.last_message_sender_id === currentUserId ? (
            <>
              <Text style={styles.lastMessagePrefix}>You: </Text>
              {item.last_message}
            </>
          ) : (
            <>
              <Text style={styles.lastMessagePrefix}>{item.other_user_name}: </Text>
              {item.last_message}
            </>
          )}
        </Text>
      </View>
    </TouchableOpacity>
  );


  const renderEmptyState = () => {
    return (
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
  };

  const renderDesktopDropdownContent = () => {
    return (
      <View style={styles.desktopDropdownContainer}>
        <View style={styles.desktopDropdownHeader}>
          <Text style={styles.desktopDropdownTitle}>Messages</Text>
          <View style={styles.desktopHeaderActions}>
            <TouchableOpacity
              style={styles.desktopNewMessageButton}
              onPress={() => {
                onNewConversation?.();
                setDropdownVisible(false);
              }}
            >
              <Icon name="edit" size={14} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.desktopCloseButton}
              onPress={handleCloseModal}
            >
              <Icon name="times" size={14} color={colors.gray600} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.desktopDropdownScrollContainer}
          showsVerticalScrollIndicator={true}
        >
          {conversations.length === 0 ? (
            renderEmptyState()
          ) : (
            <View style={styles.desktopConversationsList}>
              {conversations.map((item) => (
                <TouchableOpacity
                  key={item.conversation_id}
                  style={[
                    styles.desktopConversationItem,
                    item.unread_count > 0 && styles.desktopConversationItemUnread
                  ]}
                  onPress={() => handleConversationPress(item)}
                  activeOpacity={0.9}
                >
                  <View style={styles.desktopAvatarContainer}>
                    <View style={[
                      styles.desktopAvatar,
                      { backgroundColor: getUserIconColor(item.other_user_type) + '20' }
                    ]}>
                      {userAvatars[item.other_user_id] ? (
                        <Image
                          source={{ uri: userAvatars[item.other_user_id]! }}
                          style={styles.desktopAvatarImage}
                        />
                      ) : (
                        <Icon
                          name={getUserIcon(item.other_user_type)}
                          size={20}
                          color={getUserIconColor(item.other_user_type)}
                        />
                      )}
                    </View>
                    {item.unread_count > 0 && (
                      <View style={styles.desktopUnreadIndicator} />
                    )}
                  </View>

                  <View style={styles.desktopConversationContent}>
                    <Text style={[
                      styles.desktopParticipantName,
                      item.unread_count > 0 && styles.desktopParticipantNameUnread
                    ]} numberOfLines={1}>
                      {item.other_user_name}
                    </Text>
                    <View style={styles.desktopLastMessageContainer}>
                      <Text style={[
                        styles.desktopLastMessage,
                        item.unread_count > 0 && styles.desktopLastMessageUnread
                      ]} numberOfLines={1}>
                        {item.last_message_sender_id === currentUserId ? (
                          <>
                            <Text style={styles.desktopLastMessagePrefix}>You: </Text>
                            {item.last_message}
                          </>
                        ) : (
                          <>
                            <Text style={styles.desktopLastMessagePrefix}>{item.other_user_name}: </Text>
                            {item.last_message}
                          </>
                        )}
                      </Text>
                      <Text style={styles.desktopTimestamp}>
                        · {formatTimestamp(item.last_message_at)}
                      </Text>
                    </View>
                  </View>

                  {item.unread_count > 0 && (
                    <View style={styles.desktopUnreadBadge}>
                      <Text style={styles.desktopUnreadBadgeText}>
                        {item.unread_count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.messageWrapper}>
      {/* Header Message Button */}
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
        animationKeyframesType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          {/* Conversations List View Only */}
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
                onPress={handleCloseModal}
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
              keyExtractor={(item) => item.conversation_id}
              style={styles.conversationsList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </Modal>

      {/* Chat Modal */}
      {selectedConversation && (
        <ChatModal
          visible={chatModalVisible}
          onClose={handleCloseChatModal}
          participant={{
            id: selectedConversation.other_user_id,
            name: selectedConversation.other_user_name,
            type: selectedConversation.other_user_type,
            isOnline: false,
            avatarUrl: userAvatars[selectedConversation.other_user_id] || null,
          }}
          messages={messages.map((msg): ChatMessage => ({
            id: msg.id,
            senderId: msg.sender_id,
            senderName: `${msg.sender_profile?.first_name || ''} ${msg.sender_profile?.last_name || ''}`.trim() || 'User',
            senderType: msg.sender_profile?.user_type || 'buyer',
            content: msg.content,
            timestamp: msg.created_at,
            read: msg.is_read,
          }))}
          conversationId={selectedConversation.conversation_id}
          onSendMessage={async (content: string) => {
            const now = Date.now();
            const timeSinceLastSend = now - lastSendTimeRef.current;
            const minSendInterval = 1000; // 1 second minimum between sends

            console.log('🚀 TWO-USER DEBUG: Send attempt by user:', currentUserId, {
              sendingMessage: sendingStateRef.current,
              timeSinceLastSend,
              minSendInterval,
              componentInstanceId: componentInstanceId.substring(0, 15) + '...'
            });

            if (sendingStateRef.current) {
              console.log('⏳ TWO-USER DEBUG: Blocked - already sending message for user:', currentUserId);
              return;
            }

            if (timeSinceLastSend < minSendInterval) {
              console.log('⏳ TWO-USER DEBUG: Blocked - rate limit for user:', currentUserId, 'wait:', minSendInterval - timeSinceLastSend, 'ms');
              // Allow bypass if it's been too long (prevents permanent blocking)
              if (timeSinceLastSend > 5000) {
                console.log('🔄 TWO-USER DEBUG: Bypassing old rate limit for user:', currentUserId);
                lastSendTimeRef.current = 0;
              } else {
                return;
              }
            }

            try {
              sendingStateRef.current = true;
              lastSendTimeRef.current = now;

              let newMessage;
              try {
                newMessage = await messageService.sendMessage({
                  receiverId: selectedConversation.other_user_id,
                  content: content.trim(),
                });

              } catch (serviceError) {
                console.error('Error sending message:', serviceError);
                throw serviceError;
              }

              if (!newMessage) {
                Alert.alert('Error', 'Failed to send message. Please try again.');
                return;
              }

            } catch (error) {
              console.error('Error sending message:', error);
              Alert.alert('Error', 'Failed to send message. Please check your connection.');
            } finally {
              // Always clear sending state to prevent blocking
              sendingStateRef.current = false;
              console.log('✅ TWO-USER DEBUG: Cleared sending state for user:', currentUserId);
            }
          }}
          currentUserId={currentUserId}
          loading={loading || sendingStateRef.current}
        />
      )}
    </View>
  );
});

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
    top: 45,
    right: 0,
    zIndex: 9999,
  },

  desktopDropdownContainer: {
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

  desktopDropdownScrollContainer: {
    maxHeight: 420,
    minHeight: 200,
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
    flex: 1,
  },

  desktopHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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

  desktopCloseButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
    overflow: 'hidden',
  },

  desktopAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
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

  desktopLastMessagePrefix: {
    fontWeight: '600',
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
    overflow: 'hidden',
  },

  conversationAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
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

  lastMessagePrefix: {
    fontWeight: '600',
    color: colors.gray700,
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

MessageComponent.displayName = 'MessageComponent';

export default MessageComponent;