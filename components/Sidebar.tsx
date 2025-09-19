import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { logoutUser } from '../services/auth';

const { width, height } = Dimensions.get('window');

interface SidebarItem {
  id: string;
  title: string;
  icon: string;
  route: string;
  badge?: number;
  userTypes: ('farmer' | 'buyer' | 'admin')[];
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  // Farmer items
  {
    id: 'farmer-dashboard',
    title: 'Dashboard',
    icon: '📊 ',
    route: '/farmer/my-products',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-products',
    title: 'My Products',
    icon: '🌱',
    route: '/farmer/my-products',
    userTypes: ['farmer'],
  },
  {
    id: 'farmer-add-product',
    title: 'Add Product',
    icon: '➕',
    route: '/farmer/products/add',
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
  {
    id: 'farmer-sales',
    title: 'Sales History',
    icon: '💰',
    route: '/farmer/sales-history',
    userTypes: ['farmer'],
  },

  // Buyer items
  {
    id: 'buyer-marketplace',
    title: 'Marketplace',
    icon: '🛒',
    route: '/buyer/marketplace',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-search',
    title: 'Search Products',
    icon: '🔍',
    route: '/buyer/search',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-orders',
    title: 'My Orders',
    icon: '📦',
    route: '/buyer/my-orders',
    userTypes: ['buyer'],
  },
  {
    id: 'buyer-history',
    title: 'Purchase History',
    icon: '📄',
    route: '/buyer/purchase-history',
    userTypes: ['buyer'],
  },

  // Admin items
  {
    id: 'admin-users',
    title: 'User Management',
    icon: '👥',
    route: '/admin/users',
    userTypes: ['admin'],
  },
  {
    id: 'admin-products',
    title: 'Product Approval',
    icon: '✅',
    route: '/admin/products',
    userTypes: ['admin'],
  },
  {
    id: 'admin-settings',
    title: 'System Settings',
    icon: '⚙️',
    route: '/admin/settings',
    userTypes: ['admin'],
  },
];

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
  userType: 'farmer' | 'buyer' | 'admin';
  currentRoute: string;
  userProfile?: {
    first_name: string;
    last_name: string;
    farm_name?: string;
    company_name?: string;
  };
}

export default function Sidebar({
  isVisible,
  onClose,
  userType,
  currentRoute,
  userProfile,
}: SidebarProps) {
  const [slideAnimation] = useState(new Animated.Value(-width * 0.8));

  React.useEffect(() => {
    Animated.timing(slideAnimation, {
      toValue: isVisible ? 0 : -width * 0.8,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  const handleLogout = async () => {
    try { 
      await logoutUser();
      onClose();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleNavigation = (route: string) => {
    onClose();
    router.push(route);
  };

  const filteredItems = SIDEBAR_ITEMS.filter(item =>
    item.userTypes.includes(userType)
  );

  const getUserDisplayName = () => {
    if (userProfile) {
      return `${userProfile.first_name} ${userProfile.last_name}`;
    }
    return 'User';
  };

  const getUserSubtitle = () => {
    switch (userType) {
      case 'farmer':
        return userProfile?.farm_name || 'Farmer';
      case 'buyer':
        return userProfile?.company_name || 'Buyer';
      case 'admin':
        return 'Administrator';
      default:
        return userType;
    }
  };

  const getUserTypeColor = () => {
    switch (userType) {
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

  const getUserTypeIcon = () => {
    switch (userType) {
      case 'farmer':
        return '🌾';
      case 'buyer':
        return '🏪';
      case 'admin':
        return '👑';
      default:
        return '👤';
    }
  };

  if (!isVisible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={styles.backdrop}
        onPress={onClose}
        activeOpacity={1}
      />

      <Animated.View
        style={[
          styles.sidebar,
          {
            transform: [{ translateX: slideAnimation }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandSection}>
            <Text style={styles.brandName}>Farm2Go</Text>
            <View style={[styles.userTypeBadge, { backgroundColor: getUserTypeColor() }]}>
              <Text style={styles.userTypeIcon}>{getUserTypeIcon()}</Text>
              <Text style={styles.userTypeText}>{userType.toUpperCase()}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* User Profile */}
        <View style={styles.userProfile}>
          <View style={[styles.avatar, { backgroundColor: getUserTypeColor() }]}>
            <Text style={styles.avatarText}>
              {getUserDisplayName().split(' ').map(n => n[0]).join('')}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{getUserDisplayName()}</Text>
            <Text style={styles.userSubtitle}>{getUserSubtitle()}</Text>
          </View>
        </View>

        {/* Navigation */}
        <ScrollView style={styles.navigation} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Navigation</Text>

          {filteredItems.map((item) => {
            const isActive = currentRoute === item.route;

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.navItem,
                  isActive && styles.navItemActive,
                ]}
                onPress={() => handleNavigation(item.route)}
              >
                <View style={styles.navItemLeft}>
                  <Text style={[
                    styles.navIcon,
                    isActive && styles.navIconActive,
                  ]}>
                    {item.icon}
                  </Text>
                  <Text style={[
                    styles.navText,
                    isActive && styles.navTextActive,
                  ]}>
                    {item.title}
                  </Text>
                </View>

                {item.badge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                )}

                {isActive && <View style={[styles.activeIndicator, { backgroundColor: getUserTypeColor() }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <Text style={styles.sectionTitle}>Quick Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>24</Text>
              <Text style={styles.statLabel}>
                {userType === 'farmer' ? 'Products' : 'Orders'}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: getUserTypeColor() }]}>₱12.5K</Text>
              <Text style={styles.statLabel}>
                {userType === 'farmer' ? 'Revenue' : 'Spent'}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => handleNavigation(`/${userType}/settings`)}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
            <Text style={styles.settingsText}>Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutIcon}>🚪</Text>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width * 0.8,
    height: height,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: '#1f2937',
  },
  brandSection: {
    flex: 1,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  userTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  userTypeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  userTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '600',
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  userSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  navigation: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 16,
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: '#f0fdf4',
  },
  navItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  navIcon: {
    fontSize: 20,
    marginRight: 16,
    width: 24,
    textAlign: 'center',
  },
  navIconActive: {
    transform: [{ scale: 1.1 }],
  },
  navText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  navTextActive: {
    color: '#059669',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  activeIndicator: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  },
  quickStats: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    marginBottom: 8,
  },
  settingsIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  settingsText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
  },
  logoutIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  logoutText: {
    fontSize: 16,
    color: '#dc2626',
    fontWeight: '600',
  },
});