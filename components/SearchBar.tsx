import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Theme } from '../constants/Theme';

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onSearch?: () => void;
  onFilter?: () => void;
  style?: any;
}

export default function SearchBar({
  placeholder = "Search fresh produce...",
  value,
  onChangeText,
  onSearch,
  onFilter,
  style,
}: SearchBarProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.searchContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={Theme.colors.text.tertiary}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSearch}
            returnKeyType="search"
          />

          <TouchableOpacity
            style={styles.searchButton}
            onPress={onSearch}
            activeOpacity={0.7}
          >
            <View style={styles.searchIcon}>
              <View style={styles.searchIconCircle} />
              <View style={styles.searchIconHandle} />
            </View>
          </TouchableOpacity>
        </View>

        {onFilter && (
          <TouchableOpacity
            style={styles.filterButton}
            onPress={onFilter}
            activeOpacity={0.7}
          >
            <View style={styles.filterIcon}>
              <View style={styles.filterLine} />
              <View style={styles.filterLine} />
              <View style={styles.filterLine} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Theme.colors.background,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },

  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    ...Theme.shadows.sm,
  },

  input: {
    flex: 1,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm + 2,
    ...Theme.typography.body1,
    color: Theme.colors.text.primary,
  },

  searchButton: {
    padding: Theme.spacing.sm,
    paddingRight: Theme.spacing.md,
  },

  searchIcon: {
    width: 20,
    height: 20,
    position: 'relative',
  },

  searchIconCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Theme.colors.text.secondary,
    position: 'absolute',
    top: 0,
    left: 0,
  },

  searchIconHandle: {
    width: 2,
    height: 8,
    backgroundColor: Theme.colors.text.secondary,
    position: 'absolute',
    bottom: 0,
    right: 2,
    transform: [{ rotate: '45deg' }],
    borderRadius: 1,
  },

  filterButton: {
    width: 44,
    height: 44,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.sm,
  },

  filterIcon: {
    gap: 3,
  },

  filterLine: {
    height: 2,
    backgroundColor: Theme.colors.text.secondary,
    borderRadius: 1,
  },

  filterLine: {
    width: 16,
    height: 2,
    backgroundColor: Theme.colors.text.secondary,
    borderRadius: 1,
  },
});