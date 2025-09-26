import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { createNotification } from '../services/notifications';

export default function TestNotificationsScreen() {

  const checkDatabaseConnection = async () => {
    console.log('🔍 Checking database connection...');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('count(*)')
        .limit(1);

      if (error) {
        console.error('❌ Database connection error:', error);
        Alert.alert('Connection Error', JSON.stringify(error, null, 2));
      } else {
        console.log('✅ Database connected successfully');
        Alert.alert('Success', 'Database connection is working');
      }
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      Alert.alert('Connection Failed', JSON.stringify(error, null, 2));
    }
  };

  const checkNotificationsTable = async () => {
    console.log('🔍 Checking notifications table...');

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .limit(1);

      if (error) {
        console.error('❌ Notifications table error:', error);
        Alert.alert('Table Error', `Error: ${error.message}\nHint: ${error.hint || 'None'}\nDetails: ${error.details || 'None'}`);
      } else {
        console.log('✅ Notifications table accessible');
        Alert.alert('Success', `Notifications table exists and returned ${data.length} rows`);
      }
    } catch (error) {
      console.error('❌ Table check failed:', error);
      Alert.alert('Table Check Failed', JSON.stringify(error, null, 2));
    }
  };

  const testDirectInsert = async () => {
    console.log('🧪 Testing direct insert...');

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      console.log('👤 Current user:', user.id);

      const testData = {
        recipient_id: user.id,
        sender_id: null,
        type: 'system_message',
        title: '🧪 Direct Test Notification',
        message: 'This is a direct test notification to verify database insertion.',
        action_url: null,
        action_data: { test: true, timestamp: new Date().toISOString() },
        is_read: false,
        created_at: new Date().toISOString()
      };

      console.log('📝 Inserting test data:', testData);

      const { data: result, error: insertError } = await supabase
        .from('notifications')
        .insert(testData)
        .select()
        .single();

      if (insertError) {
        console.error('❌ Insert failed:', insertError);
        Alert.alert('Insert Failed', `Error: ${insertError.message}\nCode: ${insertError.code}\nDetails: ${insertError.details}`);
      } else {
        console.log('✅ Insert successful:', result);
        Alert.alert('Success!', `Notification created with ID: ${result.id}`);
      }

    } catch (error) {
      console.error('❌ Direct insert test failed:', error);
      Alert.alert('Test Failed', JSON.stringify(error, null, 2));
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

      console.log('🔧 Using notification service...');

      const result = await createNotification({
        recipientId: user.id,
        type: 'system_message',
        title: '🧪 Service Test Notification',
        message: 'This test uses the notification service function.',
        actionData: { serviceTest: true, timestamp: new Date().toISOString() }
      });

      console.log('✅ Service test successful:', result);
      Alert.alert('Service Success!', `Notification created with ID: ${result.id}`);

    } catch (error) {
      console.error('❌ Service test failed:', error);
      Alert.alert('Service Failed', `Error: ${error.message || 'Unknown error'}`);
    }
  };

  const readNotifications = async () => {
    console.log('📖 Reading notifications...');

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('❌ Read failed:', error);
        Alert.alert('Read Failed', JSON.stringify(error, null, 2));
      } else {
        console.log('✅ Read successful:', notifications);
        Alert.alert('Read Success', `Found ${notifications.length} notifications`);

        // Log each notification
        notifications.forEach((notif, index) => {
          console.log(`${index + 1}. ${notif.title}: ${notif.message}`);
        });
      }

    } catch (error) {
      console.error('❌ Read test failed:', error);
      Alert.alert('Read Failed', JSON.stringify(error, null, 2));
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🧪 Notification Debug Panel</Text>
        <Text style={styles.subtitle}>Test each step to find the issue</Text>

        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={checkDatabaseConnection}>
          <Text style={styles.buttonText}>1. Test Database Connection</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={checkNotificationsTable}>
          <Text style={styles.buttonText}>2. Check Notifications Table</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={testDirectInsert}>
          <Text style={styles.buttonText}>3. Test Direct Insert</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.successButton]} onPress={testNotificationService}>
          <Text style={styles.buttonText}>4. Test Notification Service</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.infoButton]} onPress={readNotifications}>
          <Text style={styles.buttonText}>5. Read Notifications</Text>
        </TouchableOpacity>

        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Instructions:</Text>
          <Text style={styles.instructionsText}>
            1. First run the SQL file in your Supabase dashboard{'\n'}
            2. Test each step in order{'\n'}
            3. Check console logs for detailed error messages{'\n'}
            4. If step 2 fails, the table doesn't exist{'\n'}
            5. If step 3 fails, there's a permission issue{'\n'}
            6. If step 4 fails, there's a service function issue
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 20,
    paddingTop: 60, // Account for status bar
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#6b7280',
  },
  button: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  secondaryButton: {
    backgroundColor: '#6366f1',
  },
  warningButton: {
    backgroundColor: '#f59e0b',
  },
  successButton: {
    backgroundColor: '#10b981',
  },
  infoButton: {
    backgroundColor: '#06b6d4',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  instructions: {
    marginTop: 30,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1f2937',
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
  },
});