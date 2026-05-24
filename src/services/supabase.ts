import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// JD Car Rental - Mobile Supabase Client Configuration

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Safe Validation (Does not log full keys)
const validateEnv = () => {
  const issues: string[] = [];

  if (!supabaseUrl || supabaseUrl.includes("PASTE_")) {
    issues.push("EXPO_PUBLIC_SUPABASE_URL is missing or using a placeholder.");
  } else if (!supabaseUrl.startsWith("https://")) {
    issues.push("EXPO_PUBLIC_SUPABASE_URL must start with https://");
  } else if (supabaseUrl.includes("/rest/v1") || supabaseUrl.includes("/auth/v1")) {
    issues.push("EXPO_PUBLIC_SUPABASE_URL should NOT include /rest/v1 or /auth/v1.");
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
