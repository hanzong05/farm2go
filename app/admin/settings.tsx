import React from 'react';
import { View, StyleSheet } from 'react-native';
import NavBar from '../../components/NavBar';
import Settings from '../../components/Settings';

export default function AdminSettingsScreen() {
  return (
    <View style={styles.container}>
      <NavBar currentRoute="/admin/settings" />
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