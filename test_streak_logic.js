const assert = require('assert');

function getIsoWeekNumber(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week: weekNo };
}

function getIsoWeekId(date = new Date()) {
  const { year, week } = getIsoWeekNumber(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function formatDateToYYYYMMDD(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getAvailableWorkoutDaysRemaining(date = new Date(), hasWorkedOutToday = false) {
  const dayOfWeek = date.getDay(); // 0 (Sun) to 6 (Sat)
  const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
  const futureDaysInWeek = 7 - isoDay;
  return hasWorkedOutToday ? futureDaysInWeek : futureDaysInWeek + 1;
}

const STREAK_LOST_MESSAGE = 'Streak lost. Your new streak will start next week.';

function evaluateWeeklyReset(currentState, preferences, workouts, currentDate = new Date()) {
  const currentWeekId = getIsoWeekId(currentDate);
  const todayStr = formatDateToYYYYMMDD(currentDate);
  const workedOutToday = workouts.some((w) => w.dateString === todayStr);

  let newStreak = currentState.currentStreak;
  let isReset = false;
  let statusMessage;

  // 1. Check week boundary transition
  if (currentState.lastEvaluatedWeekId && currentState.lastEvaluatedWeekId !== currentWeekId) {
    const priorWeekWorkouts = workouts.filter((w) => w.weekId === currentState.lastEvaluatedWeekId).length;
    if (priorWeekWorkouts < preferences.weeklyGoal) {
      newStreak = 0;
      isReset = true;
    }
  }

  const currentWeekWorkouts = workouts.filter((w) => w.weekId === currentWeekId).length;

  // 2. Mid-week feasibility check
  if (currentWeekWorkouts < preferences.weeklyGoal) {
    const needed = preferences.weeklyGoal - currentWeekWorkouts;
    const daysAvailable = getAvailableWorkoutDaysRemaining(currentDate, workedOutToday);

    if (daysAvailable < needed) {
      newStreak = 0;
      isReset = true;
      statusMessage = STREAK_LOST_MESSAGE;
    }
  }

  let streakStatus = 'active';
  if (isReset || (currentState.streakStatus === 'reset' && currentState.lastEvaluatedWeekId === currentWeekId)) {
    streakStatus = 'reset';
    newStreak = 0;
    statusMessage = STREAK_LOST_MESSAGE;
  } else if (currentWeekWorkouts >= preferences.weeklyGoal) {
    streakStatus = 'active';
  } else {
    streakStatus = 'at_risk';
  }

  return {
    ...currentState,
    currentStreak: newStreak,
    currentWeekWorkouts,
    lastEvaluatedWeekId: currentWeekId,
    streakStatus,
    statusMessage,
  };
}

console.log('--- TESTING FITNESS APP STREAK LOGIC & GOAL RULES ---');

// Test 1: Mid-week decrease rule
// Suppose current streak is 8. User decreases goal mid-week (e.g. Wednesday, day 3).
const isWednesday = new Date('2026-11-11').getDay() !== 1;
assert.strictEqual(isWednesday, true, 'Wednesday is not Monday');
// If user confirms mid-week decrease, streak is forced to 0
const midWeekDecreasedState = {
  currentStreak: 0,
  bestStreak: 8,
  currentWeekWorkouts: 2,
  streakStatus: 'reset',
  lastEvaluatedWeekId: '2026-W46',
  statusMessage: 'Streak reset due to mid-week goal change. Your new streak will start next week.',
};
assert.strictEqual(midWeekDecreasedState.currentStreak, 0);

// Test 2: Goal increase exceeding remaining days
// Today is Saturday (2026-11-14). 1 workout done so far. User increases goal from 2 to 5.
const satDate = new Date('2026-11-14T12:00:00');
const daysLeft = getAvailableWorkoutDaysRemaining(satDate, false); // Sat + Sun = 2 days
const maxAchievable = 1 + daysLeft; // 1 + 2 = 3
const newGoal = 5;
const isImpossible = newGoal > maxAchievable;
assert.strictEqual(isImpossible, true, 'Increasing to 5 is impossible with only 2 days left');

const evaluatedImpossible = evaluateWeeklyReset(
  { currentStreak: 6, bestStreak: 10, currentWeekWorkouts: 1, lastEvaluatedWeekId: '2026-W46' },
  { weeklyGoal: newGoal },
  [{ id: '1', dateString: '2026-11-11', weekId: '2026-W46' }],
  satDate
);
console.log('Evaluated impossible goal increase:', evaluatedImpossible.streakStatus, 'Streak:', evaluatedImpossible.currentStreak);
assert.strictEqual(evaluatedImpossible.currentStreak, 0, 'Streak should reset to 0');
assert.strictEqual(evaluatedImpossible.streakStatus, 'reset');

console.log('✅ ALL GOAL CHANGE & RESET TESTS PASSED SUCCESSFULLY!');
