import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthTest() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string>('');

  const testSupabaseConnection = async () => {
    setTesting(true);
    setResult('Testing...');

    try {
      // Test 1: Basic connection
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setResult(`❌ Connection Error: ${error.message}`);
        return;
      }

      // Test 2: OAuth provider check
      try {
        const oauthResult = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'farm2go://auth/callback',
            skipBrowserRedirect: true,
          },
        });

        if (oauthResult.error) {
          setResult(`❌ OAuth Error: ${oauthResult.error.message}\nDetails: ${JSON.stringify(oauthResult.error, null, 2)}`);
        } else if (oauthResult.data?.url) {
          setResult(`✅ OAuth URL Generated Successfully!\nURL: ${oauthResult.data.url.substring(0, 100)}...`);
        } else {
          setResult(`⚠️ OAuth returned no URL or error`);
        }
      } catch (oauthError: any) {
        setResult(`❌ OAuth Exception: ${oauthError.message}`);
      }

    } catch (error: any) {
      setResult(`❌ Test Failed: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OAuth Debug Test</Text>

      <TouchableOpacity
        style={[styles.button, testing && styles.buttonDisabled]}
        onPress={testSupabaseConnection}
        disabled={testing}
      >
        <Text style={styles.buttonText}>
          {testing ? 'Testing...' : 'Test OAuth Setup'}
        </Text>
      </TouchableOpacity>

      {result ? (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    margin: 20,
    borderRadius: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  button: {
    backgroundColor: '#4285f4',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resultContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resultText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
  },
});