import { Stack } from 'expo-router';

export default function FarmerLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Farmer Dashboard' }} />
      <Stack.Screen name="products" options={{ title: 'My Products' }} />
      <Stack.Screen name="orders" options={{ title: 'My Orders' }} />
      <Stack.Screen name="inventory" options={{ title: 'Inventory' }} />
      <Stack.Screen name="profile" options={{ title: 'Farm Profile' }} />
    </Stack>
  );
}