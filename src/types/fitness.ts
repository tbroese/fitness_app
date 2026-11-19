export const FIXED_DWELL_MINUTES = 15;
export const MAX_MANUAL_SESSION_MINUTES = 180;
export const DEFAULT_GEOFENCE_RADIUS_METERS = 150;
export const MIN_GEOFENCE_RADIUS_METERS = 50;

export type ThemeMode = 'dark' | 'light';
export type DistanceUnit = 'mi' | 'km';

export type AuthProviderType = 'google' | 'apple' | 'device';
export type WeightUnit = 'lbs' | 'kg';
export type UserGender = 'male' | 'female' | null;

export interface UserProfile {
  id: string; // Unique UUID for cloud sync & leaderboard
  fullName: string; // User's full name
  userTag: string; // 4-digit discriminator tag (e.g. "4821" -> "Tanner B #4821")
  email?: string | null; // Linked Google or Apple email to prevent duplicate accounts
  authProvider?: AuthProviderType; // 'google' | 'apple' | 'device'
  authUserId?: string | null; // OAuth / Supabase Auth subject ID
  gender?: UserGender; // Optional: 'male' | 'female' | null
  age?: number | null; // Optional age in years
  squatPrKg?: number;
  benchPrKg?: number;
  deadliftPrKg?: number;
  preferredWeightUnit?: WeightUnit;
  hasCompletedOnboarding: boolean; // False until first-time sign-in is completed
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  syncedAt?: string | null; // null until connected to cloud server
}

export interface GymLocation {
  id: string;
  name: string;
  address?: string;
  isVerified?: boolean;
  isManual?: boolean; // True for home/manual gyms where GPS tracking isn't used
  latitude: number;
  longitude: number;
  radiusMeters: number; // Default 150m (50..150m)
  dwellMinutesRequired: number; // Fixed at 15 mins
}

export interface WorkoutSession {
  id: string;
  userId?: string; // Links to UserProfile.id for cloud leaderboard
  timestamp: string; // ISO format: e.g. 2026-11-14T08:30:00Z
  dateString: string; // YYYY-MM-DD
  durationMinutes: number;
  verifiedByGps: boolean;
  isVerified?: boolean;
  gymName: string;
  weekId: string; // e.g. "2026-W46"
  updatedAt?: string; // ISO string for sync resolution
  synced?: boolean; // false while local-only
}

export interface UserPreferences {
  weeklyGoal: number; // default: 1
  pendingWeeklyGoal?: number | null; // Scheduled to take effect next Monday
  gymLocation: GymLocation | null;
  dwellDurationMinutes: number; // Fixed at 15 mins
  autoDetectGym: boolean;
  geofenceRadiusMeters?: number; // 50..150m (default 150m)
  themeMode?: ThemeMode; // 'dark' | 'light'
  distanceUnit?: DistanceUnit; // 'mi' | 'km'
  updatedAt?: string;
}

export interface StreakState {
  userId?: string;
  currentStreak: number; // Total consecutive gym visits/workouts (personal)
  bestStreak: number;
  verifiedStreak?: number; // Streak earned strictly at verified gyms
  bestVerifiedStreak?: number;
  currentWeekWorkouts: number; // Completed in the current ISO week
  lastCompletedDate?: string; // YYYY-MM-DD to enforce max 1 per day
  lastEvaluatedWeekId?: string; // e.g. "2026-W46"
  streakStatus: 'active' | 'at_risk' | 'reset';
  statusMessage?: string;
  updatedAt?: string;
  synced?: boolean;
}

export interface DwellSessionState {
  isDwelling: boolean;
  enteredAt?: string; // ISO string persisted to AsyncStorage
  minutesDwelling: number;
  gymName?: string;
  completedToday: boolean;
  dateString?: string; // YYYY-MM-DD of the dwell session
  isManualSession?: boolean; // True when started via manual check-in/check-out
}

export interface CloudSyncPayload {
  profile: UserProfile;
  streakState: StreakState;
  preferences: UserPreferences;
  unsyncedWorkouts: WorkoutSession[];
  exportedAt: string;
}
