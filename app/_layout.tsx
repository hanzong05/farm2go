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

  // Session-based routing guard for automatic user type redirection and route protection
  useEffect(() => {
    const checkUserSessionAndRedirect = async () => {
      try {
        // Skip session check only if already initialized AND user data is available
        // This ensures that mobile browser refreshes still trigger proper session checks
        if (hasInitialized.current) {
          try {
            const existingUserData = await getUserWithProfile();
            if (existingUserData?.profile) {
              console.log('🔍 Skipping session check - already initialized with valid user data');
              return;
            } else {
              console.log('🔍 User data not found despite initialization, running session check');
              hasInitialized.current = false; // Reset to allow proper session check
            }
          } catch (error) {
            console.log('🔍 Error checking existing user data, running session check');
            hasInitialized.current = false; // Reset to allow proper session check
          }
        }

        const userData = await getUserWithProfile();
        const currentPath = window?.location?.pathname || '';

        console.log('🔍 Session check - Current path:', currentPath);
        console.log('🔍 Session check - User data:', userData?.profile ? 'Logged in' : 'Not logged in');

        // Define public routes that don't require authentication
        const publicRoutes = [
          '/',
          '/index',
          '/buyer/marketplace',
          '/about',
          '/contact',
          '/terms',
          '/privacy',
          '/features',
          '/pricing',
          '/demo',
          '/blog',
          '/careers',
          '/case-studies',
          '/cookies',
          '/docs',
          '/integrations',
          '/press',
          '/security',
          '/support',
          '/onboarding',
          '/maintenance'
        ];

        // Define protected routes that require authentication
        const protectedRoutes = [
          '/admin',
          '/super-admin',
          '/farmer',
          '/buyer/my-orders',
          '/buyer/purchase-history',
          '/buyer/wishlist',
          '/buyer/settings',
          '/buyer/cart',
          '/buyer/checkout',
          '/shared'
        ];

        const isPublicRoute = publicRoutes.some(route =>
          currentPath === route || currentPath.startsWith('/auth/')
        );

        const isProtectedRoute = protectedRoutes.some(route =>
          currentPath.startsWith(route)
        );

        if (userData?.profile) {
          // User is logged in
          console.log('🔍 Session check - User type:', userData.profile.user_type);
          console.log('🔍 Session check - User email:', userData.profile.email);

          // Only redirect if user is on root, auth pages, or wrong user type section
          const shouldRedirect = currentPath === '/' ||
                                 currentPath === '/index' ||
                                 currentPath.startsWith('/auth/') ||
                                 (userData.profile.user_type === 'farmer' && currentPath.startsWith('/buyer/marketplace'));

          console.log('🔍 Should redirect authenticated user?', shouldRedirect, 'Current path:', currentPath, 'User type:', userData.profile.user_type);

          if (shouldRedirect) {
            // Import router dynamically to avoid circular dependencies
            const { router } = await import('expo-router');

            switch (userData.profile.user_type) {
              case 'super-admin':
                console.log('🚀 Auto-redirecting super admin to dashboard');
                router.replace('/super-admin' as any);
                break;
              case 'admin':
                console.log('🚀 Auto-redirecting admin to dashboard');
                try {
                  router.replace('/admin/users' as any);
                  console.log('✅ Admin redirect completed to /admin/users');
                } catch (error) {
                  console.error('❌ Admin redirect failed:', error);
                }
                break;
              case 'farmer':
                console.log('🚀 Auto-redirecting farmer to dashboard');
                router.replace('/farmer');
                break;
              case 'buyer':
                console.log('🚀 Auto-redirecting buyer to marketplace');
                router.replace('/buyer/marketplace');
                break;
              default:
                console.log('🚀 Default redirect to marketplace');
                router.replace('/buyer/marketplace');
            }
          }
        } else {
          // User is NOT logged in
          console.log('🔒 No active session detected');

          if (isProtectedRoute) {
            // User trying to access protected route without authentication
            console.log('🚨 Unauthorized access attempt to protected route:', currentPath);
            console.log('🔄 Redirecting to marketplace...');

            const { router } = await import('expo-router');
            router.replace('/buyer/marketplace' as any);
            console.log('✅ Redirected unauthorized user to marketplace');
          } else if (isPublicRoute) {
            // User is on public route, allow access
            console.log('✅ Access allowed to public route:', currentPath);
          } else {
            // Unknown route, redirect to marketplace for safety
            console.log('⚠️ Unknown route accessed by unauthenticated user:', currentPath);
            console.log('🔄 Redirecting to marketplace for safety...');

            const { router } = await import('expo-router');
            router.replace('/buyer/marketplace' as any);
          }
        }

        // Mark as initialized after first successful check
        hasInitialized.current = true;
      } catch (error) {
        console.log('🔍 Error checking session or redirecting:', error);
        // On error, assume user is not logged in and allow only public access
        const currentPath = window?.location?.pathname || '';
        const publicRoutes = ['/', '/index', '/buyer/marketplace', '/about', '/contact', '/terms', '/privacy'];
        const isPublicRoute = publicRoutes.some(route =>
          currentPath === route || currentPath.startsWith('/auth/')
        );

        if (!isPublicRoute) {
          console.log('🔄 Error state: Redirecting to marketplace...');
          try {
            const { router } = await import('expo-router');
            router.replace('/buyer/marketplace' as any);
          } catch (redirectError) {
            console.error('❌ Failed to redirect on error:', redirectError);
          }
        }
        hasInitialized.current = true;
      }
    };

    // Only run on initial mount, not on every app focus
    if (!hasInitialized.current) {
      checkUserSessionAndRedirect();
    }
  }, []);

  // Additional auth state listener for immediate redirects (only on actual auth events)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change detected:', event, session?.user?.email);

      // Only handle actual sign in/out events, not token refreshes
      if (event === 'SIGNED_IN' && session?.user && appStateRef.current === 'active') {
        console.log('🚀 User just signed in, checking for immediate redirect');

        try {
          // Small delay to ensure profile is loaded
          setTimeout(async () => {
            const userData = await getUserWithProfile();
            if (userData?.profile) {
              const { router } = await import('expo-router');

              console.log('🔄 Immediate redirect for user type:', userData.profile.user_type);

              switch (userData.profile.user_type) {
                case 'super-admin':
                  console.log('🚀 Immediate redirect: super-admin');
                  router.replace('/super-admin' as any);
                  break;
                case 'admin':
                  console.log('🚀 Immediate redirect: admin');
                  router.replace('/admin/users' as any);
                  break;
                case 'farmer':
                  console.log('🚀 Immediate redirect: farmer');
                  router.replace('/farmer' as any);
                  break;
                case 'buyer':
                  console.log('🚀 Immediate redirect: buyer');
                  router.replace('/buyer/marketplace' as any);
                  break;
              }
            }
          }, 200);
        } catch (error) {
          console.error('❌ Immediate redirect failed:', error);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('🚪 User signed out, checking current route...');

        try {
          const currentPath = window?.location?.pathname || '';
          const { router } = await import('expo-router');

          // Define routes that logged out users can access
          const allowedLoggedOutRoutes = [
            '/',
            '/index',
            '/buyer/marketplace',
            '/about',
            '/contact',
            '/terms',
            '/privacy',
            '/features',
            '/pricing',
            '/demo',
            '/blog',
            '/careers',
            '/case-studies',
            '/cookies',
            '/docs',
            '/integrations',
            '/press',
            '/security',
            '/support',
            '/onboarding',
            '/maintenance'
          ];

          const isAllowedRoute = allowedLoggedOutRoutes.some(route =>
            currentPath === route || currentPath.startsWith('/auth/')
          );

          if (isAllowedRoute) {
            console.log('✅ User signed out but on allowed route:', currentPath);
            // Stay on current route if it's allowed for logged out users
          } else {
            console.log('🔄 User signed out from protected route, redirecting to marketplace');
            router.replace('/buyer/marketplace' as any);
            console.log('✅ Logout redirect to marketplace successful');
          }
        } catch (error) {
          console.error('❌ Logout redirect failed:', error);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // AppState monitoring to handle mobile browser refresh scenarios
  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      console.log('🔄 App state changing from', appStateRef.current, 'to', nextAppState);

      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('🔄 App came to foreground - checking if session needs refresh');

        // On mobile browsers, when switching back to the app, we might need to refresh user state
        // if the page was reloaded/reset
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          // Check if the current user is still valid after potential page refresh
          setTimeout(async () => {
            try {
              const userData = await getUserWithProfile();
              const currentPath = window?.location?.pathname || '';

              console.log('🔄 Foreground check - Current path:', currentPath, 'User:', userData?.profile ? 'Valid' : 'Invalid');

              // If user data exists but we're not on the right path, redirect
              if (userData?.profile && currentPath.startsWith('/buyer/marketplace')) {
                const { router } = await import('expo-router');

                console.log('🔄 Mobile refresh detected - redirecting farmer from marketplace');
                if (userData.profile.user_type === 'farmer') {
                  router.replace('/farmer');
                }
              }
            } catch (error) {
              console.log('🔄 Error during foreground session check:', error);
            }
          }, 500); // Small delay to allow page to stabilize
        }
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Page visibility handler for mobile browser refresh detection
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log('🔄 Page became visible - checking user session');

          // Small delay to allow any page refresh to complete
          setTimeout(async () => {
            try {
              const userData = await getUserWithProfile();
              const currentPath = window?.location?.pathname || '';

              console.log('🔄 Visibility check - Current path:', currentPath, 'User type:', userData?.profile?.user_type);

              // If user is a farmer but ended up on marketplace, redirect back
              if (userData?.profile?.user_type === 'farmer' && currentPath.startsWith('/buyer/marketplace')) {
                console.log('🔄 Farmer detected on marketplace after page refresh - redirecting to farmer dashboard');
                const { router } = await import('expo-router');
                router.replace('/farmer');
              }
            } catch (error) {
              console.log('🔄 Error during visibility session check:', error);
            }
          }, 1000); // Longer delay for page refresh scenarios
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
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
  );
}