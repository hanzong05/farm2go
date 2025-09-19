import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false, title: '' }} />
      <Stack.Screen name="users" options={{ headerShown: false, title: '' }} />
      <Stack.Screen name="products" options={{ headerShown: false, title: '' }} />
      <Stack.Screen name="orders" options={{ headerShown: false, title: '' }} />
      <Stack.Screen name="analytics" options={{ headerShown: false, title: '' }} />
      <Stack.Screen name="settings" options={{ headerShown: false, title: '' }} />
    </Stack>
  );
}