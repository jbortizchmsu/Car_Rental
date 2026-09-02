/**
 * JD Car Rental - Sample Account Creator (Development Only)
 * 
 * This script uses the Supabase Service Role key to create test accounts
 * without requiring email confirmation.
 * 
 * Usage: 
 * 1. Create a .env file in /scripts with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * 2. Run: node --env-file=scripts/.env scripts/create-sample-accounts.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const sampleAccounts = [
  {
    email: 'admin@jdcarrental.com',
    password: 'Admin123!',
    fullName: 'Sample Admin',
    role: 'admin'
  },
  {
    email: 'customer@jdcarrental.com',
    password: 'Customer123!',
    fullName: 'Sample Customer',
    role: 'customer'
  }
];

async function seed() {
  console.log('🚀 Starting sample account creation...');

  for (const account of sampleAccounts) {
    try {
      console.log(`\nChecking for ${account.email}...`);

      // 1. Create Auth User
      // Note: This uses auth.admin to bypass email confirmation
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { full_name: account.fullName }
      });

      let userId;

      if (userError) {
        if (userError.message.includes('already registered')) {
          console.log(`ℹ️ Auth user already exists. Finding ID...`);
          // Fetch existing user ID
          const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
          if (listError) throw listError;
          const existingUser = users.find(u => u.email === account.email);
          if (!existingUser) throw new Error('User not found despite "already registered" error.');
          userId = existingUser.id;
        } else {
          throw userError;
        }
      } else {
        console.log(`✅ Auth user created: ${userData.user.email}`);
        userId = userData.user.id;
      }

      // 2. Upsert Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          full_name: account.fullName,
          role: account.role
        }, { onConflict: 'id' });

      if (profileError) throw profileError;
      console.log(`✅ Profile updated: ${account.fullName} (${account.role})`);

    } catch (err) {
      console.error(`❌ Error with ${account.email}:`, err.message);
    }
  }

  console.log('\n✨ Finished account seeding.');
}

seed();
