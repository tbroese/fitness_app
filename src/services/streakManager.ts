import { StreakState, WorkoutSession, UserPreferences } from '../types/fitness';
import {
  formatDateToYYYYMMDD,
  getIsoWeekId,
  getAvailableWorkoutDaysRemaining,
} from '../utils/dateUtils';

export const STREAK_LOST_MESSAGE = 'Streak lost. Your new streak will start next week.';

/**
 * Evaluates whether the streak resets upon crossing week boundaries or loading the app.
 * Rule: If there are less days in the week than needed to reach the goal,
 * the streak resets to 0 and displays:
 * "Streak lost. Your new streak will start next week."
 * Exception: A brand new user who just installed the app starts clean and active.
 */
export function evaluateWeeklyReset(
  currentState: StreakState,
  preferences: UserPreferences,
  workouts: WorkoutSession[],
  currentDate: Date = new Date()
): StreakState {
  const currentWeekId = getIsoWeekId(currentDate);
  const todayStr = formatDateToYYYYMMDD(currentDate);
  const workedOutToday = workouts.some((w) => w.dateString === todayStr);

  // Brand-new install detection: 0 lifetime workouts and 0 streak
  const isBrandNewInstall = workouts.length === 0 && currentState.currentStreak === 0 && currentState.bestStreak === 0;

  if (isBrandNewInstall) {
    return {
      ...currentState,
      currentStreak: 0,
      currentWeekWorkouts: 0,
      lastEvaluatedWeekId: currentWeekId,
      streakStatus: 'active',
      statusMessage: undefined,
      updatedAt: currentDate.toISOString(),
    };
  }

  let newStreak = currentState.currentStreak;
  let isReset = false;
  let statusMessage: string | undefined;

  // 1. Check if week transitioned from previous week
  if (currentState.lastEvaluatedWeekId && currentState.lastEvaluatedWeekId !== currentWeekId) {
    const priorWeekWorkouts = workouts.filter((w) => w.weekId === currentState.lastEvaluatedWeekId).length;
    if (priorWeekWorkouts < preferences.weeklyGoal) {
      newStreak = 0;
      isReset = true;
    }
  }

  // 2. Count workouts in current week
  const currentWeekWorkouts = workouts.filter((w) => w.weekId === currentWeekId).length;

  // 3. Mid-week feasibility check:
  // If user has not yet met the weekly goal, check if enough days remain
  if (currentWeekWorkouts < preferences.weeklyGoal) {
    const needed = preferences.weeklyGoal - currentWeekWorkouts;
    const daysAvailable = getAvailableWorkoutDaysRemaining(currentDate, workedOutToday);

    if (daysAvailable < needed) {
      // Mathematically impossible to meet weekly goal this week
      newStreak = 0;
      isReset = true;
      statusMessage = STREAK_LOST_MESSAGE;
    }
  }

  let streakStatus: 'active' | 'at_risk' | 'reset' = 'active';
  if (isReset || (currentState.streakStatus === 'reset' && currentState.lastEvaluatedWeekId === currentWeekId)) {
    streakStatus = 'reset';
    newStreak = 0;
    statusMessage = STREAK_LOST_MESSAGE;
  } else if (currentWeekWorkouts >= preferences.weeklyGoal) {
    streakStatus = 'active';
  } else {
    // Has not met goal, but still has enough days remaining
    streakStatus = 'at_risk';
  }

  return {
    ...currentState,
    currentStreak: newStreak,
    currentWeekWorkouts,
    lastEvaluatedWeekId: currentWeekId,
    streakStatus,
    statusMessage,
    updatedAt: currentDate.toISOString(),
  };
}

/**
 * Adds a new completed workout to the streak.
 * Rule: Only 1 workout can be credited per calendar day.
 */
export function recordCompletedWorkout(
  currentState: StreakState,
  preferences: UserPreferences,
  existingWorkouts: WorkoutSession[],
  gymName: string,
  workoutDate: Date = new Date(),
  durationMinutes: number = 15,
  userId?: string
): {
  success: boolean;
  message: string;
  updatedState: StreakState;
  newWorkout?: WorkoutSession;
  updatedWorkouts: WorkoutSession[];
} {
  const dateString = formatDateToYYYYMMDD(workoutDate);
  const weekId = getIsoWeekId(workoutDate);
  const isoNow = workoutDate.toISOString();

  // Check if a workout has already been recorded today
  const alreadyDoneToday = existingWorkouts.some((w) => w.dateString === dateString);
  if (alreadyDoneToday) {
    return {
      success: false,
      message: 'Workout already completed for today! Max 1 check-in per day.',
      updatedState: currentState,
      updatedWorkouts: existingWorkouts,
    };
  }

  // Create new workout session with cloud-ready metadata
  const newWorkout: WorkoutSession = {
    id: `workout_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: userId || currentState.userId,
    timestamp: isoNow,
    dateString,
    durationMinutes,
    verifiedByGps: true,
    gymName,
    weekId,
    updatedAt: isoNow,
    synced: false,
  };

  const updatedWorkouts = [newWorkout, ...existingWorkouts];
  const currentWeekWorkouts = currentState.currentWeekWorkouts + 1;

  // If streak was already lost for this week, it stays 0 until next week
  let newStreak = currentState.currentStreak;
  if (currentState.streakStatus !== 'reset') {
    newStreak = currentState.currentStreak + 1;
  }

  const bestStreak = Math.max(currentState.bestStreak, newStreak);

  // Re-evaluate feasibility
  const evaluated = evaluateWeeklyReset(
    {
      ...currentState,
      userId: userId || currentState.userId,
      currentStreak: newStreak,
      bestStreak,
      currentWeekWorkouts,
      lastCompletedDate: dateString,
      lastEvaluatedWeekId: weekId,
      updatedAt: isoNow,
      synced: false,
    },
    preferences,
    updatedWorkouts,
    workoutDate
  );

  return {
    success: true,
    message: evaluated.streakStatus === 'reset'
      ? `Workout logged! However, ${STREAK_LOST_MESSAGE}`
      : `Workout verified at ${gymName}! Streak is now ${newStreak} 🔥`,
    updatedState: evaluated,
    newWorkout,
    updatedWorkouts,
  };
}
