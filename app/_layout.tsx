import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColorScheme } from '@/hooks/use-color-scheme';
import ErrorBoundary from '../components/ErrorBoundary';
import SafeContainer from '../components/SafeContainer';
import { AuthProvider } from '../contexts/AuthContext';
import { ConfirmationModalProvider } from '../contexts/ConfirmationModalContext';
import { SessionProvider } from '../contexts/SessionContext';
import { ToastProvider } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { getUserWithProfile } from '../services/auth';

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
  animationKeyframes: 'slide_from_right' as const,
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
  animationKeyframes: 'fade' as const,
  contentStyle: {
    backgroundColor: '#ffffff',
  },
});

// Dashboard screen options with marketplace styling
const getDashboardScreenOptions = (title?: string)  => ({
  ...getScreenOptions(title),
  animationKeyframes: 'slide_from_bottom' as const,
  contentStyle: {
    backgroundColor: '#f0f9f4', // Farm2Go background color
  },
});

// Modal screen options for forms and overlays
const getModalScreenOptions = (title?: string) => ({
  ...getScreenOptions(title),
  animationKeyframes: 'slide_from_bottom' as const,
  contentStyle: {
    backgroundColor: '#ffffff',
  },
  ...(Platform.OS === 'ios' && {
    presentation: 'modal' as const,
  }),
});

function RootLayout() {
  const colorScheme = useColorScheme();
  const appStateRef = useRef(AppState.currentState);
  const hasInitialized = useRef(false);
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Check if router is ready for navigation
  const isRouterReady = navigationState?.key != null;

  // Handle pending navigation once router is ready
  useEffect(() => {
    if (isRouterReady && pendingNavigation) {
      const executePendingNavigation = () => {
        try {
          console.log('🚀 Executing pending navigation:', pendingNavigation);
          router.replace(pendingNavigation);
          setPendingNavigation(null);
        } catch (error) {
          console.error('❌ Pending navigation failed:', error);
          // Immediate retry
          if (pendingNavigation) {
            executePendingNavigation();
          }
        }
      };

      // Execute immediately if router is ready
      executePendingNavigation();
    }
  }, [isRouterReady, pendingNavigation, router]);

  // Safe navigation function
  const safeNavigate = (path: string) => {
    if (isRouterReady) {
      try {
        console.log('🚀 Safe navigation to:', path);
        router.replace(path);
      } catch (error) {
        console.error('❌ Navigation failed, queuing for retry:', error);
        setPendingNavigation(path);
      }
    } else {
      console.log('⏳ Router not ready, queuing navigation:', path);
      setPendingNavigation(path);
    }
  };

  useEffect(() => {
    if (!isRouterReady) return; // Wait for router to be ready

    let isMounted = true;

    const checkUserSessionAndRedirect = async () => {
      if (hasInitialized.current || !isMounted) return;

      try {
        const currentPath = Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.pathname
          : `/${segments.join('/')}`;

        // IMPORTANT: Skip all session checks if on callback page - let callback handle everything
        if (currentPath.includes('/auth/callback')) {
          console.log('⏭️ On callback page - skipping layout session check');
          hasInitialized.current = true;
          return;
        }

        const userData = await getUserWithProfile();

        if (!isMounted) return;

        console.log('🔍 Session check - Current path:', currentPath, 'User:', userData?.profile?.user_type || 'None');

        const protectedRoutes = ['/admin', '/super-admin', '/farmer', '/buyer/my-orders', '/buyer/purchase-history', '/buyer/wishlist', '/buyer/settings', '/buyer/cart', '/buyer/checkout', '/shared'];
        const isProtectedRoute = protectedRoutes.some(route => currentPath.startsWith(route));

        if (userData?.profile) {
          // User is logged in with profile - redirect from auth pages (except callback)
          const shouldRedirect = (currentPath === '/' ||
                                 currentPath === '/index' ||
                                 currentPath.startsWith('/auth/')) &&
                                 !currentPath.includes('/auth/callback'); // Let callback handle its own navigation

          if (shouldRedirect && isMounted) {
            console.log('🚀 Redirecting authenticated user to dashboard based on type:', userData.profile.user_type);
            let targetPath: string;
            switch (userData.profile.user_type) {
              case 'super-admin':
                targetPath = '/super-admin';
                break;
              case 'admin':
                targetPath = '/admin/users';
                break;
              case 'farmer':
                targetPath = '/';
                break;
              case 'buyer':
                targetPath = '/';
                break;
              default:
                console.log('⚠️ Unknown user type, defaulting to buyer marketplace');
                targetPath = '/';
            }
            console.log('🚀 Navigating to:', targetPath);
            safeNavigate(targetPath);
          }
        } else if (userData?.user && !userData?.profile) {
          // User is authenticated but has no profile - redirect to complete profile
          console.log('🔄 Authenticated user without profile, redirecting to complete profile');
          const shouldRedirectToCompleteProfile =
            currentPath === '/' ||
            currentPath === '/index' ||
            currentPath.startsWith('/auth/login') ||
            currentPath.startsWith('/auth/register') ||
            isProtectedRoute;

          if (shouldRedirectToCompleteProfile && isMounted) {
            safeNavigate('/auth/complete-profile');
          }
        } else {
          // No user at all - redirect unauthenticated users to marketplace from protected routes
          if (isProtectedRoute && isMounted) {
            safeNavigate('/');
          }
        }

        hasInitialized.current = true;
      } catch (error) {
        console.log('🔍 Session check error:', error);
        hasInitialized.current = true;
      }
    };

    // Execute session check immediately
    checkUserSessionAndRedirect();

    return () => {
      isMounted = false;
    };
  }, [isRouterReady, router, segments]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Silently handle auth state changes

      if (event === 'SIGNED_OUT') {
        const currentPath = Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.pathname
          : `/${segments.join('/')}`;
        const protectedRoutes = ['/admin', '/super-admin', '/farmer', '/buyer/my-orders', '/buyer/purchase-history', '/buyer/wishlist', '/buyer/settings', '/buyer/cart', '/buyer/checkout', '/shared'];
        const isProtectedRoute = protectedRoutes.some(route => currentPath.startsWith(route));

        if (isProtectedRoute) {
          safeNavigate('/');
        }
      }

      // OAuth navigation is now handled by the callback page directly
      // No need for additional OAuth handling here
    });

    return () => subscription.unsubscribe();
  }, [router, segments, isRouterReady]);

  // Minimal AppState monitoring - just track current state
  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Simple deep linking - navigate to callback and store URL globally
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      console.log('🔗 Deep link:', url);

      // OAuth callback - store URL globally and navigate
      if (url.includes('/auth/callback')) {
        try {
          console.log('✅ OAuth deep link detected');

          // Store URL globally so callback can access it
          (global as any).oauthCallbackUrl = url;

          if (isRouterReady) {
            router.push('/auth/callback');
          }
        } catch (error) {
          console.error('❌ Deep link parse error:', error);
        }
      }
    };

    const subscription = Linking.addEventListener('url', (event) => handleDeepLink(event.url));

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => subscription?.remove();
  }, [router, isRouterReady]);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ToastProvider>
          <SessionProvider>
            <AuthProvider>
              <ConfirmationModalProvider>
                <ThemeProvider
                  value={colorScheme === 'dark' ? Farm2GoDarkTheme : Farm2GoTheme}
                >
        <Stack
          screenOptions={{
            headerShown: false,
            animationKeyframes: 'slide_from_right',
            contentStyle: {
              backgroundColor: colorScheme === 'dark' ? '#0f1419' : '#f0f9f4',
            },
          }}
          screenLayout={({ children }) => (
            <SafeContainer>
              {children}
            </SafeContainer>
          )}
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
              animationKeyframes: 'none',
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
            name="farmer"
            options={getDashboardScreenOptions('Farmer Dashboard')}
          />
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

          {/* Buyer Shopping Flow */}
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
              animationKeyframes: 'fade',
            }}
          />
          <Stack.Screen
            name="maintenance"
            options={{
              ...getScreenOptions('System Maintenance'),
              animationKeyframes: 'fade',
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
              </ConfirmationModalProvider>
            </AuthProvider>
          </SessionProvider>
        </ToastProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default RootLayout;