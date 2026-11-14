export const FIXED_DWELL_MINUTES = 15;

export interface GymLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number; // e.g., 150m
  dwellMinutesRequired: number; // Fixed at 15 mins
}

export interface WorkoutSession {
  id: string;
  timestamp: string; // ISO format: e.g. 2026-11-14T08:30:00Z
  dateString: string; // YYYY-MM-DD
  durationMinutes: number;
  verifiedByGps: boolean;
  gymName: string;
  weekId: string; // e.g. "2026-W46"
}

export interface UserPreferences {
  weeklyGoal: number; // 1 to 7 workouts per week
  gymLocation: GymLocation | null;
  dwellDurationMinutes: number; // Fixed at 15 mins
  autoDetectGym: boolean;
}

export interface StreakState {
  currentStreak: number; // Total consecutive gym visits/workouts
  bestStreak: number;
  currentWeekWorkouts: number; // Completed in the current ISO week
  lastCompletedDate?: string; // YYYY-MM-DD to enforce max 1 per day
  lastEvaluatedWeekId?: string; // e.g. "2026-W46"
  streakStatus: 'active' | 'at_risk' | 'reset';
  statusMessage?: string;
}

export interface DwellSessionState {
  isDwelling: boolean;
  enteredAt?: string; // ISO string
  minutesDwelling: number;
  gymName?: string;
  completedToday: boolean;
}
