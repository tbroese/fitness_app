const assert = require('assert');

// 1. ISO Week calculation
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

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

function evaluateWeeklyReset(currentState, preferences, workouts, currentDate = new Date()) {
  const currentWeekId = getIsoWeekId(currentDate);

  if (!currentState.lastEvaluatedWeekId) {
    const workoutsThisWeek = workouts.filter((w) => w.weekId === currentWeekId).length;
    return {
      ...currentState,
      currentWeekWorkouts: workoutsThisWeek,
      lastEvaluatedWeekId: currentWeekId,
      streakStatus: workoutsThisWeek >= preferences.weeklyGoal ? 'active' : 'at_risk',
    };
  }

  if (currentState.lastEvaluatedWeekId !== currentWeekId) {
    const lastEvaluatedWeek = currentState.lastEvaluatedWeekId;
    const priorWeekWorkouts = workouts.filter((w) => w.weekId === lastEvaluatedWeek).length;

    let newStreak = currentState.currentStreak;
    let isReset = false;

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
      streakStatus: isReset ? 'reset' : 'active',
    };
  }

  const currentWeekWorkouts = workouts.filter((w) => w.weekId === currentWeekId).length;
  return {
    ...currentState,
    currentWeekWorkouts,
    streakStatus: currentWeekWorkouts >= preferences.weeklyGoal ? 'active' : 'at_risk',
  };
}

console.log('--- RUNNING FITNESS STREAK & GPS TESTS ---');

// Test 1: Distance Calculation
const gymLat = 37.7749;
const gymLon = -122.4194;
// Point ~100m away
const nearLat = 37.7758;
const nearLon = -122.4194;
const dist = calculateDistanceMeters(gymLat, gymLon, nearLat, nearLon);
console.log(`Test 1 (GPS Distance): Distance is ${dist}m (expected ~100m)`);
assert(dist > 80 && dist < 120, 'Distance should be approximately 100 meters');

// Test 2: Streak Reset when Goal is Missed
const prefs = { weeklyGoal: 4 };
const initialStreakState = {
  currentStreak: 12, // 12 workouts streak
  bestStreak: 15,
  currentWeekWorkouts: 2,
  lastEvaluatedWeekId: '2026-W45',
};

// Only 2 workouts logged in Week 45 (< goal of 4)
const priorWorkouts = [
  { id: '1', weekId: '2026-W45', dateString: '2026-11-03' },
  { id: '2', weekId: '2026-W45', dateString: '2026-11-05' },
];

// Transition to Week 46 (e.g. 2026-11-14)
const evalDate = new Date('2026-11-14T10:00:00Z');
const evaluatedState = evaluateWeeklyReset(initialStreakState, prefs, priorWorkouts, evalDate);

console.log(`Test 2 (Weekly Reset on Missed Goal): Streak reset to ${evaluatedState.currentStreak}`);
assert.strictEqual(evaluatedState.currentStreak, 0, 'Streak should reset to 0 when prior week workouts < goal');
assert.strictEqual(evaluatedState.streakStatus, 'reset');

// Test 3: Streak Preserved when Goal is Met
const priorWorkoutsMet = [
  { id: '1', weekId: '2026-W45', dateString: '2026-11-03' },
  { id: '2', weekId: '2026-W45', dateString: '2026-11-04' },
  { id: '3', weekId: '2026-W45', dateString: '2026-11-06' },
  { id: '4', weekId: '2026-W45', dateString: '2026-11-07' },
];
const evaluatedMetState = evaluateWeeklyReset(initialStreakState, prefs, priorWorkoutsMet, evalDate);
console.log(`Test 3 (Weekly Goal Met): Streak preserved at ${evaluatedMetState.currentStreak}`);
assert.strictEqual(evaluatedMetState.currentStreak, 12, 'Streak should remain 12 when goal met');

console.log('✅ ALL TESTS PASSED SUCCESSFULLY!');
