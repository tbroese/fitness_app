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
      partnerStreak: 0,
      bestPartnerStreak: 0,
      currentWeekWorkouts: 0,
      lastEvaluatedWeekId: currentWeekId,
      streakStatus: 'active',
      statusMessage: undefined,
      updatedAt: currentDate.toISOString(),
    };
  }

  let newStreak = currentState.currentStreak;
  let newPartnerStreak = currentState.partnerStreak ?? 0;
  const bestPartnerStreak = currentState.bestPartnerStreak ?? 0;
  let isReset = false;
  let statusMessage: string | undefined;

  const partnerWorkouts = workouts.filter((w) => Boolean(w.isPartnered));

  // 1. Check if week transitioned from previous week
  if (currentState.lastEvaluatedWeekId && currentState.lastEvaluatedWeekId !== currentWeekId) {
    const priorWeekWorkouts = workouts.filter((w) => w.weekId === currentState.lastEvaluatedWeekId).length;
    if (priorWeekWorkouts < preferences.weeklyGoal) {
      newStreak = 0;
      isReset = true;
    }

    const priorPartnerWeekWorkouts = partnerWorkouts.filter(
      (w) => w.weekId === currentState.lastEvaluatedWeekId
    ).length;
    if (priorPartnerWeekWorkouts < preferences.weeklyGoal) {
      newPartnerStreak = 0;
    }
  }

  // 2. Count workouts in current week
  const currentWeekWorkouts = workouts.filter((w) => w.weekId === currentWeekId).length;
  const currentPartnerWeekWorkouts = partnerWorkouts.filter(
    (w) => w.weekId === currentWeekId
  ).length;
  const workedOutAtPartnerToday = partnerWorkouts.some((w) => w.dateString === todayStr);

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

  if (currentPartnerWeekWorkouts < preferences.weeklyGoal) {
    const partnerNeeded = preferences.weeklyGoal - currentPartnerWeekWorkouts;
    const partnerDaysAvailable = getAvailableWorkoutDaysRemaining(
      currentDate,
      workedOutAtPartnerToday
    );
    if (partnerDaysAvailable < partnerNeeded) {
      newPartnerStreak = 0;
    }
  }

  let streakStatus: 'active' | 'at_risk' | 'reset' = 'active';
  if (isReset || (currentState.streakStatus === 'reset' && currentState.lastEvaluatedWeekId === currentWeekId)) {
    streakStatus = 'reset';
    newStreak = 0;
    newPartnerStreak = 0;
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
    partnerStreak: newPartnerStreak,
    bestPartnerStreak: Math.max(bestPartnerStreak, newPartnerStreak),
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
  userId?: string,
  isPartnered: boolean = false
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
    isPartnered,
    gymName,
    weekId,
    updatedAt: isoNow,
    synced: false,
  };

  const updatedWorkouts = [newWorkout, ...existingWorkouts];
  const currentWeekWorkouts = updatedWorkouts.filter((w) => w.weekId === weekId).length;
  const currentPartnerWeekWorkouts = updatedWorkouts.filter(
    (w) => w.weekId === weekId && Boolean(w.isPartnered)
  ).length;

  // Cap streak increments at the user's weekly goal so low-goal farming isn't possible
  let newStreak = currentState.currentStreak;
  const withinWeeklyGoalCap = currentWeekWorkouts <= preferences.weeklyGoal;
  if (currentState.streakStatus !== 'reset' && withinWeeklyGoalCap) {
    newStreak = currentState.currentStreak + 1;
  }

  // Partnered Gym Streak only increments for verified partnered gym visits
  let newPartnerStreak = currentState.partnerStreak ?? 0;
  if (
    isPartnered &&
    currentState.streakStatus !== 'reset' &&
    currentPartnerWeekWorkouts <= preferences.weeklyGoal
  ) {
    newPartnerStreak = newPartnerStreak + 1;
  }

  const bestStreak = Math.max(currentState.bestStreak, newStreak);
  const bestPartnerStreak = Math.max(currentState.bestPartnerStreak ?? 0, newPartnerStreak);

  // Re-evaluate feasibility
  const evaluated = evaluateWeeklyReset(
    {
      ...currentState,
      userId: userId || currentState.userId,
      currentStreak: newStreak,
      bestStreak,
      partnerStreak: newPartnerStreak,
      bestPartnerStreak,
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
    message:
      evaluated.streakStatus === 'reset'
        ? `Workout logged! However, ${STREAK_LOST_MESSAGE}`
        : !withinWeeklyGoalCap
        ? `Workout logged at ${gymName}! Weekly streak cap (${preferences.weeklyGoal}/wk) already reached.`
        : `Workout verified at ${gymName}! Streak is now ${newStreak} 🔥`,
    updatedState: evaluated,
    newWorkout,
    updatedWorkouts,
  };
}
