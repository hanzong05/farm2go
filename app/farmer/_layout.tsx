import { Stack } from 'expo-router';

export default function FarmerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false, title: '' }} />
      <Stack.Screen name="my-products" options={{ headerShown: false, title: '' }} />
      <Stack.Screen name="products" options={{ headerShown: false, title: '' }} />
      <Stack.Screen name="orders" options={{ headerShown: false, title: '' }} />
      <Stack.Screen name="inventory" options={{ headerShown: false, title: '' }} />
      <Stack.Screen name="profile" options={{ headerShown: false, title: '' }} />
    </Stack>
  );
}