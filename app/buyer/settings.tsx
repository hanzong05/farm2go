import React from 'react';
import { View, StyleSheet } from 'react-native';
import NavBar from '../../components/NavBar';
import Settings from '../../components/Settings';

export default function BuyerSettingsScreen() {
  return (
    <View style={styles.container}>
      <NavBar currentRoute="/buyer/settings" />
      <Settings userType="buyer" currentRoute="/buyer/settings" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
});