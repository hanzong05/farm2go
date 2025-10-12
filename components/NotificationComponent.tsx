import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';

const { width } = Dimensions.get('window');
const isDesktop = width >= 1024;

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  sender?: {
    first_name: string | null;
    last_name: string | null;
  };
  action_data?: any;
}

interface NotificationComponentProps {
  notifications: Notification[];
  onNotificationPress?: (notification: Notification) => void;
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  onClearAll?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
  unreadCount?: number;
  userType?: 'farmer' | 'buyer' | 'admin' | 'super-admin';
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
};

export default function NotificationComponent({
  notifications,
  onNotificationPress,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onRefresh,
  loading = false,
  unreadCount = 0,
  userType,
}: NotificationComponentProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const buttonRef = useRef<View>(null);

  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'check-circle';
      case 'warning':
        return 'exclamation-triangle';
      case 'error':
        return 'times-circle';
      default:
        return 'info-circle';
    }
  };

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'error':
        return colors.danger;
      default:
        return colors.info;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h`;
    } else if (diffInMinutes < 10080) {
      return `${Math.floor(diffInMinutes / 1440)}d`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read first
    if (!notification.read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }

    // Handle navigation based on notification type and data
    try {
      let targetRoute = null;

      if (notification.actionUrl) {
        // Use direct actionUrl if provided
        targetRoute = notification.actionUrl;
      } else if (notification.action_data) {
        // Create smart routing based on notification type and data
        const { type, data } = notification.action_data;

        switch (type) {
          case 'new_order':
          case 'order_updated':
          case 'order_cancelled':
            // Navigate to specific order based on user type
            if (data.orderId) {
              if (userType === 'admin') {
                targetRoute = `/admin/orders/${data.orderId}`;
              } else if (userType === 'farmer') {
                targetRoute = `/farmer/order/${data.orderId}`;
              } else if (userType === 'buyer') {
                targetRoute = `/buyer/orders/${data.orderId}`;
              } else {
                targetRoute = `/order/${data.orderId}`;
              }
            } else {
              if (userType === 'admin') {
                targetRoute = '/admin/orders';
              } else if (userType === 'farmer') {
                targetRoute = '/farmer/orders';
              } else if (userType === 'buyer') {
                targetRoute = '/buyer/my-orders';
              } else {
                targetRoute = '/order';
              }
            }
            break;

          case 'product_approved':
          case 'product_rejected':
          case 'product_updated':
            // Navigate to specific product
            if (data.productId) {
              targetRoute = `/products/${data.productId}`;
            } else {
              targetRoute = '/products';
            }
            break;

          case 'verification_approved':
          case 'verification_rejected':
            // Navigate to verification status
            targetRoute = '/verification/status';
            break;

          case 'new_message':
            // Navigate to messages or specific conversation
            if (data.conversationId) {
              targetRoute = `/messages/${data.conversationId}`;
            } else {
              targetRoute = '/messages';
            }
            break;

          default:
            // Default navigation based on notification title/message content
            if (notification.title.toLowerCase().includes('order')) {
              if (userType === 'admin') {
                targetRoute = '/admin/orders';
              } else if (userType === 'farmer') {
                targetRoute = '/farmer/orders';
              } else if (userType === 'buyer') {
                targetRoute = '/buyer/my-orders';
              } else {
                targetRoute = '/order';
              }
            } else if (notification.title.toLowerCase().includes('product')) {
              if (userType === 'admin') {
                targetRoute = '/admin/products';
              } else if (userType === 'farmer') {
                targetRoute = '/farmer/my-products';
              } else {
                targetRoute = '/products';
              }
            } else if (notification.title.toLowerCase().includes('verification')) {
              targetRoute = '/verification/status';
            } else {
              // Fallback to appropriate home based on user type
              if (userType === 'admin') {
                targetRoute = '/admin/products';
              } else if (userType === 'farmer') {
                targetRoute = '/';
              } else {
                targetRoute = '/';
              }
            }
        }
      } else {
        // Fallback navigation based on notification content
        if (notification.title.toLowerCase().includes('order')) {
          if (userType === 'admin') {
            targetRoute = '/admin/orders';
          } else if (userType === 'farmer') {
            targetRoute = '/farmer/orders';
          } else if (userType === 'buyer') {
            targetRoute = '/buyer/my-orders';
          } else {
            targetRoute = '/order';
          }
        } else if (notification.title.toLowerCase().includes('product')) {
          if (userType === 'admin') {
            targetRoute = '/admin/products';
          } else if (userType === 'farmer') {
            targetRoute = '/farmer/my-products';
          } else {
            targetRoute = '/products';
          }
        } else if (notification.title.toLowerCase().includes('verification')) {
          targetRoute = '/verification/status';
        } else {
          // Default to appropriate home based on user type
          if (userType === 'admin') {
            targetRoute = '/admin/products';
          } else if (userType === 'farmer') {
            targetRoute = '/';
          } else {
            targetRoute = '/';
          }
        }
      }

      // Handle navigation differently for web vs mobile
      if (targetRoute) {
        console.log('Notification clicked - Navigating to:', targetRoute);

        if (Platform.OS === 'web') {
          // For web, try multiple approaches
          try {
            router.push(targetRoute as any);
            console.log('Router.push called for web');
          } catch (error) {
            console.log('Router.push failed, using window.location:', error);
            if (typeof window !== 'undefined') {
              window.location.href = targetRoute;
            }
          }
        } else {
          // For mobile/expo app
          try {
            router.push(targetRoute as any);
            console.log('Router.push called for mobile');
          } catch (error) {
            console.error('Navigation failed on mobile:', error);
          }
        }
      } else {
        console.log('No target route determined for notification:', notification);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback to marketplace on error
      const fallbackRoute = '/products';

      if (Platform.OS === 'web') {
        router.push(fallbackRoute as any);
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            window.location.href = fallbackRoute;
          }, 100);
        }
      } else {
        router.push(fallbackRoute as any);
      }
    }

    // Call custom handler if provided
    if (onNotificationPress) {
      onNotificationPress(notification);
    }
  };

  const calculatedUnreadCount = unreadCount > 0 ? unreadCount : notifications.filter(n => !n.read).length;
  const recentNotifications = notifications.filter(n => {
    const diffInDays = Math.floor((new Date().getTime() - new Date(n.timestamp).getTime()) / (1000 * 60 * 60 * 24));
    return diffInDays === 0;
  });

  const handleToggleNotifications = () => {
    if (isDesktop) {
      setDropdownVisible(!dropdownVisible);
    } else {
      setModalVisible(true);
    }
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !item.read && styles.notificationItemUnread
      ]}
      onPress={() => {
        // Close modal first, then navigate
        setModalVisible(false);
        // Add small delay to ensure modal closes before navigation
        setTimeout(() => {
          handleNotificationPress(item);
        }, 100);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.notificationIcon}>
        <Icon
          name={getTypeIcon(item.type)}
          size={16}
          color={getTypeColor(item.type)}
        />
      </View>
      <View style={styles.notificationContent}>
        <Text style={[
          styles.notificationTitle,
          !item.read && styles.notificationTitleUnread
        ]}>
          {item.title}
        </Text>
        <Text style={styles.notificationMessage} numberOfLines={2}>
          {item.message}
        </Text>
        <View style={styles.notificationMeta}>
          <Text style={styles.notificationTime}>
            {formatTimestamp(item.timestamp)}
          </Text>
          {item.sender && (
            <Text style={styles.notificationSender}>
              • {item.sender.first_name} {item.sender.last_name}
            </Text>
          )}
        </View>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={[styles.emptyContainer, isDesktop && styles.dropdownEmptyContainer]}>
      <Icon name="bell-slash" size={isDesktop ? 40 : 48} color={colors.gray400} />
      <Text style={[styles.emptyTitle, isDesktop && styles.dropdownEmptyTitle]}>No Notifications</Text>
      <Text style={[styles.emptyDescription, isDesktop && styles.dropdownEmptyDescription]}>
        {isDesktop ? 'Your notifications will appear here' : "You're all caught up! New notifications will appear here."}
      </Text>
    </View>
  );

  const renderDesktopDropdownContent = () => (
    <View style={styles.desktopDropdownContainer}>
      <View style={styles.desktopDropdownHeader}>
        <Text style={styles.desktopDropdownTitle}>Notifications</Text>
        <TouchableOpacity
          style={styles.desktopOptionsButton}
          onPress={() => {
            setDropdownVisible(false);
            setModalVisible(true);
          }}
        >
          <Icon name="ellipsis-h" size={16} color={colors.gray600} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.desktopDropdownScrollContainer}
        showsVerticalScrollIndicator={true}
      >
        {notifications.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.desktopNotificationsList}>
            {notifications.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.desktopNotificationItem,
                  !item.read && styles.desktopNotificationItemUnread
                ]}
                onPress={() => {
                  // Close dropdown first, then navigate
                  setDropdownVisible(false);
                  // Add small delay to ensure dropdown closes before navigation
                  setTimeout(() => {
                    handleNotificationPress(item);
                  }, 50);
                }}
                activeOpacity={0.9}
              >
                <View style={styles.desktopNotificationIconContainer}>
                  <View style={[
                    styles.desktopNotificationIcon,
                    { backgroundColor: getTypeColor(item.type) + '20' }
                  ]}>
                    <Icon
                      name={getTypeIcon(item.type)}
                      size={20}
                      color={getTypeColor(item.type)}
                    />
                  </View>
                  {!item.read && (
                    <View style={styles.desktopUnreadIndicator} />
                  )}
                </View>

                <View style={styles.desktopNotificationContent}>
                  <Text style={[
                    styles.desktopNotificationTitle,
                    !item.read && styles.desktopNotificationTitleUnread
                  ]}>
                    {item.title}
                  </Text>
                  <Text style={[
                    styles.desktopNotificationMessage,
                    !item.read && styles.desktopNotificationMessageUnread
                  ]} numberOfLines={2}>
                    {item.message}
                  </Text>
                  <Text style={styles.desktopTimestamp}>
                    {formatTimestamp(item.timestamp)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.notificationWrapper}>
      <View ref={buttonRef}>
        <TouchableOpacity
          style={styles.bellButton}
          onPress={handleToggleNotifications}
        >
          <Icon name="bell" size={18} color={colors.white} />
          {calculatedUnreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {calculatedUnreadCount > 99 ? '99+' : calculatedUnreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Desktop Dropdown */}
      {isDesktop && dropdownVisible && (
        <View style={styles.dropdownContainer}>
          <TouchableOpacity
            style={styles.dropdownBackdrop}
            activeOpacity={1}
            onPress={() => setDropdownVisible(false)}
          />
          <View style={styles.dropdownContentWrapper}>
            {renderDesktopDropdownContent()}
          </View>
        </View>
      )}

      {/* Mobile/Tablet Modal */}
      <Modal
        visible={modalVisible}
        animationKeyframesType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['bottom']}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={onMarkAllAsRead}
                >
                  <Text style={styles.headerButtonText}>Mark All Read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Icon name="times" size={20} color={colors.gray600} />
              </TouchableOpacity>
            </View>
          </View>

          {notifications.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={notifications}
              renderItem={renderNotificationItem}
              keyExtractor={(item) => item.id}
              style={styles.notificationsList}
              showsVerticalScrollIndicator={false}
              refreshControl={
                onRefresh ? (
                  <RefreshControl
                    refreshing={loading}
                    onRefresh={onRefresh}
                    colors={[colors.primary]}
                    tintColor={colors.primary}
                  />
                ) : undefined
              }
            />
          )}

          {notifications.length > 0 && (
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.clearAllButton}
                onPress={onClearAll}
              >
                <Text style={styles.clearAllText}>Clear All Notifications</Text>
              </TouchableOpacity>
            </View>
          )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  notificationWrapper: {
    position: 'relative',
  },

  bellButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.white,
  },

  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // Desktop Dropdown Styles (Facebook-like)
  dropdownContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },

  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },

  dropdownContentWrapper: {
    position: 'absolute',
    top: 45,
    right: 0,
    zIndex: 10000,
  },

  desktopDropdownContainer: {
    width: 380,
    maxHeight: 500,
    backgroundColor: colors.white,
    borderRadius: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)',
      },
      default: {
        elevation: 999,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
    }),
    borderWidth: 1,
    borderColor: colors.gray200,
  },

  desktopDropdownScrollContainer: {
    maxHeight: 420,
    minHeight: 200,
  },

  desktopDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },

  desktopDropdownTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },

  desktopOptionsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
      },
    }),
  },

  desktopNotificationSection: {
    paddingVertical: 8,
  },

  desktopSectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },

  desktopSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },

  desktopNotificationsList: {
    paddingVertical: 4,
  },

  desktopNotificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginHorizontal: 8,
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
      },
    }),
  },

  desktopNotificationItemUnread: {
    backgroundColor: colors.gray50,
  },

  desktopNotificationIconContainer: {
    position: 'relative',
    marginRight: 12,
  },

  desktopNotificationIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  desktopUnreadIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
  },

  desktopNotificationContent: {
    flex: 1,
    paddingTop: 2,
  },

  desktopNotificationTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
    lineHeight: 20,
  },

  desktopNotificationTitleUnread: {
    fontWeight: '600',
  },

  desktopNotificationMessage: {
    fontSize: 13,
    color: colors.gray600,
    lineHeight: 18,
    marginBottom: 4,
  },

  desktopNotificationMessageUnread: {
    color: colors.text,
    fontWeight: '500',
  },

  desktopTimestamp: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },

  desktopDropdownFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    paddingVertical: 8,
  },

  desktopViewAllButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  desktopViewAllText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500',
  },

  // Empty state adjustments for dropdown
  dropdownEmptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
  },

  dropdownEmptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },

  dropdownEmptyDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.gray600,
  },

  // Mobile Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 60,
    backgroundColor: colors.primary,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  headerButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },

  headerButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },

  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationsList: {
    flex: 1,
    paddingTop: 8,
  },

  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    backgroundColor: colors.white,
  },

  notificationItemUnread: {
    backgroundColor: colors.gray100,
  },

  notificationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  notificationContent: {
    flex: 1,
  },

  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },

  notificationTitleUnread: {
    fontWeight: 'bold',
  },

  notificationMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },

  notificationTime: {
    fontSize: 12,
    color: colors.gray500,
  },

  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  notificationSender: {
    fontSize: 12,
    color: colors.gray400,
    marginLeft: 4,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
    marginTop: 8,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },

  emptyDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },

  clearAllButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },

  clearAllText: {
    fontSize: 16,
    color: colors.danger,
    fontWeight: '600',
  },
});