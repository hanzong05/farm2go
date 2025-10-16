import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, ViewStyle } from 'react-native';

interface SafeContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
}

/**
 * SafeContainer - Wrapper component that ensures content doesn't get hidden
 * behind system UI elements (status bar, notch, navigation bar, etc.)
 *
 * Use this instead of View for your root container on any screen.
 */
export default function SafeContainer({
  children,
  style,
  edges = ['bottom'] // Only bottom by default - no top padding
}: SafeContainerProps) {
  return (
    <SafeAreaView style={[styles.container, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
