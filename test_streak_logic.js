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

console.log('--- TESTING MID-WEEK STREAK RESET & EXPIRY ---');

// Goal: 4 workouts/week
const prefs = { weeklyGoal: 4 };

// Test A: Today is Saturday (2026-11-14).
// In Week 46, user has completed only 1 workout (e.g. Wednesday).
// Remaining needed = 4 - 1 = 3 workouts.
// Saturday (today) + Sunday = 2 days available.
// 2 days available < 3 needed -> STREAK MUST RESET IMMEDIATELY!
const satDate = new Date('2026-11-14T12:00:00'); // Saturday
const activeStreakState = {
  currentStreak: 10,
  bestStreak: 15,
  currentWeekWorkouts: 1,
  lastEvaluatedWeekId: '2026-W46',
  streakStatus: 'active',
};
const weekWorkouts = [
  { id: 'w1', weekId: '2026-W46', dateString: '2026-11-11' }, // Wed
];

const resA = evaluateWeeklyReset(activeStreakState, prefs, weekWorkouts, satDate);
console.log('Result A (Saturday with 1 workout, goal 4):', resA.streakStatus, 'Streak:', resA.currentStreak);
assert.strictEqual(resA.currentStreak, 0, 'Streak should reset to 0 because less days remain than needed');
assert.strictEqual(resA.streakStatus, 'reset');
assert.strictEqual(resA.statusMessage, 'Streak lost. Your new streak will start next week.');

// Test B: Today is Tuesday (2026-11-10).
// In Week 46, user has 1 workout (Mon).
// Goal is 4, needed = 3. Days available (Tue, Wed, Thu, Fri, Sat, Sun) = 6.
// 6 >= 3 -> Streak must NOT reset!
const tueDate = new Date('2026-11-10T12:00:00'); // Tuesday
const resB = evaluateWeeklyReset(activeStreakState, prefs, weekWorkouts, tueDate);
console.log('Result B (Tuesday with 1 workout, goal 4):', resB.streakStatus, 'Streak:', resB.currentStreak);
assert.strictEqual(resB.currentStreak, 10, 'Streak should NOT reset because enough days remain');
assert.strictEqual(resB.streakStatus, 'at_risk');

console.log('✅ ALL MID-WEEK RESET TESTS PASSED!');
