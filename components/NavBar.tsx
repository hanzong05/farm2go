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
    // Buyer icons
    'shopping-cart': '🛒',
    'search': '🔍',
    'history': '📋',
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
    iconName: 'bar-chart',
    route: '/farmer/inventory',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-history',
    title: 'History',
    iconName: 'clock',
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
    title: 'Marketplace',
    iconName: 'shopping-cart',
    route: '/buyer/marketplace',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-search',
    title: 'Search',
    iconName: 'search',
    route: '/buyer/search',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-history',
    title: 'History',
    iconName: 'history',
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

  const getUserTypeTheme = () => {
    switch (profile?.user_type) {
      case 'farmer':
        return {
          primary: '#059669',
          secondary: '#10b981',
          accent: '#34d399',
          background: '#ecfdf5',
          text: '#064e3b',
        };
      case 'buyer':
        return {
          primary: '#1d4ed8',
          secondary: '#2563eb',
          accent: '#60a5fa',
          background: '#eff6ff',
          text: '#1e3a8a',
        };
      case 'admin':
        return {
          primary: '#6d28d9',
          secondary: '#7c3aed',
          accent: '#a78bfa',
          background: '#f3e8ff',
          text: '#581c87',
        };
      default:
        return {
          primary: '#374151',
          secondary: '#4b5563',
          accent: '#6b7280',
          background: '#f9fafb',
          text: '#1f2937',
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

  if (!user || !profile) {
    return null;
  }

  const filteredNavItems = getFilteredNavItems();
  const theme = getUserTypeTheme();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

      <View style={[styles.navbar, { backgroundColor: theme.primary }]}>
        {/* Enhanced Brand Section */}
        <View style={styles.brandSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logoWrapper}>
              <Text style={styles.logoText}>F2G</Text>
            </View>
            <View style={styles.brandInfo}>
              <Text style={styles.brandName}>Farm2Go</Text>
              <Text style={styles.brandTagline}>
                {profile?.user_type === 'admin' ? 'Admin Dashboard' :
                 profile?.user_type === 'farmer' ? 'Producer Portal' : 'Marketplace Hub'}
              </Text>
            </View>
          </View>
        </View>

        {/* Enhanced Navigation Items */}
        <View style={styles.navItems}>
          {filteredNavItems.map((item) => {
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
                    size={18}
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

        {/* Enhanced User Section */}
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
              <Icon name="log-out" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Enhanced bottom shadow */}
      <View style={styles.bottomShadow} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
    elevation: 10,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 55 : (StatusBar.currentHeight || 0) + 15,
    paddingBottom: 20,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  bottomShadow: {
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },

  // Enhanced Brand Section
  brandSection: {
    flex: 1,
    minWidth: 140,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  brandInfo: {
    flex: 1,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    lineHeight: 26,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  brandTagline: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },

  // Enhanced Navigation Items
  navItems: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  navItem: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    minWidth: 68,
    maxWidth: 85,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ scale: 1.05 }],
  },
  navIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  navIconContainerActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    transform: [{ scale: 1.1 }],
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  navItemText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 13,
  },
  navItemTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2,
    width: 24,
    height: 3,
    borderRadius: 2,
  },

  // Enhanced User Section
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 140,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    flex: 1,
    justifyContent: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  userAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  userDetails: {
    alignItems: 'flex-end',
    maxWidth: 110,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'right',
    lineHeight: 17,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  userRole: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'right',
    marginTop: 1,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  logoutButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

// Enhanced responsive styles for larger screens
if (width > 768) {
  Object.assign(styles, {
    navbar: {
      ...styles.navbar,
      paddingHorizontal: 32,
      paddingBottom: 24,
    },
    logoWrapper: {
      ...styles.logoWrapper,
      width: 48,
      height: 48,
      borderRadius: 14,
      marginRight: 18,
    },
    logoText: {
      ...styles.logoText,
      fontSize: 18,
    },
    brandName: {
      ...styles.brandName,
      fontSize: 24,
    },
    brandTagline: {
      ...styles.brandTagline,
      fontSize: 13,
    },
    navItems: {
      ...styles.navItems,
      gap: 12,
      paddingHorizontal: 16,
    },
    navItem: {
      ...styles.navItem,
      paddingHorizontal: 16,
      paddingVertical: 14,
      minWidth: 75,
      maxWidth: 95,
    },
    navIconContainer: {
      ...styles.navIconContainer,
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    navItemText: {
      ...styles.navItemText,
      fontSize: 12,
    },
    userAvatar: {
      ...styles.userAvatar,
      width: 42,
      height: 42,
      borderRadius: 21,
    },
    userName: {
      ...styles.userName,
      fontSize: 15,
    },
    userRole: {
      ...styles.userRole,
      fontSize: 12,
    },
    logoutButton: {
      ...styles.logoutButton,
      width: 42,
      height: 42,
      borderRadius: 21,
    },
  });
}