import React from 'react';
import { StyleSheet, View } from 'react-native';
import Settings from '../../components/Settings';

export default function BuyerSettingsScreen() {
  return (
    <View style={styles.container}>
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