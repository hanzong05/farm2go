import { supabase } from '../lib/supabase';
import { realtimeManager } from './realtimeManager';

export interface Message {
  id: string;
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
  // Send a new message
  async sendMessage(params: SendMessageParams): Promise<Message | null> {
    try {
      // Get current user
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Error getting user:', userError);
        return null;
      }
      if (!user.user) {
        console.error('No authenticated user found');
        return null;
      }

      console.log('Current user:', {
        id: user.user.id,
        email: user.user.email,
        aud: user.user.aud,
      });

      // Check if trying to send message to self
      if (user.user.id === params.receiverId) {
        console.error('Cannot send message to yourself');
        return null;
      }

      console.log('Sending message:', {
        sender_id: user.user.id,
        receiver_id: params.receiverId,
        content: params.content.substring(0, 50) + '...'
      });

      // Check if both users exist in profiles table
      const { data: userProfiles, error: userProfileError } = await supabase
        .from('profiles')
        .select('id')
        .in('id', [user.user.id, params.receiverId]);

      if (userProfileError) {
        console.error('Error checking profiles:', userProfileError);
      } else {
        console.log('Found profiles:', userProfiles?.map(p => p.id));
        if (!userProfiles?.find(p => p.id === user.user.id)) {
          console.error('Sender profile not found in profiles table');
        }
        if (!userProfiles?.find(p => p.id === params.receiverId)) {
          console.error('Receiver profile not found in profiles table');
        }
      }

      // First insert the message
      const { data: message, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.user.id,
          receiver_id: params.receiverId,
          content: params.content,
          subject: params.subject,
          related_product_id: params.relatedProductId,
          related_order_id: params.relatedOrderId,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error sending message:', error);
        return null;
      }

      // Get profile data for sender and receiver
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, user_type')
        .in('id', [message.sender_id, message.receiver_id]);

      if (profileError) {
        console.error('Error fetching profiles for message:', profileError);
        // Return message without profile data
        return { ...message, sender_profile: null, receiver_profile: null };
      }

      // Create profile lookup
      const profileMap = new Map();
      profiles?.forEach(profile => {
        profileMap.set(profile.id, profile);
      });

      // Return message with profile data
      return {
        ...message,
        sender_profile: profileMap.get(message.sender_id) || null,
        receiver_profile: profileMap.get(message.receiver_id) || null,
      } as Message;
    } catch (error) {
      console.error('Error in sendMessage:', error);
      return null;
    }
  }

  // Get conversation messages between current user and another user
  async getConversationMessages(
    otherUserId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];

      // First get the messages
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.user.id},receiver_id.eq.${otherUserId}),` +
          `and(sender_id.eq.${otherUserId},receiver_id.eq.${user.user.id})`
        )
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
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];

      // Get all messages for current user
      const { data: messages, error } = await supabase
        .from('messages')
        .select('sender_id, receiver_id, content, created_at, is_read')
        .or(`sender_id.eq.${user.user.id},receiver_id.eq.${user.user.id}`)
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
          message.sender_id === user.user.id ? message.receiver_id : message.sender_id
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
        const otherUserId = message.sender_id === user.user.id
          ? message.receiver_id
          : message.sender_id;

        const otherUserProfile = profileMap.get(otherUserId);
        const conversationId = [user.user.id, otherUserId].sort().join('-');

        if (!conversationMap.has(conversationId) ||
            new Date(message.created_at) > new Date(conversationMap.get(conversationId).last_message_at)) {

          conversationMap.set(conversationId, {
            conversation_id: conversationId,
            other_user_id: otherUserId,
            other_user_name: `${otherUserProfile?.first_name || ''} ${otherUserProfile?.last_name || ''}`.trim() || 'Unknown User',
            other_user_type: otherUserProfile?.user_type || 'buyer',
            last_message: message.content,
            last_message_at: message.created_at,
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
          .eq('receiver_id', user.user.id)
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
      const { error } = await supabase
        .from('messages')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .eq('receiver_id', (await supabase.auth.getUser()).data.user?.id);

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
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return false;

      const { error } = await supabase
        .from('messages')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('sender_id', otherUserId)
        .eq('receiver_id', user.user.id)
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

  // Subscribe to new messages with profile data
  subscribeToMessages(callback: (message: Message) => void, userId?: string) {
    console.log('📡 Setting up real-time subscription for messages...', {
      userId,
      realtimeAvailable: realtimeManager.isRealtimeAvailable()
    });

    const channel = supabase.channel('messages_realtime');

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: userId ? `or(sender_id.eq.${userId},receiver_id.eq.${userId})` : undefined,
      },
      async (payload) => {
        console.log('📨 New message received via real-time:', payload);

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
      console.log('📡 Messages subscription status:', status);
    });
  }

  // Subscribe to message updates (like read status)
  subscribeToMessageUpdates(callback: (message: Message) => void, userId?: string) {
    return supabase
      .channel('message_updates_realtime')
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

  // Subscribe to both insert and update events for comprehensive real-time
  subscribeToAllMessageChanges(callback: (message: Message, type: 'INSERT' | 'UPDATE') => void, userId?: string) {
    const channel = supabase.channel('messages_all_changes');

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
        const messageData = payload.new as any;
        const enhancedMessage = await this.enhanceMessageWithProfiles(messageData);
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
        const messageData = payload.new as any;
        const enhancedMessage = await this.enhanceMessageWithProfiles(messageData);
        callback(enhancedMessage, 'UPDATE');
      }
    );

    return channel.subscribe();
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
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return 0;

      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.user.id)
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
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return false;

      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('sender_id, receiver_id')
        .eq('id', messageId)
        .single();

      if (fetchError || !message) return false;

      const updateData: any = {};

      if (message.sender_id === user.user.id) {
        updateData.is_deleted_by_sender = true;
      }

      if (message.receiver_id === user.user.id) {
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