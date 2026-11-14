import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UserPreferences,
  WorkoutSession,
  StreakState,
  GymLocation,
  FIXED_DWELL_MINUTES,
  DEFAULT_GEOFENCE_RADIUS_METERS,
} from '../types/fitness';
import { getIsoWeekId } from '../utils/dateUtils';

const STORAGE_KEYS = {
  PREFERENCES: '@fitness_preferences_v1',
  WORKOUTS: '@fitness_workouts_v1',
  STREAK_STATE: '@fitness_streak_state_v1',
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  weeklyGoal: 1, // Default starts at 1 workout per week
  pendingWeeklyGoal: null,
  gymLocation: {
    id: 'default_gym',
    name: 'Metropolis Fitness Club',
    latitude: 37.7749, // default SF or customizable
    longitude: -122.4194,
    radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS, // 300m default
    dwellMinutesRequired: FIXED_DWELL_MINUTES,
  },
  dwellDurationMinutes: FIXED_DWELL_MINUTES,
  autoDetectGym: true,
};

export const DEFAULT_STREAK_STATE: StreakState = {
  currentStreak: 0,
  bestStreak: 0,
  currentWeekWorkouts: 0,
  streakStatus: 'active',
  lastEvaluatedWeekId: getIsoWeekId(new Date()),
};

export const storageService = {
  async getPreferences(): Promise<UserPreferences> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PREFERENCES);
      return data ? { ...DEFAULT_PREFERENCES, ...JSON.parse(data) } : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  },

  async savePreferences(preferences: UserPreferences): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
    } catch (e) {
      console.error('Failed to save preferences', e);
    }
  },

  async getWorkouts(): Promise<WorkoutSession[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async saveWorkouts(workouts: WorkoutSession[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));
    } catch (e) {
      console.error('Failed to save workouts', e);
    }
  },

  async getStreakState(): Promise<StreakState> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.STREAK_STATE);
      return data ? JSON.parse(data) : DEFAULT_STREAK_STATE;
    } catch {
      return DEFAULT_STREAK_STATE;
    }
  },

  async saveStreakState(state: StreakState): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STREAK_STATE, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save streak state', e);
    }
  },

  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.PREFERENCES,
        STORAGE_KEYS.WORKOUTS,
        STORAGE_KEYS.STREAK_STATE,
      ]);
    } catch (e) {
      console.error('Failed to clear data', e);
    }
  },
};
