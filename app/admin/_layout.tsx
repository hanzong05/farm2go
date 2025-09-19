import { Stack } from 'expo-router';
import ResponsiveLayout from '../../components/ResponsiveLayout';

export default function AdminLayout() {
  return (
    <ResponsiveLayout userRole="admin">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false, title: 'Admin Dashboard' }} />
        <Stack.Screen name="users" options={{ headerShown: false, title: 'User Management' }} />
        <Stack.Screen name="products" options={{ headerShown: false, title: 'Product Management' }} />
        <Stack.Screen name="orders" options={{ headerShown: false, title: 'Order Management' }} />
        <Stack.Screen name="analytics" options={{ headerShown: false, title: 'Analytics' }} />
        <Stack.Screen name="settings" options={{ headerShown: false, title: 'System Settings' }} />
      </Stack>
    </ResponsiveLayout>
  );
}