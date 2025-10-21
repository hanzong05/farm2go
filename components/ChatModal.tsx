import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';
import * as ImagePicker from 'expo-image-picker';
import { messageService } from '../services/messageService';
import { supabase } from '../lib/supabase';
import { fileUploadService } from '../services/fileUploadService';

const { width } = Dimensions.get('window');
const isDesktop = width >= 1024;

// Performant emoji categories
const EMOJI_CATEGORIES = {
  'Smileys': ['😊', '😂', '🤣', '😍', '🥰', '😘', '😗', '😙', '😚', '☺️', '😌', '😉', '🤗', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩', '🤯', '😬', '😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '😡', '😠', '🤬', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '😇', '🤠', '🤡', '🥳', '🥴', '🥺', '🤥', '🤫', '🤭', '🧐', '🤓', '😈', '👿', '👹', '👺', '💀', '☠️', '👻', '👽', '👾', '🤖', '💩'],
  'Gestures': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'],
  'Animals': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️'],
  'Food': ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥡', '🦪', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯'],
  'Activities': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾', '🏌️', '🏇', '🧘', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩'],
  'Travel': ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚦', '🚥', '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕', '🕋'],
  'Objects': ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '🧾', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪒', '🧽', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🖼️', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓'],
  'Symbols': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⚛️', '🕉️', '✡️', '☸️', '☯️', '✝️', '☦️', '☪️', '☮️', '🕎', '🔯', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '⛎', '🔀', '🔁', '🔂', '▶️', '⏩', '⏭️', '⏯️', '◀️', '⏪', '⏮️', '🔼', '⏫', '🔽', '⏬', '⏸️', '⏹️', '⏺️', '⏏️', '🎦', '🔅', '🔆', '📶', '📳', '📴', '♀️', '♂️', '⚧️', '✖️', '➕', '➖', '➗', '♾️', '‼️', '⁉️', '❓', '❔', '❕', '❗', '〰️', '💱', '💲', '⚕️', '♻️', '⚜️', '🔱', '📛', '🔰', '⭕', '✅', '☑️', '✔️', '❌', '❎', '➰', '➿', '〽️', '✳️', '✴️', '❇️', '©️', '®️', '™️', '#️⃣', '*️⃣', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔠', '🔡', '🔢', '🔣', '🔤', '🅰️', '🆎', '🅱️', '🆑', '🆒', '🆓', 'ℹ️', '🆔', 'Ⓜ️', '🆕', '🆖', '🅾️', '🆗', '🅿️', '🆘', '🆙', '🆚', '🈁', '🈂️', '🈷️', '🈶', '🈯', '🉐', '🈹', '🈚', '🈲', '🉑', '🈸', '🈴', '🈳', '㊗️', '㊙️', '🈺', '🈵', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤', '⚫', '⚪', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬛', '⬜', '◼️', '◻️', '◾', '◽', '▪️', '▫️', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔳', '🔲'],
};

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
  avatarUrl?: string | null;
}

interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
  participant: ChatParticipant;
  messages: ChatMessage[];
  onSendMessage?: (content: string) => void;
  currentUserId?: string;
  loading?: boolean;
  conversationId?: string;
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
  conversationId,
}: ChatModalProps) {
  // Debug conversation setup
  console.log('🚨 CHATMODAL DEBUG: Component props:', {
    visible,
    currentUserId,
    participantId: participant.id,
    participantName: participant.name,
    conversationId,
    messagesCount: messages.length
  });
  const [messageText, setMessageText] = useState('');
  const [workflowStatus, setWorkflowStatus] = useState('initializing');
  const [conversationExists, setConversationExists] = useState(false);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>(messages);
  const [participantAvatar, setParticipantAvatar] = useState<string | null>(participant.avatarUrl || null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>('Smileys');
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedImageMessage, setSelectedImageMessage] = useState<ChatMessage | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [messageOffset, setMessageOffset] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Update local messages when props change - merge intelligently to preserve all messages
  useEffect(() => {
    setLocalMessages(prev => {
      // If there are no previous messages, just use the new ones
      if (prev.length === 0) {
        return messages;
      }

      // Create a map of all messages by ID
      const messageMap = new Map();

      // First, add all existing messages (including real-time ones we just received)
      prev.forEach(m => messageMap.set(m.id, m));

      // Then add/update with messages from props
      messages.forEach(m => {
        // Only update if this message is not a temp message we're waiting to replace
        const existing = messageMap.get(m.id);
        if (!existing || !existing.id.startsWith('temp_')) {
          messageMap.set(m.id, m);
        }
      });

      // Remove temp messages that now have real counterparts with same content
      const finalMessages = Array.from(messageMap.values()).filter(m => {
        if (!m.id.startsWith('temp_')) return true;
        // Keep temp message only if no real message with same content exists
        return !Array.from(messageMap.values()).some(
          other => !other.id.startsWith('temp_') && other.content === m.content
        );
      });

      // Sort by timestamp
      const sorted = finalMessages.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      return sorted;
    });
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (localMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [localMessages.length]);

  // Fetch user avatars
  useEffect(() => {
    const fetchAvatars = async () => {
      try {
        // Fetch participant avatar if not provided
        if (!participant.avatarUrl && participant.id) {
          const { data } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', participant.id)
            .single();

          if (data && (data as any).avatar_url) {
            setParticipantAvatar((data as any).avatar_url);
          }
        }

        // Fetch current user avatar
        if (currentUserId) {
          const { data } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', currentUserId)
            .single();

          if (data && (data as any).avatar_url) {
            setCurrentUserAvatar((data as any).avatar_url);
          }
        }
      } catch (error) {
        console.error('Error fetching avatars:', error);
      }
    };

    if (visible) {
      fetchAvatars();
    }
  }, [visible, participant.id, participant.avatarUrl, currentUserId]);

  // WORKFLOW: When chat modal opens, implement the exact workflow diagram
  useEffect(() => {
    if (visible && participant.id) {
      initializeWorkflowChat();
    }
  }, [visible, participant.id, currentUserId]);

  // Direct real-time subscription for instant message updates
  useEffect(() => {
    if (!visible || !conversationId) {
      console.log('❌ REALTIME: Cannot set up subscription - missing requirements:', {
        visible,
        conversationId,
        currentUserId,
        participantId: participant.id
      });
      return;
    }

    console.log('🔥 ChatModal: Setting up SIMPLIFIED real-time subscription for:', {
      conversationId,
      currentUserId,
      participantId: participant.id
    });

    const { supabase } = require('../lib/supabase');

    // First check if supabase is properly connected
    console.log('🔍 REALTIME: Checking Supabase connection...');

    // Use a consistent channel name (no timestamp to avoid conflicts)
    const channelName = `chat_realtime_${conversationId}`;
    console.log('📡 REALTIME: Creating channel:', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: any) => {
          console.log('🚨 DIRECT REALTIME: New message detected in conversation:', conversationId);
          console.log('🚨 DIRECT REALTIME: Message details:', {
            messageId: payload.new?.id,
            content: payload.new?.content,
            senderId: payload.new?.sender_id,
            receiverId: payload.new?.receiver_id,
            currentUserId,
            participantId: participant.id
          });

          const newMessage = payload.new;

          // Check if this message is relevant to this chat
          const isForThisChat = newMessage.sender_id === currentUserId ||
                               newMessage.receiver_id === currentUserId ||
                               newMessage.sender_id === participant.id ||
                               newMessage.receiver_id === participant.id;

          console.log('🚨 DIRECT REALTIME: Is message for this chat?', isForThisChat);

          if (!isForThisChat) {
            console.log('🚫 REALTIME: Message not for this chat, ignoring');
            return;
          }

          // Convert to ChatMessage format immediately
          const chatMessage: ChatMessage = {
            id: newMessage.id,
            senderId: newMessage.sender_id,
            senderName: newMessage.sender_id === currentUserId ? 'You' : participant.name,
            senderType: newMessage.sender_id === currentUserId ? 'farmer' : participant.type,
            content: newMessage.content,
            timestamp: newMessage.created_at,
            read: newMessage.is_read || false,
          };

          console.log('🚨 DIRECT REALTIME: Adding message to UI immediately for user:', currentUserId);

          // Force immediate UI update
          setLocalMessages(prev => {
            console.log('🚨 DIRECT REALTIME: Current messages before update:', prev.length);

            const exists = prev.find(m => m.id === chatMessage.id);
            if (exists) {
              console.log('🚨 DIRECT REALTIME: Message already exists, skipping');
              return prev;
            }

            // Remove temp messages with same content
            const filtered = prev.filter(m =>
              !(m.id.startsWith('temp_') && m.content === chatMessage.content)
            );

            const updated = [...filtered, chatMessage];
            console.log('🚨 DIRECT REALTIME: Messages after update:', updated.length);
            return updated;
          });
        }
      )
      .subscribe((status) => {
        console.log('🚨 DIRECT REALTIME: Subscription status for', conversationId, ':', status);
      });

    return () => {
      console.log('🔌 ChatModal: Cleaning up direct subscription for:', conversationId);
      channel.unsubscribe();
    };
  }, [visible, conversationId, currentUserId, participant.id, participant.name, participant.type]);

  const initializeWorkflowChat = async () => {
    try {
      console.log('┌─────────────────────┐');
      console.log('│ User opens a chat   │');
      console.log('└──────────┬──────────┘');
      setWorkflowStatus('User opened chat');

      console.log('            │');
      console.log('            ▼');
      console.log(' ┌─────────────────────────────┐');
      console.log(' │ Does conversation exist?    │');
      console.log(' └──────────┬──────────┬───────┘');
      setWorkflowStatus('Checking if conversation exists...');

      // Reset pagination state
      setMessageOffset(0);
      setHasMoreMessages(true);

      // Check if conversation exists
      const chatData = await messageService.initializeChat(currentUserId, participant.id);

      if (chatData.exists && chatData.conversationId) {
        console.log('            │ Yes');
        console.log('            ▼');
        console.log(' ┌─────────────────┐');
        console.log(' │ Load existing   │');
        console.log(' │ conversation    │');
        console.log(' └──────────┬──────┘');
        setWorkflowStatus('Loading existing conversation');
        setConversationExists(true);

        // Check if there are more messages beyond the initial load
        if (chatData.messages.length < 20) {
          setHasMoreMessages(false);
        }
      } else {
        console.log('                       │ No');
        console.log('                       ▼');
        console.log(' ┌────────────────────────┐');
        console.log(' │ Create conversation    │');
        console.log(' │ automatically (trigger)│');
        console.log(' └──────────┬─────────────┘');
        setWorkflowStatus('Will create conversation automatically');
        setConversationExists(false);
      }

      console.log('            │');
      console.log('            ▼');
      console.log('     ┌────────────────────────────────┐');
      console.log('     │ Ready for user to send message │');
      console.log('     └────────────────────────────────┘');
      setWorkflowStatus('Ready to send messages');

    } catch (error) {
      console.error('❌ Error in workflow initialization:', error);
      setWorkflowStatus('Error initializing chat');
    }
  };

  // Load older messages
  const loadMoreMessages = async () => {
    if (loadingMore || !hasMoreMessages) {
      return;
    }

    try {
      setLoadingMore(true);
      console.log('📥 Loading more messages...');

      const newOffset = messageOffset + 20;
      const olderMessages = await messageService.getConversationMessages(
        participant.id,
        20,
        newOffset
      );

      console.log(`📥 Loaded ${olderMessages.length} older messages`);

      if (olderMessages.length === 0) {
        setHasMoreMessages(false);
        console.log('📭 No more messages to load');
      } else {
        // Convert to ChatMessage format and prepend to existing messages
        const convertedMessages = olderMessages.map(msg => ({
          id: msg.id,
          senderId: msg.sender_id,
          senderName: msg.sender_id === currentUserId
            ? 'You'
            : `${msg.sender_profile?.first_name || ''} ${msg.sender_profile?.last_name || ''}`.trim() || participant.name,
          senderType: msg.sender_profile?.user_type as 'farmer' | 'buyer' | 'admin' || 'buyer',
          content: msg.content,
          timestamp: msg.created_at,
          read: msg.is_read,
        }));

        setLocalMessages(prev => [...convertedMessages, ...prev]);
        setMessageOffset(newOffset);

        if (olderMessages.length < 20) {
          setHasMoreMessages(false);
        }
      }
    } catch (error) {
      console.error('❌ Error loading more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  };

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

  const handleSendMessage = async () => {
    console.log('🔥 WORKFLOW: ChatModal handleSendMessage called');

    if (messageText.trim()) {
      const textToSend = messageText.trim();

      // WORKFLOW Step: User sends a message
      console.log('     ┌────────────────────────────────┐');
      console.log('     │ User sends a message           │');
      console.log('     └──────────┬─────────────────────┘');
      setWorkflowStatus('User sending message...');

      // Clear input immediately to prevent double-sending
      setMessageText('');

      if (onSendMessage) {
        try {
          // Add message instantly to sender's view
          const tempMessage: ChatMessage = {
            id: `temp_${Date.now()}`,
            senderId: currentUserId,
            senderName: 'You',
            senderType: 'farmer', // This will be updated by real-time
            content: textToSend,
            timestamp: new Date().toISOString(),
            read: false,
          };

          setLocalMessages(prev => [...prev, tempMessage]);

          await onSendMessage(textToSend);

          // WORKFLOW Step: Message stored in database
          console.log('                │');
          console.log('                ▼');
          console.log('     ┌────────────────────────────────┐');
          console.log('     │ Message stored in database      │');
          console.log('     │ (with conversation ID, sender, │');
          console.log('     │ receiver, content, timestamp)  │');
          console.log('     └──────────┬─────────────────────┘');
          setWorkflowStatus('Message stored in database');

          // WORKFLOW Step: Database broadcasts to users
          console.log('                │');
          console.log('                ▼');
          console.log('     ┌───────────────────────────────┐');
          console.log('     │ Database broadcasts new       │');
          console.log('     │ message to conversation users │');
          console.log('     └──────────┬────────────────────┘');
          setWorkflowStatus('Broadcasting to users...');

          // Update conversation status if this was the first message
          if (!conversationExists) {
            setConversationExists(true);
            setWorkflowStatus('Conversation created automatically');
          } else {
            setWorkflowStatus('Ready to send messages');
          }

          console.log('✅ WORKFLOW: Message sent successfully');
        } catch (error) {
          console.error('❌ WORKFLOW: Message sending failed:', error);
          setWorkflowStatus('Error sending message');
          // Restore message text on error so user can retry
          setMessageText(textToSend);
        }
      } else {
        console.log('❌ WORKFLOW: No onSendMessage callback provided');
        setWorkflowStatus('Error: No send callback');
        setMessageText(textToSend);
      }
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleFileUpload = async (fileUri: string, fileName: string, mimeType: string) => {
    try {
      // Show uploading message
      Alert.alert('Uploading', 'Please wait while we upload your file...');

      // Check file size
      const isValid = await fileUploadService.isFileSizeValid(fileUri);
      if (!isValid) {
        Alert.alert('File Too Large', 'File size must be less than 50MB');
        return;
      }

      // Upload file
      const uploadedFile = await fileUploadService.uploadFile(
        fileUri,
        fileName,
        mimeType,
        currentUserId
      );

      // Send message with file attachment
      const fileMessage = `📎 ${uploadedFile.name}\n${uploadedFile.url}`;

      if (onSendMessage) {
        onSendMessage(fileMessage);
        Alert.alert('Success', 'File uploaded and sent successfully!');
      }
    } catch (error) {
      console.error('File upload error:', error);
      Alert.alert('Upload Failed', 'Failed to upload file. Please try again.');
    }
  };

  const handleAttachment = async () => {
    Alert.alert(
      'Add Attachment',
      'Choose attachment type',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Camera permission is required to take photos');
              return;
            }

            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0];
              await handleFileUpload(
                asset.uri,
                asset.fileName || `photo_${Date.now()}.jpg`,
                asset.mimeType || 'image/jpeg'
              );
            }
            setShowAttachmentMenu(false);
          },
        },
        {
          text: 'Choose Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Photo library permission is required');
              return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0];
              await handleFileUpload(
                asset.uri,
                asset.fileName || `image_${Date.now()}.jpg`,
                asset.mimeType || 'image/jpeg'
              );
            }
            setShowAttachmentMenu(false);
          },
        },
        {
          text: 'Choose Document',
          onPress: () => {
            Alert.alert(
              'Document Upload',
              'Document upload requires a full app rebuild. For now, please use the photo options to share images and screenshots of documents.',
              [{ text: 'OK' }]
            );
            setShowAttachmentMenu(false);
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setShowAttachmentMenu(false),
        },
      ]
    );
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

  // Helper to detect if message contains an image URL
  const parseMessageContent = (content: string) => {
    // Check if message starts with file attachment emoji and contains URL
    const attachmentPattern = /📎\s*(.+)\n(https?:\/\/.+)/;
    const match = content.match(attachmentPattern);

    if (match) {
      const fileName = match[1];
      const fileUrl = match[2];

      // Check if it's an image URL
      const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(fileUrl);

      return {
        type: isImage ? 'image' : 'file',
        fileName,
        fileUrl,
      };
    }

    return { type: 'text', content };
  };

  // Handle image tap to view full screen
  const handleImagePress = (message: ChatMessage, imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setSelectedImageMessage(message);
    setImageViewerVisible(true);
  };

  // Handle image long press for save/delete options
  const handleImageLongPress = async (message: ChatMessage, imageUrl: string, filePath: string) => {
    const isOwn = message.senderId === currentUserId;

    if (Platform.OS === 'web') {
      // For web, show options based on ownership
      const options = isOwn
        ? [
            { text: 'Delete Image', onPress: () => handleDeleteMessage(message, filePath) },
            { text: 'Cancel', style: 'cancel' as const }
          ]
        : [
            { text: 'Open in New Tab', onPress: () => {
              const { Linking } = require('react-native');
              Linking.openURL(imageUrl);
            }},
            { text: 'Cancel', style: 'cancel' as const }
          ];

      Alert.alert('Image Options', '', options);
    } else {
      // For mobile, show save and delete options
      const options = [
        {
          text: 'Save to Photos',
          onPress: () => handleSaveImage(imageUrl)
        },
        ...(isOwn ? [{
          text: 'Delete Image',
          onPress: () => handleDeleteMessage(message, filePath),
          style: 'destructive' as const
        }] : []),
        {
          text: 'Cancel',
          style: 'cancel' as const
        }
      ];

      Alert.alert('Image Options', 'What would you like to do?', options);
    }
  };

  // Save image to device
  const handleSaveImage = async (imageUrl: string) => {
    try {
      if (Platform.OS === 'web') {
        // For web, download via link
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `image_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Alert.alert('Success', 'Image downloaded to your Downloads folder');
      } else {
        // For mobile, need to request permissions and save
        Alert.alert('Save Image', 'This feature requires expo-media-library. Please install it first or use screenshot instead.');
      }
    } catch (error) {
      console.error('Error saving image:', error);
      Alert.alert('Error', 'Failed to save image. Please try again.');
    }
  };

  // Delete message and file from storage
  const handleDeleteMessage = async (message: ChatMessage, filePath: string) => {
    try {
      Alert.alert(
        'Delete Image',
        'Are you sure you want to delete this image? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                // Delete file from storage
                const filePathFromUrl = filePath || extractFilePathFromUrl(message.content);
                if (filePathFromUrl) {
                  await fileUploadService.deleteFile(filePathFromUrl);
                }

                // Delete message from database
                const { error } = await supabase
                  .from('messages')
                  .delete()
                  .eq('id', message.id);

                if (error) {
                  throw error;
                }

                // Remove from local state
                setLocalMessages(prev => prev.filter(m => m.id !== message.id));

                Alert.alert('Success', 'Image deleted successfully');
              } catch (error) {
                console.error('Error deleting message:', error);
                Alert.alert('Error', 'Failed to delete image. Please try again.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in delete handler:', error);
    }
  };

  // Extract file path from message content
  const extractFilePathFromUrl = (content: string): string | null => {
    const parsed = parseMessageContent(content);
    if ((parsed.type === 'image' || parsed.type === 'file') && parsed.fileUrl) {
      // Extract path from Supabase URL
      // URL format: https://.../storage/v1/object/public/chat-attachments/userId/timestamp_filename
      const urlMatch = parsed.fileUrl.match(/chat-attachments\/(.+)$/);
      return urlMatch ? urlMatch[1] : null;
    }
    return null;
  };

  const renderMessageItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isOwn = item.senderId === currentUserId;
    const nextMessage = localMessages[index + 1];
    const showAvatar = !nextMessage || nextMessage.senderId !== item.senderId;
    const showTimestamp = index === 0 ||
      new Date(item.timestamp).getTime() - new Date(localMessages[index - 1]?.timestamp || 0).getTime() > 300000; // 5 minutes

    const parsedContent = parseMessageContent(item.content);

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
                {participantAvatar ? (
                  <Image
                    source={{ uri: participantAvatar }}
                    style={styles.messageAvatarImage}
                  />
                ) : (
                  <Icon
                    name={getUserIcon(item.senderType)}
                    size={16}
                    color={getUserIconColor(item.senderType)}
                  />
                )}
              </View>
            </View>
          )}

          {!isOwn && !showAvatar && (
            <View style={styles.avatarSpacer} />
          )}

          {/* Render based on content type */}
          {parsedContent.type === 'image' ? (
            <TouchableOpacity
              onPress={() => handleImagePress(item, parsedContent.fileUrl || '')}
              onLongPress={() => handleImageLongPress(item, parsedContent.fileUrl || '', extractFilePathFromUrl(item.content) || '')}
              activeOpacity={0.9}
              delayLongPress={500}
            >
              <Image
                source={{ uri: parsedContent.fileUrl }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : (
            <View style={[
              styles.messageBubble,
              isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther
            ]}>
              {!isOwn && showAvatar && (
                <Text style={styles.senderName}>{item.senderName}</Text>
              )}

              {parsedContent.type === 'file' ? (
                <TouchableOpacity onPress={() => {
                  Alert.alert('Download File', `Open ${parsedContent.fileName}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open', onPress: () => {
                      // Open URL in browser
                      const { Linking } = require('react-native');
                      Linking.openURL(parsedContent.fileUrl);
                    }}
                  ]);
                }}>
                  <View style={styles.fileAttachment}>
                    <Icon name="file" size={24} color={isOwn ? colors.white : colors.primary} />
                    <Text style={[
                      styles.fileName,
                      isOwn ? styles.fileNameOwn : styles.fileNameOther
                    ]}>
                      {parsedContent.fileName}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <Text style={[
                  styles.messageText,
                  isOwn ? styles.messageTextOwn : styles.messageTextOther
                ]}>
                  {parsedContent.content}
                </Text>
              )}
            </View>
          )}
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
          {participantAvatar ? (
            <Image
              source={{ uri: participantAvatar }}
              style={styles.emptyAvatarImage}
            />
          ) : (
            <Icon
              name={getUserIcon(participant.type)}
              size={32}
              color={getUserIconColor(participant.type)}
            />
          )}
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
      transparent={isDesktop}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: isDesktop ? 'transparent' : '#000' }} edges={['bottom']}>
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
                  {participantAvatar ? (
                    <Image
                      source={{ uri: participantAvatar }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Icon
                      name={getUserIcon(participant.type)}
                      size={20}
                      color={getUserIconColor(participant.type)}
                    />
                  )}
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
                  <Text style={styles.workflowStatusText}>
                    {workflowStatus}
                  </Text>
                </View>
              </View>

            </View>

            {/* Messages Area */}
            <View style={styles.messagesContainer}>
              {localMessages.length === 0 ? (
                renderEmptyState()
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={localMessages}
                  renderItem={renderMessageItem}
                  keyExtractor={(item) => item.id}
                  style={styles.messagesList}
                  contentContainerStyle={styles.messagesContent}
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                  ListHeaderComponent={
                    hasMoreMessages ? (
                      <TouchableOpacity
                        style={styles.loadMoreButton}
                        onPress={loadMoreMessages}
                        disabled={loadingMore}
                      >
                        {loadingMore ? (
                          <Text style={styles.loadMoreText}>Loading...</Text>
                        ) : (
                          <Text style={styles.loadMoreText}>Load older messages</Text>
                        )}
                      </TouchableOpacity>
                    ) : localMessages.length >= 20 ? (
                      <View style={styles.loadMoreButton}>
                        <Text style={[styles.loadMoreText, styles.loadMoreTextDisabled]}>
                          No more messages
                        </Text>
                      </View>
                    ) : null
                  }
                />
              )}
            </View>

            {/* Message Input */}
            <View style={styles.inputContainer}>
              {/* Emoji Picker */}
              {showEmojiPicker && (
                <View style={styles.emojiPickerContainer}>
                  {/* Category Tabs */}
                  <View style={styles.emojiCategoryTabs}>
                    {Object.keys(EMOJI_CATEGORIES).map((category) => (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.emojiCategoryTab,
                          selectedEmojiCategory === category && styles.emojiCategoryTabActive
                        ]}
                        onPress={() => setSelectedEmojiCategory(category)}
                      >
                        <Text style={[
                          styles.emojiCategoryTabText,
                          selectedEmojiCategory === category && styles.emojiCategoryTabTextActive
                        ]}>
                          {category}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Emoji Grid - Using FlatList for performance */}
                  <FlatList
                    data={EMOJI_CATEGORIES[selectedEmojiCategory as keyof typeof EMOJI_CATEGORIES]}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.emojiItem}
                        onPress={() => handleEmojiSelect(item)}
                      >
                        <Text style={styles.emojiText}>{item}</Text>
                      </TouchableOpacity>
                    )}
                    keyExtractor={(item, index) => `${item}-${index}`}
                    numColumns={8}
                    contentContainerStyle={styles.emojiGridContent}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={40}
                    maxToRenderPerBatch={20}
                    windowSize={5}
                    removeClippedSubviews={true}
                  />
                </View>
              )}

              <View style={styles.inputWrapper}>
                <TouchableOpacity
                  style={styles.attachButton}
                  onPress={handleAttachment}
                  activeOpacity={0.7}
                >
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

                <TouchableOpacity
                  style={styles.emojiButton}
                  onPress={() => setShowEmojiPicker(!showEmojiPicker)}
                  activeOpacity={0.7}
                >
                  <Icon name="smile" size={18} color={showEmojiPicker ? colors.secondary : colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    messageText.trim() && !loading ? styles.sendButtonActive : styles.sendButtonInactive
                  ]}
                  onPress={handleSendMessage}
                  disabled={!messageText.trim() || loading}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={loading ? "spinner" : "paper-plane"}
                    size={16}
                    color={messageText.trim() && !loading ? colors.white : colors.gray400}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Full-Screen Image Viewer Modal */}
      {imageViewerVisible && selectedImageUrl && selectedImageMessage && (
        <Modal
          visible={imageViewerVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setImageViewerVisible(false)}
        >
          <View style={styles.imageViewerContainer}>
            {/* Header with close and options */}
            <View style={styles.imageViewerHeader}>
              <TouchableOpacity
                style={styles.imageViewerCloseButton}
                onPress={() => setImageViewerVisible(false)}
              >
                <Icon name="times" size={24} color={colors.white} />
              </TouchableOpacity>

              <View style={styles.imageViewerHeaderRight}>
                <TouchableOpacity
                  style={styles.imageViewerActionButton}
                  onPress={() => handleSaveImage(selectedImageUrl)}
                >
                  <Icon name="download" size={20} color={colors.white} />
                </TouchableOpacity>

                {selectedImageMessage.senderId === currentUserId && (
                  <TouchableOpacity
                    style={styles.imageViewerActionButton}
                    onPress={() => {
                      setImageViewerVisible(false);
                      handleDeleteMessage(selectedImageMessage, extractFilePathFromUrl(selectedImageMessage.content) || '');
                    }}
                  >
                    <Icon name="trash" size={20} color={colors.white} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Full-screen image */}
            <View style={styles.imageViewerContent}>
              <Image
                source={{ uri: selectedImageUrl }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            </View>

            {/* Footer with timestamp and sender */}
            <View style={styles.imageViewerFooter}>
              <Text style={styles.imageViewerSender}>
                {selectedImageMessage.senderName}
              </Text>
              <Text style={styles.imageViewerTimestamp}>
                {formatTimestamp(selectedImageMessage.timestamp)}
              </Text>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: isDesktop ? 'flex-end' : 'flex-start',
    alignItems: isDesktop ? 'flex-end' : 'stretch',
    paddingRight: isDesktop ? 20 : 0,
    paddingBottom: isDesktop ? 20 : 0,
    pointerEvents: isDesktop ? 'box-none' : 'auto',
  },

  modalContainer: {
    flex: isDesktop ? 0 : 1,
    backgroundColor: colors.white,
    width: isDesktop ? 350 : '100%',
    height: isDesktop ? 500 : '100%',
    minWidth: isDesktop ? 350 : undefined,
    minHeight: isDesktop ? 500 : undefined,
  },

  modalContainerDesktop: {
    width: 350,
    height: 500,
    minWidth: 350,
    minHeight: 500,
    borderRadius: 8,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        border: '1px solid #e1e5e9',
      },
      default: {
        elevation: 8,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
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
    overflow: 'hidden',
  },

  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
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

  workflowStatusText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
    marginTop: 2,
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
    overflow: 'hidden',
  },

  messageAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
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

  // Message Image Styles
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },

  imageCaption: {
    fontSize: 12,
    marginTop: 4,
  },

  messageCaptionOwn: {
    color: 'rgba(255, 255, 255, 0.8)',
  },

  messageCaptionOther: {
    color: colors.gray600,
  },

  // File Attachment Styles
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
  },

  fileName: {
    fontSize: 14,
    fontWeight: '500',
  },

  fileNameOwn: {
    color: colors.white,
  },

  fileNameOther: {
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
    overflow: 'hidden',
  },

  emptyAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
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

  // Emoji Picker Styles
  emojiPickerContainer: {
    height: 300,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },

  emojiCategoryTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    paddingHorizontal: 4,
    backgroundColor: colors.gray50,
  },

  emojiCategoryTab: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 2,
  },

  emojiCategoryTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },

  emojiCategoryTabText: {
    fontSize: 12,
    color: colors.gray600,
    fontWeight: '500',
  },

  emojiCategoryTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  emojiGridContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },

  emojiItem: {
    width: `${100 / 8}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },

  emojiText: {
    fontSize: 28,
  },

  // Image Viewer Styles
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },

  imageViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },

  imageViewerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  imageViewerHeaderRight: {
    flexDirection: 'row',
    gap: 12,
  },

  imageViewerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  imageViewerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  fullScreenImage: {
    width: '100%',
    height: '100%',
  },

  imageViewerFooter: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    alignItems: 'center',
  },

  imageViewerSender: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    marginBottom: 4,
  },

  imageViewerTimestamp: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },

  // Load More Button Styles
  loadMoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },

  loadMoreText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },

  loadMoreTextDisabled: {
    color: colors.gray500,
  },
});
