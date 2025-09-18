import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Theme, ComponentStyles } from '../constants/Theme';

interface CategoryChipProps {
  label: string;
  icon?: string;
  active?: boolean;
  onPress?: () => void;
  style?: any;
}

export default function CategoryChip({
  label,
  icon,
  active = false,
  onPress,
  style,
}: CategoryChipProps) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        active && styles.chipActive,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={[
        styles.label,
        active && styles.labelActive,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    ...ComponentStyles.chip,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    minHeight: 36,
  },

  chipActive: {
    ...ComponentStyles.chipActive,
  },

  icon: {
    fontSize: 14,
  },

  label: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    fontWeight: '500',
  },

  labelActive: {
    color: Theme.colors.text.inverse,
    fontWeight: '600',
  },
});