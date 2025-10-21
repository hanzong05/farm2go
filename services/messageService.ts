import { supabase } from '../lib/supabase';
import { realtimeManager } from './realtimeManager';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  subject?: string;
  message_type: 'text' | 'image' | 'file';
  is_read: boolean;
  is_deleted_by_sender: boolean;
  is_deleted_by_receiver: boolean;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  related_product_id?: string;
  related_order_id?: string;
  created_at: string;
  updated_at: string;
  read_at?: string;
  sender_profile?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    user_type: string;
  };
  receiver_profile?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    user_type: string;
  };
}

export interface Conversation {
  conversation_id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_type: string;
  last_message: string;
  last_message_at: string;
  last_message_sender_id: string;
  unread_count: number;
}

export interface SendMessageParams {
  receiverId: string;
  content: string;
  subject?: string;
  relatedProductId?: string;
  relatedOrderId?: string;
}

class MessageService {

  // Helper method to get current user with better error handling
  private async getCurrentUser() {
    try {
      // First try to get user from auth
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        console.error('❌ Auth getUser error:', error);

        // Fallback to session
        console.log('🔄 Falling back to session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          return null;
        }

        if (session?.user) {
          console.log('✅ Got user from session fallback');
          return session.user;
        }

        console.error('❌ No user found in session either');
        return null;
      }

      if (!user) {
        console.error('❌ No user returned from auth');
        return null;
      }

      console.log('✅ Got user from auth:', user.id);
      return user;
    } catch (error) {
      console.error('❌ Exception in getCurrentUser:', error);
      return null;
    }
  }

  // Check if conversation exists between two users (Step 1 in workflow)
  async checkConversationExists(user1Id: string, user2Id: string): Promise<string | null> {
    try {
      console.log('🔍 Checking if conversation exists between:', user1Id, 'and', user2Id);

      // Ensure consistent ordering (user1 < user2)
      const [userId1, userId2] = [user1Id, user2Id].sort();

      // Check if conversation exists
      const { data: existingConversation, error: findError } = await supabase
        .from('conversations')
        .select('id')
        .eq('user1_id', userId1)
        .eq('user2_id', userId2)
        .single();

      if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('❌ Error checking conversation:', findError);
        return null;
      }

      if (existingConversation) {
        console.log('✅ Conversation exists:', existingConversation.id);
        return existingConversation.id;
      }

      console.log('📝 No existing conversation found');
      return null;
    } catch (error) {
      console.error('❌ Error in checkConversationExists:', error);
      return null;
    }
  }

  // Get or create conversation ID between two users (fallback method)
  async getOrCreateConversationId(user1Id: string, user2Id: string): Promise<string | null> {
    try {
      // First check if conversation exists
      const existingConversationId = await this.checkConversationExists(user1Id, user2Id);
      if (existingConversationId) {
        return existingConversationId;
      }

      // Create new conversation if it doesn't exist
      console.log('🆕 Creating new conversation...');
      const [userId1, userId2] = [user1Id, user2Id].sort();

      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert({
          user1_id: userId1,
          user2_id: userId2,
        })
        .select('id')
        .single();

      if (createError) {
        console.error('❌ Error creating conversation:', createError);
        return null;
      }

      console.log('✅ New conversation created:', newConversation.id);
      return newConversation.id;
    } catch (error) {
      console.error('❌ Error in getOrCreateConversationId:', error);
      return null;
    }
  }

  // Initialize chat following the exact workflow diagram
  async initializeChat(currentUserId: string, otherUserId: string): Promise<{
    conversationId: string | null;
    messages: Message[];
    exists: boolean;
  }> {
    try {
      console.log('🚀 WORKFLOW: User opens a chat');

      // Step 1: Does conversation exist?
      console.log('🔍 WORKFLOW: Checking if conversation exists...');
      const existingConversationId = await this.checkConversationExists(currentUserId, otherUserId);

      if (existingConversationId) {
        // YES: Load existing conversation
        console.log('✅ WORKFLOW: Conversation exists, loading existing messages...');
        const messages = await this.getConversationMessages(otherUserId);

        return {
          conversationId: existingConversationId,
          messages: messages,
          exists: true
        };
      } else {
        // NO: Conversation will be created automatically by database trigger when first message is sent
        console.log('📝 WORKFLOW: No conversation exists - will be created automatically on first message');

        return {
          conversationId: null,
          messages: [],
          exists: false
        };
      }
    } catch (error) {
      console.error('❌ Error in initializeChat:', error);
      return {
        conversationId: null,
        messages: [],
        exists: false
      };
    }
  }

  // Send a new message
  async sendMessage(params: SendMessageParams): Promise<Message | null> {
    try {
      console.log('📤 TWO-USER DEBUG: sendMessage called with params:', {
        receiverId: params.receiverId,
        content: params.content.substring(0, 50),
        timestamp: new Date().toISOString(),
        userAgent: 'CHECKING_AUTH...'
      });

      // Get current user with improved error handling
      const user = await this.getCurrentUser();
      if (!user?.id) {
        console.error('❌ No authenticated user found');
        return null;
      }

      console.log('👤 TWO-USER DEBUG: Current user for message sending:', {
        id: user.id,
        email: user.email,
        timestamp: new Date().toISOString()
      });

      // Check if trying to send message to self
      if (user.id === params.receiverId) {
        console.error('❌ TWO-USER DEBUG: Cannot send message to yourself', {
          senderId: user.id,
          receiverId: params.receiverId
        });
        return null;
      }

      console.log('✅ TWO-USER DEBUG: Valid sender/receiver combination', {
        senderId: user.id,
        receiverId: params.receiverId
      });

      console.log('Sending message:', {
        sender_id: user.id,
        receiver_id: params.receiverId,
        content: params.content.substring(0, 50) + '...'
      });

      // Check if both users exist in profiles table
      const { data: userProfiles, error: userProfileError } = await supabase
        .from('profiles')
        .select('id')
        .in('id', [user.id, params.receiverId]);

      if (userProfileError) {
        console.error('Error checking profiles:', userProfileError);
      } else {
        console.log('Found profiles:', userProfiles?.map(p => p.id));
        if (!userProfiles?.find(p => p.id === user.id)) {
          console.error('Sender profile not found in profiles table');
        }
        if (!userProfiles?.find(p => p.id === params.receiverId)) {
          console.error('Receiver profile not found in profiles table');
        }
      }

      // The database trigger will automatically create conversation and set conversation_id
      // We just need to send the message with sender and receiver
      console.log('💾 TWO-USER DEBUG: Inserting message - database trigger will handle conversation creation...');
      const insertData = {
        sender_id: user.id,
        receiver_id: params.receiverId,
        content: params.content,
        subject: params.subject,
        related_product_id: params.relatedProductId,
        related_order_id: params.relatedOrderId,
        // conversation_id will be set automatically by the database trigger
      };
      console.log('💾 TWO-USER DEBUG: Insert data:', insertData);

      console.log('🚀 TWO-USER DEBUG: About to insert into database...');
      const { data: message, error } = await supabase
        .from('messages')
        .insert(insertData)
        .select('*')
        .single();

      console.log('📥 TWO-USER DEBUG: Database insert result:', {
        hasMessage: !!message,
        hasError: !!error,
        messageId: message?.id
      });

      if (error) {
        console.error('❌ TWO-USER DEBUG: Error inserting message into database:', error);
        console.error('❌ TWO-USER DEBUG: Error details:', JSON.stringify(error, null, 2));
        return null;
      }

      if (!message) {
        console.error('❌ Message insert returned null data');
        return null;
      }

      console.log('✅ Message successfully inserted into database:', {
        id: message.id,
        sender_id: message.sender_id,
        receiver_id: message.receiver_id,
        content: message.content.substring(0, 50)
      });

      // Get profile data for sender and receiver
      console.log('👥 Fetching profiles for message participants...');
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, user_type')
        .in('id', [message.sender_id, message.receiver_id]);

      if (profileError) {
        console.error('❌ Error fetching profiles for message:', profileError);
        // Return message without profile data
        return { ...message, sender_profile: null, receiver_profile: null };
      }

      console.log('👥 Profiles fetched successfully:', profiles?.length || 0, 'profiles');

      // Create profile lookup
      const profileMap = new Map();
      profiles?.forEach(profile => {
        profileMap.set(profile.id, profile);
      });

      // Return message with profile data
      const finalMessage = {
        ...message,
        sender_profile: profileMap.get(message.sender_id) || null,
        receiver_profile: profileMap.get(message.receiver_id) || null,
      } as Message;

      console.log('🎉 sendMessage completed successfully, returning message:', {
        id: finalMessage.id,
        hasSenderProfile: !!finalMessage.sender_profile,
        hasReceiverProfile: !!finalMessage.receiver_profile
      });

      return finalMessage;
    } catch (error) {
      console.error('❌ Critical error in sendMessage:', error);
      console.error('❌ Error stack:', error.stack);
      return null;
    }
  }

  // Get conversation messages between current user and another user
  async getConversationMessages(
    otherUserId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<Message[]> {
    try {
      const user = await this.getCurrentUser();
      if (!user?.id) return [];

      // Get conversation ID
      const conversationId = await this.getOrCreateConversationId(user.id, otherUserId);
      if (!conversationId) {
        console.error('Failed to get conversation ID');
        return [];
      }

      // Get messages for this conversation
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('is_deleted_by_sender', false)
        .eq('is_deleted_by_receiver', false)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching conversation messages:', error);
        return [];
      }

      if (!messages || messages.length === 0) return [];

      // Get unique user IDs from messages
      const userIds = Array.from(new Set([
        ...messages.map(m => m.sender_id),
        ...messages.map(m => m.receiver_id)
      ]));

      // Get profile data for all users
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, user_type')
        .in('id', userIds);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        return messages.map(msg => ({ ...msg, sender_profile: null, receiver_profile: null }));
      }

      // Create a profile lookup map
      const profileMap = new Map();
      profiles?.forEach(profile => {
        profileMap.set(profile.id, profile);
      });

      // Combine messages with profile data
      const messagesWithProfiles = messages.map(message => ({
        ...message,
        sender_profile: profileMap.get(message.sender_id) || null,
        receiver_profile: profileMap.get(message.receiver_id) || null,
      }));

      return messagesWithProfiles.reverse(); // Reverse to show oldest first
    } catch (error) {
      console.error('Error in getConversationMessages:', error);
      return [];
    }
  }

  // Get all conversations for current user
  async getUserConversations(): Promise<Conversation[]> {
    try {
      const user = await this.getCurrentUser();
      if (!user?.id) return [];

      // Get all messages for current user
      const { data: messages, error } = await supabase
        .from('messages')
        .select('sender_id, receiver_id, content, created_at, is_read')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('is_deleted_by_sender', false)
        .eq('is_deleted_by_receiver', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
        return [];
      }

      if (!messages || messages.length === 0) return [];

      // Get unique other user IDs
      const otherUserIds = Array.from(new Set(
        messages.map(message =>
          message.sender_id === user.id ? message.receiver_id : message.sender_id
        )
      ));

      // Get profile data for all other users
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, user_type')
        .in('id', otherUserIds);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        return [];
      }

      // Create profile lookup map
      const profileMap = new Map();
      profiles?.forEach(profile => {
        profileMap.set(profile.id, profile);
      });

      // Group messages by conversation and get latest message for each
      const conversationMap = new Map<string, any>();

      messages.forEach((message: any) => {
        const otherUserId = message.sender_id === user.id
          ? message.receiver_id
          : message.sender_id;

        const otherUserProfile = profileMap.get(otherUserId);
        const conversationId = [user.id, otherUserId].sort().join('-');

        if (!conversationMap.has(conversationId) ||
            new Date(message.created_at) > new Date(conversationMap.get(conversationId).last_message_at)) {

          conversationMap.set(conversationId, {
            conversation_id: conversationId,
            other_user_id: otherUserId,
            other_user_name: `${otherUserProfile?.first_name || ''} ${otherUserProfile?.last_name || ''}`.trim() || 'Unknown User',
            other_user_type: otherUserProfile?.user_type || 'buyer',
            last_message: message.content,
            last_message_at: message.created_at,
            last_message_sender_id: message.sender_id,
            unread_count: 0, // Will be calculated separately
          });
        }
      });

      const conversations = Array.from(conversationMap.values());

      // Calculate unread counts for each conversation
      for (const conversation of conversations) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', conversation.other_user_id)
          .eq('receiver_id', user.id)
          .eq('is_read', false)
          .eq('is_deleted_by_receiver', false);

        conversation.unread_count = count || 0;
      }

      return conversations.sort((a, b) =>
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );

    } catch (error) {
      console.error('Error in getUserConversations:', error);
      return [];
    }
  }

  // Mark message as read
  async markMessageAsRead(messageId: string): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user?.id) return false;

      const { error } = await supabase
        .from('messages')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .eq('receiver_id', user.id);

      if (error) {
        console.error('Error marking message as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markMessageAsRead:', error);
      return false;
    }
  }

  // Mark all messages in conversation as read
  async markConversationAsRead(otherUserId: string): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user?.id) return false;

      const { error } = await supabase
        .from('messages')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('sender_id', otherUserId)
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking conversation as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markConversationAsRead:', error);
      return false;
    }
  }

  // Subscribe to conversation messages by conversation ID
  subscribeToConversationMessages(conversationId: string, callback: (message: Message) => void) {
    console.log('📡 Setting up real-time subscription for conversation:', conversationId);

    const channel = supabase.channel(`conversation-${conversationId}`);

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      async (payload) => {
        console.log('📨 New message received via real-time for conversation:', conversationId, payload);

        try {
          // Get profile data for the message
          const messageData = payload.new as any;
          const enhancedMessage = await this.enhanceMessageWithProfiles(messageData);
          callback(enhancedMessage);
        } catch (error) {
          console.error('Error processing real-time message:', error);
          // Still call callback with basic message data
          callback(payload.new as Message);
        }
      }
    );

    return channel.subscribe((status) => {
      console.log('📡 Conversation subscription status:', status);
    });
  }

  // Subscribe to new messages with profile data (legacy method)
  subscribeToMessages(callback: (message: Message) => void, userId?: string) {
    console.log('📡 CONVERSATION LIST: Setting up messages subscription for user:', userId);

    // Use user-specific channel to prevent conflicts when multiple users are active
    const channelName = userId ? `messages_realtime_${userId}` : 'messages_realtime';
    console.log('📡 CONVERSATION LIST: Channel name:', channelName);

    const channel = supabase.channel(channelName);

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        // Note: Supabase real-time doesn't support complex OR filters
        // We'll receive all INSERT events and filter on client side
      },
      async (payload) => {
        console.log('🚨 CONVERSATION LIST: New message received in subscribeToMessages:', {
          messageId: payload.new?.id,
          senderId: payload.new?.sender_id,
          receiverId: payload.new?.receiver_id,
          content: payload.new?.content?.substring(0, 50),
          filterUserId: userId
        });

        const messageData = payload.new as any;

        // Client-side filtering: only process messages for this user
        if (userId && messageData.sender_id !== userId && messageData.receiver_id !== userId) {
          console.log('🚫 CONVERSATION LIST: Message not for this user, skipping');
          return;
        }

        console.log('✅ CONVERSATION LIST: Message is for this user, processing...');

        try {
          // Get profile data for the message
          const enhancedMessage = await this.enhanceMessageWithProfiles(messageData);
          console.log('🚨 CONVERSATION LIST: Calling callback with enhanced message');
          callback(enhancedMessage);
        } catch (error) {
          console.error('Error processing real-time message:', error);
          // Still call callback with basic message data
          callback(payload.new as Message);
        }
      }
    );

    return channel.subscribe((status) => {
      console.log('📡 CONVERSATION LIST: Subscription status:', status);
    });
  }

  // Subscribe to message updates (like read status)
  subscribeToMessageUpdates(callback: (message: Message) => void, userId?: string) {
    // Use user-specific channel to prevent conflicts when multiple users are active
    const channelName = userId ? `message_updates_realtime_${userId}` : 'message_updates_realtime';
    return supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: userId ? `or(sender_id.eq.${userId},receiver_id.eq.${userId})` : undefined,
        },
        async (payload) => {
          console.log('Message updated:', payload);

          // Get profile data for the updated message
          const messageData = payload.new as any;
          const userIds = [messageData.sender_id, messageData.receiver_id];

          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, user_type')
            .in('id', userIds);

          // Create profile lookup map
          const profileMap = new Map();
          profiles?.forEach(profile => {
            profileMap.set(profile.id, profile);
          });

          // Enhance message with profile data
          const enhancedMessage: Message = {
            ...messageData,
            sender_profile: profileMap.get(messageData.sender_id) || null,
            receiver_profile: profileMap.get(messageData.receiver_id) || null,
          };

          callback(enhancedMessage);
        }
      )
      .subscribe();
  }

  // Subscribe to conversation messages with both insert and update events
  subscribeToConversationChanges(conversationId: string, callback: (message: Message, type: 'INSERT' | 'UPDATE') => void) {
    // Use conversation ID as channel name so both users share the same channel
    const channelId = `conversation_${conversationId}`;

    const channel = supabase.channel(channelId);

    // Subscribe to new messages
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      async (payload) => {
        console.log('🚨 REALTIME DEBUG: INSERT callback triggered for conversation:', conversationId, {
          messageId: payload.new?.id,
          senderId: payload.new?.sender_id,
          receiverId: payload.new?.receiver_id,
          content: payload.new?.content?.substring(0, 50)
        });

        const messageData = payload.new as any;
        const enhancedMessage = await this.enhanceMessageWithProfiles(messageData);

        console.log('🚨 REALTIME DEBUG: Calling callback with enhanced message');
        callback(enhancedMessage, 'INSERT');
      }
    );

    // Subscribe to message updates
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      async (payload) => {
        const messageData = payload.new as any;
        const enhancedMessage = await this.enhanceMessageWithProfiles(messageData);
        callback(enhancedMessage, 'UPDATE');
      }
    );

    const subscription = channel.subscribe((status) => {
      console.log('🚨 REALTIME DEBUG: Conversation subscription status:', status, 'for conversation:', conversationId);
    });

    return subscription;
  }

  // Subscribe to both insert and update events for comprehensive real-time (legacy method)
  subscribeToAllMessageChanges(callback: (message: Message, type: 'INSERT' | 'UPDATE') => void, userId?: string) {
    console.log('🔥 Creating REAL-TIME message subscription for user:', userId);

    // Create unique channel name with timestamp and random ID to prevent conflicts
    const channelId = `messages_realtime_${userId || 'all'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('📡 Creating unique channel:', channelId);

    const channel = supabase.channel(channelId);

    // Subscribe to new messages
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: userId ? `or(sender_id.eq.${userId},receiver_id.eq.${userId})` : undefined,
      },
      async (payload) => {
        console.log('🚀 REAL-TIME message INSERT received:', {
          messageId: payload.new?.id,
          senderId: payload.new?.sender_id,
          receiverId: payload.new?.receiver_id,
          filterUserId: userId,
          content: payload.new?.content?.substring(0, 50)
        });
        const messageData = payload.new as any;
        const enhancedMessage = await this.enhanceMessageWithProfiles(messageData);
        console.log('🚀 Enhanced message for callback:', {
          id: enhancedMessage.id,
          sender_id: enhancedMessage.sender_id,
          receiver_id: enhancedMessage.receiver_id
        });
        callback(enhancedMessage, 'INSERT');
      }
    );

    // Subscribe to message updates
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: userId ? `or(sender_id.eq.${userId},receiver_id.eq.${userId})` : undefined,
      },
      async (payload) => {
        console.log('🚀 REAL-TIME message UPDATE:', payload);
        const messageData = payload.new as any;
        const enhancedMessage = await this.enhanceMessageWithProfiles(messageData);
        callback(enhancedMessage, 'UPDATE');
      }
    );

    const subscription = channel.subscribe((status) => {
      console.log('🔥 REAL-TIME messages subscription status:', status);
    });

    return subscription;
  }

  // Helper method to enhance messages with profile data
  private async enhanceMessageWithProfiles(messageData: any): Promise<Message> {
    const userIds = [messageData.sender_id, messageData.receiver_id];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, user_type')
      .in('id', userIds);

    // Create profile lookup map
    const profileMap = new Map();
    profiles?.forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    // Return enhanced message
    return {
      ...messageData,
      sender_profile: profileMap.get(messageData.sender_id) || null,
      receiver_profile: profileMap.get(messageData.receiver_id) || null,
    } as Message;
  }

  // Get unread message count for current user
  async getUnreadMessageCount(): Promise<number> {
    try {
      const user = await this.getCurrentUser();
      if (!user?.id) return 0;

      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false)
        .eq('is_deleted_by_receiver', false);

      if (error) {
        console.error('Error getting unread count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getUnreadMessageCount:', error);
      return 0;
    }
  }

  // Delete message (soft delete)
  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user?.id) return false;

      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('sender_id, receiver_id')
        .eq('id', messageId)
        .single();

      if (fetchError || !message) return false;

      const updateData: any = {};

      if (message.sender_id === user.id) {
        updateData.is_deleted_by_sender = true;
      }

      if (message.receiver_id === user.id) {
        updateData.is_deleted_by_receiver = true;
      }

      const { error } = await supabase
        .from('messages')
        .update(updateData)
        .eq('id', messageId);

      if (error) {
        console.error('Error deleting message:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteMessage:', error);
      return false;
    }
  }
}

export const messageService = new MessageService();