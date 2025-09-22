import { router } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  Linking
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { logoutUser } from '../services/auth';
import { Database } from '../types/database';
import { supabase } from '../lib/supabase';
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

      // Multiple download options (prioritized)
      const downloadUrls = [
        // Option 1: GitHub Releases (recommended for large files)
        'https://github.com/hanz-pillerva/farm2go/releases/latest/download/farm2go.apk',

        // Option 2: Direct link (if you host on a server)
        'https://farm2go.vercel.app/downloads/farm2go.apk',

        // Option 3: Google Drive direct download (if you use Google Drive)
        // 'https://drive.google.com/uc?export=download&id=YOUR_FILE_ID',

        // Option 4: Supabase (fallback for smaller files)
        (() => {
          const { data: apkData } = supabase.storage.from('app').getPublicUrl('farm2go.apk');
          return apkData.publicUrl;
        })()
      ];

      if (/android/i.test(userAgent)) {
        // Android device - try downloads in order
        console.log('Android detected - downloading APK');
        tryDownloads(downloadUrls);
      } else if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
        // iOS device - show message that APK is for Android only
        if (confirm('Farm2Go app is currently available for Android devices only. Download APK anyway?')) {
          tryDownloads(downloadUrls);
        }
      } else {
        // Desktop - download APK with instructions
        const confirmed = confirm('Download Farm2Go APK for Android? This file can be transferred to your Android device for installation.');
        if (confirmed) {
          tryDownloads(downloadUrls);
        }
      }
    } else {
      // Already in the app - show about page
      router.push('/about' as any);
    }
  };

  // Helper function to try multiple download URLs
  const tryDownloads = (urls: string[]) => {
    // Try the first URL (GitHub releases)
    const primaryUrl = urls[0];

    // Open the primary download URL
    window.open(primaryUrl, '_blank');

    // Show alternative options
    console.log('Primary download:', primaryUrl);
    console.log('Alternative downloads available:', urls.slice(1));
  };

  const filteredNavItems = NAV_ITEMS.filter(item =>
    item.userTypes.includes(resolvedUserType)
  );

  const getUserTypeColor = () => {
    switch (resolvedUserType) {
      case 'farmer':
        return '#10b981';
      case 'buyer':
        return '#3b82f6';
      case 'admin':
        return '#8b5cf6';
      default:
        return '#6b7280';
    }
  };

  return (
    <View style={styles.header}>
      {/* Top Navigation Bar - Now with navigation items */}
      <View style={styles.topBar}>
        <View style={styles.logoSection}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>F2G</Text>
          </View>
          <Text style={styles.brandText}>Farm2Go</Text>
        </View>

        {/* Navigation Items in Top Bar */}
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
                  size={14}
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

        <View style={styles.headerActions}>
          {/* Messages and Notifications */}
          <MessageComponent
            conversations={conversations}
            onConversationPress={onConversationPress}
            onSendMessage={onSendMessage}
            onMarkAsRead={onMarkMessageAsRead}
            onNewConversation={onNewConversation}
          />

          <NotificationComponent
            notifications={notifications}
            onNotificationPress={onNotificationPress}
            onMarkAsRead={onMarkNotificationAsRead}
            onMarkAllAsRead={onMarkAllNotificationsAsRead}
            onClearAll={onClearAllNotifications}
          />

          {/* Download App Button - only show on web */}
          {Platform.OS === 'web' && (
            <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadApp}>
              <Icon
                name="download"
                size={12}
                color={colors.white}
                style={styles.downloadIcon}
              />
              <Text style={styles.downloadText}>Get App</Text>
            </TouchableOpacity>
          )}

          {showAddButton && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleAddPress}
            >
              <Text style={styles.headerButtonText}>{addButtonText}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.authButton} onPress={handleAuthAction}>
            <Icon
              name={profile ? "sign-out-alt" : "sign-in-alt"}
              size={12}
              color={colors.white}
              style={styles.authIcon}
            />
            <Text style={styles.authText}>
              {profile ? "Log Out" : "Sign In"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar and Categories Combined */}
      {showSearch && (
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Icon
                name="search"
                size={16}
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
                  size={16}
                  color={colors.white}
                />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Simple Category Tabs under search */}
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
                    style={styles.simpleCategoryTab}
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

    </View>
  );
}

const styles = StyleSheet.create({
  // Header Styles
  header: {
    backgroundColor: colors.white,
    marginBottom: 8,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingTop: 44, // Reduced from 50
    backgroundColor: colors.primary,
    height: 70, // Fixed height for consistency
  },

  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120, // Ensure logo section has minimum width
  },

  logo: {
    width: 28, // Slightly smaller
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  logoText: {
    fontSize: 12, // Slightly smaller
    fontWeight: 'bold',
    color: colors.primary,
  },

  brandText: {
    fontSize: 16, // Slightly smaller
    fontWeight: 'bold',
    color: colors.white,
  },

  // Top Navigation in Header
  topNavScroll: {
    flex: 1,
    marginHorizontal: 16,
  },

  topNavContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },

  topNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: 'transparent',
    marginRight: 8,
    minHeight: 32,
  },

  topNavItemActive: {
    backgroundColor: colors.white,
  },

  topNavIcon: {
    marginRight: 4,
  },

  topNavText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.white,
  },

  topNavTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Reduced gap
    minWidth: 120, // Ensure actions section has minimum width
  },

  headerButton: {
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },

  headerButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },

  profileButton: {
    width: 28, // Smaller
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.primary,
  },

  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  downloadIcon: {
    marginRight: 0,
  },

  downloadText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.white,
  },

  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },

  authIcon: {
    marginRight: 0,
  },

  authText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },

  // Search Section
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
  },

  searchContainer: {
    flexDirection: 'row',
    gap: 8,
  },

  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },

  searchIcon: {
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },

  filterButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Simple categories within search section
  categoryScrollView: {
    marginTop: 8,
  },

  categoryContainer: {
    paddingHorizontal: 0,
    paddingVertical: 8,
  },

  simpleCategoryTab: {
    paddingHorizontal: 0,
    paddingVertical: 4,
  },

  simpleCategoryText: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
  },

  simpleCategoryTextActive: {
    color: colors.white,
    fontWeight: '500',
  },

  categoryDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 12,
    alignSelf: 'center',
  },
});