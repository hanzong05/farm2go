import { router } from 'expo-router';
import React, { useState } from 'react';
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

const { width } = Dimensions.get('window');
const isMobile = width < 768;
const isTablet = width >= 768 && width < 1024;
const isDesktop = width >= 1024;

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
  const [showMobileNav, setShowMobileNav] = useState(false);

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

  return (
    <View style={styles.header}>
      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>F2G</Text>
          </View>
          {!isMobile && (
            <Text style={styles.brandText}>Farm2Go</Text>
          )}
        </View>

        {/* Navigation Items - Desktop & Tablet */}
        {!isMobile && (
          <View style={styles.desktopNavContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.topNavScroll}
              contentContainerStyle={styles.topNavContent}
            >
              {filteredNavItems.map((item) => {
                const isActive = currentRoute === item.route;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.topNavItem,
                      isActive && styles.topNavItemActive
                    ]}
                    onPress={() => handleNavigation(item.route)}
                  >
                    <Icon
                      name={item.icon}
                      size={isDesktop ? 16 : 14}
                      color={isActive ? colors.primary : colors.white}
                      style={styles.topNavIcon}
                    />
                    <Text style={[
                      styles.topNavText,
                      isActive && styles.topNavTextActive
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
        <View style={styles.headerActions}>
          {/* Messages and Notifications - Show on all devices if enabled */}
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

          {/* Download App Button - only show on web */}
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

          {/* Add Button - Hide on mobile if space is tight */}
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
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Icon
                name="search"
                size={isMobile ? 16 : 18}
                color={colors.textSecondary}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
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
        <View style={styles.statsSection}>
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

const styles = StyleSheet.create({
  // Header Styles
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
    paddingHorizontal: isMobile ? 16 : isTablet ? 24 : 32,
    paddingVertical: isMobile ? 8 : 12,
    paddingTop: Platform.OS === 'web' ? (isMobile ? 16 : 20) : (isMobile ? 44 : 48),
    backgroundColor: colors.primary,
    minHeight: isMobile ? 72 : isTablet ? 80 : 88,
  },

  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: isMobile ? 0 : 0.3,
    minWidth: isMobile ? 60 : isTablet ? 140 : 180,
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
    fontSize: isTablet ? 18 : 20,
    fontWeight: 'bold',
    color: colors.white,
    letterSpacing: 0.5,
  },

  // Desktop Navigation
  desktopNavContainer: {
    flex: 1,
    maxWidth: isDesktop ? 800 : 600,
    marginHorizontal: isTablet ? 16 : 24,
  },

  topNavScroll: {
    flex: 1,
  },

  topNavContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: isDesktop ? 12 : 8,
  },

  topNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isDesktop ? 16 : 12,
    paddingVertical: isDesktop ? 10 : 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
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
  },

  topNavTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },

  // Header Actions
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: isMobile ? 0 : 0.3,
    justifyContent: 'flex-end',
    gap: isMobile ? 8 : isTablet ? 12 : 16,
  },

  headerButton: {
    backgroundColor: colors.white,
    paddingHorizontal: isDesktop ? 16 : 12,
    paddingVertical: isDesktop ? 10 : 8,
    borderRadius: 8,
    minHeight: 40,
  },

  headerButtonText: {
    fontSize: isDesktop ? 14 : 12,
    fontWeight: '600',
    color: colors.primary,
  },

  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: isMobile ? 12 : isDesktop ? 16 : 14,
    paddingVertical: isMobile ? 10 : isDesktop ? 10 : 8,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    minHeight: 40,
  },

  downloadText: {
    fontSize: isDesktop ? 14 : 12,
    fontWeight: '600',
    color: colors.white,
  },

  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: isMobile ? 12 : isDesktop ? 16 : 14,
    paddingVertical: isMobile ? 10 : isDesktop ? 10 : 8,
    borderRadius: 8,
    gap: 8,
    minHeight: 40,
  },

  authText: {
    fontSize: isDesktop ? 14 : 12,
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

  // Search Section
  searchSection: {
    paddingHorizontal: isMobile ? 16 : isTablet ? 24 : 32,
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

  filterButton: {
    width: isMobile ? 48 : 56,
    height: isMobile ? 48 : 56,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  // Categories
  categoryScrollView: {
    marginTop: isMobile ? 12 : 16,
  },

  categoryContainer: {
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: isMobile ? 16 : 20,
  },

  simpleCategoryTab: {
    paddingHorizontal: isMobile ? 16 : 20,
    paddingVertical: isMobile ? 8 : 10,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },

  simpleCategoryTabActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  simpleCategoryText: {
    fontSize: isMobile ? 12 : isTablet ? 14 : 16,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
  },

  simpleCategoryTextActive: {
    color: colors.white,
    fontWeight: '600',
  },

  categoryDivider: {
    width: 1,
    height: isMobile ? 14 : 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
  },

  // Stats Section
  statsSection: {
    backgroundColor: colors.gray100,
    paddingHorizontal: isMobile ? 16 : isTablet ? 24 : 32,
    paddingVertical: isMobile ? 12 : 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },

  statsContainer: {
    alignItems: 'center',
    gap: isMobile ? 24 : isTablet ? 32 : 40,
    paddingHorizontal: 8,
  },

  statItem: {
    alignItems: 'center',
    minWidth: isMobile ? 80 : 100,
  },

  statNumber: {
    fontSize: isMobile ? 20 : isTablet ? 24 : 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },

  statLabel: {
    fontSize: isMobile ? 11 : isTablet ? 12 : 14,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Additional responsive fixes
  ...(Platform.OS === 'web' && isDesktop && {
    topBar: {
      paddingHorizontal: 40,
      paddingVertical: 16,
      minHeight: 96,
    },
    searchSection: {
      paddingHorizontal: 40,
      paddingVertical: 20,
    },
    statsSection: {
      paddingHorizontal: 40,
      paddingVertical: 20,
    },
  }),

  // Tablet-specific adjustments
  ...(Platform.OS === 'web' && isTablet && !isDesktop && {
    topBar: {
      paddingHorizontal: 28,
      paddingVertical: 14,
      minHeight: 88,
    },
    searchSection: {
      paddingHorizontal: 28,
      paddingVertical: 18,
    },
    statsSection: {
      paddingHorizontal: 28,
      paddingVertical: 18,
    },
  }),
});