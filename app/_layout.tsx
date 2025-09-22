import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Linking, Platform, AppState } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '../contexts/AuthContext';
import { SessionProvider } from '../contexts/SessionContext';
import { supabase } from '../lib/supabase';
import { getUserWithProfile } from '../services/auth';
import ErrorBoundary from '../components/ErrorBoundary';

// Farm2Go green theme
const Farm2GoTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#059669', // Farm green
    background: '#f0f9f4', // Light green background
    card: '#ffffff',
    text: '#0f172a',
    border: '#d1fae5',
    notification: '#059669',
  },
};

const Farm2GoDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#10b981', // Lighter green for dark mode
    background: '#0f1419',
    card: '#1f2937',
    text: '#ffffff',
    border: '#374151',
    notification: '#10b981',
  },
};

// Enhanced screen options for Farm2Go-style appearance
const getScreenOptions = (title?: string) => ({
  headerShown: false,
  title: title || '',
  animation: 'slide_from_right' as const,
  contentStyle: {
    backgroundColor: 'transparent',
  },
  ...(Platform.OS === 'ios' && {
    presentation: 'card' as const,
    gestureEnabled: true,
    fullScreenGestureEnabled: true,
  }),
});

// Auth screen options with Farm2Go styling
const getAuthScreenOptions = (title?: string) => ({
  ...getScreenOptions(title),
  animation: 'fade' as const,
  contentStyle: {
    backgroundColor: '#ffffff',
  },
});

// Dashboard screen options with marketplace styling
const getDashboardScreenOptions = (title?: string)  => ({
  ...getScreenOptions(title),
  animation: 'slide_from_bottom' as const,
  contentStyle: {
    backgroundColor: '#f0f9f4', // Farm2Go background color
  },
});

// Modal screen options for forms and overlays
const getModalScreenOptions = (title?: string) => ({
  ...getScreenOptions(title),
  animation: 'slide_from_bottom' as const,
  contentStyle: {
    backgroundColor: '#ffffff',
  },
  ...(Platform.OS === 'ios' && {
    presentation: 'modal' as const,
  }),
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const appStateRef = useRef(AppState.currentState);
  const hasInitialized = useRef(false);

  // Simplified session-based routing guard
  useEffect(() => {
    let isMounted = true;

    const checkUserSessionAndRedirect = async () => {
      if (hasInitialized.current || !isMounted) return;

      try {
        const userData = await getUserWithProfile();
        const currentPath = Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.pathname
          : '';

        if (!isMounted) return;

        console.log('🔍 Session check - Current path:', currentPath, 'User:', userData?.profile?.user_type || 'None');

        const protectedRoutes = ['/admin', '/super-admin', '/farmer', '/buyer/my-orders', '/buyer/purchase-history', '/buyer/wishlist', '/buyer/settings', '/buyer/cart', '/buyer/checkout', '/shared'];
        const isProtectedRoute = protectedRoutes.some(route => currentPath.startsWith(route));

        if (userData?.profile) {
          // User is logged in - only redirect from root/auth pages
          const shouldRedirect = currentPath === '/' || currentPath === '/index' || currentPath.startsWith('/auth/');

          if (shouldRedirect && isMounted) {
            const { router } = await import('expo-router');

            switch (userData.profile.user_type) {
              case 'super-admin':
                router.replace('/super-admin' as any);
                break;
              case 'admin':
                router.replace('/admin' as any);
                break;
              case 'farmer':
                router.replace('/farmer');
                break;
              case 'buyer':
                router.replace('/buyer/marketplace');
                break;
              default:
                router.replace('/buyer/marketplace');
            }
          }
        } else if (isProtectedRoute && isMounted) {
          // Redirect unauthenticated users from protected routes
          const { router } = await import('expo-router');
          router.replace('/buyer/marketplace' as any);
        }

        hasInitialized.current = true;
      } catch (error) {
        console.log('🔍 Session check error:', error);
        hasInitialized.current = true;
      }
    };

    const timeoutId = setTimeout(checkUserSessionAndRedirect, 100); // Small delay to prevent race conditions

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  // Simplified auth state listener - only handle sign out
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change:', event);

      if (event === 'SIGNED_OUT') {
        const currentPath = Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.pathname
          : '';
        const protectedRoutes = ['/admin', '/super-admin', '/farmer', '/buyer/my-orders', '/buyer/purchase-history', '/buyer/wishlist', '/buyer/settings', '/buyer/cart', '/buyer/checkout', '/shared'];
        const isProtectedRoute = protectedRoutes.some(route => currentPath.startsWith(route));

        if (isProtectedRoute) {
          const { router } = await import('expo-router');
          router.replace('/buyer/marketplace' as any);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Minimal AppState monitoring - just track current state
  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Enhanced deep linking for OAuth and marketplace navigation
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      console.log('🛒 Marketplace deep link handler:', url);
      
      // Handle specific deep link patterns
      if (url.includes('/products/')) {
        // Product detail pages
        console.log('🔗 Product deep link detected');
      } else if (url.includes('/farmers/')) {
        // Farmer profile pages
        console.log('🔗 Farmer profile deep link detected');
      } else if (url.includes('/orders/')) {
        // Order tracking pages
        console.log('🔗 Order tracking deep link detected');
      }
      
      // OAuth redirects will be handled by Supabase automatically
    };

    // Listen for incoming deep links with enhanced error handling
    const subscription = Linking.addEventListener('url', (event) => {
      try {
        handleDeepLink(event.url);
      } catch (error) {
        console.error('🚨 Deep link handling error:', error);
      }
    });

    // Check if app was opened with a deep link
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          handleDeepLink(url);
        }
      })
      .catch((error) => {
        console.error('🚨 Initial URL error:', error);
      });

    return () => {
      subscription?.remove();
    };
  }, []);

  return (
    <ErrorBoundary>
      <SessionProvider>
        <AuthProvider>
          <ThemeProvider
            value={colorScheme === 'dark' ? Farm2GoDarkTheme : Farm2GoTheme}
          >
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: {
              backgroundColor: colorScheme === 'dark' ? '#0f1419' : '#f0f9f4',
            },
          }}
        >
          {/* Landing & Marketing Pages */}
          <Stack.Screen 
            name="index" 
            options={getScreenOptions('Farm2Go - Fresh Agricultural Marketplace')}
          />
          <Stack.Screen 
            name="about" 
            options={getScreenOptions('About Farm2Go')}
          />
          <Stack.Screen 
            name="contact" 
            options={getScreenOptions('Contact Us')}
          />
          <Stack.Screen 
            name="terms" 
            options={getScreenOptions('Terms of Service')}
          />
          <Stack.Screen 
            name="privacy" 
            options={getScreenOptions('Privacy Policy')}
          />
          <Stack.Screen 
            name="features" 
            options={getScreenOptions('Platform Features')}
          />
          <Stack.Screen 
            name="pricing" 
            options={getScreenOptions('Seller Pricing')}
          />
          <Stack.Screen 
            name="demo" 
            options={getScreenOptions('Request Demo')}
          />

          {/* Authentication Flow */}
          <Stack.Screen 
            name="auth/login" 
            options={getAuthScreenOptions('Sign In to Farm2Go')}
          />
          <Stack.Screen 
            name="auth/register" 
            options={getAuthScreenOptions('Join Farm2Go')}
          />
          <Stack.Screen 
            name="auth/complete-profile" 
            options={getAuthScreenOptions('Complete Your Profile')}
          />
          <Stack.Screen 
            name="auth/forgot-password" 
            options={getAuthScreenOptions('Reset Password')}
          />
          <Stack.Screen 
            name="auth/callback" 
            options={{
              ...getAuthScreenOptions('Signing You In...'),
              animation: 'none',
            }}
          />

          {/* Super Admin Dashboard - System Management */}
          <Stack.Screen
            name="super-admin"
            options={getDashboardScreenOptions('Super Admin Dashboard')}
          />
          <Stack.Screen
            name="super-admin/users"
            options={getDashboardScreenOptions('User Management')}
          />
          <Stack.Screen
            name="super-admin/settings"
            options={getDashboardScreenOptions('System Settings')}
          />
          <Stack.Screen
            name="super-admin/reports"
            options={getDashboardScreenOptions('System Reports')}
          />
          <Stack.Screen
            name="super-admin/backup"
            options={getDashboardScreenOptions('Backup & Restore')}
          />

          {/* Admin Dashboard - Management Console */}
          <Stack.Screen
            name="admin"
            options={getDashboardScreenOptions('Admin Dashboard')}
          />
          <Stack.Screen
            name="admin/dashboard"
            options={getDashboardScreenOptions('Admin Dashboard')}
          />
          <Stack.Screen
            name="admin/users"
            options={getDashboardScreenOptions('User Management')}
          />
          <Stack.Screen
            name="admin/products"
            options={getDashboardScreenOptions('Product Approval')}
          />
          <Stack.Screen
            name="admin/settings"
            options={getDashboardScreenOptions('Platform Settings')}
          />
          <Stack.Screen
            name="admin/analytics"
            options={getDashboardScreenOptions('Platform Analytics')}
          />

          {/* Farmer Dashboard - Seller Center */}
          <Stack.Screen 
            name="farmer/my-products" 
            options={getDashboardScreenOptions('My Products')}
          />
          <Stack.Screen 
            name="farmer/orders" 
            options={getDashboardScreenOptions('Order Management')}
          />
          <Stack.Screen 
            name="farmer/inventory" 
            options={getDashboardScreenOptions('Inventory Control')}
          />
          <Stack.Screen 
            name="farmer/sales-history" 
            options={getDashboardScreenOptions('Sales Analytics')}
          />
          <Stack.Screen 
            name="farmer/settings" 
            options={getDashboardScreenOptions('Seller Settings')}
          />
          <Stack.Screen 
            name="farmer/profile" 
            options={getDashboardScreenOptions('Farm Profile')}
          />

          {/* Farmer Product Management */}
          <Stack.Screen 
            name="farmer/products/add" 
            options={getModalScreenOptions('List New Product')}
          />
          <Stack.Screen 
            name="farmer/products/[id]" 
            options={getScreenOptions('Product Details')}
          />
          <Stack.Screen 
            name="farmer/products/edit/[id]" 
            options={getModalScreenOptions('Edit Product')}
          />
          <Stack.Screen 
            name="farmer/products/analytics/[id]" 
            options={getScreenOptions('Product Analytics')}
          />

          {/* Buyer Dashboard - Marketplace */}
          <Stack.Screen 
            name="buyer/marketplace" 
            options={getDashboardScreenOptions('Fresh Marketplace')}
          />
          <Stack.Screen 
            name="buyer/search" 
            options={getDashboardScreenOptions('Search Products')}
          />
          <Stack.Screen 
            name="buyer/categories" 
            options={getDashboardScreenOptions('Browse Categories')}
          />
          <Stack.Screen 
            name="buyer/my-orders" 
            options={getDashboardScreenOptions('My Orders')}
          />
          <Stack.Screen 
            name="buyer/purchase-history" 
            options={getDashboardScreenOptions('Purchase History')}
          />
          <Stack.Screen 
            name="buyer/wishlist" 
            options={getDashboardScreenOptions('My Wishlist')}
          />
          <Stack.Screen 
            name="buyer/settings" 
            options={getDashboardScreenOptions('Account Settings')}
          />

          {/* Buyer Shopping Flow */}
          <Stack.Screen 
            name="buyer/products/[id]" 
            options={getScreenOptions('Product Details')}
          />
          <Stack.Screen 
            name="buyer/farmers/[id]" 
            options={getScreenOptions('Farmer Profile')}
          />
          <Stack.Screen 
            name="buyer/cart" 
            options={getModalScreenOptions('Shopping Cart')}
          />
          <Stack.Screen 
            name="buyer/checkout" 
            options={getModalScreenOptions('Checkout')}
          />
          <Stack.Screen 
            name="buyer/order/[id]" 
            options={getScreenOptions('Order Details')}
          />
          <Stack.Screen 
            name="buyer/contact-farmer/[id]" 
            options={getModalScreenOptions('Contact Farmer')}
          />

          {/* Shared Features */}
          <Stack.Screen 
            name="shared/notifications" 
            options={getDashboardScreenOptions('Notifications')}
          />
          <Stack.Screen 
            name="shared/messages" 
            options={getDashboardScreenOptions('Messages')}
          />
          <Stack.Screen 
            name="shared/barangay-sync" 
            options={getScreenOptions('Location Services')}
          />
          <Stack.Screen 
            name="shared/gps-location" 
            options={getScreenOptions('GPS Location')}
          />
          <Stack.Screen 
            name="shared/partnerships" 
            options={getScreenOptions('Partner Programs')}
          />
          <Stack.Screen 
            name="shared/visual-search" 
            options={getModalScreenOptions('Visual Search')}
          />
          <Stack.Screen 
            name="shared/support" 
            options={getModalScreenOptions('Customer Support')}
          />

          {/* Marketing & Information Pages */}
          <Stack.Screen 
            name="blog" 
            options={getScreenOptions('Farm2Go Blog')}
          />
          <Stack.Screen 
            name="careers" 
            options={getScreenOptions('Join Our Team')}
          />
          <Stack.Screen 
            name="case-studies" 
            options={getScreenOptions('Success Stories')}
          />
          <Stack.Screen 
            name="cookies" 
            options={getScreenOptions('Cookie Policy')}
          />
          <Stack.Screen 
            name="docs" 
            options={getScreenOptions('Help Center')}
          />
          <Stack.Screen 
            name="integrations" 
            options={getScreenOptions('Platform Integrations')}
          />
          <Stack.Screen 
            name="press" 
            options={getScreenOptions('Press & Media')}
          />
          <Stack.Screen 
            name="security" 
            options={getScreenOptions('Security & Trust')}
          />
          <Stack.Screen 
            name="support" 
            options={getScreenOptions('Customer Support')}
          />

          {/* Special Pages */}
          <Stack.Screen 
            name="onboarding" 
            options={{
              ...getScreenOptions('Welcome to Farm2Go'),
              animation: 'fade',
            }}
          />
          <Stack.Screen 
            name="maintenance" 
            options={{
              ...getScreenOptions('System Maintenance'),
              animation: 'fade',
            }}
          />
        </Stack>

        {/* Enhanced status bar with marketplace styling */}
        <StatusBar
          style={colorScheme === 'dark' ? 'light' : 'light'}
          backgroundColor={colorScheme === 'dark' ? '#0f1419' : '#059669'}
          translucent={Platform.OS === 'android'}
        />
        </ThemeProvider>
        </AuthProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}