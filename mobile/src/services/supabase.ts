import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseBaseUrl } from '../utils/env';

// JD Car Rental - Mobile Supabase Client Configuration

// Derived, not read raw — eas.json's EXPO_PUBLIC_SUPABASE_URL currently includes a
// trailing /rest/v1 path (meant for direct REST calls, not for supabase-js's own
// client constructor, which needs the bare project URL). getSupabaseBaseUrl() strips
// that safely, so this works whether or not eas.json's value is ever corrected.
const supabaseUrl = getSupabaseBaseUrl() || undefined;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Safe Validation (Does not log full keys)
const validateEnv = () => {
  const issues: string[] = [];

  if (!supabaseUrl || supabaseUrl.includes("PASTE_")) {
    issues.push("EXPO_PUBLIC_SUPABASE_URL is missing or using a placeholder.");
  } else if (!supabaseUrl.startsWith("https://")) {
    issues.push("EXPO_PUBLIC_SUPABASE_URL must start with https://");
  }

  if (!supabaseAnonKey || supabaseAnonKey.includes("PASTE_")) {
    issues.push("EXPO_PUBLIC_SUPABASE_ANON_KEY is missing or using a placeholder.");
  } else {
    const isLegacyJWT = supabaseAnonKey.startsWith("eyJ");
    const isModernKey = supabaseAnonKey.startsWith("sb_publishable_");
    
    if (!isLegacyJWT && !isModernKey) {
      issues.push("EXPO_PUBLIC_SUPABASE_ANON_KEY format is invalid.");
    }

    if (supabaseAnonKey.startsWith("sb_secret_") || supabaseAnonKey.includes("service_role")) {
      issues.push("SECURITY ALERT: Secret/Service_role key detected. Use Anon/Publishable key.");
    }
  }

  if (issues.length > 0) {
    console.warn("⚠️ Mobile Supabase Config:\n" + issues.join("\n"));
    return false;
  }
  return true;
};

validateEnv();

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
