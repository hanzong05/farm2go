import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { logoutUser } from '../services/auth';

const { width } = Dimensions.get('window');

interface NavItem {
  id: string;
  title: string;
  icon: string;
  route: string;
  userTypes: ('farmer' | 'buyer' | 'admin')[];
}

const NAV_ITEMS: NavItem[] = [
  // Farmer Navigation
  {
    id: 'farmer-dashboard',
    title: 'Dashboard',
    icon: '🏠',
    route: '/farmer/my-products',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-products',
    title: 'Products',
    icon: '🌱',
    route: '/farmer/my-products',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-orders',
    title: 'Orders',
    icon: '📦',
    route: '/farmer/orders',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-inventory',
    title: 'Inventory',
    icon: '📋',
    route: '/farmer/inventory',
    userTypes: ['farmer'],
  },

  // Buyer Navigation
  {
    id: 'buyer-marketplace',
    title: 'Marketplace',
    icon: '🛒',
    route: '/buyer/marketplace',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-search',
    title: 'Search',
    icon: '🔍',
    route: '/buyer/search',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-orders',
    title: 'Orders',
    icon: '📦',
    route: '/buyer/my-orders',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-history',
    title: 'History',
    icon: '📄',
    route: '/buyer/purchase-history',
    userTypes: ['buyer'],
  },

  // Admin Navigation
  {
    id: 'admin-dashboard',
    title: 'Dashboard',
    icon: '🏛️',
    route: '/admin/users',
    userTypes: ['admin'],
  },
  {
    id: 'admin-users',
    title: 'Users',
    icon: '👥',
    route: '/admin/users',
    userTypes: ['admin'],
  },
  {
    id: 'admin-products',
    title: 'Products',
    icon: '✅',
    route: '/admin/products',
    userTypes: ['admin'],
  },
  {
    id: 'admin-settings',
    title: 'Settings',
    icon: '⚙️',
    route: '/admin/settings',
    userTypes: ['admin'],
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
    router.push(route);
  };

  const getUserTypeColor = () => {
    switch (profile?.user_type) {
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

  const getUserDisplayName = () => {
    if (profile) {
      return `${profile.first_name} ${profile.last_name}`;
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
  const userTypeColor = getUserTypeColor();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={userTypeColor} />

      <View style={[styles.navbar, { backgroundColor: userTypeColor }]}>
        {/* Brand Section */}
        <View style={styles.brandSection}>
          <Text style={styles.brandIcon}>🌱</Text>
          <Text style={styles.brandName}>Farm2Go</Text>
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
                <Text style={[
                  styles.navItemIcon,
                  isActive && styles.navItemIconActive,
                ]}>
                  {item.icon}
                </Text>
                <Text style={[
                  styles.navItemText,
                  isActive && styles.navItemTextActive,
                ]}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* User Section */}
        {showUserInfo && (
          <View style={styles.userSection}>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {getUserDisplayName()}
              </Text>
              <Text style={styles.userSubtitle} numberOfLines={1}>
                {getUserSubtitle()}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Text style={styles.logoutIcon}>🚪</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },

  // Brand Section
  brandSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  brandIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },

  // Navigation Items
  navItems: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'center',
    gap: 8,
  },
  navItem: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 60,
  },
  navItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  navItemIcon: {
    fontSize: 16,
    marginBottom: 4,
    opacity: 0.8,
  },
  navItemIconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  navItemText: {
    fontSize: 11,
    color: '#ffffff',
    opacity: 0.8,
    fontWeight: '500',
    textAlign: 'center',
  },
  navItemTextActive: {
    opacity: 1,
    fontWeight: '600',
  },

  // User Section
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  userInfo: {
    alignItems: 'flex-end',
    marginRight: 12,
    maxWidth: 120,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'right',
  },
  userSubtitle: {
    fontSize: 11,
    color: '#ffffff',
    opacity: 0.8,
    textAlign: 'right',
    marginTop: 2,
  },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIcon: {
    fontSize: 16,
  },
});

// Responsive styles for larger screens
if (width > 768) {
  Object.assign(styles, {
    navbar: {
      ...styles.navbar,
      paddingHorizontal: 32,
    },
    brandName: {
      ...styles.brandName,
      fontSize: 24,
    },
    navItems: {
      ...styles.navItems,
      gap: 16,
    },
    navItem: {
      ...styles.navItem,
      paddingHorizontal: 16,
      minWidth: 80,
    },
    navItemIcon: {
      ...styles.navItemIcon,
      fontSize: 18,
    },
    navItemText: {
      ...styles.navItemText,
      fontSize: 12,
    },
    userName: {
      ...styles.userName,
      fontSize: 16,
    },
    userSubtitle: {
      ...styles.userSubtitle,
      fontSize: 12,
    },
  });
}