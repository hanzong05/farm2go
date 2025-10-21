import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

export interface ToastConfig {
  type: 'success' | 'error' | 'info' | 'warning';
  text1: string;
  text2?: string;
  duration?: number;
}

interface ToastProps {
  config: ToastConfig | null;
  onHide: () => void;
}

const colors = {
  success: '#10b981',
  error: '#ef4444',
  info: '#3b82f6',
  warning: '#f59e0b',
  white: '#ffffff',
  text: '#111827',
};

const icons = {
  success: 'check-circle',
  error: 'exclamation-circle',
  info: 'info-circle',
  warning: 'exclamation-triangle',
};

export default function Toast({ config, onHide }: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (config) {
      console.log('🍞 Toast showing:', config.type, config.text1, config.text2);
      // Show toast
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const timer = setTimeout(() => {
        hideToast();
      }, config.duration || 3000);

      return () => clearTimeout(timer);
    }
  }, [config]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  if (!config) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors[config.type],
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.content}>
        <Icon name={icons[config.type]} size={20} color={colors.white} style={styles.icon} />
        <View style={styles.textContainer}>
          <Text style={styles.text1}>{config.text1}</Text>
          {config.text2 && <Text style={styles.text2}>{config.text2}</Text>}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 40 : 60,
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  text1: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  text2: {
    color: colors.white,
    fontSize: 14,
    opacity: 0.9,
  },
});
