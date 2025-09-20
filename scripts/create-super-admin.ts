import { supabase } from '../lib/supabase';

// Script to create a super admin user
async function createSuperAdmin() {
  const email = 'admin@farm2go.com'; // Change this to your email
  const password = 'superadmin123'; // Change this to a secure password

  try {
    console.log('🚀 Creating super admin user...');

    // First, create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('📧 User already exists, trying to get existing user...');

        // Try to sign in to get the user ID
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (signInError) {
          console.error('❌ Could not sign in existing user:', signInError);
          return;
        }

        if (signInData.user) {
          // Check if profile exists
          const { data: existingProfile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', signInData.user.id)
            .single();

          if (profileError || !existingProfile) {
            console.log('📝 Creating profile for existing user...');
            await createProfile(signInData.user.id, email);
          } else if (existingProfile.user_type !== 'super-admin') {
            console.log('🔄 Updating user type to super-admin...');
            await updateUserType(signInData.user.id);
          } else {
            console.log('✅ Super admin profile already exists and is correctly configured');
          }
        }
        return;
      } else {
        throw authError;
      }
    }

    if (authData.user) {
      console.log('✅ Auth user created:', authData.user.id);
      await createProfile(authData.user.id, email);
    }

  } catch (error) {
    console.error('❌ Error creating super admin:', error);
  }
}

async function createProfile(userId: string, email: string) {
  try {
    console.log('📝 Creating super admin profile...');

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        first_name: 'Super',
        last_name: 'Admin',
        user_type: 'super-admin',
        phone: null,
        barangay: 'San Sebastian', // Default barangay
        farm_name: null,
        company_name: null,
      });

    if (profileError) {
      console.error('❌ Profile creation error:', profileError);
      throw profileError;
    }

    console.log('✅ Super admin profile created successfully');
  } catch (error) {
    console.error('❌ Error creating profile:', error);
    throw error;
  }
}

async function updateUserType(userId: string) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ user_type: 'super-admin' })
      .eq('id', userId);

    if (error) {
      console.error('❌ Update user type error:', error);
      throw error;
    }

    console.log('✅ User type updated to super-admin');
  } catch (error) {
    console.error('❌ Error updating user type:', error);
    throw error;
  }
}

// Check if a super admin exists
async function checkSuperAdminExists() {
  try {
    const { data: superAdmins, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_type', 'super-admin');

    if (error) {
      console.error('❌ Error checking super admins:', error);
      return;
    }

    console.log('🔍 Found super admins:', superAdmins?.length || 0);
    if (superAdmins && superAdmins.length > 0) {
      superAdmins.forEach(admin => {
        console.log(`👑 Super Admin: ${admin.first_name} ${admin.last_name} (${admin.email})`);
      });
    } else {
      console.log('❌ No super admin found. Run createSuperAdmin() to create one.');
    }
  } catch (error) {
    console.error('❌ Error checking super admins:', error);
  }
}

// Export functions for use
export { createSuperAdmin, checkSuperAdminExists };

// If running directly, execute the functions
if (require.main === module) {
  checkSuperAdminExists().then(() => {
    console.log('\n🚀 To create a super admin, run: createSuperAdmin()');
  });
}