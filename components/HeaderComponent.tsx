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

  return (
    <View style={styles.header}>
      {/* Top Navigation Bar */}
      <View style={[
        styles.topBar,
        isMobile && styles.topBarMobile,
        isTablet && styles.topBarTablet,
        isDesktop && styles.topBarDesktop
      ]}>
        {/* Logo Section */}
        <View style={[
          styles.logoSection,
          isMobile && styles.logoSectionMobile,
          isDesktop && styles.logoSectionDesktop
        ]}>
          <View style={[
            styles.logo,
            isMobile && styles.logoMobile,
            isTablet && styles.logoTablet,
            isDesktop && styles.logoDesktop
          ]}>
            <Text style={[
              styles.logoText,
              isMobile && styles.logoTextMobile,
              isTablet && styles.logoTextTablet,
              isDesktop && styles.logoTextDesktop
            ]}>F2G</Text>
          </View>
          {!isMobile && (
            <Text style={[
              styles.brandText,
              isTablet && styles.brandTextTablet,
              isDesktop && styles.brandTextDesktop
            ]}>Farm2Go</Text>
          )}
        </View>

        {/* Navigation Items - Desktop & Tablet */}
        {!isMobile && filteredNavItems.length > 0 && (
          <View style={[
            styles.desktopNavContainer,
            isTablet && styles.desktopNavContainerTablet,
            isDesktop && styles.desktopNavContainerDesktop
          ]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.topNavScroll}
              contentContainerStyle={[
                styles.topNavContent,
                isTablet && styles.topNavContentTablet,
                isDesktop && styles.topNavContentDesktop
              ]}
            >
              {filteredNavItems.map((item) => {
                const isActive = currentRoute === item.route;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.topNavItem,
                      isTablet && styles.topNavItemTablet,
                      isDesktop && styles.topNavItemDesktop,
                      isActive && styles.topNavItemActive
                    ]}
                    onPress={() => handleNavigation(item.route)}
                  >
                    <Icon
                      name={item.icon}
                      size={isDesktop ? 14 : 12}
                      color={isActive ? colors.primary : colors.white}
                      style={styles.topNavIcon}
                    />
                    <Text style={[
                      styles.topNavText,
                      isTablet && styles.topNavTextTablet,
                      isDesktop && styles.topNavTextDesktop,
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
        <View style={[
          styles.headerActions,
          isMobile && styles.headerActionsMobile,
          isTablet && styles.headerActionsTablet,
          isDesktop && styles.headerActionsDesktop
        ]}>
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
          {Platform.OS === 'web' && !isMobile && (
            <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadApp}>
              <Icon
                name="download"
                size={14}
                color={colors.white}
              />
              <Text style={styles.downloadText}>Get App</Text>
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
          <TouchableOpacity style={[
            styles.authButton,
            isMobile && styles.authButtonMobile
          ]} onPress={handleAuthAction}>
            <Icon
              name={profile ? "sign-out-alt" : "sign-in-alt"}
              size={isMobile ? 16 : 14}
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
            style={styles.mobileNavScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={[
              styles.mobileNavGrid,
              screenData.width < 375 && styles.mobileNavGridSmall
            ]}>
              {filteredNavItems.map((item) => {
                const isActive = currentRoute === item.route;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.mobileNavItem,
                      screenData.width < 375 && styles.mobileNavItemSmall,
                      isActive && styles.mobileNavItemActive
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
                      style={styles.mobileNavIcon}
                    />
                    <Text style={[
                      styles.mobileNavText,
                      screenData.width < 375 && styles.mobileNavTextSmall,
                      isActive && styles.mobileNavTextActive
                    ]} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Mobile Add Button */}
            {showAddButton && (
              <TouchableOpacity
                style={styles.mobileAddButton}
                onPress={() => {
                  handleAddPress();
                  setShowMobileNav(false);
                }}
                activeOpacity={0.7}
              >
                <Icon name="plus" size={16} color={colors.primary} />
                <Text style={styles.mobileAddButtonText}>{addButtonText}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}

      {/* Search Section */}
      {showSearch && (
        <View style={[
          styles.searchSection,
          isMobile && styles.searchSectionMobile,
          isTablet && styles.searchSectionTablet,
          isDesktop && styles.searchSectionDesktop
        ]}>
          <View style={styles.searchContainer}>
            <View style={[
              styles.searchInputContainer,
              isMobile && styles.searchInputContainerMobile,
              isTablet && styles.searchInputContainerTablet,
              isDesktop && styles.searchInputContainerDesktop
            ]}>
              <Icon
                name="search"
                size={isMobile ? 16 : 18}
                color={colors.textSecondary}
                style={styles.searchIcon}
              />
              <TextInput
                style={[
                  styles.searchInput,
                  isMobile && styles.searchInputMobile,
                  isTablet && styles.searchInputTablet,
                  isDesktop && styles.searchInputDesktop
                ]}
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChangeText={onSearchChange}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            {showFilterButton && (
              <TouchableOpacity style={[
                styles.filterButton,
                isMobile && styles.filterButtonMobile
              ]} onPress={onFilterPress}>
                <Icon
                  name="sliders-h"
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
        <View style={[
          styles.statsSection,
          isMobile && styles.statsSectionMobile
        ]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsContainer}
          >
            {stats.map((stat, index) => (
              <View key={index} style={[
                styles.statItem,
                isMobile && styles.statItemMobile
              ]}>
                <Text style={[
                  styles.statNumber,
                  isMobile && styles.statNumberMobile
                ]}>{stat.number}</Text>
                <Text style={[
                  styles.statLabel,
                  isMobile && styles.statLabelMobile
                ]}>{stat.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Header Container
  header: {
    backgroundColor: colors.white,
    marginBottom: 2,
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

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
  },
  
  topBarMobile: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingTop: Platform.OS === 'web' ? 12 : 44,
    minHeight: 60,
  },
  
  topBarTablet: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'web' ? 16 : 48,
    minHeight: 70,
  },
  
  topBarDesktop: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'web' ? 20 : 52,
    minHeight: 80,
  },

  // Logo Section
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  logoSectionMobile: {
    flex: 0,
    minWidth: 40,
  },
  
  logoSectionDesktop: {
    flex: 0,
    minWidth: 200,
  },

  logo: {
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  logoMobile: {
    width: 28,
    height: 28,
    marginRight: 0,
  },
  
  logoTablet: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  
  logoDesktop: {
    width: 36,
    height: 36,
    marginRight: 12,
  },

  logoText: {
    fontWeight: 'bold',
    color: colors.primary,
  },
  
  logoTextMobile: {
    fontSize: 12,
  },
  
  logoTextTablet: {
    fontSize: 14,
  },
  
  logoTextDesktop: {
    fontSize: 16,
  },

  brandText: {
    fontWeight: 'bold',
    color: colors.white,
    letterSpacing: 0.5,
  },
  
  brandTextTablet: {
    fontSize: 16,
  },
  
  brandTextDesktop: {
    fontSize: 20,
  },

  // Desktop Navigation
  desktopNavContainer: {
    flex: 1,
    marginHorizontal: 20,
    height: '100%',
    justifyContent: 'center',
  },
  
  desktopNavContainerTablet: {
    maxWidth: 500,
    marginHorizontal: 16,
  },
  
  desktopNavContainerDesktop: {
    maxWidth: 700,
    marginHorizontal: 24,
  },

  topNavScroll: {
    flex: 1,
  },

  topNavContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
    flexDirection: 'row',
    minHeight: 36,
  },
  
  topNavContentTablet: {
    gap: 4,
  },
  
  topNavContentDesktop: {
    gap: 6,
  },

  topNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
    marginHorizontal: 2,
    minHeight: 32,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 0.2s ease-in-out',
    } : {}),
  },
  
  topNavItemTablet: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 36,
  },
  
  topNavItemDesktop: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
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
    marginRight: 6,
  },

  topNavText: {
    fontWeight: '500',
    color: colors.white,
    ...(Platform.OS === 'web' && {
      whiteSpace: 'nowrap' as any,
    }),
  },
  
  topNavTextTablet: {
    fontSize: 12,
  },
  
  topNavTextDesktop: {
    fontSize: 14,
  },

  topNavTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },

  // Header Actions
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  
  headerActionsMobile: {
    flex: 0,
    gap: 8,
  },
  
  headerActionsTablet: {
    flex: 0,
    gap: 8,
    minWidth: 160,
  },
  
  headerActionsDesktop: {
    flex: 0,
    gap: 10,
    minWidth: 200,
  },

  // Action Buttons
  headerButton: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },

  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    minHeight: 36,
  },

  downloadText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },

  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    minHeight: 36,
  },
  
  authButtonMobile: {
    paddingHorizontal: 10,
    minWidth: 44,
    justifyContent: 'center',
  },

  authText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },

  mobileMenuButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },

  // Mobile Navigation Menu
  mobileNavMenu: {
    backgroundColor: colors.primary,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    maxHeight: 280,
  },

  mobileNavScroll: {
    flex: 1,
  },

  mobileNavGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 8,
  },
  
  mobileNavGridSmall: {
    paddingHorizontal: 4,
    gap: 4,
  },

  mobileNavItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'transparent',
    minWidth: 80,
    maxWidth: 95,
    minHeight: 70,
  },
  
  mobileNavItemSmall: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    minWidth: 65,
    maxWidth: 80,
    minHeight: 60,
  },

  mobileNavItemActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
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
  
  mobileNavTextSmall: {
    fontSize: 9,
    lineHeight: 12,
  },

  mobileNavTextActive: {
    color: colors.white,
    fontWeight: '700',
  },

  mobileAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    gap: 8,
    alignSelf: 'center',
    minHeight: 44,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      },
      default: {
        elevation: 3,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
    }),
  },

  mobileAddButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },

  // Search Section
  searchSection: {
    backgroundColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  
  searchSectionMobile: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  
  searchSectionTablet: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  
  searchSectionDesktop: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
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
  
  searchInputContainerMobile: {
    height: 40,
    paddingHorizontal: 12,
  },
  
  searchInputContainerTablet: {
    height: 44,
    paddingHorizontal: 16,
  },
  
  searchInputContainerDesktop: {
    height: 48,
    paddingHorizontal: 20,
  },

  searchIcon: {
    marginRight: 12,
  },

  searchInput: {
    flex: 1,
    color: colors.text,
    fontWeight: '400',
  },
  
  searchInputMobile: {
    fontSize: 14,
  },
  
  searchInputTablet: {
    fontSize: 15,
  },
  
  searchInputDesktop: {
    fontSize: 16,
  },

  filterButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    width: 40,
    height: 40,
  },
  
  filterButtonMobile: {
    width: 40,
    height: 40,
  },

  // Stats Section
  statsSection: {
    backgroundColor: colors.gray100,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  
  statsSectionMobile: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  statsContainer: {
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 4,
  },

  statItem: {
    alignItems: 'center',
    minWidth: 70,
  },
  
  statItemMobile: {
    minWidth: 60,
  },

  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 2,
  },
  
  statNumberMobile: {
    fontSize: 16,
  },

  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 13,
  },
  
  statLabelMobile: {
    fontSize: 10,
    lineHeight: 12,
  },
});