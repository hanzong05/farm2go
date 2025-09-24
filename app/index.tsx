import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function Index() {
  console.log('📍 Index page rendered - emergency navigation');
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Farm2Go</Text>
      <Text style={styles.subtitle}>Emergency Navigation</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/auth/login')}
      >
        <Text style={styles.buttonText}>Go to Login</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/buyer/marketplace')}
      >
        <Text style={styles.buttonText}>Go to Marketplace</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/auth/register')}
      >
        <Text style={styles.buttonText}>Go to Register</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9f4',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#059669',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 8,
    marginVertical: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});