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

const { width } = Dimensions.get('window');

// Farm2Go green color scheme
const colors = {
  primary: '#059669',
  secondary: '#10b981',
  white: '#ffffff',
  background: '#f0f9f4',
  text: '#0f172a',
  textSecondary: '#6b7280',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  gray100: '#f9fafb',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  shadow: 'rgba(0,0,0,0.1)',
};

interface NavItem {
  id: string;
  title: string;
  icon: string;
  route: string;
  userTypes: ('farmer' | 'buyer' | 'admin')[];
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  // Farmer Navigation
  {
    id: 'farmer-products',
    title: 'Products',
    icon: '📦',
    route: '/farmer/my-products',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-orders',
    title: 'Orders',
    icon: '📋',
    route: '/farmer/orders',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-analytics',
    title: 'Analytics',
    icon: '📊',
    route: '/farmer/sales-history',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-inventory',
    title: 'Inventory',
    icon: '🏪',
    route: '/farmer/inventory',
    userTypes: ['farmer'],
  },

  // Buyer Navigation
  {
    id: 'buyer-marketplace',
    title: 'Market',
    icon: '🛒',
    route: '/buyer/marketplace',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-orders',
    title: 'Orders',
    icon: '📋',
    route: '/buyer/my-orders',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-favorites',
    title: 'Wishlist',
    icon: '❤️',
    route: '/buyer/favorites',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-profile',
    title: 'Profile',
    icon: '👤',
    route: '/buyer/settings',
    userTypes: ['buyer'],
  },

  // Admin Navigation
  {
    id: 'admin-dashboard',
    title: 'Dashboard',
    icon: '📊',
    route: '/admin/dashboard',
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
    icon: '📦',
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

interface Farm2GoNavBarProps {
  currentRoute?: string;
  showNotifications?: boolean;
}

export default function Farm2GoNavBar({
  currentRoute = '',
  showNotifications = true
}: Farm2GoNavBarProps) {
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

  const getUserTheme = () => {
    switch (profile?.user_type) {
      case 'farmer':
        return {
          primary: '#059669',
          secondary: '#10b981',
          gradient: ['#059669', '#10b981'],
        };
      case 'buyer':
        return {
          primary: '#1d4ed8',
          secondary: '#2563eb',
          gradient: ['#1d4ed8', '#2563eb'],
        };
      case 'admin':
        return {
          primary: '#6d28d9',
          secondary: '#7c3aed',
          gradient: ['#6d28d9', '#7c3aed'],
        };
      default:
        return {
          primary: colors.primary,
          secondary: colors.secondary,
          gradient: [colors.primary, colors.secondary],
        };
    }
  };

  const getFilteredNavItems = () => {
    if (!profile?.user_type) return [];
    return NAV_ITEMS.filter(item => item.userTypes.includes(profile.user_type));
  };

  const isCurrentRoute = (route: string) => {
    return currentRoute === route || currentRoute.startsWith(route);
  };

  const getUserDisplayName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    } else if (profile?.first_name) {
      return profile.first_name;
    }
    return 'User';
  };

  const getUserRole = () => {
    switch (profile?.user_type) {
      case 'farmer':
        return profile?.farm_name || 'Farmer';
      case 'buyer':
        return 'Buyer';
      case 'admin':
        return 'Administrator';
      default:
        return 'User';
    }
  };

  if (!user || !profile) {
    return null;
  }

  const filteredNavItems = getFilteredNavItems();
  const theme = getUserTheme();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      {/* Top Bar */}
      <View style={[styles.topBar, { backgroundColor: colors.primary }]}>
        {/* Logo Section */}
        <TouchableOpacity style={styles.logoSection} activeOpacity={0.8}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>F2G</Text>
          </View>
          <View>
            <Text style={styles.brandText}>Farm2Go</Text>
            <Text style={styles.taglineText}>
              {profile?.user_type === 'farmer' ? 'Seller Center' : 
               profile?.user_type === 'admin' ? 'Admin Panel' : 'Marketplace'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Top Actions */}
        <View style={styles.topActions}>
          {/* Notifications */}
          {showNotifications && (
            <TouchableOpacity style={styles.notificationButton} activeOpacity={0.8}>
              <Text style={styles.notificationIcon}>🔔</Text>
              <View style={styles.notificationBadge}>
                <Text style={styles.badgeText}>3</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Profile */}
          <TouchableOpacity style={styles.profileSection} activeOpacity={0.8}>
            <View style={styles.profileAvatar}>
              <Text style={styles.avatarText}>
                {getUserDisplayName().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>
                {getUserDisplayName()}
              </Text>
              <Text style={styles.profileRole} numberOfLines={1}>
                {getUserRole()}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutIcon}>⏻</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        {filteredNavItems.map((item, index) => {
          const isActive = isCurrentRoute(item.route);
          
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.navItem}
              onPress={() => handleNavigation(item.route)}
              activeOpacity={0.6}
            >
              {/* Icon Container */}
              <View style={[
                styles.navIconContainer,
                isActive && [styles.navIconContainerActive, { backgroundColor: colors.primary }]
              ]}>
                <Text style={[
                  styles.navIcon,
                  isActive && styles.navIconActive
                ]}>
                  {item.icon}
                </Text>
                
                {/* Badge */}
                {item.badge && (
                  <View style={styles.navBadge}>
                    <Text style={styles.navBadgeText}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </Text>
                  </View>
                )}
              </View>

              {/* Label */}
              <Text style={[
                styles.navLabel,
                isActive && [styles.navLabelActive, { color: colors.primary }]
              ]} numberOfLines={1}>
                {item.title}
              </Text>

              {/* Active Indicator */}
              {isActive && (
                <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Shadow */}
      <View style={styles.shadowContainer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    zIndex: 1000,
    elevation: 10,
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 10,
    paddingBottom: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },

  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  logoContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  logoText: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -0.5,
  },

  brandText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
    lineHeight: 20,
  },

  taglineText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    marginTop: 1,
  },

  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  notificationButton: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationIcon: {
    fontSize: 18,
  },

  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ff4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.white,
  },

  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: 140,
  },

  profileAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  avatarText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
  },

  profileInfo: {
    flex: 1,
  },

  profileName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
    lineHeight: 14,
  },

  profileRole: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 1,
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
    color: colors.white,
  },

  // Bottom Navigation
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },

  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    position: 'relative',
    minHeight: 60,
  },

  navIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    position: 'relative',
    backgroundColor: 'transparent',
  },

  navIconContainerActive: {
    backgroundColor: colors.primary + '15',
    transform: [{ scale: 1.1 }],
  },

  navIcon: {
    fontSize: 18,
  },

  navIconActive: {
    transform: [{ scale: 1.1 }],
  },

  navBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  navBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.white,
  },

  navLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },

  navLabelActive: {
    fontWeight: '600',
    color: colors.primary,
  },

  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },

  shadowContainer: {
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
});

// Responsive adjustments for tablets
if (width > 768) {
  Object.assign(styles, {
    topBar: {
      ...styles.topBar,
      paddingHorizontal: 32,
      paddingBottom: 20,
    },
    
    logoContainer: {
      ...styles.logoContainer,
      width: 40,
      height: 40,
      marginRight: 16,
    },
    
    logoText: {
      ...styles.logoText,
      fontSize: 18,
    },
    
    brandText: {
      ...styles.brandText,
      fontSize: 20,
    },
    
    taglineText: {
      ...styles.taglineText,
      fontSize: 12,
    },
    
    bottomNav: {
      ...styles.bottomNav,
      paddingVertical: 12,
      paddingHorizontal: 32,
    },
    
    navItem: {
      ...styles.navItem,
      paddingVertical: 12,
      minHeight: 70,
    },
    
    navIconContainer: {
      ...styles.navIconContainer,
      width: 44,
      height: 44,
      marginBottom: 6,
    },
    
    navIcon: {
      ...styles.navIcon,
      fontSize: 20,
    },
    
    navLabel: {
      ...styles.navLabel,
      fontSize: 11,
    },
  });
}