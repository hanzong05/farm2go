import { Stack } from 'expo-router';

export default function BuyerLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Buyer Dashboard' }} />
      <Stack.Screen name="products" options={{ title: 'Browse Products' }} />
      <Stack.Screen name="cart" options={{ title: 'Shopping Cart' }} />
      <Stack.Screen name="orders" options={{ title: 'My Orders' }} />
      <Stack.Screen name="favorites" options={{ title: 'Favorites' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
    </Stack>
  );
}