import { useEffect, useState } from 'react';
import {
  clearPushToken,
  getPushToken,
  initializeSimplePush,
  sendLocalNotification,
  sendPushNotification,
  simplePushService
} from '../services/simplePush';
import { supabase } from '../lib/supabase';

interface UseSimplePushResult {
  pushToken: string | null;
  isInitialized: boolean;
  sendTestNotification: () => Promise<void>;
  sendDirectNotification: (userId: string, title: string, body: string, data?: any) => Promise<void>;
  clearToken: () => Promise<void>;
}

export const useSimplePush = (userId: string | null): UseSimplePushResult => {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize push notifications when user is available
  useEffect(() => {
    if (!userId) return;

    const initPush = async () => {
      try {
        console.log('📱 Initializing simple push for user:', userId);

        const token = await initializeSimplePush(userId);
        setPushToken(token);
        setIsInitialized(!!token);

        if (token) {
          console.log('✅ Simple push initialized successfully');
        } else {
          console.warn('⚠️ Simple push initialization failed');
        }
      } catch (error) {
        console.error('❌ Failed to initialize simple push:', error);
        setIsInitialized(false);
      }
    };

    initPush();

    // Cleanup on unmount
    return () => {
      console.log('🧹 Simple push hook cleanup');
    };
  }, [userId]);

  // Send test notification
  const sendTestNotification = async () => {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      // Send local notification first
      await sendLocalNotification(
        '🧪 Test Local Notification',
        `Local test sent at ${new Date().toLocaleTimeString()}`
      );

      // Then send via Edge Function
      const { data, error } = await supabase.functions.invoke('send-expo-push', {
        body: {
          userId,
          title: '🧪 Test Push Notification',
          body: `Push test sent at ${new Date().toLocaleTimeString()}`,
          data: {
            test: true,
            timestamp: Date.now(),
          },
        },
      });

      if (error) {
        console.error('❌ Failed to send test push:', error);
        throw error;
      }

      console.log('✅ Test notifications sent successfully:', data);
    } catch (error) {
      console.error('❌ Failed to send test notification:', error);
      throw error;
    }
  };

  // Send direct notification via Edge Function
  const sendDirectNotification = async (
    targetUserId: string,
    title: string,
    body: string,
    data?: any
  ) => {
    try {
      console.log('📤 Sending direct push notification to user:', targetUserId);

      const { data: result, error } = await supabase.functions.invoke('send-expo-push', {
        body: {
          userId: targetUserId,
          title,
          body,
          data: data || {},
        },
      });

      if (error) {
        console.error('❌ Failed to send direct notification:', error);
        throw error;
      }

      console.log('✅ Direct notification sent successfully:', result);
    } catch (error) {
      console.error('❌ Exception sending direct notification:', error);
      throw error;
    }
  };

  // Clear push token (on logout)
  const clearToken = async () => {
    if (!userId) return;

    try {
      await clearPushToken(userId);
      setPushToken(null);
      setIsInitialized(false);
      console.log('✅ Push token cleared');
    } catch (error) {
      console.error('❌ Failed to clear push token:', error);
      throw error;
    }
  };

  return {
    pushToken,
    isInitialized,
    sendTestNotification,
    sendDirectNotification,
    clearToken,
  };
};