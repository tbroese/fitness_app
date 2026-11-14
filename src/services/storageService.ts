import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UserProfile,
  UserPreferences,
  WorkoutSession,
  StreakState,
  DwellSessionState,
  CloudSyncPayload,
  FIXED_DWELL_MINUTES,
  DEFAULT_GEOFENCE_RADIUS_METERS,
} from '../types/fitness';
import { formatDateToYYYYMMDD, getIsoWeekId } from '../utils/dateUtils';
import { recordCompletedWorkout } from './streakManager';

const STORAGE_KEYS = {
  USER_PROFILE: '@fitness_user_profile_v1',
  PREFERENCES: '@fitness_preferences_v1',
  WORKOUTS: '@fitness_workouts_v1',
  STREAK_STATE: '@fitness_streak_state_v1',
  DWELL_SESSION: '@fitness_dwell_session_v1',
};

function generateOfflineUserId(): string {
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const timePart = Date.now().toString(36);
  return `usr_${timePart}_${randomSuffix}`;
}

export function createDefaultUserProfile(): UserProfile {
  const now = new Date().toISOString();
  return {
    id: generateOfflineUserId(),
    fullName: '',
    hasCompletedOnboarding: false,
    createdAt: now,
    updatedAt: now,
    syncedAt: null,
  };
}

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
  synced: false,
};

export const DEFAULT_DWELL_SESSION: DwellSessionState = {
  isDwelling: false,
  enteredAt: undefined,
  minutesDwelling: 0,
  completedToday: false,
  dateString: formatDateToYYYYMMDD(new Date()),
};

export const storageService = {
  async getUserProfile(): Promise<UserProfile> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          id: parsed.id || generateOfflineUserId(),
          fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
          hasCompletedOnboarding: Boolean(parsed.hasCompletedOnboarding && parsed.fullName),
          createdAt: parsed.createdAt || new Date().toISOString(),
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          syncedAt: parsed.syncedAt ?? null,
        };
      }
      const newProfile = createDefaultUserProfile();
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(newProfile));
      return newProfile;
    } catch {
      return createDefaultUserProfile();
    }
  },

  async saveUserProfile(profile: UserProfile): Promise<UserProfile> {
    const updated: UserProfile = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save user profile', e);
    }
    return updated;
  },

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
      const withTimestamp: UserPreferences = {
        ...preferences,
        updatedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(withTimestamp));
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

  async getDwellSession(): Promise<DwellSessionState> {
    const today = formatDateToYYYYMMDD(new Date());
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.DWELL_SESSION);
      if (!data) {
        return { ...DEFAULT_DWELL_SESSION, dateString: today };
      }
      const parsed: DwellSessionState = JSON.parse(data);
      // If stored session is from an older day, reset completedToday flag
      if (parsed.dateString && parsed.dateString !== today) {
        const resetForToday: DwellSessionState = {
          isDwelling: parsed.isDwelling,
          enteredAt: parsed.isDwelling ? new Date().toISOString() : undefined,
          minutesDwelling: 0,
          gymName: parsed.gymName,
          completedToday: false,
          dateString: today,
        };
        await AsyncStorage.setItem(STORAGE_KEYS.DWELL_SESSION, JSON.stringify(resetForToday));
        return resetForToday;
      }
      return parsed;
    } catch {
      return { ...DEFAULT_DWELL_SESSION, dateString: today };
    }
  },

  async saveDwellSession(session: DwellSessionState): Promise<void> {
    try {
      const withDate: DwellSessionState = {
        ...session,
        dateString: session.dateString || formatDateToYYYYMMDD(new Date()),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.DWELL_SESSION, JSON.stringify(withDate));
    } catch (e) {
      console.error('Failed to save dwell session', e);
    }
  },

  /**
   * Called by foreground GPS or background TaskManager when entering the gym geofence.
   * Persists entry timestamp in AsyncStorage so dwell time survives app restarts/backgrounding.
   */
  async handleBackgroundGeofenceEnter(gymName?: string): Promise<DwellSessionState> {
    const today = formatDateToYYYYMMDD(new Date());
    const [existingSession, workouts, prefs] = await Promise.all([
      this.getDwellSession(),
      this.getWorkouts(),
      this.getPreferences(),
    ]);

    const todayWorkout = workouts.find((w) => w.dateString === today);
    const completedToday = Boolean(todayWorkout);
    const resolvedGymName = gymName || prefs.gymLocation?.name || 'Local Gym';

    if (existingSession.isDwelling && existingSession.enteredAt) {
      // Already dwelling — keep original enteredAt timestamp!
      const updated: DwellSessionState = {
        ...existingSession,
        completedToday,
        gymName: existingSession.gymName || resolvedGymName,
        dateString: today,
      };
      await this.saveDwellSession(updated);
      return updated;
    }

    // If re-entering the gym later on the same day after already completing a workout,
    // backdate enteredAt by prior duration so cumulative gym time for today continues seamlessly!
    const priorMinutesToday = todayWorkout ? todayWorkout.durationMinutes : 0;
    const effectiveEnteredAt = new Date(Date.now() - priorMinutesToday * 60 * 1000).toISOString();

    const newSession: DwellSessionState = {
      isDwelling: true,
      enteredAt: effectiveEnteredAt,
      minutesDwelling: priorMinutesToday,
      gymName: resolvedGymName,
      completedToday,
      dateString: today,
    };
    await this.saveDwellSession(newSession);
    return newSession;
  },

  /**
   * Evaluates persisted dwell session:
   * - Automatically logs workout once 15 minutes have elapsed.
   * - Continues tracking gym time past 15 minutes for as long as the user stays at the gym!
   */
  async evaluatePersistedDwellSession(): Promise<{
    dwellSession: DwellSessionState;
    streakState: StreakState;
    workouts: WorkoutSession[];
    completedNow: boolean;
  }> {
    const today = formatDateToYYYYMMDD(new Date());
    const [session, prefs, workouts, streak, profile] = await Promise.all([
      this.getDwellSession(),
      this.getPreferences(),
      this.getWorkouts(),
      this.getStreakState(),
      this.getUserProfile(),
    ]);

    const alreadyDoneToday = workouts.some((w) => w.dateString === today);

    // If not currently inside the gym perimeter
    if (!session.isDwelling || !session.enteredAt) {
      if (alreadyDoneToday && !session.completedToday) {
        const todayWorkout = workouts.find((w) => w.dateString === today);
        const syncedSession: DwellSessionState = {
          ...session,
          completedToday: true,
          minutesDwelling: todayWorkout?.durationMinutes || session.minutesDwelling,
          dateString: today,
        };
        await this.saveDwellSession(syncedSession);
        return {
          dwellSession: syncedSession,
          streakState: streak,
          workouts,
          completedNow: false,
        };
      }
      return {
        dwellSession: session,
        streakState: streak,
        workouts,
        completedNow: false,
      };
    }

    // User is actively dwelling inside the gym perimeter — compute elapsed time
    const elapsedMs = Date.now() - new Date(session.enteredAt).getTime();
    const elapsedMins = Math.max(0, Math.floor(elapsedMs / (1000 * 60)));

    // Case 1: Reached 15-minute threshold for the first time today -> Log workout & KEEP dwelling active!
    if (elapsedMins >= FIXED_DWELL_MINUTES && !alreadyDoneToday) {
      const gymName = session.gymName || prefs.gymLocation?.name || 'Local Gym';
      const result = recordCompletedWorkout(
        streak,
        prefs,
        workouts,
        gymName,
        new Date(),
        elapsedMins,
        profile.id
      );

      // Keep isDwelling: true and enteredAt intact so timer continues past 15 mins!
      const ongoingCompletedSession: DwellSessionState = {
        ...session,
        isDwelling: true,
        minutesDwelling: elapsedMins,
        completedToday: true,
        dateString: today,
      };

      await Promise.all([
        this.saveDwellSession(ongoingCompletedSession),
        this.saveStreakState(result.updatedState),
        this.saveWorkouts(result.updatedWorkouts),
      ]);

      return {
        dwellSession: ongoingCompletedSession,
        streakState: result.updatedState,
        workouts: result.updatedWorkouts,
        completedNow: result.success,
      };
    }

    // Case 2: Already completed today's 15-min check-in, and STILL at the gym (> 15 mins)
    // Continue incrementing minutesDwelling and updating today's workout durationMinutes!
    if (alreadyDoneToday) {
      let workoutsUpdated = false;
      const updatedWorkouts = workouts.map((w) => {
        if (w.dateString === today && elapsedMins > w.durationMinutes) {
          workoutsUpdated = true;
          return {
            ...w,
            durationMinutes: elapsedMins,
            updatedAt: new Date().toISOString(),
            synced: false,
          };
        }
        return w;
      });

      const updatedSession: DwellSessionState = {
        ...session,
        isDwelling: true,
        completedToday: true,
        minutesDwelling: Math.max(session.minutesDwelling, elapsedMins),
        dateString: today,
      };

      const promises: Promise<any>[] = [this.saveDwellSession(updatedSession)];
      if (workoutsUpdated) {
        promises.push(this.saveWorkouts(updatedWorkouts));
      }
      await Promise.all(promises);

      return {
        dwellSession: updatedSession,
        streakState: streak,
        workouts: workoutsUpdated ? updatedWorkouts : workouts,
        completedNow: false,
      };
    }

    // Case 3: Under 15 minutes (< 15 mins), still building up to threshold
    if (elapsedMins !== session.minutesDwelling) {
      const updatedSession: DwellSessionState = {
        ...session,
        minutesDwelling: elapsedMins,
        dateString: today,
      };
      await this.saveDwellSession(updatedSession);
      return {
        dwellSession: updatedSession,
        streakState: streak,
        workouts,
        completedNow: false,
      };
    }

    return {
      dwellSession: session,
      streakState: streak,
      workouts,
      completedNow: false,
    };
  },

  /**
   * Called when user exits the gym perimeter.
   * First evaluates final elapsed minutes so total gym time is saved to today's workout,
   * then stops the active dwell session.
   */
  async handleBackgroundGeofenceExit(): Promise<DwellSessionState> {
    const evalResult = await this.evaluatePersistedDwellSession();
    const today = formatDateToYYYYMMDD(new Date());
    const exitedSession: DwellSessionState = {
      isDwelling: false,
      enteredAt: undefined,
      minutesDwelling: evalResult.dwellSession.completedToday
        ? evalResult.dwellSession.minutesDwelling
        : 0,
      gymName: evalResult.dwellSession.gymName,
      completedToday: evalResult.dwellSession.completedToday,
      dateString: today,
    };
    await this.saveDwellSession(exitedSession);
    return exitedSession;
  },

  /**
   * Builds a cloud-sync payload containing the user's profile, streak state, and unsynced workouts.
   */
  async getCloudSyncPayload(): Promise<CloudSyncPayload> {
    const [profile, streakState, preferences, workouts] = await Promise.all([
      this.getUserProfile(),
      this.getStreakState(),
      this.getPreferences(),
      this.getWorkouts(),
    ]);
    return {
      profile,
      streakState,
      preferences,
      unsyncedWorkouts: workouts.filter((w) => !w.synced),
      exportedAt: new Date().toISOString(),
    };
  },

  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.PREFERENCES,
        STORAGE_KEYS.WORKOUTS,
        STORAGE_KEYS.STREAK_STATE,
        STORAGE_KEYS.DWELL_SESSION,
      ]);
    } catch (e) {
      console.error('Failed to clear data', e);
    }
  },
};
