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

type Profile = Database['public']['Tables']['profiles']['Row'];

interface NavItem {
  id: string;
  title: string;
  icon: string;
  route: string;
  userTypes: ('farmer' | 'buyer' | 'admin' | 'super-admin')[];
}

const NAV_ITEMS: NavItem[] = [
  // Farmer items
  {
    id: 'farmer-dashboard',
    title: 'Dashboard',
    icon: 'chart-bar',
    route: '/farmer',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-products',
    title: 'Products',
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

  // Buyer items
  {
    id: 'buyer-marketplace',
    title: 'Marketplace',
    icon: 'store',
    route: '/buyer/marketplace',
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
    id: 'buyer-orders',
    title: 'My Orders',
    icon: 'shopping-bag',
    route: '/buyer/my-orders',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-history',
    title: 'History',
    icon: 'history',
    route: '/buyer/purchase-history',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-verification',
    title: 'Verification',
    icon: 'id-card',
    route: '/verification/status',
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
    id: 'admin-dashboard',
    title: 'Dashboard',
    icon: 'tachometer-alt',
    route: '/admin',
    userTypes: ['admin'],
  },
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
    id: 'super-admin-dashboard',
    title: 'Super Admin',
    icon: 'crown',
    route: '/super-admin',
    userTypes: ['super-admin'],
  },
  {
    id: 'super-admin-users',
    title: 'Manage Users',
    icon: 'users-cog',
    route: '/super-admin/users',
    userTypes: ['super-admin'],
  },
];

interface HeaderComponentProps {
  profile?: Profile | null;
  userType?: 'farmer' | 'buyer' | 'admin' | 'super-admin';
  currentRoute?: string;

  // Search functionality
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
  showNotifications = true,
  notifications = [],
  onNotificationPress,
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  onClearAllNotifications,
  showMessages = true,
  conversations = [],
  onConversationPress,
  onSendMessage,
  onMarkMessageAsRead,
  onNewConversation,
}: HeaderComponentProps) {
  // Use state to track screen dimensions
  const [screenData, setScreenData] = useState(getScreenDimensions());
  const [showMobileNav, setShowMobileNav] = useState(false);

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
      // User is signed in, perform logout
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
        // Fallback redirect if logout fails
        router.replace('/' as any);
      }
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
        'https://farm2go.vercel.app/downloads/farm2go.apk',
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

  const filteredNavItems = NAV_ITEMS.filter(item =>
    item.userTypes.includes(resolvedUserType)
  );

  // Create dynamic styles based on current screen size
  const dynamicStyles = StyleSheet.create({
    header: {
      backgroundColor: colors.white,
      marginBottom: 8,
      ...Platform.select({
        web: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        },
        default: {
          elevation: 2,
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
      paddingHorizontal: isMobile ? 16 : isTablet ? 24 : 40,
      paddingVertical: isMobile ? 8 : 16,
      paddingTop: Platform.OS === 'web' ? (isMobile ? 16 : 20) : (isMobile ? 44 : 48),
      backgroundColor: colors.primary,
      minHeight: isMobile ? 72 : isTablet ? 80 : 96,
    },

    logoSection: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: isMobile ? 0 : 0.25,
      minWidth: isMobile ? 60 : isTablet ? 140 : 200,
    },

    logo: {
      width: isMobile ? 32 : isTablet ? 36 : 40,
      height: isMobile ? 32 : isTablet ? 36 : 40,
      borderRadius: isMobile ? 8 : 10,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: isMobile ? 8 : 12,
    },

    logoText: {
      fontSize: isMobile ? 12 : isTablet ? 14 : 16,
      fontWeight: 'bold',
      color: colors.primary,
    },

    brandText: {
      fontSize: isTablet ? 18 : 22,
      fontWeight: 'bold',
      color: colors.white,
      letterSpacing: 0.5,
    },

    // Desktop Navigation - FIXED
    desktopNavContainer: {
      flex: 1,
      maxWidth: isDesktop ? 800 : 600,
      marginHorizontal: isTablet ? 16 : 32,
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
      paddingHorizontal: isDesktop ? 16 : 12,
      paddingVertical: isDesktop ? 10 : 8,
      borderRadius: 8,
      backgroundColor: 'transparent',
      marginHorizontal: 2,
      minHeight: 40,
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
      marginRight: 8,
    },

    topNavText: {
      fontSize: isDesktop ? 14 : 12,
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
      gap: isMobile ? 8 : isTablet ? 12 : 16,
    },

    searchSection: {
      paddingHorizontal: isMobile ? 16 : isTablet ? 24 : 40,
      paddingVertical: isMobile ? 12 : 16,
      backgroundColor: colors.primary,
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
      borderRadius: 12,
      paddingHorizontal: isMobile ? 16 : 20,
      height: isMobile ? 48 : isTablet ? 52 : 56,
      ...Platform.select({
        web: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        },
        default: {
          elevation: 2,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
      }),
    },

    searchIcon: {
      marginRight: isMobile ? 12 : 16,
    },

    searchInput: {
      flex: 1,
      fontSize: isMobile ? 14 : isTablet ? 16 : 18,
      color: colors.text,
    },

    statsSection: {
      backgroundColor: colors.gray100,
      paddingHorizontal: isMobile ? 16 : isTablet ? 24 : 40,
      paddingVertical: isMobile ? 12 : 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray200,
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
                const isActive = currentRoute === item.route;

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
          {/* Messages and Notifications */}
          {showMessages && (
            <MessageComponent
              conversations={conversations}
              onConversationPress={onConversationPress}
              onSendMessage={onSendMessage}
              onMarkAsRead={onMarkMessageAsRead}
              onNewConversation={onNewConversation}
            />
          )}

          {showNotifications && (
            <NotificationComponent
              notifications={notifications}
              onNotificationPress={onNotificationPress}
              onMarkAsRead={onMarkNotificationAsRead}
              onMarkAllAsRead={onMarkAllNotificationsAsRead}
              onClearAll={onClearAllNotifications}
            />
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
        <View style={styles.mobileNavMenu}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mobileNavContent}
          >
            {filteredNavItems.map((item) => {
              const isActive = currentRoute === item.route;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.mobileNavItem,
                    isActive && styles.mobileNavItemActive
                  ]}
                  onPress={() => {
                    handleNavigation(item.route);
                    setShowMobileNav(false);
                  }}
                >
                  <Icon
                    name={item.icon}
                    size={16}
                    color={isActive ? colors.primary : colors.white}
                    style={styles.mobileNavIcon}
                  />
                  <Text style={[
                    styles.mobileNavText,
                    isActive && styles.mobileNavTextActive
                  ]}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Mobile Add Button */}
          {showAddButton && (
            <TouchableOpacity
              style={styles.mobileAddButton}
              onPress={handleAddPress}
            >
              <Icon name="plus" size={14} color={colors.primary} />
              <Text style={styles.mobileAddButtonText}>{addButtonText}</Text>
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

          {/* Category Tabs */}
          {showCategories && categories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScrollView}
              contentContainerStyle={styles.categoryContainer}
            >
              {categories.map((category, index) => (
                <React.Fragment key={category.key}>
                  <TouchableOpacity
                    style={[
                      styles.simpleCategoryTab,
                      selectedCategory === category.key && styles.simpleCategoryTabActive
                    ]}
                    onPress={() => onCategoryChange?.(category.key)}
                  >
                    <Text style={[
                      styles.simpleCategoryText,
                      selectedCategory === category.key && styles.simpleCategoryTextActive
                    ]}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                  {index < categories.length - 1 && (
                    <View style={styles.categoryDivider} />
                  )}
                </React.Fragment>
              ))}
            </ScrollView>
          )}
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
    </View>
  );
}

// Keep the original styles for components that don't need dynamic changes
const styles = StyleSheet.create({
  headerButton: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 40,
  },

  headerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    minHeight: 40,
  },

  downloadText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },

  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    minHeight: 40,
  },

  authText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },

  mobileMenuButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Mobile Navigation
  mobileNavMenu: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },

  mobileNavContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 16,
  },

  mobileNavItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'transparent',
    minWidth: 80,
    minHeight: 80,
  },

  mobileNavItemActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  mobileNavIcon: {
    marginBottom: 6,
  },

  mobileNavText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.white,
    textAlign: 'center',
    lineHeight: 14,
  },

  mobileNavTextActive: {
    color: colors.white,
    fontWeight: '600',
  },

  mobileAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
    alignSelf: 'center',
  },

  mobileAddButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  // Categories
  categoryScrollView: {
    marginTop: 12,
  },

  categoryContainer: {
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 16,
  },

  simpleCategoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },

  simpleCategoryTabActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  simpleCategoryText: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
  },

  simpleCategoryTextActive: {
    color: colors.white,
    fontWeight: '600',
  },

  categoryDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
  },

  // Stats
  statsContainer: {
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 8,
  },

  statItem: {
    alignItems: 'center',
    minWidth: 80,
  },

  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },

  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});