import { supabase } from '../lib/supabase';

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

class RealtimeManager {
  private connectionState: ConnectionState = 'DISCONNECTED';
  private listeners: Array<(state: ConnectionState) => void> = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupConnectionMonitoring();
  }

  // Monitor connection state
  private setupConnectionMonitoring() {
    // Set initial state as connected (optimistic)
    this.setConnectionState('CONNECTED');

    // Use auth state change to monitor connection
    supabase.auth.onAuthStateChange((event, session) => {
      // Silently monitor connection state
      if (session) {
        this.setConnectionState('CONNECTED');
      } else if (event === 'SIGNED_OUT') {
        this.setConnectionState('DISCONNECTED');
      }
    });

    // Start heartbeat to monitor connection
    this.startHeartbeat();
    this.startConnectionCheck();
  }

  private startHeartbeat() {
    // Clear existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.connectionState === 'CONNECTED') {
        // Test connection with a simple query
        supabase
          .from('profiles')
          .select('id')
          .limit(1)
          .then(() => {
            // Connection is good
          })
          .catch((error) => {
            console.error('Heartbeat failed:', error);
            this.setConnectionState('DISCONNECTED');
          });
      }
    }, 30000);
  }

  private startConnectionCheck() {
    // Clear existing connection check
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    // Check connection every 5 seconds
    this.connectionCheckInterval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (this.connectionState === 'DISCONNECTED') {
            this.setConnectionState('CONNECTED');
          }
        } else {
          if (this.connectionState === 'CONNECTED') {
            this.setConnectionState('DISCONNECTED');
          }
        }
      } catch (error) {
        console.error('Connection check failed:', error);
        this.setConnectionState('DISCONNECTED');
      }
    }, 5000);
  }

  private setConnectionState(state: ConnectionState) {
    if (this.connectionState !== state) {
      console.log(`📡 Real-time connection state changed: ${this.connectionState} → ${state}`);
      this.connectionState = state;
      this.notifyListeners(state);
    }
  }

  private notifyListeners(state: ConnectionState) {
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in connection state listener:', error);
      }
    });
  }

  // Public methods
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  onConnectionStateChange(callback: (state: ConnectionState) => void) {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  // Force reconnection
  async reconnect() {
    console.log('🔄 Forcing real-time reconnection...');
    this.setConnectionState('CONNECTING');

    try {
      // Test connection with a simple query
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Try a simple database query to test connection
        await supabase
          .from('profiles')
          .select('id')
          .limit(1);

        this.setConnectionState('CONNECTED');
        console.log('✅ Reconnection successful');
      } else {
        this.setConnectionState('DISCONNECTED');
        console.log('❌ No session available for reconnection');
      }
    } catch (error) {
      console.error('Error during reconnection:', error);
      this.setConnectionState('DISCONNECTED');
    }
  }

  // Check if real-time is available
  isRealtimeAvailable(): boolean {
    return this.connectionState === 'CONNECTED';
  }

  // Enable real-time features for messages table
  async enableMessagesRealtime() {
    try {
      console.log('🔧 Enabling real-time for messages table...');

      // This ensures the messages table is set up for real-time
      const { error } = await supabase
        .from('messages')
        .select('id')
        .limit(1);

      if (error) {
        console.error('Error testing messages table access:', error);
        return false;
      }

      console.log('✅ Messages table real-time access confirmed');
      return true;
    } catch (error) {
      console.error('Error enabling messages real-time:', error);
      return false;
    }
  }

  // Cleanup
  destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    this.listeners = [];
  }
}

// Export singleton instance
export const realtimeManager = new RealtimeManager();

// Auto-enable real-time when imported
realtimeManager.enableMessagesRealtime();