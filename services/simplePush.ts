import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Check if we're running in Expo Go (which doesn't support push notifications in SDK 53+)
const isExpoGo = Constants.appOwnership === 'expo';

// Configure notification behavior only if not in Expo Go
if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

class SimplePushService {
  private static instance: SimplePushService;
  private pushToken: string | null = null;

  public static getInstance(): SimplePushService {
    if (!SimplePushService.instance) {
      SimplePushService.instance = new SimplePushService();
    }
    return SimplePushService.instance;
  }

  // Initialize push notifications
  public async initialize(userId: string): Promise<string | null> {
    try {
      console.log('📱 Initializing simple push notifications...');

      // Check if we're in Expo Go
      if (isExpoGo) {
        console.warn('⚠️ Push notifications are not supported in Expo Go. Use a development build or production app.');
        return null;
      }

      // Check if device supports push notifications
      if (!Device.isDevice) {
        console.warn('⚠️ Push notifications only work on physical devices');
        return null;
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('⚠️ Push notification permission denied');
        return null;
      }

      // Get push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });

      const token = tokenData.data;
      this.pushToken = token;

      console.log('✅ Expo push token obtained:', token);

      // Store token in database
      await this.storeToken(token, userId);

      // Setup notification listeners
      this.setupListeners();

      return token;
    } catch (error) {
      console.error('❌ Failed to initialize push notifications:', error);
      return null;
    }
  }

  // Store token in database
  private async storeToken(token: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('expo_push_tokens')
        .upsert({
          user_id: userId,
          token,
          platform: Platform.OS,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('❌ Failed to store push token:', error);
      } else {
        console.log('✅ Push token stored successfully');
      }
    } catch (error) {
      console.error('❌ Exception storing push token:', error);
    }
  }

  // Setup notification listeners
  private setupListeners(): void {
    // Handle notification received while app is in foreground
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('🔔 Notification received:', notification);
    });

    // Handle notification tapped
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 Notification tapped:', response);

      // Handle navigation based on notification data
      const data = response.notification.request.content.data;
      if (data?.actionUrl) {
        console.log('🔗 Navigate to:', data.actionUrl);
        // Add navigation logic here
      }
    });
  }

  // Send push notification via Expo API
  public async sendNotification(
    userIds: string | string[],
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    try {
      console.log('📤 Sending push notification...');

      // Get tokens for users
      const targetUserIds = Array.isArray(userIds) ? userIds : [userIds];

      const { data: tokens, error } = await supabase
        .from('expo_push_tokens')
        .select('token')
        .in('user_id', targetUserIds);

      if (error || !tokens || tokens.length === 0) {
        console.error('❌ No push tokens found for users:', targetUserIds);
        return;
      }

      // Prepare push messages
      const messages = tokens.map(tokenData => ({
        to: tokenData.token,
        sound: 'default',
        title,
        body,
        data: data || {},
      }));

      // Send via Expo Push API
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ Push notification sent successfully:', result);
      } else {
        console.error('❌ Failed to send push notification:', result);
      }
    } catch (error) {
      console.error('❌ Exception sending push notification:', error);
    }
  }

  // Send local notification (for testing)
  public async sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
        },
        trigger: null, // Send immediately
      });
      console.log('✅ Local notification sent');
    } catch (error) {
      console.error('❌ Failed to send local notification:', error);
    }
  }

  // Clear token (on logout)
  public async clearToken(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('expo_push_tokens')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Failed to clear push token:', error);
      } else {
        console.log('✅ Push token cleared');
      }

      this.pushToken = null;
    } catch (error) {
      console.error('❌ Exception clearing push token:', error);
    }
  }

  // Get current token
  public getCurrentToken(): string | null {
    return this.pushToken;
  }
}

// Export singleton
export const simplePushService = SimplePushService.getInstance();

// Helper functions
export const initializeSimplePush = (userId: string) => simplePushService.initialize(userId);
export const sendPushNotification = (userIds: string | string[], title: string, body: string, data?: any) =>
  simplePushService.sendNotification(userIds, title, body, data);
export const sendLocalNotification = (title: string, body: string, data?: any) =>
  simplePushService.sendLocalNotification(title, body, data);
export const clearPushToken = (userId: string) => simplePushService.clearToken(userId);
export const getPushToken = () => simplePushService.getCurrentToken();