import { StreakState, WorkoutSession, UserPreferences } from '../types/fitness';
import {
  formatDateToYYYYMMDD,
  getIsoWeekId,
  getAvailableWorkoutDaysRemaining,
} from '../utils/dateUtils';

export const STREAK_LOST_MESSAGE = 'Streak lost. Your new streak will start next week.';

/**
 * Returns the effective weekly goal for a given ISO week.
 * During a user's sign-up week, caps the required target to the number of days
 * available from their sign-up day through Sunday so they aren't penalized for
 * days before they joined—while still resetting if they miss days they had available.
 */
export function getEffectiveGoalForWeek(
  weeklyGoal: number,
  weekId: string,
  signupDate?: Date | string
): number {
  if (!signupDate) return weeklyGoal;
  const parsed = signupDate instanceof Date ? signupDate : new Date(signupDate);
  if (isNaN(parsed.getTime())) return weeklyGoal;
  const signupWeekId = getIsoWeekId(parsed);
  if (weekId !== signupWeekId) return weeklyGoal;
  const dayOfWeek = parsed.getDay(); // 0 (Sun) .. 6 (Sat)
  const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek; // 1 (Mon) .. 7 (Sun)
  const daysAvailableInFirstWeek = 8 - isoDay; // Mon=7 .. Sun=1
  return Math.max(1, Math.min(weeklyGoal, daysAvailableInFirstWeek));
}

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
  currentDate: Date = new Date(),
  signupDate?: Date | string
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
      verifiedStreak: 0,
      bestVerifiedStreak: 0,
      currentWeekWorkouts: 0,
      lastEvaluatedWeekId: currentWeekId,
      streakStatus: 'active',
      statusMessage: undefined,
      updatedAt: currentDate.toISOString(),
    };
  }

  let newStreak = currentState.currentStreak;
  let newVerifiedStreak = currentState.verifiedStreak ?? 0;
  const bestVerifiedStreak = currentState.bestVerifiedStreak ?? 0;
  let isReset = false;
  let statusMessage: string | undefined;

  const verifiedWorkouts = workouts.filter((w) => Boolean(w.isVerified));

  // 1. Check if week transitioned from previous week
  if (currentState.lastEvaluatedWeekId && currentState.lastEvaluatedWeekId !== currentWeekId) {
    const priorWeekTarget = getEffectiveGoalForWeek(
      preferences.weeklyGoal,
      currentState.lastEvaluatedWeekId,
      signupDate
    );
    const priorWeekWorkouts = workouts.filter((w) => w.weekId === currentState.lastEvaluatedWeekId).length;
    if (priorWeekWorkouts < priorWeekTarget) {
      newStreak = 0;
      isReset = true;
    }

    const priorVerifiedWeekWorkouts = verifiedWorkouts.filter(
      (w) => w.weekId === currentState.lastEvaluatedWeekId
    ).length;
    if (priorVerifiedWeekWorkouts < priorWeekTarget) {
      newVerifiedStreak = 0;
    }
  }

  // 2. Count workouts in current week
  const currentWeekTarget = getEffectiveGoalForWeek(
    preferences.weeklyGoal,
    currentWeekId,
    signupDate
  );
  const currentWeekWorkouts = workouts.filter((w) => w.weekId === currentWeekId).length;
  const currentVerifiedWeekWorkouts = verifiedWorkouts.filter(
    (w) => w.weekId === currentWeekId
  ).length;
  const workedOutAtVerifiedToday = verifiedWorkouts.some((w) => w.dateString === todayStr);

  // 3. Mid-week feasibility check:
  // If user has not yet met the weekly goal, check if enough days remain
  if (currentWeekWorkouts < currentWeekTarget) {
    const needed = currentWeekTarget - currentWeekWorkouts;
    const daysAvailable = getAvailableWorkoutDaysRemaining(currentDate, workedOutToday);

    if (daysAvailable < needed) {
      // Mathematically impossible to meet weekly goal this week
      newStreak = 0;
      isReset = true;
      statusMessage = STREAK_LOST_MESSAGE;
    }
  }

  if (currentVerifiedWeekWorkouts < currentWeekTarget) {
    const verifiedNeeded = currentWeekTarget - currentVerifiedWeekWorkouts;
    const verifiedDaysAvailable = getAvailableWorkoutDaysRemaining(
      currentDate,
      workedOutAtVerifiedToday
    );
    if (verifiedDaysAvailable < verifiedNeeded) {
      newVerifiedStreak = 0;
    }
  }

  let streakStatus: 'active' | 'at_risk' | 'reset' = 'active';
  if (isReset || (currentState.streakStatus === 'reset' && currentState.lastEvaluatedWeekId === currentWeekId)) {
    streakStatus = 'reset';
    newStreak = 0;
    newVerifiedStreak = 0;
    statusMessage = STREAK_LOST_MESSAGE;
  } else if (currentWeekWorkouts >= currentWeekTarget) {
    streakStatus = 'active';
  } else {
    // Has not met goal, but still has enough days remaining
    streakStatus = 'at_risk';
  }

  return {
    ...currentState,
    currentStreak: newStreak,
    verifiedStreak: newVerifiedStreak,
    bestVerifiedStreak: Math.max(bestVerifiedStreak, newVerifiedStreak),
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
  isVerified: boolean = false,
  signupDate?: Date | string
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
  const existingTodayWorkout = existingWorkouts.find((w) => w.dateString === dateString);
  const isSameDayVerifiedUpgrade = Boolean(
    existingTodayWorkout && !existingTodayWorkout.isVerified && isVerified
  );

  if (existingTodayWorkout && !isSameDayVerifiedUpgrade) {
    return {
      success: false,
      message: 'Workout already completed for today! Max 1 check-in per day.',
      updatedState: currentState,
      updatedWorkouts: existingWorkouts,
    };
  }

  // Enforce 180-minute cooldown between workouts
  if (!isSameDayVerifiedUpgrade && existingWorkouts.length > 0) {
    const lastWorkoutMs = existingWorkouts.reduce(
      (maxMs, w) => Math.max(maxMs, new Date(w.timestamp).getTime()),
      0
    );
    if (workoutDate.getTime() - lastWorkoutMs < 180 * 60 * 1000) {
      return {
        success: false,
        message: 'A new workout cannot be logged within 180 minutes of your last workout.',
        updatedState: currentState,
        updatedWorkouts: existingWorkouts,
      };
    }
  }

  let newWorkout: WorkoutSession;
  let updatedWorkouts: WorkoutSession[];
  if (isSameDayVerifiedUpgrade && existingTodayWorkout) {
    newWorkout = {
      ...existingTodayWorkout,
      isVerified: true,
      gymName,
      durationMinutes: Math.max(existingTodayWorkout.durationMinutes, durationMinutes),
      updatedAt: isoNow,
      synced: false,
    };
    updatedWorkouts = existingWorkouts.map((w) =>
      w.dateString === dateString ? newWorkout : w
    );
  } else {
    // Create new workout session with cloud-ready metadata
    newWorkout = {
      id: `workout_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: userId || currentState.userId,
      timestamp: isoNow,
      dateString,
      durationMinutes,
      verifiedByGps: true,
      isVerified,
      gymName,
      weekId,
      updatedAt: isoNow,
      synced: false,
    };
    updatedWorkouts = [newWorkout, ...existingWorkouts];
  }

  const currentWeekWorkouts = updatedWorkouts.filter((w) => w.weekId === weekId).length;
  const currentVerifiedWeekWorkouts = updatedWorkouts.filter(
    (w) => w.weekId === weekId && Boolean(w.isVerified)
  ).length;

  // Cap streak increments at the user's weekly goal so low-goal farming isn't possible.
  // Same-day verified upgrades do not double-count Personal Streak.
  let newStreak = currentState.currentStreak;
  const withinWeeklyGoalCap = currentWeekWorkouts <= preferences.weeklyGoal;
  if (!isSameDayVerifiedUpgrade && currentState.streakStatus !== 'reset' && withinWeeklyGoalCap) {
    newStreak = currentState.currentStreak + 1;
  }

  // Verified Gym Streak only increments for verified gym visits
  let newVerifiedStreak = currentState.verifiedStreak ?? 0;
  if (
    isVerified &&
    currentState.streakStatus !== 'reset' &&
    currentVerifiedWeekWorkouts <= preferences.weeklyGoal
  ) {
    newVerifiedStreak = newVerifiedStreak + 1;
  }

  const bestStreak = Math.max(currentState.bestStreak, newStreak);
  const bestVerifiedStreak = Math.max(currentState.bestVerifiedStreak ?? 0, newVerifiedStreak);

  // Re-evaluate feasibility
  const evaluated = evaluateWeeklyReset(
    {
      ...currentState,
      userId: userId || currentState.userId,
      currentStreak: newStreak,
      bestStreak,
      verifiedStreak: newVerifiedStreak,
      bestVerifiedStreak,
      currentWeekWorkouts,
      lastCompletedDate: dateString,
      lastEvaluatedWeekId: weekId,
      updatedAt: isoNow,
      synced: false,
    },
    preferences,
    updatedWorkouts,
    workoutDate,
    signupDate
  );

  return {
    success: true,
    message:
      evaluated.streakStatus === 'reset'
        ? `Workout logged! However, ${STREAK_LOST_MESSAGE}`
        : isSameDayVerifiedUpgrade
        ? `Upgraded today's workout at ${gymName} to Verified Gym! Verified Streak is now ${newVerifiedStreak} 🔥`
        : !withinWeeklyGoalCap
        ? `Workout logged at ${gymName}! Weekly streak cap (${preferences.weeklyGoal}/wk) already reached.`
        : `Workout verified at ${gymName}! Streak is now ${newStreak} 🔥`,
    updatedState: evaluated,
    newWorkout,
    updatedWorkouts,
  };
}
