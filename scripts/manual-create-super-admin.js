// Manual script to create super admin - run this in browser console
// or in your Supabase SQL editor

// For browser console (run on your Farm2Go app page):
async function createSuperAdminProfile() {
  // You'll need to replace these with your actual values
  const email = 'admin@farm2go.com';
  const authUserId = 'your-auth-user-id-here'; // Get this from auth.users table

  try {
    // First check if auth user exists
    const { data: authUser } = await supabase.auth.getUser();
    console.log('Current auth user:', authUser);

    // Create profile directly
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: authUserId, // Use the actual auth user ID
        email: email,
        first_name: 'Super',
        last_name: 'Admin',
        user_type: 'super-admin',
        phone: null,
        barangay: 'San Sebastian',
        farm_name: null,
        company_name: null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating super admin profile:', error);
    } else {
      console.log('Super admin profile created:', data);
    }
  } catch (error) {
    console.error('Script error:', error);
  }
}

// For Supabase SQL Editor - run this SQL:
/*
-- Step 1: Check if auth user exists
SELECT * FROM auth.users WHERE email = 'admin@farm2go.com';

-- Step 2: If user exists, get the ID and create profile
-- Replace 'your-auth-user-id-here' with the actual ID from step 1
INSERT INTO profiles (id, email, first_name, last_name, user_type, phone, barangay, farm_name, company_name)
VALUES (
  'your-auth-user-id-here',
  'admin@farm2go.com',
  'Super',
  'Admin',
  'super-admin',
  null,
  'San Sebastian',
  null,
  null
);

-- Step 3: Verify the profile was created
SELECT * FROM profiles WHERE email = 'admin@farm2go.com';

-- Step 4: Check all super admins
SELECT * FROM profiles WHERE user_type = 'super-admin';
*/

console.log('Super admin creation script loaded. Run createSuperAdminProfile() to execute.');