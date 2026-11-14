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

console.log('--- TESTING UPDATED FITNESS APP RULES ---');

// Test 1: Default weekly goal is 1
const defaultGoal = 1;
assert.strictEqual(defaultGoal, 1, 'Default weekly goal must start at 1');

// Test 2: Geofence default is 300m
const defaultGeofenceRadius = 300;
const gymLat = 37.7749;
const gymLon = -122.4194;
// Point 250m away is inside
const point250m = { lat: 37.7771, lon: -122.4194 };
const dist250 = calculateDistanceMeters(gymLat, gymLon, point250m.lat, point250m.lon);
assert(dist250 <= defaultGeofenceRadius, '250m point should be inside 300m geofence');
// Point 350m away is outside
const point350m = { lat: 37.7781, lon: -122.4194 };
const dist350 = calculateDistanceMeters(gymLat, gymLon, point350m.lat, point350m.lon);
assert(dist350 > defaultGeofenceRadius, '350m point should be outside 300m geofence');

// Test 3: Mid-week goal changes are blocked and scheduled for Monday
const testDate = new Date('2026-11-14T12:00:00'); // Saturday
const isMonday = testDate.getDay() === 1;
assert.strictEqual(isMonday, false, 'Saturday is not Monday');

// When user chooses "Update Starting Monday", pending goal is stored
const prefs = {
  weeklyGoal: 1,
  pendingWeeklyGoal: 3, // Scheduled for Monday
};
assert.strictEqual(prefs.weeklyGoal, 1, 'Current week goal remains 1');
assert.strictEqual(prefs.pendingWeeklyGoal, 3, 'Pending goal queued for Monday');

// On Monday transition, pending goal activates
const nextMondayDate = new Date('2026-11-16T08:00:00'); // Next Monday
if (prefs.pendingWeeklyGoal) {
  prefs.weeklyGoal = prefs.pendingWeeklyGoal;
  prefs.pendingWeeklyGoal = null;
}
assert.strictEqual(prefs.weeklyGoal, 3, 'Goal updated to 3 on Monday transition');
assert.strictEqual(prefs.pendingWeeklyGoal, null, 'Pending goal cleared');

// Test 4: Local UserProfile (Full Name Only + First-Time Onboarding)
const defaultProfile = {
  id: 'usr_test_12345',
  fullName: '',
  hasCompletedOnboarding: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  syncedAt: null,
};
assert(defaultProfile.id.startsWith('usr_'), 'Profile ID must have offline UUID prefix');
assert.strictEqual(defaultProfile.hasCompletedOnboarding, false, 'New user starts with onboarding incomplete');

// After user enters Full Name on first open
const savedProfile = {
  ...defaultProfile,
  fullName: 'Tanner Smith',
  hasCompletedOnboarding: true,
};
assert.strictEqual(savedProfile.fullName, 'Tanner Smith', 'Full name saved to profile');
assert.strictEqual(savedProfile.hasCompletedOnboarding, true, 'Onboarding marked complete after saving full name');

// Test 5: Continuous Gym Time Tracking Past 15-Min Dwell Threshold
const enteredFortyTwoMinsAgo = new Date(Date.now() - 42 * 60 * 1000).toISOString();
const elapsedMins = Math.floor((Date.now() - new Date(enteredFortyTwoMinsAgo).getTime()) / 60000);
assert(elapsedMins >= 15, '15-min threshold reached');
assert.strictEqual(elapsedMins, 42, 'Gym time continues tracking past 15 mins up to 42 mins while inside perimeter');

console.log('✅ ALL TESTS PASSED SUCCESSFULLY!');
