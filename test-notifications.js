// Test script to demonstrate notification functionality
// Run this after setting up the notifications table

const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration
const supabaseUrl = 'https://lipviwhsjgvcmdggecqn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcHZpd2hzamd2Y21kZ2dlY3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4MDQ5NzEsImV4cCI6MjA1MzM4MDk3MX0.YSE7n2P2dTaIx5LGnQz5VJCudUfABIpwF3nVnJJEzrs';

const supabase = createClient(supabaseUrl, supabaseKey);

// Test notification functions
async function testNotifications() {
  console.log('🧪 Testing notification system...');

  try {
    // Test 1: Create a test notification
    console.log('\n1. Testing notification creation...');

    // Get a test user (farmer)
    const { data: farmers, error: farmersError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('user_type', 'farmer')
      .limit(1);

    if (farmersError || !farmers || farmers.length === 0) {
      console.log('❌ No farmers found for testing');
      return;
    }

    const testFarmer = farmers[0];
    console.log(`✅ Found test farmer: ${testFarmer.first_name} ${testFarmer.last_name}`);

    // Create a test notification
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .insert({
        recipient_id: testFarmer.id,
        type: 'product_created',
        title: '🧪 Test Notification',
        message: 'This is a test notification to verify the system is working!',
        action_url: '/farmer/my-products',
        action_data: { test: true, timestamp: new Date().toISOString() }
      })
      .select()
      .single();

    if (notifError) {
      console.error('❌ Error creating test notification:', notifError);
      return;
    }

    console.log('✅ Test notification created:', notification.id);

    // Test 2: Retrieve notifications
    console.log('\n2. Testing notification retrieval...');
    const { data: notifications, error: retrieveError } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', testFarmer.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (retrieveError) {
      console.error('❌ Error retrieving notifications:', retrieveError);
      return;
    }

    console.log(`✅ Retrieved ${notifications.length} notifications for farmer`);
    notifications.forEach(notif => {
      console.log(`   - ${notif.title}: ${notif.message.substring(0, 50)}...`);
    });

    // Test 3: Mark as read
    console.log('\n3. Testing mark as read...');
    const { error: readError } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notification.id);

    if (readError) {
      console.error('❌ Error marking notification as read:', readError);
      return;
    }

    console.log('✅ Notification marked as read successfully');

    // Test 4: Count unread notifications
    console.log('\n4. Testing unread count...');
    const { count, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', testFarmer.id)
      .eq('is_read', false);

    if (countError) {
      console.error('❌ Error counting unread notifications:', countError);
      return;
    }

    console.log(`✅ Farmer has ${count} unread notifications`);

    console.log('\n🎉 All notification tests passed! The system is ready to use.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
testNotifications();