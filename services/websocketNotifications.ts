import { Platform } from 'react-native';
import { NotificationData } from '../hooks/useNotifications';

interface WebSocketNotificationService {
  connect: (userId: string, onNotification: (notification: NotificationData) => void) => void;
  disconnect: () => void;
  getConnectionStatus: () => 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED';
  send: (data: any) => void;
}

class WebSocketNotificationServiceImpl implements WebSocketNotificationService {
  private ws: WebSocket | null = null;
  private userId: string | null = null;
  private onNotificationCallback: ((notification: NotificationData) => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isManuallyDisconnected = false;

  connect(userId: string, onNotification: (notification: NotificationData) => void) {
    // Disable WebSocket fallback for now - Supabase real-time is primary
    console.log('🌐 WebSocket fallback disabled - using Supabase real-time only');
    return;

    /*
    // Uncomment and configure when you have a WebSocket server
    if (Platform.OS !== 'web') {
      console.log('🌐 WebSocket fallback only available on web platform');
      return;
    }

    this.userId = userId;
    this.onNotificationCallback = onNotification;
    this.isManuallyDisconnected = false;

    this.setupWebSocket();
    */
  }

  private setupWebSocket() {
    if (!this.userId || this.isManuallyDisconnected) return;

    try {
      // Use your Supabase WebSocket URL or create a custom WebSocket server
      const wsUrl = `wss://your-websocket-server.com/notifications?userId=${this.userId}`;

      console.log('🔌 Connecting to WebSocket for notifications:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected for notifications');
        this.reconnectAttempts = 0;
        this.startHeartbeat();

        // Send authentication/subscription message
        this.send({
          type: 'subscribe',
          userId: this.userId,
          topic: 'notifications'
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', data);

          if (data.type === 'notification' && this.onNotificationCallback) {
            this.onNotificationCallback(data.payload);
          } else if (data.type === 'pong') {
            console.log('🏓 WebSocket pong received');
          }
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        this.stopHeartbeat();

        if (!this.isManuallyDisconnected && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      this.attemptReconnect();
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, 30000); // Every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect() {
    if (this.isManuallyDisconnected) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Max 30 seconds

    console.log(`🔄 WebSocket reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      if (!this.isManuallyDisconnected) {
        this.setupWebSocket();
      }
    }, delay);
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send:', data);
    }
  }

  disconnect() {
    console.log('🔌 Disconnecting WebSocket');
    this.isManuallyDisconnected = true;

    this.stopHeartbeat();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }

    this.userId = null;
    this.onNotificationCallback = null;
  }

  getConnectionStatus(): 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED' {
    if (!this.ws) return 'CLOSED';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'OPEN';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'CLOSED';
    }
  }
}

// Singleton instance
const websocketNotificationService = new WebSocketNotificationServiceImpl();

export { websocketNotificationService };
export type { WebSocketNotificationService };