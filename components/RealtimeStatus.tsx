import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { realtimeManager, ConnectionState } from '../services/realtimeManager';

const colors = {
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  white: '#ffffff',
  gray400: '#9ca3af',
  gray600: '#4b5563',
};

interface RealtimeStatusProps {
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function RealtimeStatus({
  showLabel = false,
  size = 'small'
}: RealtimeStatusProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');

  useEffect(() => {
    // Get initial state
    setConnectionState(realtimeManager.getConnectionState());

    // Subscribe to state changes
    const unsubscribe = realtimeManager.onConnectionStateChange(setConnectionState);

    return unsubscribe;
  }, []);

  const getStatusColor = () => {
    switch (connectionState) {
      case 'CONNECTED':
        return colors.success;
      case 'CONNECTING':
        return colors.warning;
      case 'DISCONNECTED':
        return colors.danger;
      default:
        return colors.gray400;
    }
  };

  const getStatusIcon = () => {
    switch (connectionState) {
      case 'CONNECTED':
        return 'wifi';
      case 'CONNECTING':
        return 'spinner';
      case 'DISCONNECTED':
        return 'wifi-slash';
      default:
        return 'question-circle';
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'CONNECTED':
        return 'Connected';
      case 'CONNECTING':
        return 'Connecting...';
      case 'DISCONNECTED':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  const handlePress = () => {
    if (connectionState === 'DISCONNECTED') {
      realtimeManager.reconnect();
    }
  };

  const iconSize = size === 'small' ? 12 : size === 'medium' ? 16 : 20;

  return (
    <TouchableOpacity
      style={[styles.container, size === 'large' && styles.containerLarge]}
      onPress={handlePress}
      disabled={connectionState === 'CONNECTING'}
    >
      <View style={[styles.indicator, { backgroundColor: getStatusColor() }]}>
        <Icon
          name={getStatusIcon()}
          size={iconSize}
          color={colors.white}
        />
      </View>
      {showLabel && (
        <Text style={[styles.label, size === 'large' && styles.labelLarge]}>
          {getStatusText()}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  containerLarge: {
    gap: 8,
  },

  indicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: {
    fontSize: 12,
    color: colors.gray600,
    fontWeight: '500',
  },

  labelLarge: {
    fontSize: 14,
  },
});