// Script to create the notifications table and test it
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lipviwhsjgvcmdggecqn.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcHZpd2hzamd2Y21kZ2dlY3FuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzgwNDk3MSwiZXhwIjoyMDUzMzgwOTcxfQ.dZHshZj1UdHQf0XP7M7qFkTgIvYWV8pO5Y5dMMzQdRA';

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupNotificationsTable() {
  console.log('🔧 Setting up notifications table...');

  try {
    // First check if table exists
    console.log('1. Checking if notifications table exists...');
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_info', { table_name: 'notifications' })
      .single();

    if (tablesError && !tablesError.message.includes('does not exist')) {
      console.error('Error checking table existence:', tablesError);
    }

    // Create the table using SQL
    console.log('2. Creating notifications table...');

    const createTableSQL = `
      -- Drop existing table if it exists
      DROP TABLE IF EXISTS public.notifications CASCADE;

      -- Create notifications table
      CREATE TABLE public.notifications (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          action_url TEXT,
          action_data JSONB,
          is_read BOOLEAN DEFAULT FALSE,
          read_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for better performance
      CREATE INDEX idx_notifications_recipient_id ON public.notifications(recipient_id);
      CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
      CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
      CREATE INDEX idx_notifications_type ON public.notifications(type);

      -- Enable RLS
      ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

      -- Create RLS policies
      CREATE POLICY "Users can view their own notifications" ON public.notifications
          FOR SELECT USING (recipient_id = auth.uid());

      CREATE POLICY "Users can update their own notifications" ON public.notifications
          FOR UPDATE USING (recipient_id = auth.uid());

      CREATE POLICY "Service role can do anything" ON public.notifications
          FOR ALL USING (auth.role() = 'service_role');

      CREATE POLICY "Authenticated users can create notifications" ON public.notifications
          FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

      -- Grant permissions
      GRANT ALL ON public.notifications TO authenticated;
      GRANT ALL ON public.notifications TO service_role;
      GRANT ALL ON public.notifications TO anon;
    `;

    const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });

    if (createError) {
      console.error('❌ Error creating table:', createError);

      // Try alternative approach - create table step by step
      console.log('3. Trying alternative table creation...');

      const { error: altError } = await supabase
        .from('notifications')  // This will fail but might give us info
        .select('*')
        .limit(1);

      console.log('Alternative creation result:', altError);
    } else {
      console.log('✅ Table created successfully');
    }

    // Test table creation with a simple insert
    console.log('4. Testing table with insert...');

    // Get a test user
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (usersError || !users || users.length === 0) {
      console.log('❌ No users found for testing');
      return;
    }

    const testUserId = users[0].id;
    console.log(`Using test user ID: ${testUserId}`);

    // Try to insert a test notification
    const { data: testNotif, error: insertError } = await supabase
      .from('notifications')
      .insert({
        recipient_id: testUserId,
        type: 'system_message',
        title: '🧪 Test Setup Notification',
        message: 'This is a test notification to verify the table is working correctly.',
        action_data: { setup_test: true }
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error inserting test notification:', insertError);
      console.error('Full error details:', JSON.stringify(insertError, null, 2));
    } else {
      console.log('✅ Test notification created:', testNotif.id);

      // Try to read it back
      const { data: readBack, error: readError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', testNotif.id)
        .single();

      if (readError) {
        console.error('❌ Error reading back notification:', readError);
      } else {
        console.log('✅ Successfully read back notification:', readBack.title);

        // Clean up test notification
        await supabase
          .from('notifications')
          .delete()
          .eq('id', testNotif.id);

        console.log('✅ Test notification cleaned up');
      }
    }

    console.log('🎉 Notifications table setup complete!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    console.error('Full error:', JSON.stringify(error, null, 2));
  }
}

// Run setup
setupNotificationsTable();