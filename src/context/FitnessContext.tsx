import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  UserProfile,
  UserPreferences,
  WorkoutSession,
  StreakState,
  GymLocation,
  DwellSessionState,
  FIXED_DWELL_MINUTES,
  DEFAULT_GEOFENCE_RADIUS_METERS,
} from '../types/fitness';
import {
  storageService,
  createDefaultUserProfile,
  DEFAULT_PREFERENCES,
  DEFAULT_STREAK_STATE,
  DEFAULT_DWELL_SESSION,
} from '../services/storageService';
import {
  evaluateWeeklyReset,
} from '../services/streakManager';
import {
  calculateDistanceMeters,
  getCurrentCoordinates,
  subscribeToLocationUpdates,
} from '../services/locationService';
import { formatDateToYYYYMMDD, getIsoWeekId } from '../utils/dateUtils';

interface FitnessContextType {
  userProfile: UserProfile;
  preferences: UserPreferences;
  streakState: StreakState;
  workouts: WorkoutSession[];
  dwellState: DwellSessionState;
  currentDistanceMeters: number | null;
  isLoading: boolean;
  updateUserProfile: (fullName: string) => Promise<void>;
  setWeeklyGoal: (goal: number) => Promise<void>;
  scheduleGoalForMonday: (goal: number) => Promise<void>;
  cancelPendingGoal: () => Promise<void>;
  updateGymLocation: (location: GymLocation) => Promise<void>;
  refreshLocation: () => Promise<void>;
  simulateEnterGym: () => void;
  simulateDwellProgress: (minutes: number) => void;
  simulateLeaveGym: () => void;
  testSimulatePreviousWeek: (workoutsInPriorWeek: number) => Promise<void>;
  resetAll: () => Promise<void>;
}

const FitnessContext = createContext<FitnessContextType | undefined>(undefined);

export const FitnessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile>(createDefaultUserProfile);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [streakState, setStreakState] = useState<StreakState>(DEFAULT_STREAK_STATE);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [currentDistanceMeters, setCurrentDistanceMeters] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [dwellState, setDwellState] = useState<DwellSessionState>(DEFAULT_DWELL_SESSION);

  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  const userProfileRef = useRef(userProfile);
  userProfileRef.current = userProfile;

  // Load state, profile, persisted dwell session, and perform weekly evaluation
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [savedProfile, savedPrefs, savedWorkouts, savedStreak] = await Promise.all([
        storageService.getUserProfile(),
        storageService.getPreferences(),
        storageService.getWorkouts(),
        storageService.getStreakState(),
      ]);

      // Ensure defaults & locked values
      savedPrefs.dwellDurationMinutes = FIXED_DWELL_MINUTES;
      if (savedPrefs.gymLocation) {
        savedPrefs.gymLocation.dwellMinutesRequired = FIXED_DWELL_MINUTES;
        savedPrefs.gymLocation.radiusMeters = DEFAULT_GEOFENCE_RADIUS_METERS;
      }

      const currentWeekId = getIsoWeekId(new Date());

      // If week transitioned to a new week, apply any scheduled Monday goal change
      if (savedStreak.lastEvaluatedWeekId && savedStreak.lastEvaluatedWeekId !== currentWeekId) {
        if (savedPrefs.pendingWeeklyGoal) {
          savedPrefs.weeklyGoal = savedPrefs.pendingWeeklyGoal;
          savedPrefs.pendingWeeklyGoal = null;
          await storageService.savePreferences(savedPrefs);
        }
      }

      // Attach userId to streakState if missing
      if (!savedStreak.userId) {
        savedStreak.userId = savedProfile.id;
      }

      // Check weekly reset
      const evaluatedStreak = evaluateWeeklyReset(
        savedStreak,
        savedPrefs,
        savedWorkouts,
        new Date()
      );
      await storageService.saveStreakState(evaluatedStreak);

      // Evaluate any persisted background dwell session
      const dwellEval = await storageService.evaluatePersistedDwellSession();

      setUserProfile(savedProfile);
      setPreferences(savedPrefs);
      setWorkouts(dwellEval.workouts);
      setStreakState(dwellEval.streakState);
      setDwellState(dwellEval.dwellSession);
    } catch (e) {
      console.error('Failed to load initial fitness data', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save user's Full Name locally on device
  const updateUserProfile = async (fullName: string) => {
    const trimmed = fullName.trim();
    const updatedProfile: UserProfile = {
      ...userProfile,
      fullName: trimmed,
      hasCompletedOnboarding: Boolean(trimmed),
      updatedAt: new Date().toISOString(),
    };

    const saved = await storageService.saveUserProfile(updatedProfile);
    setUserProfile(saved);
  };

  // Helper to apply GPS proximity check and persist dwell state to AsyncStorage
  const applyProximityDistance = useCallback(async (distance: number, gym: GymLocation) => {
    setCurrentDistanceMeters(distance);
    const radius = gym.radiusMeters || DEFAULT_GEOFENCE_RADIUS_METERS;

    if (distance <= radius) {
      await storageService.handleBackgroundGeofenceEnter(gym.name);
      const evalResult = await storageService.evaluatePersistedDwellSession();
      setDwellState(evalResult.dwellSession);
      setStreakState(evalResult.streakState);
      setWorkouts(evalResult.workouts);
    } else {
      const exitedSession = await storageService.handleBackgroundGeofenceExit();
      const [latestStreak, latestWorkouts] = await Promise.all([
        storageService.getStreakState(),
        storageService.getWorkouts(),
      ]);
      setDwellState(exitedSession);
      setStreakState(latestStreak);
      setWorkouts(latestWorkouts);
    }
  }, []);

  // Check current GPS location against gym
  const refreshLocation = useCallback(async () => {
    const gym = preferencesRef.current.gymLocation;
    if (!gym) return;
    const coords = await getCurrentCoordinates();
    if (!coords) return;

    const distance = calculateDistanceMeters(
      coords.latitude,
      coords.longitude,
      gym.latitude,
      gym.longitude
    );
    await applyProximityDistance(distance, gym);
  }, [applyProximityDistance]);

  // Listen to AppState so when user unlocks phone or reopens app, persisted dwell time & background events sync immediately
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const evalResult = await storageService.evaluatePersistedDwellSession();
        setDwellState(evalResult.dwellSession);
        setStreakState(evalResult.streakState);
        setWorkouts(evalResult.workouts);
        refreshLocation();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshLocation]);

  // Continuous live GPS watching when app is active
  useEffect(() => {
    let sub: any = null;
    let isMounted = true;

    refreshLocation();

    if (preferences.gymLocation) {
      subscribeToLocationUpdates((coords) => {
        if (!isMounted) return;
        const gym = preferencesRef.current.gymLocation;
        if (!gym) return;

        const distance = calculateDistanceMeters(
          coords.latitude,
          coords.longitude,
          gym.latitude,
          gym.longitude
        );
        applyProximityDistance(distance, gym);
      }).then((subscription) => {
        if (isMounted) {
          sub = subscription;
        } else if (subscription && subscription.remove) {
          subscription.remove();
        }
      });
    }

    return () => {
      isMounted = false;
      if (sub && sub.remove) sub.remove();
    };
  }, [preferences.gymLocation, refreshLocation, applyProximityDistance]);

  // Live real-time dwell time counter — continues tracking past 15 minutes for as long as user remains at the gym!
  useEffect(() => {
    if (!dwellState.isDwelling || !dwellState.enteredAt) {
      return;
    }

    const interval = setInterval(async () => {
      const evalResult = await storageService.evaluatePersistedDwellSession();
      setDwellState(evalResult.dwellSession);
      setStreakState(evalResult.streakState);
      setWorkouts(evalResult.workouts);
    }, 5000); // Ticks every 5 seconds

    return () => clearInterval(interval);
  }, [dwellState.isDwelling, dwellState.enteredAt]);

  // Update weekly goal immediately (e.g. on Monday)
  const setWeeklyGoal = async (goal: number) => {
    const updatedPrefs: UserPreferences = {
      ...preferences,
      weeklyGoal: goal,
      pendingWeeklyGoal: null,
      dwellDurationMinutes: FIXED_DWELL_MINUTES,
    };
    if (updatedPrefs.gymLocation) {
      updatedPrefs.gymLocation.dwellMinutesRequired = FIXED_DWELL_MINUTES;
      updatedPrefs.gymLocation.radiusMeters = DEFAULT_GEOFENCE_RADIUS_METERS;
    }

    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);

    const reEvaluated = evaluateWeeklyReset(streakState, updatedPrefs, workouts, new Date());
    setStreakState(reEvaluated);
    await storageService.saveStreakState(reEvaluated);
  };

  // Schedule weekly goal to update starting next Monday
  const scheduleGoalForMonday = async (goal: number) => {
    const updatedPrefs: UserPreferences = {
      ...preferences,
      pendingWeeklyGoal: goal,
    };
    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);
  };

  // Cancel scheduled Monday goal
  const cancelPendingGoal = async () => {
    const updatedPrefs: UserPreferences = {
      ...preferences,
      pendingWeeklyGoal: null,
    };
    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);
  };

  // Update Gym Location with locked 300m radius and 15 min dwell
  const updateGymLocation = async (location: GymLocation) => {
    const lockedLocation: GymLocation = {
      ...location,
      radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS, // Fixed at 300m
      dwellMinutesRequired: FIXED_DWELL_MINUTES, // Fixed at 15m
    };
    const updatedPrefs: UserPreferences = { ...preferences, gymLocation: lockedLocation };
    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);
    refreshLocation();
  };

  // Simulation controls (persists to AsyncStorage and keeps tracking past 15 mins while inside gym)
  const simulateEnterGym = async () => {
    const gymName = preferences.gymLocation?.name || 'Simulated Gym';
    const session = await storageService.handleBackgroundGeofenceEnter(gymName);
    setDwellState(session);
    setCurrentDistanceMeters(10); // 10 meters away
  };

  const simulateDwellProgress = async (addMinutes: number) => {
    const newDwell = dwellState.minutesDwelling + addMinutes;
    const simulatedEnteredAt = new Date(Date.now() - newDwell * 60 * 1000).toISOString();

    const updatedSession: DwellSessionState = {
      ...dwellState,
      isDwelling: true,
      enteredAt: simulatedEnteredAt,
      minutesDwelling: newDwell,
      gymName: dwellState.gymName || preferences.gymLocation?.name || 'Local Gym',
      dateString: formatDateToYYYYMMDD(new Date()),
    };
    await storageService.saveDwellSession(updatedSession);

    const evalResult = await storageService.evaluatePersistedDwellSession();
    setDwellState(evalResult.dwellSession);
    setStreakState(evalResult.streakState);
    setWorkouts(evalResult.workouts);
    setCurrentDistanceMeters(10);
  };

  const simulateLeaveGym = async () => {
    const exited = await storageService.handleBackgroundGeofenceExit();
    const [latestStreak, latestWorkouts] = await Promise.all([
      storageService.getStreakState(),
      storageService.getWorkouts(),
    ]);
    setDwellState(exited);
    setStreakState(latestStreak);
    setWorkouts(latestWorkouts);
    setCurrentDistanceMeters(2500); // 2.5 km away
  };

  // Test simulation: jump week and see reset behavior
  const testSimulatePreviousWeek = async (workoutsInPriorWeek: number) => {
    const prevWeekDate = new Date();
    prevWeekDate.setDate(prevWeekDate.getDate() - 7);
    const prevWeekId = getIsoWeekId(prevWeekDate);

    // Create fake workouts for the previous week
    const fakePriorWorkouts: WorkoutSession[] = [];
    for (let i = 0; i < workoutsInPriorWeek; i++) {
      const d = new Date(prevWeekDate);
      d.setDate(d.getDate() - i);
      fakePriorWorkouts.push({
        id: `sim_w_${i}`,
        userId: userProfile.id,
        timestamp: d.toISOString(),
        dateString: formatDateToYYYYMMDD(d),
        durationMinutes: 45,
        verifiedByGps: true,
        gymName: preferences.gymLocation?.name || 'Local Gym',
        weekId: prevWeekId,
        updatedAt: d.toISOString(),
        synced: false,
      });
    }

    const stateWithPriorWeek: StreakState = {
      ...streakState,
      userId: userProfile.id,
      currentStreak: streakState.currentStreak > 0 ? streakState.currentStreak : 5,
      lastEvaluatedWeekId: prevWeekId,
    };

    const combinedWorkouts = [...fakePriorWorkouts, ...workouts];
    const evaluated = evaluateWeeklyReset(stateWithPriorWeek, preferences, combinedWorkouts, new Date());

    setWorkouts(combinedWorkouts);
    setStreakState(evaluated);
    await storageService.saveWorkouts(combinedWorkouts);
    await storageService.saveStreakState(evaluated);
  };

  const resetAll = async () => {
    await storageService.clearAllData();
    setPreferences(DEFAULT_PREFERENCES);
    setStreakState({ ...DEFAULT_STREAK_STATE, userId: userProfile.id });
    setWorkouts([]);
    setDwellState(DEFAULT_DWELL_SESSION);
    setCurrentDistanceMeters(null);
  };

  return (
    <FitnessContext.Provider
      value={{
        userProfile,
        preferences,
        streakState,
        workouts,
        dwellState,
        currentDistanceMeters,
        isLoading,
        updateUserProfile,
        setWeeklyGoal,
        scheduleGoalForMonday,
        cancelPendingGoal,
        updateGymLocation,
        refreshLocation,
        simulateEnterGym,
        simulateDwellProgress,
        simulateLeaveGym,
        testSimulatePreviousWeek,
        resetAll,
      }}
    >
      {children}
    </FitnessContext.Provider>
  );
};

export const useFitness = (): FitnessContextType => {
  const context = useContext(FitnessContext);
  if (!context) {
    throw new Error('useFitness must be used within a FitnessProvider');
  }
  return context;
};
