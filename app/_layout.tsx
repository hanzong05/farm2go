import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '../contexts/AuthContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();

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
          <Stack.Screen name="auth/forgot-password" options={{ headerShown: false }} />
          <Stack.Screen name="admin/users" options={{ headerShown: false }} />
          <Stack.Screen name="admin/products" options={{ headerShown: false }} />
          <Stack.Screen name="admin/settings" options={{ headerShown: false }} />
          <Stack.Screen name="farmer/my-products" options={{ headerShown: false }} />
          <Stack.Screen name="farmer/orders" options={{ headerShown: false }} />
          <Stack.Screen name="farmer/inventory" options={{ headerShown: false }} />
          <Stack.Screen name="farmer/sales-history" options={{ headerShown: false }} />
          <Stack.Screen name="farmer/settings" options={{ headerShown: false }} />
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
