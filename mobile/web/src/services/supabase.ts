import { createClient } from '@supabase/supabase-js';

// JD Car Rental - Supabase Client Configuration
// Note: The system has transitioned to a local Express backend.
// This client is kept only for potential legacy lookups.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

// Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Simple Connection Check
 */
export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('vehicles').select('id').limit(1);
    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
