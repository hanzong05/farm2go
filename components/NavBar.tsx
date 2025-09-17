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

// Professional icon component
const Icon = ({ name, size = 20, color = '#ffffff' }: { name: string; size?: number; color?: string }) => {
  const iconMap: { [key: string]: string } = {
    // Admin icons
    'users': '👤',
    'clipboard': '📋',
    'settings': '⚙',
    // Farmer icons
    'leaf': '🌿',
    'package': '📦',
    'bar-chart': '📊',
    'clock': '🕒',
    // Buyer icons
    'shopping-cart': '🛒',
    'search': '🔍',
    'history': '📋',
    // Common icons
    'log-out': '⤴',
    'user': '👤',
  };

  return (
    <Text style={{
      fontSize: size,
      color,
      fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto',
      textAlign: 'center',
    }}>
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
  // Admin Navigation - 1.1 Admin
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

  // Farmer Navigation - 1.2.1 Farmer
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

  // Buyer Navigation - 1.2.2 Buyer
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
    router.push(route);
  };

  const getUserTypeColor = () => {
    switch (profile?.user_type) {
      case 'farmer':
        return {
          primary: '#16a34a',
          gradient: ['#16a34a', '#15803d'],
          light: 'rgba(22, 163, 74, 0.1)',
        };
      case 'buyer':
        return {
          primary: '#2563eb',
          gradient: ['#2563eb', '#1d4ed8'],
          light: 'rgba(37, 99, 235, 0.1)',
        };
      case 'admin':
        return {
          primary: '#7c3aed',
          gradient: ['#7c3aed', '#6d28d9'],
          light: 'rgba(124, 58, 237, 0.1)',
        };
      default:
        return {
          primary: '#6b7280',
          gradient: ['#6b7280', '#4b5563'],
          light: 'rgba(107, 114, 128, 0.1)',
        };
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
  const userTypeColors = getUserTypeColor();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={userTypeColors.primary} />

      <View style={[styles.navbar, { backgroundColor: userTypeColors.primary }]}>
        {/* Brand Section */}
        <View style={styles.brandSection}>
          <View style={styles.logoContainer}>
            <View style={[styles.logo, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}>
              <Text style={styles.logoText}>F2G</Text>
            </View>
            <View style={styles.brandTextContainer}>
              <Text style={styles.brandName}>Farm2Go</Text>
              <Text style={styles.brandTagline}>
                {profile?.user_type === 'admin' ? 'Admin Panel' :
                 profile?.user_type === 'farmer' ? 'Producer' : 'Marketplace'}
              </Text>
            </View>
          </View>
        </View>

        {/* Navigation Items */}
        <View style={styles.navItems}>
          {filteredNavItems.map((item) => {
            const isActive = isCurrentRoute(item.route);

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.navItem,
                  isActive && [styles.navItemActive, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }],
                ]}
                onPress={() => handleNavigation(item.route)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.navItemIconContainer,
                  isActive && styles.navItemIconContainerActive,
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
              </TouchableOpacity>
            );
          })}
        </View>

        {/* User Section */}
        {showUserInfo && (
          <View style={styles.userSection}>
            <TouchableOpacity style={styles.userInfo} activeOpacity={0.7}>
              <View style={[styles.userAvatar, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}>
                <Icon name="user" size={14} color="#ffffff" />
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName} numberOfLines={1}>
                  {getUserDisplayName()}
                </Text>
                <Text style={styles.userSubtitle} numberOfLines={1}>
                  {getUserSubtitle()}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.logoutButton, { borderColor: 'rgba(255, 255, 255, 0.2)' }]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Icon name="log-out" size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Subtle bottom border */}
      <View style={[styles.bottomBorder, { backgroundColor: userTypeColors.light }]} />
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
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomBorder: {
    height: 1,
    opacity: 0.3,
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
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  brandTextContainer: {
    flex: 1,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  brandTagline: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 60,
    maxWidth: 80,
  },
  navItemActive: {
    transform: [{ scale: 1.05 }],
  },
  navItemIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  navItemIconContainerActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    transform: [{ scale: 1.1 }],
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
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  userDetails: {
    alignItems: 'flex-end',
    maxWidth: 100,
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'right',
    lineHeight: 16,
  },
  userSubtitle: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
    marginTop: 1,
    fontWeight: '500',
  },
  logoutButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});

// Responsive styles for larger screens
if (width > 768) {
  Object.assign(styles, {
    navbar: {
      ...styles.navbar,
      paddingHorizontal: 40,
      paddingBottom: 20,
    },
    logo: {
      ...styles.logo,
      width: 40,
      height: 40,
      borderRadius: 10,
    },
    logoText: {
      ...styles.logoText,
      fontSize: 16,
    },
    brandName: {
      ...styles.brandName,
      fontSize: 22,
    },
    brandTagline: {
      ...styles.brandTagline,
      fontSize: 12,
    },
    navItems: {
      ...styles.navItems,
      gap: 12,
      paddingHorizontal: 16,
    },
    navItem: {
      ...styles.navItem,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minWidth: 70,
      maxWidth: 90,
    },
    navItemIconContainer: {
      ...styles.navItemIconContainer,
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    navItemText: {
      ...styles.navItemText,
      fontSize: 11,
    },
    userAvatar: {
      ...styles.userAvatar,
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    userName: {
      ...styles.userName,
      fontSize: 14,
    },
    userSubtitle: {
      ...styles.userSubtitle,
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