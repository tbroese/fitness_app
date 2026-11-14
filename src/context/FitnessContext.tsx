import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  UserPreferences,
  WorkoutSession,
  StreakState,
  GymLocation,
  DwellSessionState,
  FIXED_DWELL_MINUTES,
} from '../types/fitness';
import {
  storageService,
  DEFAULT_PREFERENCES,
  DEFAULT_STREAK_STATE,
} from '../services/storageService';
import {
  evaluateWeeklyReset,
  recordCompletedWorkout,
  STREAK_LOST_MESSAGE,
} from '../services/streakManager';
import {
  calculateDistanceMeters,
  getCurrentCoordinates,
} from '../services/locationService';
import { formatDateToYYYYMMDD, getIsoWeekId } from '../utils/dateUtils';

interface FitnessContextType {
  preferences: UserPreferences;
  streakState: StreakState;
  workouts: WorkoutSession[];
  dwellState: DwellSessionState;
  currentDistanceMeters: number | null;
  isLoading: boolean;
  setWeeklyGoal: (goal: number, forceResetStreak?: boolean) => Promise<void>;
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
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [streakState, setStreakState] = useState<StreakState>(DEFAULT_STREAK_STATE);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [currentDistanceMeters, setCurrentDistanceMeters] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [dwellState, setDwellState] = useState<DwellSessionState>({
    isDwelling: false,
    minutesDwelling: 0,
    completedToday: false,
  });

  // Load state and perform weekly evaluation
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const savedPrefs = await storageService.getPreferences();
      // Enforce 15 mins dwell requirement
      savedPrefs.dwellDurationMinutes = FIXED_DWELL_MINUTES;
      if (savedPrefs.gymLocation) {
        savedPrefs.gymLocation.dwellMinutesRequired = FIXED_DWELL_MINUTES;
      }

      const savedWorkouts = await storageService.getWorkouts();
      const savedStreak = await storageService.getStreakState();

      // Check weekly reset
      const evaluatedStreak = evaluateWeeklyReset(
        savedStreak,
        savedPrefs,
        savedWorkouts,
        new Date()
      );

      setPreferences(savedPrefs);
      setWorkouts(savedWorkouts);
      setStreakState(evaluatedStreak);
      await storageService.saveStreakState(evaluatedStreak);

      const todayString = formatDateToYYYYMMDD(new Date());
      const hasCompletedToday = savedWorkouts.some((w) => w.dateString === todayString);
      setDwellState((prev) => ({ ...prev, completedToday: hasCompletedToday }));
    } catch (e) {
      console.error('Failed to load initial fitness data', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check current GPS location against gym
  const refreshLocation = useCallback(async () => {
    if (!preferences.gymLocation) return;
    const coords = await getCurrentCoordinates();
    if (!coords) return;

    const distance = calculateDistanceMeters(
      coords.latitude,
      coords.longitude,
      preferences.gymLocation.latitude,
      preferences.gymLocation.longitude
    );
    setCurrentDistanceMeters(distance);

    // If inside perimeter
    if (distance <= preferences.gymLocation.radiusMeters) {
      setDwellState((prev) => {
        if (!prev.isDwelling) {
          return {
            ...prev,
            isDwelling: true,
            enteredAt: new Date().toISOString(),
            gymName: preferences.gymLocation?.name,
          };
        }
        return prev;
      });
    } else {
      setDwellState((prev) => ({
        ...prev,
        isDwelling: false,
        minutesDwelling: 0,
      }));
    }
  }, [preferences.gymLocation]);

  // Record a completed workout (only called when GPS dwells for full 15 minutes)
  const completeWorkout = useCallback(
    async (gymName: string, workoutDate: Date = new Date(), duration: number = 45) => {
      const result = recordCompletedWorkout(
        streakState,
        preferences,
        workouts,
        gymName,
        workoutDate,
        duration
      );

      if (result.success && result.newWorkout) {
        setStreakState(result.updatedState);
        setWorkouts(result.updatedWorkouts);
        setDwellState((prev) => ({
          ...prev,
          completedToday: true,
          minutesDwelling: FIXED_DWELL_MINUTES,
          isDwelling: false,
        }));
        await storageService.saveStreakState(result.updatedState);
        await storageService.saveWorkouts(result.updatedWorkouts);
      }

      return result;
    },
    [streakState, preferences, workouts]
  );

  // Update weekly goal immediately with support for mid-week reset
  const setWeeklyGoal = async (goal: number, forceResetStreak: boolean = false) => {
    const updatedPrefs = {
      ...preferences,
      weeklyGoal: goal,
      dwellDurationMinutes: FIXED_DWELL_MINUTES,
    };
    if (updatedPrefs.gymLocation) {
      updatedPrefs.gymLocation.dwellMinutesRequired = FIXED_DWELL_MINUTES;
    }

    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);

    let baseStreak = forceResetStreak ? 0 : streakState.currentStreak;
    let baseStatus: 'active' | 'at_risk' | 'reset' = forceResetStreak ? 'reset' : streakState.streakStatus;
    let baseMessage = forceResetStreak
      ? 'Streak reset due to mid-week goal change. Your new streak will start next week.'
      : streakState.statusMessage;

    const baseState: StreakState = {
      ...streakState,
      currentStreak: baseStreak,
      streakStatus: baseStatus,
      statusMessage: baseMessage,
    };

    const reEvaluated = evaluateWeeklyReset(baseState, updatedPrefs, workouts, new Date());
    setStreakState(reEvaluated);
    await storageService.saveStreakState(reEvaluated);
  };

  // Update Gym Location with locked 15 min dwell
  const updateGymLocation = async (location: GymLocation) => {
    const lockedLocation = { ...location, dwellMinutesRequired: FIXED_DWELL_MINUTES };
    const updatedPrefs = { ...preferences, gymLocation: lockedLocation };
    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);
    refreshLocation();
  };

  // Simulation controls (tests 15 min dwell requirement)
  const simulateEnterGym = () => {
    setDwellState({
      isDwelling: true,
      enteredAt: new Date().toISOString(),
      minutesDwelling: 0,
      gymName: preferences.gymLocation?.name || 'Simulated Gym',
      completedToday: dwellState.completedToday,
    });
    setCurrentDistanceMeters(10); // 10 meters away
  };

  const simulateDwellProgress = (addMinutes: number) => {
    setDwellState((prev) => {
      const newDwell = prev.minutesDwelling + addMinutes;
      const required = FIXED_DWELL_MINUTES;

      // When user remains at the location for the entire 15 mins
      if (newDwell >= required && !prev.completedToday) {
        completeWorkout(prev.gymName || 'Local Gym', new Date(), newDwell);
        return {
          ...prev,
          minutesDwelling: newDwell,
          completedToday: true,
        };
      }

      return {
        ...prev,
        minutesDwelling: newDwell,
      };
    });
  };

  const simulateLeaveGym = () => {
    setDwellState((prev) => ({
      ...prev,
      isDwelling: false,
      minutesDwelling: 0,
    }));
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
        timestamp: d.toISOString(),
        dateString: formatDateToYYYYMMDD(d),
        durationMinutes: 45,
        verifiedByGps: true,
        gymName: preferences.gymLocation?.name || 'Local Gym',
        weekId: prevWeekId,
      });
    }

    const stateWithPriorWeek: StreakState = {
      ...streakState,
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
    setStreakState(DEFAULT_STREAK_STATE);
    setWorkouts([]);
    setDwellState({
      isDwelling: false,
      minutesDwelling: 0,
      completedToday: false,
    });
    setCurrentDistanceMeters(null);
  };

  return (
    <FitnessContext.Provider
      value={{
        preferences,
        streakState,
        workouts,
        dwellState,
        currentDistanceMeters,
        isLoading,
        setWeeklyGoal,
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
