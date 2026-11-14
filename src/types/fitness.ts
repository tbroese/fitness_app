export const FIXED_DWELL_MINUTES = 15;
export const DEFAULT_GEOFENCE_RADIUS_METERS = 300;

export interface UserProfile {
  id: string; // Unique UUID for future cloud sync & leaderboard
  fullName: string; // User's full name
  hasCompletedOnboarding: boolean; // False until first-time name prompt is saved
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  syncedAt?: string | null; // null until connected to cloud server
}

export interface GymLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number; // Fixed at 300m
  dwellMinutesRequired: number; // Fixed at 15 mins
}

export interface WorkoutSession {
  id: string;
  userId?: string; // Links to UserProfile.id for cloud leaderboard
  timestamp: string; // ISO format: e.g. 2026-11-14T08:30:00Z
  dateString: string; // YYYY-MM-DD
  durationMinutes: number;
  verifiedByGps: boolean;
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
  updatedAt?: string;
}

export interface StreakState {
  userId?: string;
  currentStreak: number; // Total consecutive gym visits/workouts
  bestStreak: number;
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
}

export interface CloudSyncPayload {
  profile: UserProfile;
  streakState: StreakState;
  preferences: UserPreferences;
  unsyncedWorkouts: WorkoutSession[];
  exportedAt: string;
}
