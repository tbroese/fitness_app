/**
 * Debug & feature flags
 * Flip `ENABLE_DEBUG_SIMULATOR` to `true` to show the in-app "Simulator" button on the dashboard.
 */
export const ENABLE_DEBUG_SIMULATOR = false;

/**
 * Cloud Database Configuration (Supabase Free Tier by default)
 * Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in `.env.local`
 * or in your EAS environment variables.
 */
export const SUPABASE_CONFIG = {
  url: (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, ''),
  anonKey: (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
};
