import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  ScrollView,
  Platform,
} from 'react-native';
import { router, useSegments } from 'expo-router';
import NavBar from './NavBar';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Responsive breakpoints
const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200,
};

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  userRole: 'farmer' | 'buyer' | 'admin';
}

interface NavigationItem {
  id: string;
  title: string;
  route: string;
  icon: string;
  description?: string;
}

// Navigation configurations for different user roles
const NAVIGATION_CONFIG = {
  farmer: [
    { id: 'dashboard', title: 'Dashboard', route: '/farmer', icon: '🏠', description: 'Overview & Analytics' },
    { id: 'products', title: 'My Products', route: '/farmer/my-products', icon: '🥬', description: 'Manage Products' },
    { id: 'inventory', title: 'Inventory', route: '/farmer/inventory', icon: '📦', description: 'Stock Management' },
    { id: 'orders', title: 'Orders', route: '/farmer/orders', icon: '📋', description: 'Order Management' },
    { id: 'sales', title: 'Sales History', route: '/farmer/sales-history', icon: '💰', description: 'Sales Reports' },
    { id: 'profile', title: 'Profile', route: '/farmer/profile', icon: '👤', description: 'Account Settings' },
  ],
  buyer: [
    { id: 'marketplace', title: 'Marketplace', route: '/buyer/marketplace', icon: '🛒', description: 'Browse Products' },
    { id: 'orders', title: 'My Orders', route: '/buyer/my-orders', icon: '📦', description: 'Order History' },
    { id: 'purchases', title: 'Purchase History', route: '/buyer/purchase-history', icon: '📜', description: 'Past Purchases' },
    { id: 'profile', title: 'Profile', route: '/buyer/settings', icon: '👤', description: 'Account Settings' },
  ],
  admin: [
    { id: 'dashboard', title: 'Dashboard', route: '/admin', icon: '⚡', description: 'Admin Overview' },
    { id: 'users', title: 'Users', route: '/admin/users', icon: '👥', description: 'User Management' },
    { id: 'products', title: 'Products', route: '/admin/products', icon: '🥬', description: 'Product Approval' },
    { id: 'settings', title: 'Settings', route: '/admin/settings', icon: '⚙️', description: 'System Settings' },
  ],
};

// Farm2Go color scheme
const colors = {
  primary: '#059669',
  secondary: '#10b981',
  white: '#ffffff',
  background: '#f0f9f4',
  surface: '#ffffff',
  text: '#0f172a',
  textSecondary: '#6b7280',
  border: '#d1fae5',
  shadow: 'rgba(0,0,0,0.1)',
  sidebarBg: '#ffffff',
  sidebarHover: '#f0f9f4',
};

export default function ResponsiveLayout({ children, userRole }: ResponsiveLayoutProps) {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const segments = useSegments();

  const isDesktop = dimensions.width >= BREAKPOINTS.mobile;
  const isTablet = dimensions.width >= BREAKPOINTS.tablet;
  const navigationItems = NAVIGATION_CONFIG[userRole] || [];

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const getCurrentRoute = () => {
    return `/${segments.join('/')}`;
  };

  const isActiveRoute = (route: string) => {
    const currentRoute = getCurrentRoute();
    if (route === `/${userRole}`) {
      return currentRoute === route || currentRoute === `/${userRole}/index`;
    }
    return currentRoute.startsWith(route);
  };

  const handleNavigation = (route: string) => {
    router.push(route as any);
  };

  const DesktopSidebar = () => (
    <View style={[
      styles.sidebar,
      sidebarCollapsed && styles.sidebarCollapsed,
      { width: sidebarCollapsed ? 80 : 280 }
    ]}>
      {/* Header */}
      <View style={styles.sidebarHeader}>
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🌱</Text>
          </View>
          {!sidebarCollapsed && (
            <View style={styles.logoText}>
              <Text style={styles.logoTitle}>Farm2Go</Text>
              <Text style={styles.logoSubtitle}>
                {userRole.charAt(0).toUpperCase() + userRole.slice(1)} Portal
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.collapseButton}
          onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          <Text style={styles.collapseIcon}>
            {sidebarCollapsed ? '→' : '←'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Navigation */}
      <ScrollView style={styles.navigation} showsVerticalScrollIndicator={false}>
        {navigationItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.navItem,
              isActiveRoute(item.route) && styles.navItemActive,
              sidebarCollapsed && styles.navItemCollapsed,
            ]}
            onPress={() => handleNavigation(item.route)}
            activeOpacity={0.7}
          >
            <View style={styles.navIconContainer}>
              <Text style={[
                styles.navIcon,
                isActiveRoute(item.route) && styles.navIconActive
              ]}>
                {item.icon}
              </Text>
            </View>

            {!sidebarCollapsed && (
              <View style={styles.navTextContainer}>
                <Text style={[
                  styles.navTitle,
                  isActiveRoute(item.route) && styles.navTitleActive
                ]}>
                  {item.title}
                </Text>
                {item.description && (
                  <Text style={[
                    styles.navDescription,
                    isActiveRoute(item.route) && styles.navDescriptionActive
                  ]}>
                    {item.description}
                  </Text>
                )}
              </View>
            )}

            {isActiveRoute(item.route) && (
              <View style={styles.activeIndicator} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Footer */}
      {!sidebarCollapsed && (
        <View style={styles.sidebarFooter}>
          <Text style={styles.footerText}>Farm2Go v1.0</Text>
          <Text style={styles.footerSubtext}>Fresh • Local • Direct</Text>
        </View>
      )}
    </View>
  );

  const TabletNavigation = () => (
    <View style={styles.tabletNav}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabletNavContent}
      >
        {navigationItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.tabletNavItem,
              isActiveRoute(item.route) && styles.tabletNavItemActive,
            ]}
            onPress={() => handleNavigation(item.route)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.tabletNavIcon,
              isActiveRoute(item.route) && styles.tabletNavIconActive
            ]}>
              {item.icon}
            </Text>
            <Text style={[
              styles.tabletNavText,
              isActiveRoute(item.route) && styles.tabletNavTextActive
            ]}>
              {item.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (isDesktop) {
    return (
      <View style={styles.desktopContainer}>
        <DesktopSidebar />
        <View style={[styles.mainContent, { marginLeft: sidebarCollapsed ? 80 : 280 }]}>
          {children}
        </View>
      </View>
    );
  }

  if (isTablet) {
    return (
      <View style={styles.tabletContainer}>
        <TabletNavigation />
        <View style={styles.tabletContent}>
          {children}
        </View>
      </View>
    );
  }

  // Mobile layout with existing NavBar
  return (
    <View style={styles.mobileContainer}>
      {children}
      <NavBar currentRoute={getCurrentRoute()} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Desktop Styles
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },

  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.sidebarBg,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    zIndex: 1000,
    transition: 'width 0.3s ease',
  },

  sidebarCollapsed: {
    width: 80,
  },

  sidebarHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  logoIcon: {
    fontSize: 20,
  },

  logoText: {
    flex: 1,
  },

  logoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 2,
  },

  logoSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },

  collapseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  collapseIcon: {
    fontSize: 14,
    color: colors.text,
  },

  navigation: {
    flex: 1,
    paddingTop: 20,
  },

  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    borderRadius: 12,
    position: 'relative',
  },

  navItemActive: {
    backgroundColor: colors.primary,
  },

  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },

  navIconContainer: {
    width: 40,
    alignItems: 'center',
  },

  navIcon: {
    fontSize: 20,
  },

  navIconActive: {
    // Icon remains same color
  },

  navTextContainer: {
    flex: 1,
    marginLeft: 12,
  },

  navTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },

  navTitleActive: {
    color: colors.white,
  },

  navDescription: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  navDescriptionActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },

  activeIndicator: {
    position: 'absolute',
    right: 0,
    top: '50%',
    marginTop: -12,
    width: 4,
    height: 24,
    backgroundColor: colors.white,
    borderRadius: 2,
  },

  mainContent: {
    flex: 1,
    transition: 'margin-left 0.3s ease',
  },

  sidebarFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },

  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },

  footerSubtext: {
    fontSize: 10,
    color: colors.textSecondary,
  },

  // Tablet Styles
  tabletContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },

  tabletNav: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },

  tabletNavContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },

  tabletNavItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.border,
    alignItems: 'center',
    minWidth: 100,
  },

  tabletNavItemActive: {
    backgroundColor: colors.primary,
  },

  tabletNavIcon: {
    fontSize: 16,
    marginBottom: 4,
  },

  tabletNavIconActive: {
    // Keep same color
  },

  tabletNavText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },

  tabletNavTextActive: {
    color: colors.white,
  },

  tabletContent: {
    flex: 1,
  },

  // Mobile Styles
  mobileContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
});