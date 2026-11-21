/**
 * Debug & feature flags
 * Flip `ENABLE_DEBUG_SIMULATOR` to `true` to show the in-app "Simulator" button on the dashboard.
 */
export const ENABLE_DEBUG_SIMULATOR = false;

/**
 * Public Privacy Policy URL (hosted via GitHub Pages `/docs` on `main`).
 */
export const PRIVACY_POLICY_URL =
  'https://tbroese.github.io/fitness_app/privacy-policy.html';

export const WEBSITE_URL = 'https://inertialeaderboard.com';

/**
 * Google OAuth Web Client ID (from Google Cloud Console -> Credentials -> Web application)
 * Used by native @react-native-google-signin/google-signin to obtain an ID token for Supabase.
 */
export const GOOGLE_WEB_CLIENT_ID = (
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || ''
).trim();

/**
 * Cloud Database Configuration (Supabase Free Tier by default)
 * Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in `.env.local`
 * or in your EAS environment variables.
 */
export const SUPABASE_CONFIG = {
  url: (
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    'https://nzoarfnrnbnwfduftcvv.supabase.co'
  )
    .trim()
    .replace(/\/$/, ''),
  anonKey: (
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_P4bLx6fKUOL9G7Gdffj_SQ_rHsiqWWx'
  ).trim(),
};
