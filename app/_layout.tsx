import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '../contexts/AuthContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Handle deep linking for OAuth redirects
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      console.log('🔗 Deep link received:', url);
      // OAuth redirects will be handled by Supabase automatically
    };

    // Listen for incoming deep links
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="about" options={{ headerShown: false }} />
          <Stack.Screen name="contact" options={{ headerShown: false }} />
          <Stack.Screen name="terms" options={{ headerShown: false }} />
          <Stack.Screen name="privacy" options={{ headerShown: false }} />
          <Stack.Screen name="features" options={{ headerShown: false }} />
          <Stack.Screen name="pricing" options={{ headerShown: false }} />
          <Stack.Screen name="demo" options={{ headerShown: false }} />
          <Stack.Screen name="auth/login" options={{ headerShown: false }} />
          <Stack.Screen name="auth/register" options={{ headerShown: false }} />
          <Stack.Screen name="auth/complete-profile" options={{ headerShown: false }} />
          <Stack.Screen name="auth/forgot-password" options={{ headerShown: false }} />
          <Stack.Screen name="admin/users" options={{ headerShown: false }} />
          <Stack.Screen name="admin/products" options={{ headerShown: false }} />
          <Stack.Screen name="admin/settings" options={{ headerShown: false }} />
          <Stack.Screen name="farmer/my-products" options={{ headerShown: false, title: '' }} />
          <Stack.Screen name="farmer/orders" options={{ headerShown: false, title: '' }} />
          <Stack.Screen name="farmer/inventory" options={{ headerShown: false, title: '' }} />
          <Stack.Screen name="farmer/sales-history" options={{ headerShown: false, title: '' }} />
          <Stack.Screen name="farmer/settings" options={{ headerShown: false, title: '' }} />
          <Stack.Screen name="buyer/marketplace" options={{ headerShown: false }} />
          <Stack.Screen name="buyer/search" options={{ headerShown: false }} />
          <Stack.Screen name="buyer/my-orders" options={{ headerShown: false }} />
          <Stack.Screen name="buyer/purchase-history" options={{ headerShown: false }} />
          <Stack.Screen name="buyer/settings" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
