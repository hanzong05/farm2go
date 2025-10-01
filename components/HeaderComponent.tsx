import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useCustomAlert } from './CustomAlert';

// Get window dimensions and add listener for changes
const getScreenDimensions = () => {
  const { width, height } = Dimensions.get('window');
  return {
    width,
    height,
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024
  };
};

import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../lib/supabase';
import { logoutUser } from '../services/auth';
import { Database } from '../types/database';
import MessageComponent, { Conversation } from './MessageComponent';
import NotificationComponent, { Notification } from './NotificationComponent';
import RealtimeStatus from './RealtimeStatus';
import { useNotifications } from '../hooks/useNotifications';
import { useSimplePush } from '../hooks/useSimplePush';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface NavItem {
  id: string;
  title: string;
  icon: string;
  route: string;
  userTypes: ('farmer' | 'buyer' | 'admin' | 'super-admin')[];
}

const NAV_ITEMS: NavItem[] = [
  // Marketplace - accessible only to farmers and buyers (app/index.tsx)
  {
    id: 'marketplace',
    title: 'Marketplace',
    icon: 'store',
    route: '/',
    userTypes: ['farmer', 'buyer'],
  },

  // Farmer items
  {
    id: 'farmer-products',
    title: 'My Products',
    icon: 'seedling',
    route: '/farmer/my-products',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-add-product',
    title: 'Add Product',
    icon: 'plus',
    route: '/farmer/products/add',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-orders',
    title: 'Orders',
    icon: 'box',
    route: '/farmer/orders',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-inventory',
    title: 'Inventory',
    icon: 'clipboard-list',
    route: '/farmer/inventory',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-sales',
    title: 'Sales',
    icon: 'dollar-sign',
    route: '/farmer/sales-history',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-settings',
    title: 'Settings',
    icon: 'cog',
    route: '/farmer/settings',
    userTypes: ['farmer'],
  },

  // Buyer items
  {
    id: 'buyer-orders',
    title: 'My Orders',
    icon: 'shopping-bag',
    route: '/buyer/my-orders',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-search',
    title: 'Search',
    icon: 'search',
    route: '/buyer/search',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-purchase-history',
    title: 'Purchase History',
    icon: 'history',
    route: '/buyer/purchase-history',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-settings',
    title: 'Settings',
    icon: 'cog',
    route: '/buyer/settings',
    userTypes: ['buyer'],
  },

  // Farmer verification
  {
    id: 'farmer-verification',
    title: 'Verification',
    icon: 'id-card',
    route: '/verification/status',
    userTypes: ['farmer'],
  },

  // Admin items
  {
    id: 'admin-users',
    title: 'Users',
    icon: 'users',
    route: '/admin/users',
    userTypes: ['admin'],
  },
  {
    id: 'admin-products',
    title: 'Products',
    icon: 'check-circle',
    route: '/admin/products',
    userTypes: ['admin'],
  },
  {
    id: 'admin-verifications',
    title: 'Verifications',
    icon: 'id-badge',
    route: '/admin/verifications',
    userTypes: ['admin'],
  },
  {
    id: 'admin-settings',
    title: 'Settings',
    icon: 'cog',
    route: '/admin/settings',
    userTypes: ['admin'],
  },

  // Super Admin items
  {
    id: 'super-admin-users',
    title: 'Manage Users',
    icon: 'users-cog',
    route: '/super-admin/users',
    userTypes: ['super-admin'],
  },
  {
    id: 'super-admin-settings',
    title: 'System Settings',
    icon: 'cogs',
    route: '/super-admin/settings',
    userTypes: ['super-admin'],
  },
  {
    id: 'super-admin-reports',
    title: 'System Reports',
    icon: 'chart-line',
    route: '/super-admin/reports',
    userTypes: ['super-admin'],
  },
  {
    id: 'super-admin-backup',
    title: 'Backup & Restore',
    icon: 'database',
    route: '/super-admin/backup',
    userTypes: ['super-admin'],
  },
];

interface HeaderComponentProps {
  profile?: Profile | null;
  userType?: 'farmer' | 'buyer' | 'admin' | 'super-admin';
  currentRoute?: string;

  showSearch?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;

  // Category tabs
  showCategories?: boolean;
  categories?: Array<{
    key: string;
    label: string;
    color: string;
  }>;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;

  // Stats banner
  showStats?: boolean;
  stats?: Array<{
    number: string | number;
    label: string;
  }>;

  // Action buttons
  showAddButton?: boolean;
  addButtonText?: string;
  addButtonRoute?: string;
  onAddButtonPress?: () => void;

  // Filter button
  showFilterButton?: boolean;
  onFilterPress?: () => void;

  // Notifications
  showNotifications?: boolean;
  notifications?: Notification[];
  onNotificationPress?: (notification: Notification) => void;
  onMarkNotificationAsRead?: (notificationId: string) => void;
  onMarkAllNotificationsAsRead?: () => void;
  onClearAllNotifications?: () => void;

  // Messages
  showMessages?: boolean;
  conversations?: Conversation[];
  onConversationPress?: (conversation: Conversation) => void;
  onSendMessage?: (conversationId: string, content: string) => void;
  onMarkMessageAsRead?: (conversationId: string) => void;
  onNewConversation?: () => void;
}

// Farm2Go green color scheme
const colors = {
  primary: '#059669',
  secondary: '#10b981',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
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

export default function HeaderComponent({
  profile,
  userType,
  currentRoute = '',
  showSearch = true,
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  showCategories = false,
  categories = [],
  selectedCategory = 'all',
  onCategoryChange,
  showStats = false,
  stats = [],
  showAddButton = false,
  addButtonText = '+ Add',
  addButtonRoute,
  onAddButtonPress,
  showFilterButton = false,
  onFilterPress,
  showNotifications = false,
  notifications = [],
  onNotificationPress,
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  onClearAllNotifications,
  showMessages = false,
  conversations = [],
  onConversationPress,
  onSendMessage,
  onMarkMessageAsRead,
  onNewConversation,
}: HeaderComponentProps) {
  // Use state to track screen dimensions
  const [screenData, setScreenData] = useState(getScreenDimensions());
  const [showMobileNav, setShowMobileNav] = useState(false);

  // State to manage message and notification panel visibility
  const [activePanel, setActivePanel] = useState<'messages' | 'notifications' | null>(null);

  // Custom alert hook for web/mobile compatibility
  const { showAlert, AlertComponent } = useCustomAlert();

  // Real-time notifications
  const {
    notifications: realtimeNotifications,
    unreadCount,
    markAsRead,
    refreshNotifications
  } = useNotifications(profile?.id || null);

  // Push notifications hook
  const { sendTestNotification, isInitialized, pushToken } = useSimplePush(profile?.id || null);

  // For debugging: show push status
  useEffect(() => {
    if (profile?.id) {
      console.log('🔍 Push notification status:', {
        isInitialized,
        hasPushToken: !!pushToken,
        platform: Platform.OS,
        userId: profile.id
      });
    }
  }, [isInitialized, pushToken, profile?.id]);

  // Helper function to convert notification type
  const getNotificationType = (type: string): 'info' | 'success' | 'warning' | 'error' => {
    if (type.includes('approved')) return 'success';
    if (type.includes('rejected') || type.includes('deleted')) return 'error';
    if (type.includes('pending')) return 'warning';
    return 'info';
  };

  // Convert real-time notifications to the format expected by NotificationComponent
  const convertedNotifications: Notification[] = realtimeNotifications.map(notif => ({
    id: notif.id,
    title: notif.title,
    message: notif.message,
    type: getNotificationType(notif.type),
    timestamp: notif.created_at,
    read: notif.is_read,
    actionUrl: notif.action_url
  }));

  // Update dimensions on window resize
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleResize = () => {
        setScreenData(getScreenDimensions());
      };
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const { isMobile, isTablet, isDesktop } = screenData;

  // Determine user type from profile if not explicitly passed
  const resolvedUserType = userType || profile?.user_type || 'buyer';

  // Get the current route to determine active navigation item
  const getCurrentRoute = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return currentRoute;
  };

  const activeRoute = getCurrentRoute();

  const handleAddPress = () => {
    if (onAddButtonPress) {
      onAddButtonPress();
    } else if (addButtonRoute) {
      router.push(addButtonRoute as any);
    }
  };

  const handleNavigation = (route: string) => {
    router.push(route as any);
  };

  const handleAuthAction = async () => {
    if (profile) {
      // User is signed in, show logout confirmation
      showAlert(
        'Confirm Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              try {
                console.log('🚪 Starting logout process...');
                await logoutUser();
                console.log('✅ Logout completed, session cleared');

                // Redirect to landing page (marketplace)
                console.log('🔄 Redirecting to landing page...');
                router.replace('/' as any);
                console.log('✅ Redirect to landing page completed');
              } catch (error) {
                console.error('❌ Logout error:', error);
              }
            },
          },
        ]
      );
    } else {
      // No user signed in, redirect to login page
      console.log('🔄 Redirecting to login...');
      router.replace('/auth/login' as any);
    }
  };

  const handleDownloadApp = () => {
    if (Platform.OS === 'web') {
      // For web users, show download options
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

      // Multiple download options
      const downloadUrls = [
        'https://github.com/hanz-pillerva/farm2go/releases/latest/download/farm2go.apk',
        'exp://192.168.100.52:8081/downloads/farm2go.apk',
        (() => {
          const { data: apkData } = supabase.storage.from('app').getPublicUrl('farm2go.apk');
          return apkData.publicUrl;
        })()
      ];

      if (/android/i.test(userAgent)) {
        console.log('Android detected - downloading APK');
        tryDownloads(downloadUrls);
      } else if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
        if (confirm('Farm2Go app is currently available for Android devices only. Download APK anyway?')) {
          tryDownloads(downloadUrls);
        }
      } else {
        const confirmed = confirm('Download Farm2Go APK for Android? This file can be transferred to your Android device for installation.');
        if (confirmed) {
          tryDownloads(downloadUrls);
        }
      }
    } else {
      router.push('/about' as any);
    }
  };

  const tryDownloads = (urls: string[]) => {
    const primaryUrl = urls[0];
    window.open(primaryUrl, '_blank');
    console.log('Primary download:', primaryUrl);
    console.log('Alternative downloads available:', urls.slice(1));
  };

  const handleTestNotification = async () => {
    if (!profile?.id) {
      console.warn('⚠️ No user logged in for push notification test');
      return;
    }

    try {
      await sendTestNotification();
      console.log('✅ Test notification sent successfully');
    } catch (error) {
      console.error('❌ Failed to send test notification:', error);
    }
  };

  // Filter navigation items based on user type - this ensures only role-appropriate nav items are shown
  const filteredNavItems = NAV_ITEMS.filter(item =>
    item.userTypes.includes(resolvedUserType)
  );

  // Function to determine if a nav item should be active
  const isNavItemActive = (item: NavItem) => {
    // Always show the navigation for the user's role, regardless of current page
    // Only highlight the item if we're actually on that route
    return activeRoute === item.route;
  };

  // Create dynamic styles based on current screen size
  const dynamicStyles = StyleSheet.create({
    header: {
      backgroundColor: colors.white,
      marginBottom: 2,
      zIndex: 1000,
      elevation: 1000,
      position: 'relative',
      ...Platform.select({
        web: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: 1000,
          position: 'relative',
        },
        default: {
          elevation: 1000,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
      }),
    },

    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: isMobile ? 12 : isTablet ? 16 : 24,
      paddingVertical: isMobile ? 2 : 4,
      paddingTop: Platform.OS === 'web' ? (isMobile ? 8 : 12) : (isMobile ? 36 : 40),
      backgroundColor: colors.primary,
      minHeight: isMobile ? 44 : isTablet ? 52 : 60,
    },

    logoSection: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: isMobile ? 0 : 0.25,
      minWidth: isMobile ? 60 : isTablet ? 140 : 200,
    },

    logo: {
      width: isMobile ? 24 : isTablet ? 28 : 32,
      height: isMobile ? 24 : isTablet ? 28 : 32,
      borderRadius: isMobile ? 6 : 8,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: isMobile ? 6 : 8,
    },

    logoText: {
      fontSize: isMobile ? 10 : isTablet ? 12 : 14,
      fontWeight: 'bold',
      color: colors.primary,
    },

    brandText: {
      fontSize: isTablet ? 14 : 18,
      fontWeight: 'bold',
      color: colors.white,
      letterSpacing: 0.3,
    },

    // Desktop Navigation - FIXED
    desktopNavContainer: {
      flex: 1,
      maxWidth: isDesktop ? 800 : 600,
      marginHorizontal: isTablet ? 12 : 24,
      height: '100%',
      justifyContent: 'center',
    },

    topNavScroll: {
      flex: 1,
    },

    topNavContent: {
      alignItems: 'center',
      paddingHorizontal: 8,
      flexDirection: 'row',
      gap: isDesktop ? 8 : 4,
      minHeight: 40,
    },

    topNavItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isDesktop ? 8 : 6,
      paddingVertical: isDesktop ? 4 : 3,
      borderRadius: 6,
      backgroundColor: 'transparent',
      marginHorizontal: 1,
      minHeight: 24,
      ...(Platform.OS === 'web' ? {
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
      } : {}),
    },

    topNavItemActive: {
      backgroundColor: colors.white,
      ...Platform.select({
        web: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        },
        default: {
          elevation: 2,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
        },
      }),
    },

    topNavIcon: {
      marginRight: 4,
    },

    topNavText: {
      fontSize: isDesktop ? 12 : 10,
      fontWeight: '500',
      color: colors.white,
      ...(Platform.OS === 'web' && {
        whiteSpace: 'nowrap' as any,
      }),
    },

    topNavTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },

    // Header Actions - FIXED
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: isMobile ? 0 : 0.25,
      justifyContent: 'flex-end',
      gap: isMobile ? 6 : isTablet ? 8 : 10,
      minWidth: isMobile ? 120 : 'auto',
    },

    searchSection: {
      paddingHorizontal: isMobile ? 12 : isTablet ? 16 : 24,
      paddingVertical: isMobile ? 4 : 8,
      backgroundColor: colors.primary,
      zIndex: -1,
      position: 'relative',
      ...Platform.select({
        web: {
          zIndex: -1,
        },
        default: {
          elevation: 0,
        },
      }),
    },

    searchContainer: {
      flexDirection: 'row',
      gap: isMobile ? 8 : 12,
      alignItems: 'center',
    },

    searchInputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.white,
      borderRadius: 8,
      paddingHorizontal: isMobile ? 8 : 12,
      height: isMobile ? 32 : isTablet ? 36 : 40,
      zIndex: -1,
      position: 'relative',
      ...Platform.select({
        web: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: -1,
        },
        default: {
          elevation: 0,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
      }),
    },

    searchIcon: {
      marginRight: isMobile ? 8 : 12,
    },

    searchInput: {
      flex: 1,
      fontSize: isMobile ? 12 : isTablet ? 14 : 16,
      color: colors.text,
    },

    statsSection: {
      backgroundColor: colors.gray100,
      paddingHorizontal: isMobile ? 12 : isTablet ? 16 : 24,
      paddingVertical: isMobile ? 4 : 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray200,
      zIndex: 1,
      elevation: 1,
      position: 'relative',
      ...Platform.select({
        web: {
          zIndex: 1,
        },
        default: {
          elevation: 1,
        },
      }),
    },

    // Mobile Navigation - Dynamic Styles
    mobileNavMenu: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.2)',
      maxHeight: 200,
    },

    mobileNavGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingHorizontal: 4,
      gap: 8,
    },

    mobileNavItem: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: screenData.width < 375 ? 8 : 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: 'transparent',
      minWidth: screenData.width < 375 ? 65 : 80,
      maxWidth: screenData.width < 375 ? 75 : 90,
      minHeight: 60,
    },

    mobileNavItemActive: {
      backgroundColor: 'rgba(255,255,255,0.25)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },

    mobileNavIcon: {
      marginBottom: 4,
    },

    mobileNavText: {
      fontSize: screenData.width < 375 ? 9 : 10,
      fontWeight: '500',
      color: colors.white,
      textAlign: 'center',
      lineHeight: screenData.width < 375 ? 11 : 13,
    },

    mobileNavTextActive: {
      color: colors.white,
      fontWeight: '700',
    },

    mobileAddButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.white,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      marginTop: 8,
      gap: 6,
      alignSelf: 'center',
      minHeight: 36,
    },

    mobileAddButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
  });

  return (
    <View style={dynamicStyles.header}>
      {/* Top Navigation Bar */}
      <View style={dynamicStyles.topBar}>
        {/* Logo Section */}
        <View style={dynamicStyles.logoSection}>
          <View style={dynamicStyles.logo}>
            <Text style={dynamicStyles.logoText}>F2G</Text>
          </View>
          {!isMobile && (
            <Text style={dynamicStyles.brandText}>Farm2Go</Text>
          )}
        </View>

        {/* Navigation Items - Desktop & Tablet */}
        {!isMobile && filteredNavItems.length > 0 && (
          <View style={dynamicStyles.desktopNavContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={dynamicStyles.topNavScroll}
              contentContainerStyle={dynamicStyles.topNavContent}
            >
              {filteredNavItems.map((item) => {
                const isActive = isNavItemActive(item);

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      dynamicStyles.topNavItem,
                      isActive && dynamicStyles.topNavItemActive
                    ]}
                    onPress={() => handleNavigation(item.route)}
                  >
                    <Icon
                      name={item.icon}
                      size={isDesktop ? 16 : 14}
                      color={isActive ? colors.primary : colors.white}
                      style={dynamicStyles.topNavIcon}
                    />
                    <Text style={[
                      dynamicStyles.topNavText,
                      isActive && dynamicStyles.topNavTextActive
                    ]}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Header Actions */}
        <View style={dynamicStyles.headerActions}>
          {/* Real-time Status Indicator */}
          <View style={styles.notificationContainer}>
            <RealtimeStatus size="small" />
          </View>

          {/* Messages and Notifications - Always show on all devices */}
          {showMessages && (
            <View style={styles.notificationContainer}>
              <MessageComponent
                key={`messages-${profile?.id}`}
                currentUserId={profile?.id}
                onConversationPress={onConversationPress}
                onNewConversation={onNewConversation}
                visible={true}
              />
            </View>
          )}

          {showNotifications && (
            <View style={styles.notificationContainer}>
              <NotificationComponent
                key={`notifications-${profile?.id}`}
                notifications={convertedNotifications}
                onMarkAsRead={(notificationId) => {
                  markAsRead(notificationId);
                  // Call original handler if provided
                  if (onMarkNotificationAsRead) {
                    onMarkNotificationAsRead(notificationId);
                  }
                }}
                onMarkAllAsRead={() => {
                  // Mark all as read
                  convertedNotifications.forEach(notif => {
                    if (!notif.read) {
                      markAsRead(notif.id);
                    }
                  });
                  // Call original handler if provided
                  if (onMarkAllNotificationsAsRead) {
                    onMarkAllNotificationsAsRead();
                  }
                }}
                onClearAll={onClearAllNotifications}
                onRefresh={refreshNotifications}
                loading={false}
                unreadCount={unreadCount}
              />
            </View>
          )}

          {/* Push Notification Test Button */}
          {profile && (
            <TouchableOpacity
              style={[styles.testNotificationButton, !isInitialized && styles.disabledButton]}
              onPress={handleTestNotification}
              disabled={!isInitialized}
            >
              <Icon
                name="rocket"
                size={isMobile ? 14 : 16}
                color={isInitialized ? colors.white : colors.gray400}
              />
              {!isMobile && (
                <Text style={[styles.testNotificationText, !isInitialized && styles.disabledText]}>
                  Test Push
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Download App Button */}
          {Platform.OS === 'web' && (
            <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadApp}>
              <Icon
                name="download"
                size={isMobile ? 14 : 16}
                color={colors.white}
              />
              {!isMobile && (
                <Text style={styles.downloadText}>Get App</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Add Button */}
          {showAddButton && !isMobile && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleAddPress}
            >
              <Text style={styles.headerButtonText}>{addButtonText}</Text>
            </TouchableOpacity>
          )}

          {/* Auth Button */}
          <TouchableOpacity style={styles.authButton} onPress={handleAuthAction}>
            <Icon
              name={profile ? "sign-out-alt" : "sign-in-alt"}
              size={isMobile ? 14 : 16}
              color={colors.white}
            />
            {!isMobile && (
              <Text style={styles.authText}>
                {profile ? "Log Out" : "Sign In"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Mobile Menu Button */}
          {isMobile && (
            <TouchableOpacity
              style={styles.mobileMenuButton}
              onPress={() => setShowMobileNav(!showMobileNav)}
            >
              <Icon
                name={showMobileNav ? "times" : "bars"}
                size={18}
                color={colors.white}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mobile Navigation Menu */}
      {isMobile && showMobileNav && (
        <View style={dynamicStyles.mobileNavMenu}>
          <View style={dynamicStyles.mobileNavGrid}>
            {filteredNavItems.map((item) => {
              const isActive = isNavItemActive(item);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    dynamicStyles.mobileNavItem,
                    isActive && dynamicStyles.mobileNavItemActive
                  ]}
                  onPress={() => {
                    handleNavigation(item.route);
                    setShowMobileNav(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={item.icon}
                    size={screenData.width < 375 ? 16 : 18}
                    color={colors.white}
                    style={dynamicStyles.mobileNavIcon}
                  />
                  <Text style={[
                    dynamicStyles.mobileNavText,
                    isActive && dynamicStyles.mobileNavTextActive
                  ]} numberOfLines={1}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Mobile Add Button */}
          {showAddButton && (
            <TouchableOpacity
              style={dynamicStyles.mobileAddButton}
              onPress={handleAddPress}
              activeOpacity={0.7}
            >
              <Icon name="plus" size={16} color={colors.primary} />
              <Text style={dynamicStyles.mobileAddButtonText}>{addButtonText}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Search Section */}
      {showSearch && (
        <View style={dynamicStyles.searchSection}>
          <View style={dynamicStyles.searchContainer}>
            <View style={dynamicStyles.searchInputContainer}>
              <Icon
                name="search"
                size={isMobile ? 16 : 18}
                color={colors.textSecondary}
                style={dynamicStyles.searchIcon}
              />
              <TextInput
                style={dynamicStyles.searchInput}
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChangeText={onSearchChange}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            {showFilterButton && (
              <TouchableOpacity style={styles.filterButton} onPress={onFilterPress}>
                <Icon
                  name="cog"
                  size={isMobile ? 16 : 18}
                  color={colors.white}
                />
              </TouchableOpacity>
            )}
          </View>

        </View>
      )}

      {/* Stats Section */}
      {showStats && stats.length > 0 && (
        <View style={dynamicStyles.statsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsContainer}
          >
            {stats.map((stat, index) => (
              <View key={index} style={styles.statItem}>
                <Text style={styles.statNumber}>{stat.number}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Custom Alert for web/mobile compatibility */}
      {AlertComponent}
    </View>
  );
}

// Keep the original styles for components that don't need dynamic changes
const styles = StyleSheet.create({
  notificationContainer: {
    zIndex: 99999,
    elevation: 9999,
    position: 'relative',
    ...Platform.select({
      web: {
        zIndex: 99999,
        position: 'relative',
      },
      default: {
        elevation: 9999,
      },
    }),
  },

  headerButton: {
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minHeight: 28,
  },

  headerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    minHeight: 28,
  },

  downloadText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },

  testNotificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    minHeight: 28,
  },

  testNotificationText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },

  disabledButton: {
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    borderColor: 'rgba(107, 114, 128, 0.3)',
  },

  disabledText: {
    color: colors.gray400,
  },

  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
    minHeight: 28,
  },

  authText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },

  mobileMenuButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },


  filterButton: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },


  // Stats
  statsContainer: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 4,
  },

  statItem: {
    alignItems: 'center',
    minWidth: 60,
  },

  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 2,
  },

  statLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});