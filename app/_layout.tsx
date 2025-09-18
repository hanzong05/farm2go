import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '../contexts/AuthContext';

// Professional custom theme with modern colors
const ProfessionalTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#059669',
    background: '#ffffff',
    card: '#ffffff',
    text: '#0f172a',
    border: '#e2e8f0',
    notification: '#059669',
  },
};

const ProfessionalDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#10b981',
    background: '#0f172a',
    card: '#1e293b',
    text: '#f8fafc',
    border: '#334155',
    notification: '#10b981',
  },
};

// Enhanced screen options for consistent professional appearance
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

// Auth screen options with enhanced styling
const getAuthScreenOptions = (title?: string) => ({
  ...getScreenOptions(title),
  animation: 'fade' as const,
  contentStyle: {
    backgroundColor: '#f8fafc',
  },
});

// Dashboard screen options with enhanced navigation
const getDashboardScreenOptions = (title?: string) => ({
  ...getScreenOptions(title),
  animation: 'slide_from_bottom' as const,
  contentStyle: {
    backgroundColor: '#f1f5f9',
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Enhanced deep linking for OAuth redirects
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      console.log('🔗 Professional deep link handler:', url);
      // OAuth redirects will be handled by Supabase automatically
      // Add any additional professional app-specific handling here
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
    <AuthProvider>
      <ThemeProvider 
        value={colorScheme === 'dark' ? ProfessionalDarkTheme : ProfessionalTheme}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: {
              backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#ffffff',
            },
          }}
        >
          {/* Landing & Marketing Pages */}
          <Stack.Screen 
            name="index" 
            options={getScreenOptions('Farm2Go - Agricultural Supply Chain')}
          />
          <Stack.Screen 
            name="about" 
            options={getScreenOptions('About Us')}
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
            options={getScreenOptions('Features')}
          />
          <Stack.Screen 
            name="pricing" 
            options={getScreenOptions('Pricing')}
          />
          <Stack.Screen 
            name="demo" 
            options={getScreenOptions('Request Demo')}
          />

          {/* Authentication Flow */}
          <Stack.Screen 
            name="auth/login" 
            options={getAuthScreenOptions('Sign In')}
          />
          <Stack.Screen 
            name="auth/register" 
            options={getAuthScreenOptions('Create Account')}
          />
          <Stack.Screen 
            name="auth/complete-profile" 
            options={getAuthScreenOptions('Complete Profile')}
          />
          <Stack.Screen 
            name="auth/forgot-password" 
            options={getAuthScreenOptions('Reset Password')}
          />
          <Stack.Screen 
            name="auth/callback" 
            options={{
              ...getAuthScreenOptions('Authenticating'),
              animation: 'none',
            }}
          />

          {/* Admin Dashboard */}
          <Stack.Screen 
            name="admin/users" 
            options={getDashboardScreenOptions('User Management')}
          />
          <Stack.Screen 
            name="admin/products" 
            options={getDashboardScreenOptions('Product Management')}
          />
          <Stack.Screen 
            name="admin/settings" 
            options={getDashboardScreenOptions('Admin Settings')}
          />

          {/* Farmer Dashboard */}
          <Stack.Screen 
            name="farmer/my-products" 
            options={getDashboardScreenOptions('My Products')}
          />
          <Stack.Screen 
            name="farmer/orders" 
            options={getDashboardScreenOptions('Orders')}
          />
          <Stack.Screen 
            name="farmer/inventory" 
            options={getDashboardScreenOptions('Inventory')}
          />
          <Stack.Screen 
            name="farmer/sales-history" 
            options={getDashboardScreenOptions('Sales History')}
          />
          <Stack.Screen 
            name="farmer/settings" 
            options={getDashboardScreenOptions('Farm Settings')}
          />

          {/* Farmer Product Management */}
          <Stack.Screen 
            name="farmer/products/add" 
            options={{
              ...getScreenOptions('Add Product'),
              animation: 'slide_from_bottom',
              contentStyle: {
                backgroundColor: '#f8fafc',
              },
            }}
          />
          <Stack.Screen 
            name="farmer/products/[id]" 
            options={{
              ...getScreenOptions('Product Details'),
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen 
            name="farmer/products/edit/[id]" 
            options={{
              ...getScreenOptions('Edit Product'),
              animation: 'slide_from_bottom',
              contentStyle: {
                backgroundColor: '#f8fafc',
              },
            }}
          />

          {/* Buyer Dashboard */}
          <Stack.Screen 
            name="buyer/marketplace" 
            options={getDashboardScreenOptions('Marketplace')}
          />
          <Stack.Screen 
            name="buyer/search" 
            options={getDashboardScreenOptions('Search Products')}
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
            name="buyer/settings" 
            options={getDashboardScreenOptions('Account Settings')}
          />

          {/* Buyer Product & Order Management */}
          <Stack.Screen 
            name="buyer/products/[id]" 
            options={{
              ...getScreenOptions('Product Details'),
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen 
            name="buyer/order/[id]" 
            options={{
              ...getScreenOptions('Place Order'),
              animation: 'slide_from_bottom',
              contentStyle: {
                backgroundColor: '#f8fafc',
              },
            }}
          />
          <Stack.Screen 
            name="buyer/contact-farmer/[id]" 
            options={{
              ...getScreenOptions('Contact Farmer'),
              animation: 'slide_from_bottom',
              contentStyle: {
                backgroundColor: '#f8fafc',
              },
            }}
          />

          {/* Shared Features */}
          <Stack.Screen 
            name="shared/barangay-sync" 
            options={getScreenOptions('Location Sync')}
          />
          <Stack.Screen 
            name="shared/gps-location" 
            options={getScreenOptions('GPS Location')}
          />
          <Stack.Screen 
            name="shared/partnerships" 
            options={getScreenOptions('Partnerships')}
          />
          <Stack.Screen 
            name="shared/visual-search" 
            options={getScreenOptions('Visual Search')}
          />

          {/* Additional Marketing Pages */}
          <Stack.Screen 
            name="blog" 
            options={getScreenOptions('Blog')}
          />
          <Stack.Screen 
            name="careers" 
            options={getScreenOptions('Careers')}
          />
          <Stack.Screen 
            name="case-studies" 
            options={getScreenOptions('Case Studies')}
          />
          <Stack.Screen 
            name="cookies" 
            options={getScreenOptions('Cookie Policy')}
          />
          <Stack.Screen 
            name="docs" 
            options={getScreenOptions('Documentation')}
          />
          <Stack.Screen 
            name="integrations" 
            options={getScreenOptions('Integrations')}
          />
          <Stack.Screen 
            name="press" 
            options={getScreenOptions('Press')}
          />
          <Stack.Screen 
            name="security" 
            options={getScreenOptions('Security')}
          />
          <Stack.Screen 
            name="support" 
            options={getScreenOptions('Support')}
          />
        </Stack>

        {/* Enhanced status bar with theme-aware styling */}
        <StatusBar 
          style={colorScheme === 'dark' ? 'light' : 'dark'}
          backgroundColor={colorScheme === 'dark' ? '#0f172a' : '#ffffff'}
          translucent={Platform.OS === 'android'}
        />
      </ThemeProvider>
    </AuthProvider>
  );
}