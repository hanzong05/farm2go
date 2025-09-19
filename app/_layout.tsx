import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '../contexts/AuthContext';
import { SessionProvider } from '../contexts/SessionContext';

// Shopee-inspired theme with orange primary colors
const ShopeeTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#ff4500', // Shopee orange
    background: '#f5f5f5', // Light gray background
    card: '#ffffff',
    text: '#212529',
    border: '#e9ecef',
    notification: '#ff4500',
  },
};

const ShopeeDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#ff6b35', // Lighter orange for dark mode
    background: '#1a1a1a',
    card: '#2d2d2d',
    text: '#ffffff',
    border: '#404040',
    notification: '#ff6b35',
  },
};

// Enhanced screen options for Shopee-style appearance
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

// Auth screen options with Shopee styling
const getAuthScreenOptions = (title?: string) => ({
  ...getScreenOptions(title),
  animation: 'fade' as const,
  contentStyle: {
    backgroundColor: '#ffffff',
  },
});

// Dashboard screen options with marketplace styling
const getDashboardScreenOptions = (title?: string) => ({
  ...getScreenOptions(title),
  animation: 'slide_from_bottom' as const,
  contentStyle: {
    backgroundColor: '#f5f5f5', // Shopee background color
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
          value={colorScheme === 'dark' ? ShopeeDarkTheme : ShopeeTheme}
        >
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: {
              backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5',
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
          style={colorScheme === 'dark' ? 'light' : 'dark'}
          backgroundColor={colorScheme === 'dark' ? '#1a1a1a' : '#ff4500'}
          translucent={Platform.OS === 'android'}
        />
        </ThemeProvider>
      </AuthProvider>
    </SessionProvider>
  );
}