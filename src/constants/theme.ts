export type ThemeMode = 'dark' | 'light';

export const darkTheme = {
  background: '#0F0F0F', // YouTube-style neutral dark background
  cardBackground: '#1A1A1A', // Elevated dark surface
  cardBorder: '#2C2C2C', // Clean neutral border
  cardBackgroundSubtle: '#222226',

  textPrimary: '#F1F1F1', // Crisp off-white text
  textSecondary: '#A1A1AA', // Neutral muted text
  textTertiary: '#71717A', // Low emphasis text

  primary: '#3B82F6', // Familiar interactive blue (buttons, active tabs, pills)
  onPrimary: '#FFFFFF', // Crisp white text/icons on blue primary surfaces
  primaryLight: '#60A5FA', // Bright blue for icons & accents on dark cards
  primaryMuted: 'rgba(59, 130, 246, 0.18)',
  primaryBorder: 'rgba(59, 130, 246, 0.35)',

  brandRed: '#CC0022', // Surgical Inertia red (progress bars)
  flame: '#E11D48', // Inertia red streak flame
  flameLight: '#FB7185',
  flameMuted: 'rgba(225, 29, 72, 0.15)',

  success: '#10B981', // Clean green for completed
  successLight: '#34D399',
  successMuted: 'rgba(16, 185, 129, 0.16)',

  warning: '#F59E0B', // Amber for at risk
  warningMuted: 'rgba(245, 158, 11, 0.16)',

  danger: '#EF4444', // Red for streak lost
  dangerMuted: 'rgba(239, 68, 68, 0.16)',

  tabBarBackground: '#141414',
  tabBarBorder: '#2C2C2C',
  tabBarActive: '#3B82F6',
  tabBarInactive: '#71717A',

  inputBackground: '#121212',
  inputBorder: '#333338',
  pillBackground: '#222226',
  pillActive: '#3B82F6',
};

export const lightTheme: AppTheme = {
  background: '#F3F4F6',
  cardBackground: '#FFFFFF',
  cardBorder: '#E5E7EB',
  cardBackgroundSubtle: '#F9FAFB',

  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#6B7280',

  primary: '#2563EB',
  onPrimary: '#FFFFFF',
  primaryLight: '#2563EB',
  primaryMuted: 'rgba(37, 99, 235, 0.10)',
  primaryBorder: 'rgba(37, 99, 235, 0.28)',

  brandRed: '#CC0022',
  flame: '#E11D48',
  flameLight: '#E11D48',
  flameMuted: 'rgba(225, 29, 72, 0.10)',

  success: '#059669',
  successLight: '#10B981',
  successMuted: 'rgba(5, 150, 105, 0.12)',

  warning: '#D97706',
  warningMuted: 'rgba(217, 119, 6, 0.12)',

  danger: '#DC2626',
  dangerMuted: 'rgba(220, 38, 38, 0.10)',

  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  tabBarActive: '#2563EB',
  tabBarInactive: '#6B7280',

  inputBackground: '#F9FAFB',
  inputBorder: '#D1D5DB',
  pillBackground: '#F3F4F6',
  pillActive: '#2563EB',
};

export type AppTheme = typeof darkTheme;

export function getTheme(mode: ThemeMode = 'dark'): AppTheme {
  return mode === 'light' ? lightTheme : darkTheme;
}

// Default export reference for static/non-hook callers
export const theme = darkTheme;
