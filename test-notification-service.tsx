// Test component to debug notification creation
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { createNotification, notifyProductCreated } from '../services/notifications';

export default function NotificationTestScreen() {

  const testDirectNotification = async () => {
    console.log('🧪 Testing direct notification creation...');

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      console.log('👤 Current user:', user.id);

      // Try to create a notification directly
      const testNotification = {
        recipient_id: user.id,
        sender_id: user.id,
        type: 'system_message',
        title: '🧪 Direct Test Notification',
        message: 'This is a direct test to see if notifications are being saved.',
        action_url: null,
        action_data: { test: true, timestamp: new Date().toISOString() },
        is_read: false,
        created_at: new Date().toISOString()
      };

      console.log('📝 Inserting notification:', testNotification);

      const { data: result, error: insertError } = await supabase
        .from('notifications')
        .insert(testNotification)
        .select();

      if (insertError) {
        console.error('❌ Insert error:', insertError);
        Alert.alert('Insert Error', JSON.stringify(insertError, null, 2));
        return;
      }

      console.log('✅ Notification inserted:', result);
      Alert.alert('Success!', `Direct notification created: ${result[0]?.id}`);

      // Try to read it back
      const { data: readBack, error: readError } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (readError) {
        console.error('❌ Read error:', readError);
      } else {
        console.log('📖 Read back notifications:', readBack);
        Alert.alert('Read Test', `Found ${readBack.length} notifications`);
      }

    } catch (error) {
      console.error('❌ Test failed:', error);
      Alert.alert('Test Failed', error.message);
    }
  };

  const testNotificationService = async () => {
    console.log('🧪 Testing notification service...');

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      console.log('👤 Using service for user:', user.id);

      // Test the createNotification service function
      const result = await createNotification({
        recipientId: user.id,
        type: 'system_message',
        title: '🧪 Service Test Notification',
        message: 'This is a test using the notification service.',
        senderId: user.id,
        actionData: { serviceTest: true }
      });

      console.log('✅ Service result:', result);
      Alert.alert('Service Success!', `Service notification created: ${result.id}`);

    } catch (error) {
      console.error('❌ Service test failed:', error);
      Alert.alert('Service Failed', error.message);
    }
  };

  const testProductNotification = async () => {
    console.log('🧪 Testing product notification...');

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      // Test the notifyProductCreated function
      await notifyProductCreated(
        'test-product-id',
        'Test Product',
        user.id,
        [user.id] // Admin IDs
      );

      Alert.alert('Product Notification Sent!', 'Check the console for details');

    } catch (error) {
      console.error('❌ Product notification test failed:', error);
      Alert.alert('Product Test Failed', error.message);
    }
  };

  const checkTableExists = async () => {
    console.log('🧪 Checking if notifications table exists...');

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('count(*)')
        .limit(1);

      if (error) {
        console.error('❌ Table check error:', error);
        Alert.alert('Table Error', JSON.stringify(error, null, 2));
      } else {
        console.log('✅ Table exists, data:', data);
        Alert.alert('Table Check', 'Notifications table exists and is accessible');
      }

    } catch (error) {
      console.error('❌ Table check failed:', error);
      Alert.alert('Table Check Failed', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notification Debug Panel</Text>

      <TouchableOpacity style={styles.button} onPress={checkTableExists}>
        <Text style={styles.buttonText}>Check Table Exists</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testDirectNotification}>
        <Text style={styles.buttonText}>Test Direct Insert</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testNotificationService}>
        <Text style={styles.buttonText}>Test Service Function</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testProductNotification}>
        <Text style={styles.buttonText}>Test Product Notification</Text>
      </TouchableOpacity>

      <Text style={styles.instructions}>
        Check the React Native debugger console for detailed logs.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  button: {
    backgroundColor: '#059669',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  instructions: {
    marginTop: 20,
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
});