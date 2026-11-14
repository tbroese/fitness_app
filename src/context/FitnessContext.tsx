import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  UserPreferences,
  WorkoutSession,
  StreakState,
  GymLocation,
  DwellSessionState,
} from '../types/fitness';
import {
  storageService,
  DEFAULT_PREFERENCES,
  DEFAULT_STREAK_STATE,
} from '../services/storageService';
import {
  evaluateWeeklyReset,
  recordCompletedWorkout,
} from '../services/streakManager';
import {
  calculateDistanceMeters,
  requestLocationPermissions,
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
  setWeeklyGoal: (goal: number) => Promise<void>;
  updateGymLocation: (location: GymLocation) => Promise<void>;
  refreshLocation: () => Promise<void>;
  simulateEnterGym: () => void;
  simulateDwellProgress: (minutes: number) => void;
  simulateLeaveGym: () => void;
  triggerManualCheckIn: () => { success: boolean; message: string };
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

  // Update weekly goal
  const setWeeklyGoal = async (goal: number) => {
    const updatedPrefs = { ...preferences, weeklyGoal: goal };
    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);

    const reEvaluated = evaluateWeeklyReset(streakState, updatedPrefs, workouts, new Date());
    setStreakState(reEvaluated);
    await storageService.saveStreakState(reEvaluated);
  };

  // Update Gym Location
  const updateGymLocation = async (location: GymLocation) => {
    const updatedPrefs = { ...preferences, gymLocation: location };
    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);
    refreshLocation();
  };

  // Record a completed workout
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
        setDwellState((prev) => ({ ...prev, completedToday: true, minutesDwelling: 0, isDwelling: false }));
        await storageService.saveStreakState(result.updatedState);
        await storageService.saveWorkouts(result.updatedWorkouts);
      }

      return result;
    },
    [streakState, preferences, workouts]
  );

  // Manual / GPS trigger check-in
  const triggerManualCheckIn = () => {
    const gymName = preferences.gymLocation?.name || 'Local Gym';
    const result = recordCompletedWorkout(
      streakState,
      preferences,
      workouts,
      gymName,
      new Date(),
      45
    );

    if (result.success && result.newWorkout) {
      setStreakState(result.updatedState);
      setWorkouts(result.updatedWorkouts);
      setDwellState((prev) => ({ ...prev, completedToday: true, minutesDwelling: 0, isDwelling: false }));
      storageService.saveStreakState(result.updatedState);
      storageService.saveWorkouts(result.updatedWorkouts);
    }

    return { success: result.success, message: result.message };
  };

  // Simulation controls
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
      const required = preferences.gymLocation?.dwellMinutesRequired || preferences.dwellDurationMinutes || 20;

      // If dwell reached required threshold and not yet completed today
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
        triggerManualCheckIn,
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
