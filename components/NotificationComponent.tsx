import React, { useState, useRef } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
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
}

interface NotificationComponentProps {
  notifications: Notification[];
  onNotificationPress?: (notification: Notification) => void;
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  onClearAll?: () => void;
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
  gray100: '#f9fafb',
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
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    if (onNotificationPress) {
      onNotificationPress(notification);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

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
      onPress={() => handleNotificationPress(item)}
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
        <Text style={styles.notificationTime}>
          {formatTimestamp(item.timestamp)}
        </Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={[styles.emptyContainer, isDesktop && styles.dropdownEmptyContainer]}>
      <Icon name="bell-slash" size={isDesktop ? 32 : 48} color={colors.gray400} />
      <Text style={[styles.emptyTitle, isDesktop && styles.dropdownEmptyTitle]}>No Notifications</Text>
      <Text style={[styles.emptyDescription, isDesktop && styles.dropdownEmptyDescription]}>
        You're all caught up! New notifications will appear here.
      </Text>
    </View>
  );

  const renderDropdownContent = () => (
    <View style={styles.dropdownContainer}>
      <View style={styles.dropdownHeader}>
        <Text style={styles.dropdownTitle}>Notifications</Text>
        <View style={styles.dropdownHeaderActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.dropdownHeaderButton}
              onPress={onMarkAllAsRead}
            >
              <Text style={styles.dropdownHeaderButtonText}>Mark All Read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.dropdownCloseButton}
            onPress={() => setDropdownVisible(false)}
          >
            <Icon name="times" size={14} color={colors.gray600} />
          </TouchableOpacity>
        </View>
      </View>

      {notifications.length === 0 ? (
        renderEmptyState()
      ) : (
        <View style={styles.dropdownList}>
          <FlatList
            data={notifications.slice(0, 8)} // Limit to 8 notifications for dropdown
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.dropdownNotificationItem,
                  !item.read && styles.dropdownNotificationItemUnread
                ]}
                onPress={() => {
                  handleNotificationPress(item);
                  setDropdownVisible(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownNotificationIcon}>
                  <Icon
                    name={getTypeIcon(item.type)}
                    size={12}
                    color={getTypeColor(item.type)}
                  />
                </View>
                <View style={styles.dropdownNotificationContent}>
                  <Text style={[
                    styles.dropdownNotificationTitle,
                    !item.read && styles.dropdownNotificationTitleUnread
                  ]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.dropdownNotificationMessage} numberOfLines={2}>
                    {item.message}
                  </Text>
                  <Text style={styles.dropdownNotificationTime}>
                    {formatTimestamp(item.timestamp)}
                  </Text>
                </View>
                {!item.read && <View style={styles.dropdownUnreadDot} />}
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            style={styles.dropdownFlatList}
          />

          {notifications.length > 8 && (
            <TouchableOpacity
              style={styles.dropdownViewAllButton}
              onPress={() => {
                setDropdownVisible(false);
                setModalVisible(true);
              }}
            >
              <Text style={styles.dropdownViewAllText}>View All ({notifications.length})</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {notifications.length > 0 && (
        <View style={styles.dropdownFooter}>
          <TouchableOpacity
            style={styles.dropdownClearAllButton}
            onPress={() => {
              onClearAll?.();
              setDropdownVisible(false);
            }}
          >
            <Text style={styles.dropdownClearAllText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      )}
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
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Desktop Dropdown */}
      {isDesktop && dropdownVisible && (
        <>
          <TouchableOpacity
            style={styles.dropdownBackdrop}
            activeOpacity={1}
            onPress={() => setDropdownVisible(false)}
          />
          {renderDropdownContent()}
        </>
      )}

      {/* Mobile/Tablet Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
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

  // Desktop Dropdown Styles
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },

  dropdownBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 5,
    ...Platform.select({
      web: {},
      default: {
        position: 'absolute',
      },
    }),
  },

  dropdownContainer: {
    position: 'absolute',
    top: 45,
    right: 0,
    width: 380,
    maxHeight: 500,
    backgroundColor: colors.white,
    borderRadius: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
      },
      default: {
        elevation: 8,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
    }),
    borderWidth: 1,
    borderColor: colors.gray200,
  },

  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    backgroundColor: colors.gray50,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },

  dropdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },

  dropdownHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  dropdownHeaderButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  dropdownHeaderButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },

  dropdownCloseButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dropdownList: {
    maxHeight: 320,
  },

  dropdownFlatList: {
    maxHeight: 320,
  },

  dropdownNotificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    backgroundColor: colors.white,
  },

  dropdownNotificationItemUnread: {
    backgroundColor: colors.gray50,
  },

  dropdownNotificationIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },

  dropdownNotificationContent: {
    flex: 1,
  },

  dropdownNotificationTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },

  dropdownNotificationTitleUnread: {
    fontWeight: '600',
  },

  dropdownNotificationMessage: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 2,
  },

  dropdownNotificationTime: {
    fontSize: 10,
    color: colors.gray500,
  },

  dropdownUnreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginLeft: 6,
    marginTop: 6,
  },

  dropdownViewAllButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    backgroundColor: colors.gray50,
  },

  dropdownViewAllText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },

  dropdownFooter: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },

  dropdownClearAllButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },

  dropdownClearAllText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },

  // Empty state adjustments for dropdown
  dropdownEmptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
  },

  dropdownEmptyTitle: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 6,
  },

  dropdownEmptyDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
});