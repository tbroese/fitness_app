# Fitness & Habit Streak Tracker 🏋️‍♂️🔥

A mobile application built with **React Native**, **Expo SDK 58**, and **Expo Router** that automates workout tracking using phone GPS and drives habit consistency through an accountability streak engine.

---

## 🌟 Features Implemented

1. **Weekly Goal Configuration**
   - Choose your commitment: 1 to 7 workouts per week.
   - **Goal Change Safeguards**:
     - **Decreasing Goal**: Decreasing your goal mid-week (Tuesday–Sunday) warns you that your streak will reset to 0; goal decreases should be done on Monday to preserve streaks.
     - **Increasing Goal**: Increasing your goal beyond what is mathematically possible with the days left in the week warns you that your streak will be lost.

2. **GPS Geofencing & Strict 15-Minute Dwell Verification (Anti-Cheat)**
   - Configure your gym's location (name, coordinates, geofence radius e.g. 150m).
   - "Use Current Location" button detects your exact coordinates using the device's GPS.
   - **Strict Dwell Rule**: Requires staying within the gym perimeter for a fixed **15 minutes** to automatically verify and log a workout. Manual log buttons are prohibited to prevent cheating.
   - Limits check-ins to at most 1 workout per calendar day.

3. **Habit Streak & Reset Mechanics**
   - **Visit Streak Counter**: Increments with every completed workout.
   - **Weekly Reset**: If you do not meet your chosen weekly workout goal ($X$ workouts that week), your streak resets to 0 at the end of the week. If you meet or exceed your target, your streak stays intact!
   - Real-time progress bar, weekly 7-day checklist (Mon–Sun), and "days remaining" countdown.

4. **In-App GPS & Reset Simulator**
   - Tap the **"Simulator"** button in the dashboard to test without leaving your desk:
     - Arrive at Gym (enters 10m perimeter)
     - Simulate +10 mins dwell time
     - Trigger completed workout
     - Simulate prior week missed goal (tests streak resetting to 0)
     - Simulate prior week met goal (tests streak preserved)

---

## 📂 Project Structure

```
fitness_app/
├── src/
│   ├── app/                     # Expo Router navigation
│   │   ├── _layout.tsx          # Root provider & stack
│   │   └── (tabs)/              # Tab navigators
│   │       ├── _layout.tsx      # Tab bar (Streak, Workouts, Goal)
│   │       ├── index.tsx        # Dashboard (Streaks, Calendar, Proximity)
│   │       ├── goal.tsx         # Weekly Goal & Gym Location setup
│   │       └── history.tsx      # Workout logs & GPS timestamps
│   ├── components/
│   │   ├── StreakCard.tsx       # Flame badge, streak count, risk status
│   │   ├── WeeklyProgressCard.tsx # Days checklist & progress bar
│   │   ├── GymStatusCard.tsx    # Live GPS distance & dwell timer
│   │   └── GpsSimulatorModal.tsx # Interactive test tool
│   ├── context/
│   │   └── FitnessContext.tsx   # Global state and persistence
│   ├── services/
│   │   ├── locationService.ts   # Haversine distance & geofencing
│   │   ├── streakManager.ts     # Pure streak & reset business logic
│   │   └── storageService.ts    # AsyncStorage persistence
│   ├── types/
│   │   └── fitness.ts           # TypeScript interfaces
│   └── utils/
│       └── dateUtils.ts         # ISO week & date helpers
├── test_streak_logic.js         # Unit test suite
├── app.json                     # Expo configuration & permissions
├── package.json
└── tsconfig.json
```

---

## 🚀 Running the App

### 1. Start the Development Server
```bash
npx expo start
```
- Press `a` to open in Android Emulator / device.
- Press `i` to open in iOS Simulator (macOS only).
- Press `w` to open in Web browser.
- Or scan the QR code with **Expo Go** on your physical phone!

### 2. Run Typechecking & Unit Tests
```bash
npm run typecheck    # TypeScript compiler check
npm test             # Verify streak calculations & reset logic
```
