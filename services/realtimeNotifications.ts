import { RealtimeChannel, RealtimeChannelSendResponse } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { NotificationData } from '../hooks/useNotifications';

interface RealtimeNotificationService {
  subscribe: (userId: string, onNotification: (notification: NotificationData) => void) => void;
  unsubscribe: () => void;
  getConnectionStatus: () => 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';
  reconnect: (userId: string, onNotification: (notification: NotificationData) => void) => void;
}

class RealtimeNotificationServiceImpl implements RealtimeNotificationService {
  private channel: RealtimeChannel | null = null;
  private currentUserId: string | null = null;
  private currentCallback: ((notification: NotificationData) => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isManuallyDisconnected = false;

  subscribe(userId: string, onNotification: (notification: NotificationData) => void) {
    console.log('🔔 Setting up real-time notification subscription for user:', userId);

    // Clean up existing subscription
    this.unsubscribe();

    this.currentUserId = userId;
    this.currentCallback = onNotification;
    this.isManuallyDisconnected = false;
    this.reconnectAttempts = 0;

    this.setupSubscription();
  }

  private setupSubscription() {
    if (!this.currentUserId || !this.currentCallback) return;

    const channelName = `notifications-${this.currentUserId}`;
    console.log('📡 Creating real-time channel:', channelName);

    this.channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: this.currentUserId }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${this.currentUserId}`
        },
        (payload) => {
          console.log('🔔 Real-time notification received:', payload);
          if (this.currentCallback && payload.new) {
            this.currentCallback(payload.new as NotificationData);
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        console.log('👥 Presence sync completed');
      })
      .on('broadcast', { event: 'notification-ping' }, () => {
        console.log('🏓 Notification ping received');
      });

    // Handle subscription status
    this.channel.subscribe((status, err) => {
      console.log('📡 Subscription status:', status);

      if (err) {
        console.error('❌ Subscription error:', err);
        this.handleConnectionError();
        return;
      }

      switch (status) {
        case 'SUBSCRIBED':
          console.log('✅ Successfully subscribed to real-time notifications');
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.startHeartbeat();
          break;

        case 'CHANNEL_ERROR':
          console.error('❌ Channel error occurred');
          this.handleConnectionError();
          break;

        case 'TIMED_OUT':
          console.error('⏰ Subscription timed out');
          this.handleConnectionError();
          break;

        case 'CLOSED':
          console.log('🔒 Channel closed');
          if (!this.isManuallyDisconnected) {
            this.handleConnectionError();
          }
          break;
      }
    });
  }

  private startHeartbeat() {
    // Send periodic heartbeat to keep connection alive
    this.heartbeatInterval = setInterval(() => {
      if (this.channel && this.getConnectionStatus() === 'SUBSCRIBED') {
        this.channel.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { timestamp: Date.now() }
        });
      }
    }, 30000); // Every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleConnectionError() {
    if (this.isManuallyDisconnected) return;

    this.stopHeartbeat();

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

      console.log(`🔄 Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

      setTimeout(() => {
        if (!this.isManuallyDisconnected && this.currentUserId && this.currentCallback) {
          this.setupSubscription();
        }
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  reconnect(userId: string, onNotification: (notification: NotificationData) => void) {
    console.log('🔄 Manual reconnection requested');
    this.reconnectAttempts = 0;
    this.subscribe(userId, onNotification);
  }

  unsubscribe() {
    console.log('🔕 Unsubscribing from real-time notifications');
    this.isManuallyDisconnected = true;

    this.stopHeartbeat();

    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }

    this.currentUserId = null;
    this.currentCallback = null;
  }

  getConnectionStatus() {
    if (!this.channel) return 'CLOSED';

    // Access the private state if available
    const channelState = (this.channel as any).state;
    return channelState || 'CLOSED';
  }
}

// Singleton instance
const realtimeNotificationService = new RealtimeNotificationServiceImpl();

export { realtimeNotificationService };
export type { RealtimeNotificationService };