import { StreakState, WorkoutSession, UserPreferences } from '../types/fitness';
import {
  formatDateToYYYYMMDD,
  getIsoWeekId,
  getPreviousIsoWeekId,
  getDaysRemainingInWeek,
} from '../utils/dateUtils';

/**
 * Evaluates whether the streak resets upon crossing week boundaries or loading the app.
 */
export function evaluateWeeklyReset(
  currentState: StreakState,
  preferences: UserPreferences,
  workouts: WorkoutSession[],
  currentDate: Date = new Date()
): StreakState {
  const currentWeekId = getIsoWeekId(currentDate);

  // If this is the initial state
  if (!currentState.lastEvaluatedWeekId) {
    const workoutsThisWeek = workouts.filter((w) => w.weekId === currentWeekId).length;
    return {
      ...currentState,
      currentWeekWorkouts: workoutsThisWeek,
      lastEvaluatedWeekId: currentWeekId,
      streakStatus: determineStatus(workoutsThisWeek, preferences.weeklyGoal, currentDate),
    };
  }

  // If we transitioned to a new week
  if (currentState.lastEvaluatedWeekId !== currentWeekId) {
    // Workouts completed during the previous week
    const lastEvaluatedWeek = currentState.lastEvaluatedWeekId;
    const priorWeekWorkouts = workouts.filter((w) => w.weekId === lastEvaluatedWeek).length;

    let newStreak = currentState.currentStreak;
    let isReset = false;

    // Reset condition: If user did not achieve the weekly goal
    if (priorWeekWorkouts < preferences.weeklyGoal) {
      newStreak = 0;
      isReset = true;
    }

    const currentWeekWorkouts = workouts.filter((w) => w.weekId === currentWeekId).length;

    return {
      ...currentState,
      currentStreak: newStreak,
      currentWeekWorkouts,
      lastEvaluatedWeekId: currentWeekId,
      streakStatus: isReset ? 'reset' : determineStatus(currentWeekWorkouts, preferences.weeklyGoal, currentDate),
    };
  }

  // Same week - update current count and risk status
  const currentWeekWorkouts = workouts.filter((w) => w.weekId === currentWeekId).length;
  return {
    ...currentState,
    currentWeekWorkouts,
    streakStatus: determineStatus(currentWeekWorkouts, preferences.weeklyGoal, currentDate),
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
  durationMinutes: number = 45
): {
  success: boolean;
  message: string;
  updatedState: StreakState;
  newWorkout?: WorkoutSession;
  updatedWorkouts: WorkoutSession[];
} {
  const dateString = formatDateToYYYYMMDD(workoutDate);
  const weekId = getIsoWeekId(workoutDate);

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

  // Create new workout session
  const newWorkout: WorkoutSession = {
    id: `workout_${Date.now()}`,
    timestamp: workoutDate.toISOString(),
    dateString,
    durationMinutes,
    verifiedByGps: true,
    gymName,
    weekId,
  };

  const updatedWorkouts = [newWorkout, ...existingWorkouts];
  const newStreak = currentState.currentStreak + 1;
  const bestStreak = Math.max(currentState.bestStreak, newStreak);
  const currentWeekWorkouts = currentState.currentWeekWorkouts + 1;

  const updatedState: StreakState = {
    ...currentState,
    currentStreak: newStreak,
    bestStreak,
    currentWeekWorkouts,
    lastCompletedDate: dateString,
    lastEvaluatedWeekId: weekId,
    streakStatus: determineStatus(currentWeekWorkouts, preferences.weeklyGoal, workoutDate),
  };

  return {
    success: true,
    message: `Workout verified at ${gymName}! Streak is now ${newStreak} 🔥`,
    updatedState,
    newWorkout,
    updatedWorkouts,
  };
}

/**
 * Calculates whether the user is on track, at risk of resetting, or has achieved their weekly target.
 */
function determineStatus(
  currentWeekWorkouts: number,
  weeklyGoal: number,
  currentDate: Date
): 'active' | 'at_risk' | 'reset' {
  if (currentWeekWorkouts >= weeklyGoal) {
    return 'active';
  }

  const remainingWorkouts = weeklyGoal - currentWeekWorkouts;
  const daysRemaining = getDaysRemainingInWeek(currentDate) + 1; // including today

  // If there are fewer days left in the week than needed workouts, the goal cannot be met!
  if (daysRemaining < remainingWorkouts) {
    return 'at_risk';
  }

  return 'active';
}
