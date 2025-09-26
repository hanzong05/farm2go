import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  subscribeToNotifications,
  getUserNotifications,
  markNotificationAsRead,
  getUnreadNotificationCount
} from '../services/notifications';

export interface NotificationData {
  id: string;
  recipient_id: string;
  sender_id: string | null;
  type: string;
  title: string;
  message: string;
  action_url: string | null;
  action_data: any;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  sender?: {
    first_name: string | null;
    last_name: string | null;
  };
}

export interface UseNotificationsResult {
  notifications: NotificationData[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  playNotificationSound: () => void;
}

export const useNotifications = (userId: string | null): UseNotificationsResult => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load notifications
  const loadNotifications = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      const [notificationsData, count] = await Promise.all([
        getUserNotifications(userId, 50),
        getUnreadNotificationCount(userId)
      ]);

      setNotifications(notificationsData);
      setUnreadCount(count);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);

      // Update local state
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId
            ? { ...notif, is_read: true, read_at: new Date().toISOString() }
            : notif
        )
      );

      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
      Alert.alert('Error', 'Failed to mark notification as read');
    }
  };

  // Play notification sound (mock implementation)
  const playNotificationSound = () => {
    // In a real implementation, you would play a sound here
    console.log('🔔 Notification sound played');
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!userId) return;

    console.log('🔔 Setting up notification subscription for user:', userId);

    const subscription = subscribeToNotifications(userId, (newNotification: NotificationData) => {
      console.log('🔔 New real-time notification received:', newNotification);

      // Add new notification to the list
      setNotifications(prev => [newNotification, ...prev]);

      // Increment unread count if notification is unread
      if (!newNotification.is_read) {
        setUnreadCount(prev => prev + 1);
      }

      // Play notification sound
      playNotificationSound();

      // Show in-app notification alert for important notifications
      if (newNotification.type.includes('approved') || newNotification.type.includes('rejected')) {
        Alert.alert(
          newNotification.title,
          newNotification.message,
          [
            {
              text: 'OK',
              onPress: () => markAsRead(newNotification.id)
            }
          ]
        );
      }
    });

    return () => {
      console.log('🔔 Cleaning up notification subscription');
      subscription.unsubscribe();
    };
  }, [userId]);

  // Load initial notifications
  useEffect(() => {
    loadNotifications();
  }, [userId]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    refreshNotifications: loadNotifications,
    playNotificationSound
  };
};