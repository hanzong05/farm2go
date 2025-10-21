import { Platform } from 'react-native';
import { realtimeNotificationService } from './realtimeNotifications';
import { websocketNotificationService } from './websocketNotifications';
import { subscribeToNotifications, broadcastNotification, getUserNotifications } from './notifications';
import { NotificationData } from '../hooks/useNotifications';

interface HybridNotificationService {
  subscribe: (userId: string, onNotification: (notification: NotificationData) => void) => void;
  unsubscribe: () => void;
  getStatus: () => {
    supabase: string;
    websocket: string;
    polling: boolean;
  };
  forceReconnect: () => void;
}

class HybridNotificationServiceImpl implements HybridNotificationService {
  private userId: string | null = null;
  private onNotificationCallback: ((notification: NotificationData) => void) | null = null;
  private supabaseSubscription: any = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastNotificationTime = 0;
  private isSubscribed = false;
  private receivedNotificationIds = new Set<string>();

  subscribe(userId: string, onNotification: (notification: NotificationData) => void) {
    console.log('🚀 Starting hybrid notification service for user:', userId);

    this.userId = userId;
    this.onNotificationCallback = onNotification;
    this.isSubscribed = true;
    this.lastNotificationTime = Date.now();

    // Wrapper to prevent duplicate notifications
    const notificationHandler = (notification: NotificationData) => {
      if (!this.isSubscribed) return;

      // Check for duplicates
      if (this.receivedNotificationIds.has(notification.id)) {
        console.log('🔔 Duplicate notification filtered:', notification.id);
        return;
      }

      this.receivedNotificationIds.add(notification.id);
      this.lastNotificationTime = Date.now();

      // Cleanup old IDs to prevent memory leak
      if (this.receivedNotificationIds.size > 100) {
        const oldIds = Array.from(this.receivedNotificationIds).slice(0, 50);
        oldIds.forEach(id => this.receivedNotificationIds.delete(id));
      }

      console.log('✅ Unique notification processed:', notification.id);
      onNotification(notification);
    };

    // 1. Primary: Supabase Real-time
    this.setupSupabaseRealtime(notificationHandler);

    // 2. Secondary: WebSocket (disabled for now - use Supabase real-time)
    // WebSocket fallback is disabled until you configure a WebSocket server
    console.log('🔌 WebSocket fallback disabled - relying on Supabase real-time + polling');

    // 3. Tertiary: Polling fallback
    this.setupPollingFallback();

    // 4. Health monitoring
    this.startHealthMonitoring();
  }

  private setupSupabaseRealtime(onNotification: (notification: NotificationData) => void) {
    try {
      console.log('📡 Setting up Supabase real-time subscription');

      this.supabaseSubscription = subscribeToNotifications(this.userId!, onNotification);

      console.log('✅ Supabase real-time subscription established');
    } catch (error) {
      console.error('❌ Supabase real-time setup failed:', error);
    }
  }

  private setupWebSocketFallback(onNotification: (notification: NotificationData) => void) {
    if (Platform.OS !== 'web') return;

    try {
      console.log('🔌 Setting up WebSocket fallback');
      websocketNotificationService.connect(this.userId!, onNotification);
    } catch (error) {
      console.error('❌ WebSocket fallback setup failed:', error);
    }
  }

  private setupPollingFallback() {
    console.log('⏰ Setting up polling fallback');

    this.pollingInterval = setInterval(async () => {
      if (!this.isSubscribed || !this.userId) return;

      // Only poll if no recent real-time activity
      const timeSinceLastNotification = Date.now() - this.lastNotificationTime;
      if (timeSinceLastNotification < 60000) { // Less than 1 minute
        return;
      }

      try {
        console.log('📊 Polling for new notifications...');

        const recentNotifications = await getUserNotifications(this.userId, 5);

        // Check for new notifications since last check
        const newNotifications = recentNotifications.filter(notif => {
          const notifTime = new Date(notif.created_at).getTime();
          return notifTime > this.lastNotificationTime && !this.receivedNotificationIds.has(notif.id);
        });

        if (newNotifications.length > 0) {
          console.log(`📊 Found ${newNotifications.length} new notifications via polling`);
          newNotifications.forEach(notif => {
            if (this.onNotificationCallback) {
              this.onNotificationCallback(notif);
            }
          });
        }
      } catch (error) {
        console.error('❌ Polling fallback failed:', error);
      }
    }, 30000); // Poll every 30 seconds
  }

  private startHealthMonitoring() {
    console.log('🏥 Starting connection health monitoring');

    const healthCheck = setInterval(() => {
      if (!this.isSubscribed) {
        clearInterval(healthCheck);
        return;
      }

      const status = this.getStatus();
      console.log('🏥 Connection health check:', status);

      // If Supabase real-time is down and polling is off, attempt reconnect
      if (status.supabase === 'CLOSED' && !status.polling) {
        console.warn('⚠️ Supabase real-time connection lost, attempting reconnect');
        this.forceReconnect();
      }
    }, 60000); // Check every minute
  }

  forceReconnect() {
    if (!this.userId || !this.onNotificationCallback) return;

    console.log('🔄 Force reconnecting Supabase real-time service');

    // Reconnect Supabase
    if (this.supabaseSubscription) {
      this.supabaseSubscription.unsubscribe();
    }
    this.setupSupabaseRealtime(this.onNotificationCallback);

    // WebSocket reconnection disabled (no WebSocket server configured)
    console.log('🔌 WebSocket reconnection skipped - not configured');
  }

  unsubscribe() {
    console.log('🛑 Unsubscribing from hybrid notification service');

    this.isSubscribed = false;

    // Cleanup Supabase subscription
    if (this.supabaseSubscription) {
      this.supabaseSubscription.unsubscribe();
      this.supabaseSubscription = null;
    }

    // Cleanup WebSocket
    websocketNotificationService.disconnect();

    // Cleanup polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // Clear state
    this.userId = null;
    this.onNotificationCallback = null;
    this.receivedNotificationIds.clear();
  }

  getStatus() {
    return {
      supabase: this.supabaseSubscription?.state || 'CLOSED',
      websocket: websocketNotificationService.getConnectionStatus(),
      polling: !!this.pollingInterval
    };
  }
}

// Singleton instance
const hybridNotificationService = new HybridNotificationServiceImpl();

export { hybridNotificationService };
export type { HybridNotificationService };