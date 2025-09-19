import { Stack } from 'expo-router';
import ResponsiveLayout from '../../components/ResponsiveLayout';

export default function BuyerLayout() {
  return (
    <ResponsiveLayout userRole="buyer">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false, title: 'Home' }} />
        <Stack.Screen name="marketplace" options={{ headerShown: false, title: 'Marketplace' }} />
        <Stack.Screen name="products" options={{ headerShown: false, title: 'Products' }} />
        <Stack.Screen name="cart" options={{ headerShown: false, title: 'Cart' }} />
        <Stack.Screen name="my-orders" options={{ headerShown: false, title: 'My Orders' }} />
        <Stack.Screen name="purchase-history" options={{ headerShown: false, title: 'Purchase History' }} />
        <Stack.Screen name="favorites" options={{ headerShown: false, title: 'Favorites' }} />
        <Stack.Screen name="settings" options={{ headerShown: false, title: 'Settings' }} />
        <Stack.Screen name="contact-farmer" options={{ headerShown: false, title: 'Contact Farmer' }} />
        <Stack.Screen name="order" options={{ headerShown: false, title: 'Place Order' }} />
      </Stack>
    </ResponsiveLayout>
  );
}