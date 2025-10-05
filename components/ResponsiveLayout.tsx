import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  userRole: 'farmer' | 'buyer' | 'admin';
}

// Farm2Go color scheme
const colors = {
  primary: '#059669',
  secondary: '#10b981',
  white: '#ffffff',
  background: '#f0f9f4',
  surface: '#ffffff',
  text: '#0f172a',
  textSecondary: '#6b7280',
  border: '#d1fae5',
  shadow: 'rgba(0,0,0,0.1)',
  sidebarBg: '#ffffff',
  sidebarHover: '#f0f9f4',
};

export default function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  // Since navigation is now handled by HeaderComponent,
  // this layout simply returns children without sidebar
  // FloatingContactButton is now in root _layout.tsx
  return (
    <View style={styles.container}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});