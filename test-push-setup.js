const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPushSetup() {
  console.log('🔍 Testing push notification setup...');

  try {
    // Check if expo_push_tokens table exists
    console.log('📋 Checking if expo_push_tokens table exists...');

    const { data, error } = await supabase
      .from('expo_push_tokens')
      .select('id')
      .limit(1);

    if (error) {
      console.log('❌ Table does not exist or has no access. Error:', error.message);
      console.log('📝 You need to run the SQL script to create the table:');
      console.log('   1. Go to your Supabase dashboard');
      console.log('   2. Navigate to SQL Editor');
      console.log('   3. Run the contents of create-expo-push-tokens-table.sql');
      return false;
    }

    console.log('✅ expo_push_tokens table exists and is accessible');

    // Test Expo project ID
    const projectId = process.env.EXPO_PROJECT_ID;
    if (!projectId || projectId === 'your-expo-project-id-here') {
      console.log('⚠️ Expo Project ID not configured properly');
      console.log('   Current value:', projectId);
      console.log('   Run: npx expo whoami to check your account');
      return false;
    }

    console.log('✅ Expo Project ID configured:', projectId);

    // Test VAPID key
    const vapidKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey || vapidKey === 'your-vapid-public-key-here') {
      console.log('⚠️ VAPID public key not configured for web push');
      console.log('   Generate with: npx web-push generate-vapid-keys');
      return false;
    }

    console.log('✅ VAPID public key configured');

    console.log('\n🎉 Push notification setup is ready!');
    console.log('\n📱 To test:');
    console.log('   1. Start your app: npx expo start');
    console.log('   2. Login to your app');
    console.log('   3. Click the "Test Push" button in the header');
    console.log('\n⚠️ Note: Push notifications only work on:');
    console.log('   - Physical devices (not simulators)');
    console.log('   - Development builds or production apps (not Expo Go)');

    return true;

  } catch (error) {
    console.error('❌ Setup test failed:', error);
    return false;
  }
}

testPushSetup();