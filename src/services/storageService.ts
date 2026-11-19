import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UserProfile,
  UserPreferences,
  WorkoutSession,
  StreakState,
  DwellSessionState,
  CloudSyncPayload,
  FIXED_DWELL_MINUTES,
  MAX_MANUAL_SESSION_MINUTES,
  DEFAULT_GEOFENCE_RADIUS_METERS,
} from '../types/fitness';
import { formatDateToYYYYMMDD, getIsoWeekId } from '../utils/dateUtils';
import { AuthSession } from './cloud/types';
import { recordCompletedWorkout } from './streakManager';

const STORAGE_KEYS = {
  USER_PROFILE: '@fitness_user_profile_v1',
  PREFERENCES: '@fitness_preferences_v1',
  WORKOUTS: '@fitness_workouts_v1',
  STREAK_STATE: '@fitness_streak_state_v1',
  DWELL_SESSION: '@fitness_dwell_session_v1',
  AUTH_SESSION: '@fitness_auth_session_v1',
};

function generateOfflineUserId(): string {
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const timePart = Date.now().toString(36);
  return `usr_${timePart}_${randomSuffix}`;
}

export function generateUserTag(seedId?: string): string {
  if (seedId === 'usr_mwgh3zb6_f4fv0tdh') {
    return '4821';
  }
  const num = Math.floor(1000 + Math.random() * 9000);
  return String(num);
}

export function createDefaultUserProfile(): UserProfile {
  const now = new Date().toISOString();
  const id = generateOfflineUserId();
  return {
    id,
    fullName: '',
    userTag: generateUserTag(id),
    email: null,
    authProvider: 'device',
    authUserId: null,
    gender: null,
    age: null,
    squatPrKg: 0,
    benchPrKg: 0,
    deadliftPrKg: 0,
    preferredWeightUnit: 'lbs',
    hasCompletedOnboarding: false,
    createdAt: now,
    updatedAt: now,
    syncedAt: null,
  };
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  weeklyGoal: 2, // Default starts at 2 workouts per week
  pendingWeeklyGoal: null,
  gymLocation: null,
  dwellDurationMinutes: FIXED_DWELL_MINUTES,
  autoDetectGym: true,
  geofenceRadiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
  themeMode: 'dark',
  distanceUnit: 'mi',
};

export const DEFAULT_STREAK_STATE: StreakState = {
  currentStreak: 0,
  bestStreak: 0,
  partnerStreak: 0,
  bestPartnerStreak: 0,
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
        const resolvedId = parsed.id || generateOfflineUserId();
        const resolvedTag =
          typeof parsed.userTag === 'string' && parsed.userTag.length === 4
            ? parsed.userTag
            : generateUserTag(resolvedId);
        const profile: UserProfile = {
          id: resolvedId,
          fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
          userTag: resolvedTag,
          email: parsed.email ?? null,
          authProvider: parsed.authProvider || 'device',
          authUserId: parsed.authUserId ?? null,
          gender:
            parsed.gender === 'male' || parsed.gender === 'female'
              ? parsed.gender
              : null,
          age:
            typeof parsed.age === 'number' && parsed.age > 0
              ? parsed.age
              : null,
          squatPrKg: typeof parsed.squatPrKg === 'number' ? parsed.squatPrKg : 0,
          benchPrKg: typeof parsed.benchPrKg === 'number' ? parsed.benchPrKg : 0,
          deadliftPrKg: typeof parsed.deadliftPrKg === 'number' ? parsed.deadliftPrKg : 0,
          preferredWeightUnit: parsed.preferredWeightUnit === 'kg' ? 'kg' : 'lbs',
          hasCompletedOnboarding: Boolean(parsed.hasCompletedOnboarding && parsed.fullName),
          createdAt: parsed.createdAt || new Date().toISOString(),
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          syncedAt: parsed.syncedAt ?? null,
        };
        if (!parsed.userTag) {
          await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
        }
        return profile;
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
      if (!data) {
        return DEFAULT_PREFERENCES;
      }
      const parsed = JSON.parse(data);
      if (
        parsed.gymLocation &&
        (parsed.gymLocation.id === 'default_gym' ||
          parsed.gymLocation.name === 'Metropolis Fitness Club')
      ) {
        parsed.gymLocation = null;
      }
      return { ...DEFAULT_PREFERENCES, ...parsed };
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
      // If stored session is from an older day and not actively dwelling, reset for today.
      // Active dwell sessions keep their arrival enteredAt & dateString across midnight.
      if (!parsed.isDwelling && parsed.dateString && parsed.dateString !== today) {
        const resetForToday: DwellSessionState = {
          isDwelling: false,
          enteredAt: undefined,
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
  async handleBackgroundGeofenceEnter(
    gymName?: string,
    isManualStart: boolean = false
  ): Promise<DwellSessionState> {
    const today = formatDateToYYYYMMDD(new Date());
    const [existingSession, workouts, prefs] = await Promise.all([
      this.getDwellSession(),
      this.getWorkouts(),
      this.getPreferences(),
    ]);

    if (!isManualStart && !prefs.autoDetectGym) {
      return existingSession;
    }

    const todayWorkout = workouts.find((w) => w.dateString === today);
    const isPartneredGym = Boolean(prefs.gymLocation?.isPartnered);
    const isUpgradingToPartnered = Boolean(
      todayWorkout && !todayWorkout.isPartnered && isPartneredGym
    );
    const completedToday = Boolean(todayWorkout) && !isUpgradingToPartnered;
    const resolvedGymName = gymName || prefs.gymLocation?.name || 'Local Gym';

    if (
      existingSession.isDwelling &&
      existingSession.enteredAt &&
      (!isUpgradingToPartnered || existingSession.gymName === resolvedGymName)
    ) {
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

    // If re-entering the same gym type later on the same day after already completing a workout,
    // backdate enteredAt by prior duration so cumulative gym time for today continues seamlessly.
    // When upgrading from a custom gym to a partnered gym on the same day, start a fresh 15m dwell.
    const priorMinutesToday = isUpgradingToPartnered ? 0 : todayWorkout ? todayWorkout.durationMinutes : 0;
    const effectiveEnteredAt = new Date(Date.now() - priorMinutesToday * 60 * 1000).toISOString();

    const newSession: DwellSessionState = {
      isDwelling: true,
      enteredAt: effectiveEnteredAt,
      minutesDwelling: priorMinutesToday,
      gymName: resolvedGymName,
      completedToday,
      dateString: today,
      isManualSession: Boolean(prefs.gymLocation?.isManual),
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

    const todayWorkout = workouts.find((w) => w.dateString === today);
    const alreadyDoneToday = Boolean(todayWorkout);
    const isPartnered = Boolean(prefs.gymLocation?.isPartnered);
    const canUpgradeToday = Boolean(todayWorkout && !todayWorkout.isPartnered && isPartnered);

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

    // Anchor active dwell session to the day the user arrived (even if it crosses midnight)
    const arrivalDate = new Date(session.enteredAt);
    const sessionDate = session.dateString || formatDateToYYYYMMDD(arrivalDate);
    const sessionWorkout = workouts.find((w) => w.dateString === sessionDate);
    const alreadyDoneForSession = Boolean(sessionWorkout);
    const canUpgradeForSession = Boolean(
      sessionWorkout && !sessionWorkout.isPartnered && isPartnered
    );

    // Guard: if upgrading from a custom gym workout to a partnered gym, do not credit a stale
    // dwell session that was started at a different (custom) gym.
    if (
      canUpgradeForSession &&
      session.gymName &&
      prefs.gymLocation?.name &&
      session.gymName !== prefs.gymLocation.name
    ) {
      const resetSession: DwellSessionState = {
        isDwelling: false,
        enteredAt: undefined,
        minutesDwelling: 0,
        gymName: prefs.gymLocation.name,
        completedToday: false,
        dateString: today,
      };
      await this.saveDwellSession(resetSession);
      return {
        dwellSession: resetSession,
        streakState: streak,
        workouts,
        completedNow: false,
      };
    }

    // User is actively dwelling inside the gym perimeter — compute elapsed time
    const elapsedMs = Date.now() - arrivalDate.getTime();
    const elapsedMins = Math.max(0, Math.floor(elapsedMs / (1000 * 60)));
    const isManualGym = Boolean(prefs.gymLocation?.isManual || session.isManualSession);

    // Auto-checkout manual check-in/check-out sessions after MAX_MANUAL_SESSION_MINUTES (180 mins)
    if (isManualGym && elapsedMins >= MAX_MANUAL_SESSION_MINUTES) {
      const cappedMins = MAX_MANUAL_SESSION_MINUTES;
      let latestStreak = streak;
      let latestWorkouts = workouts;
      let completedNow = false;
      let sessionCompleted = alreadyDoneForSession;

      if (!alreadyDoneForSession || canUpgradeForSession) {
        const gymName = session.gymName || prefs.gymLocation?.name || 'Local Gym';
        const result = recordCompletedWorkout(
          streak,
          prefs,
          workouts,
          gymName,
          arrivalDate,
          cappedMins,
          profile.id,
          isPartnered,
          profile.createdAt
        );
        latestStreak = result.updatedState;
        latestWorkouts = result.updatedWorkouts;
        completedNow = result.success;
        sessionCompleted = result.success || alreadyDoneForSession;
      } else {
        latestWorkouts = workouts.map((w) =>
          w.dateString === sessionDate && cappedMins > w.durationMinutes
            ? {
                ...w,
                durationMinutes: cappedMins,
                updatedAt: new Date().toISOString(),
                synced: false,
              }
            : w
        );
      }

      const checkedOutSession: DwellSessionState = {
        isDwelling: false,
        enteredAt: undefined,
        minutesDwelling: cappedMins,
        gymName: session.gymName || prefs.gymLocation?.name,
        completedToday: sessionCompleted,
        dateString: sessionDate,
        isManualSession: false,
      };

      await Promise.all([
        this.saveDwellSession(checkedOutSession),
        this.saveStreakState(latestStreak),
        this.saveWorkouts(latestWorkouts),
      ]);

      return {
        dwellSession: checkedOutSession,
        streakState: latestStreak,
        workouts: latestWorkouts,
        completedNow,
      };
    }

    // Case 1: Reached 15-minute threshold for the first time in this session, or upgrading custom -> partnered
    if (elapsedMins >= FIXED_DWELL_MINUTES && (!alreadyDoneForSession || canUpgradeForSession)) {
      const gymName = session.gymName || prefs.gymLocation?.name || 'Local Gym';
      const result = recordCompletedWorkout(
        streak,
        prefs,
        workouts,
        gymName,
        arrivalDate,
        elapsedMins,
        profile.id,
        isPartnered,
        profile.createdAt
      );

      // Keep isDwelling: true and enteredAt intact so timer continues past 15 mins!
      const ongoingCompletedSession: DwellSessionState = {
        ...session,
        isDwelling: true,
        minutesDwelling: elapsedMins,
        completedToday: result.success,
        dateString: sessionDate,
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

    // Case 2: Already completed this session's 15-min check-in (and not upgrading to partnered), still at the gym
    // Continue incrementing minutesDwelling and updating the session workout's durationMinutes!
    if (alreadyDoneForSession && !canUpgradeForSession) {
      let workoutsUpdated = false;
      const updatedWorkouts = workouts.map((w) => {
        if (w.dateString === sessionDate && elapsedMins > w.durationMinutes) {
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
        dateString: sessionDate,
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
        dateString: sessionDate,
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

  async clearAllData(includeProfile: boolean = false): Promise<void> {
    try {
      const keys = [
        STORAGE_KEYS.PREFERENCES,
        STORAGE_KEYS.WORKOUTS,
        STORAGE_KEYS.STREAK_STATE,
        STORAGE_KEYS.DWELL_SESSION,
      ];
      if (includeProfile) {
        keys.push(STORAGE_KEYS.USER_PROFILE, STORAGE_KEYS.AUTH_SESSION);
      }
      await AsyncStorage.multiRemove(keys);
    } catch (e) {
      console.error('Failed to clear data', e);
    }
  },

  async getAuthSession(): Promise<AuthSession | null> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      if (json) {
        return JSON.parse(json) as AuthSession;
      }
    } catch (e) {
      console.error('Failed to load auth session', e);
    }
    return null;
  },

  async saveAuthSession(session: AuthSession): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session));
    } catch (e) {
      console.error('Failed to save auth session', e);
    }
  },

  async clearAuthSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    } catch (e) {
      console.error('Failed to clear auth session', e);
    }
  },
};
