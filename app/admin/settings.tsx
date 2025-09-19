import React from 'react';
import { StyleSheet, View } from 'react-native';
import Settings from '../../components/Settings';

export default function AdminSettingsScreen() {
  return (
    <View style={styles.container}>
      <Settings userType="admin" currentRoute="/admin/settings" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
});