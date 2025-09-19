import { Stack } from 'expo-router';
import ResponsiveLayout from '../../components/ResponsiveLayout';

export default function FarmerLayout() {
  return (
    <ResponsiveLayout userRole="farmer">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false, title: 'Dashboard' }} />
        <Stack.Screen name="my-products" options={{ headerShown: false, title: 'My Products' }} />
        <Stack.Screen name="products" options={{ headerShown: false, title: 'Products' }} />
        <Stack.Screen name="orders" options={{ headerShown: false, title: 'Orders' }} />
        <Stack.Screen name="inventory" options={{ headerShown: false, title: 'Inventory' }} />
        <Stack.Screen name="sales-history" options={{ headerShown: false, title: 'Sales History' }} />
        <Stack.Screen name="profile" options={{ headerShown: false, title: 'Profile' }} />
      </Stack>
    </ResponsiveLayout>
  );
}