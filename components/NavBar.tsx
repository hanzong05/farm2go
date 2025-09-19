import { router } from 'expo-router';
import React from 'react';
import {
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { logoutUser } from '../services/auth';

// Enhanced icon component with better styling
const Icon = ({ name, size = 20, color = '#ffffff', style }: { 
  name: string; 
  size?: number; 
  color?: string;
  style?: any;
}) => {
  const iconMap: { [key: string]: string } = {
    // Admin icons
    'users': '👥',
    'clipboard': '📋',
    'settings': '⚙️',
    // Farmer icons
    'leaf': '🌿',
    'package': '📦',
    'bar-chart': '📊',
    'clock': '🕐',
    'plus': '+',
    'inventory': '📦',
    'history': '📈',
    // Buyer icons
    'shopping-cart': '🛒',
    'search': '🔍',
    'orders': '📋',
    'purchase-history': '📋',
    // Common icons
    'log-out': '↗️',
    'user': '👤',
  };

  return (
    <Text style={[{
      fontSize: size,
      color,
      textAlign: 'center',
      fontWeight: '500',
    }, style]}>
      {iconMap[name] || '●'}
    </Text>
  );
};

const { width } = Dimensions.get('window');

interface NavItem {
  id: string;
  title: string;
  iconName: string;
  route: string;
  userTypes: ('farmer' | 'buyer' | 'admin')[];
}

const NAV_ITEMS: NavItem[] = [
  // Admin Navigation
  {
    id: 'admin-users',
    title: 'Users',
    iconName: 'users',
    route: '/admin/users',
    userTypes: ['admin'],
  },
  {
    id: 'admin-products',
    title: 'Products',
    iconName: 'clipboard',
    route: '/admin/products',
    userTypes: ['admin'],
  },
  {
    id: 'admin-settings',
    title: 'Settings',
    iconName: 'settings',
    route: '/admin/settings',
    userTypes: ['admin'],
  },

  // Farmer Navigation
  {
    id: 'farmer-products',
    title: 'Products',
    iconName: 'leaf',
    route: '/farmer/my-products',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-orders',
    title: 'Orders',
    iconName: 'package',
    route: '/farmer/orders',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-inventory',
    title: 'Inventory',
    iconName: 'inventory',
    route: '/farmer/inventory',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-history',
    title: 'History',
    iconName: 'history',
    route: '/farmer/sales-history',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-settings',
    title: 'Settings',
    iconName: 'settings',
    route: '/farmer/settings',
    userTypes: ['farmer'],
  },

  // Buyer Navigation
  {
    id: 'buyer-marketplace',
    title: 'Market',
    iconName: 'shopping-cart',
    route: '/buyer/marketplace',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-orders',
    title: 'Orders',
    iconName: 'orders',
    route: '/buyer/my-orders',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-history',
    title: 'History',
    iconName: 'purchase-history',
    route: '/buyer/purchase-history',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-settings',
    title: 'Settings',
    iconName: 'settings',
    route: '/buyer/settings',
    userTypes: ['buyer'],
  },
];

// Page title and subtitle mapping
const PAGE_INFO: { [key: string]: { title: string; subtitle: string; showActions?: boolean } } = {
  // Farmer pages
  '/farmer/my-products': {
    title: 'My Products',
    subtitle: 'Manage your farm\'s inventory',
    showActions: true,
  },
  '/farmer/orders': {
    title: 'Order Management',
    subtitle: 'Track and manage customer orders',
  },
  '/farmer/inventory': {
    title: 'Inventory Management',
    subtitle: 'Track stock levels and performance',
  },
  '/farmer/sales-history': {
    title: 'Sales Analytics',
    subtitle: 'Track performance and revenue growth',
  },
  '/farmer/settings': {
    title: 'Farm Settings',
    subtitle: 'Manage your profile and preferences',
  },
  '/farmer/products/add': {
    title: 'Add Product',
    subtitle: 'List new produce for sale',
  },

  // Buyer pages
  '/buyer/marketplace': {
    title: 'Fresh Marketplace',
    subtitle: 'Discover premium agricultural products',
  },
  '/buyer/my-orders': {
    title: 'My Orders',
    subtitle: 'Track purchases and delivery status',
  },
  '/buyer/purchase-history': {
    title: 'Purchase History',
    subtitle: 'Analyze spending patterns and favorites',
  },
  '/buyer/settings': {
    title: 'Account Settings',
    subtitle: 'Manage your profile and preferences',
  },

  // Admin pages
  '/admin/users': {
    title: 'User Management',
    subtitle: 'Manage platform users and permissions',
  },
  '/admin/products': {
    title: 'Product Management',
    subtitle: 'Review and approve product listings',
  },
  '/admin/settings': {
    title: 'System Settings',
    subtitle: 'Configure platform settings',
  },
};

interface NavBarProps {
  currentRoute?: string;
  showUserInfo?: boolean;
}

export default function NavBar({ currentRoute = '', showUserInfo = true }: NavBarProps) {
  const { user, profile, signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await logoutUser();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleNavigation = (route: string) => {
    router.push(route as any);
  };

  const handleAddProduct = () => {
    router.push('/farmer/products/add');
  };

  const getUserTypeTheme = () => {
    switch (profile?.user_type) {
      case 'farmer':
        return {
          primary: '#059669',
          secondary: '#10b981',
          accent: '#34d399',
          background: '#ecfdf5',
          text: '#064e3b',
          gradient: ['#059669', '#10b981'],
        };
      case 'buyer':
        return {
          primary: '#1d4ed8',
          secondary: '#2563eb',
          accent: '#60a5fa',
          background: '#eff6ff',
          text: '#1e3a8a',
          gradient: ['#1d4ed8', '#2563eb'],
        };
      case 'admin':
        return {
          primary: '#6d28d9',
          secondary: '#7c3aed',
          accent: '#a78bfa',
          background: '#f3e8ff',
          text: '#581c87',
          gradient: ['#6d28d9', '#7c3aed'],
        };
      default:
        return {
          primary: '#374151',
          secondary: '#4b5563',
          accent: '#6b7280',
          background: '#f9fafb',
          text: '#1f2937',
          gradient: ['#374151', '#4b5563'],
        };
    }
  };

  const getUserDisplayName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    } else if (profile?.first_name) {
      return profile.first_name;
    }
    return 'User';
  };

  const getUserSubtitle = () => {
    switch (profile?.user_type) {
      case 'farmer':
        return profile?.farm_name || 'Farmer';
      case 'buyer':
        return profile?.company_name || 'Buyer';
      case 'admin':
        return 'Administrator';
      default:
        return profile?.user_type || 'User';
    }
  };

  const getFilteredNavItems = () => {
    if (!profile?.user_type) return [];
    return NAV_ITEMS.filter(item => item.userTypes.includes(profile.user_type));
  };

  const isCurrentRoute = (route: string) => {
    return currentRoute === route || currentRoute.startsWith(route);
  };

  const getCurrentPageInfo = () => {
    return PAGE_INFO[currentRoute] || { title: 'Dashboard', subtitle: 'Welcome back' };
  };

  if (!user || !profile) {
    return null;
  }

  const filteredNavItems = getFilteredNavItems();
  const theme = getUserTypeTheme();
  const pageInfo = getCurrentPageInfo();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

      {/* Main Navigation Bar */}
      <View style={[styles.navbar, { backgroundColor: theme.primary }]}>
        {/* Brand Section */}
        <View style={styles.brandSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logoWrapper}>
              <Text style={styles.logoText}>F2G</Text>
            </View>
            <View style={styles.brandInfo}>
              <Text style={styles.brandName}>Farm2Go</Text>
              <Text style={styles.brandTagline}>
                {profile?.user_type === 'admin' ? 'Admin Portal' :
                 profile?.user_type === 'farmer' ? 'Producer Hub' : 'Marketplace'}
              </Text>
            </View>
          </View>
        </View>

        {/* Navigation Items */}
        <View style={styles.navItems}>
          {filteredNavItems.slice(0, 4).map((item) => {
            const isActive = isCurrentRoute(item.route);

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.navItem,
                  isActive && styles.navItemActive,
                ]}
                onPress={() => handleNavigation(item.route)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.navIconContainer,
                  isActive && [styles.navIconContainerActive, { backgroundColor: theme.accent }],
                ]}>
                  <Icon
                    name={item.iconName}
                    size={16}
                    color={isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.8)'}
                  />
                </View>
                <Text style={[
                  styles.navItemText,
                  isActive && styles.navItemTextActive,
                ]}>
                  {item.title}
                </Text>
                {isActive && <View style={[styles.activeIndicator, { backgroundColor: theme.accent }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* User Section */}
        {showUserInfo && (
          <View style={styles.userSection}>
            <TouchableOpacity style={styles.userInfo} activeOpacity={0.8}>
              <View style={styles.userAvatarContainer}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userInitial}>
                    {getUserDisplayName().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.statusIndicator} />
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName} numberOfLines={1}>
                  {getUserDisplayName()}
                </Text>
                <Text style={styles.userRole} numberOfLines={1}>
                  {getUserSubtitle()}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Icon name="log-out" size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Page Header Section */}
      <View style={[styles.pageHeader, { backgroundColor: theme.primary }]}>
        <View style={styles.pageHeaderContent}>
          <View style={styles.pageInfo}>
            <Text style={styles.pageTitle}>{pageInfo.title}</Text>
            <Text style={styles.pageSubtitle}>{pageInfo.subtitle}</Text>
          </View>

          {/* Action Buttons */}
          {pageInfo.showActions && profile?.user_type === 'farmer' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleAddProduct}
              activeOpacity={0.8}
            >
              <Icon name="plus" size={18} color={theme.primary} />
              <Text style={[styles.actionButtonText, { color: theme.primary }]}>Add Product</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Enhanced bottom shadow */}
      <View style={styles.bottomShadow} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
    elevation: 15,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 10,
    paddingBottom: 12,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },

  // Page Header Section
  pageHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  pageHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageInfo: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },

  bottomShadow: {
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 6,
  },

  // Brand Section
  brandSection: {
    flex: 1,
    minWidth: 120,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  brandInfo: {
    flex: 1,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  brandTagline: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 1,
  },

  // Navigation Items
  navItems: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  navItem: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    minWidth: 60,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ scale: 1.02 }],
  },
  navIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  navIconContainerActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    transform: [{ scale: 1.05 }],
  },
  navItemText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12,
  },
  navItemTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2,
    width: 18,
    height: 2,
    borderRadius: 1,
  },

  // User Section
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 120,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    flex: 1,
    justifyContent: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  userAvatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  userInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  userDetails: {
    alignItems: 'flex-end',
    maxWidth: 90,
  },
  userName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'right',
    lineHeight: 15,
  },
  userRole: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'right',
    marginTop: 1,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  logoutButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});

// Responsive styles for larger screens
if (width > 768) {
  Object.assign(styles, {
    navbar: {
      ...styles.navbar,
      paddingHorizontal: 32,
      paddingBottom: 16,
    },
    pageHeader: {
      ...styles.pageHeader,
      paddingHorizontal: 32,
      paddingVertical: 20,
    },
    logoWrapper: {
      ...styles.logoWrapper,
      width: 40,
      height: 40,
      borderRadius: 12,
      marginRight: 14,
    },
    logoText: {
      ...styles.logoText,
      fontSize: 16,
    },
    brandName: {
      ...styles.brandName,
      fontSize: 20,
    },
    brandTagline: {
      ...styles.brandTagline,
      fontSize: 12,
    },
    navItems: {
      ...styles.navItems,
      gap: 8,
      paddingHorizontal: 12,
    },
    navItem: {
      ...styles.navItem,
      paddingHorizontal: 12,
      paddingVertical: 12,
      minWidth: 66,
    },
    navIconContainer: {
      ...styles.navIconContainer,
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    navItemText: {
      ...styles.navItemText,
      fontSize: 11,
    },
    pageTitle: {
      ...styles.pageTitle,
      fontSize: 26,
    },
    pageSubtitle: {
      ...styles.pageSubtitle,
      fontSize: 15,
    },
    userAvatar: {
      ...styles.userAvatar,
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    userName: {
      ...styles.userName,
      fontSize: 13,
    },
    userRole: {
      ...styles.userRole,
      fontSize: 11,
    },
    logoutButton: {
      ...styles.logoutButton,
      width: 36,
      height: 36,
      borderRadius: 18,
    },
  });
}