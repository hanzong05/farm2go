// Quick test script to check if notifications are working
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lipviwhsjgvcmdggecqn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcHZpd2hzamd2Y21kZ2dlY3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4MDQ5NzEsImV4cCI6MjA1MzM4MDk3MX0.cDKnYuWIhGUV5fI2SDnfH8UVpGJhf3RQFyYOPR7z30I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testNotifications() {
  console.log('🧪 Testing notifications system...');

  try {
    // Test 1: Check table access
    console.log('1️⃣ Testing table access...');
    const { data: testData, error: testError } = await supabase
      .from('notifications')
      .select('count')
      .limit(1);

    if (testError) {
      console.error('❌ Table access failed:', testError.message);
      if (testError.message.includes('does not exist')) {
        console.log('💡 Please run the notifications table setup SQL script first');
        return;
      }
    } else {
      console.log('✅ Notifications table is accessible');
    }

    // Test 2: Get a test user ID
    console.log('2️⃣ Getting test user...');
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .limit(1);

    if (usersError || !users || users.length === 0) {
      console.error('❌ No users found for testing');
      return;
    }

    const testUser = users[0];
    console.log('✅ Using test user:', testUser.id, testUser.first_name);

    // Test 3: Try to create a simple notification
    console.log('3️⃣ Creating test notification...');
    const { data: newNotif, error: createError } = await supabase
      .from('notifications')
      .insert({
        recipient_id: testUser.id,
        type: 'system_message',
        title: 'Test Notification',
        message: 'This is a test notification to verify the system is working.',
        action_data: { test: true },
        created_at: new Date().toISOString(),
        is_read: false
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Failed to create notification:', createError.message);
      console.error('❌ Error code:', createError.code);
      console.error('❌ Error details:', createError.details);

      if (createError.code === '42501') {
        console.log('💡 RLS policy issue - run the RLS fix SQL script');
      } else if (createError.code === '23514') {
        console.log('💡 Type constraint issue - the notification type is not allowed');
      }
    } else {
      console.log('✅ Test notification created:', newNotif.id);

      // Clean up
      await supabase
        .from('notifications')
        .delete()
        .eq('id', newNotif.id);
      console.log('✅ Test notification cleaned up');
    }

    console.log('🎉 Notification system test complete!');

  } catch (error) {
    console.error('❌ Test failed with exception:', error);
  }
}

testNotifications();