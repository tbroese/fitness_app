# Inertia

A gym consistency and streak-tracking mobile application built with **React Native**, **Expo SDK 58**, **Expo Router**, and **Supabase**. Inertia verifies gym visits via GPS geofencing (or manual check-in/out for home gyms) and powers global, gym, and friend leaderboards.

---

## Features

1. **Weekly Goal Configuration**
   - **Default Target:** Starts at **1 workout per week** (configurable 1–7).
   - **Mid-Week Adjustment Lock:** Immediate mid-week goal changes are disallowed; users can cancel or schedule updates to take effect the following Monday.

2. **Dual Streaks & Accountability Engine**
   - **Personal Streak & Verified Gym Streak:** Tracks both overall consistency (any gym) and verified partnered-gym streaks.
   - **Segmented Weekly Progress Bar:** Displays verified gym visits (green) and custom gym visits (blue) side-by-side against the weekly goal, with daily Mon–Sun checkmarks.
   - **Same-Day Partner Upgrade:** Completing a 15-minute session at a partnered gym after an earlier custom gym visit upgrades that day's workout to verified without double-counting the Personal Streak.
   - **Midnight & Cooldown Rules:** Sessions arriving before midnight credit the arrival day across midnight, with a 180-minute cooldown before a new workout can be logged.

3. **US Gyms Directory & Flexible Tracking**
   - **22,009+ US Gyms:** Backed by Supabase `public.gyms` (`pg_trgm` search across all 50 states + DC), with silent closest-first distance sorting (`mi away`) when foreground location permission is already granted.
   - **GPS Geofencing & 15-Minute Dwell:** 150m perimeter with foreground & background (`expo-task-manager`) dwell tracking and prominent background location disclosure.
   - **Manual Check-In / Check-Out (Home Gyms):** Custom gyms support manual check-in/check-out for home gyms or locations without GPS, with automatic checkout after 180 minutes.

4. **Workout History, Profile & Leaderboards**
   - **History & Contribution Heatmap:** Multi-week activity graph and per-session logs formatted in hours and minutes.
   - **Profile & PRs:** Track Squat, Bench, and Deadlift PRs (`lbs` / `kg`), optional age and gender for leaderboard filtering, Privacy Policy link, and in-app **Delete Account**.
   - **Leaderboards & Friends:** Compete across Global, Gym, and Friends tabs with sorting by Current Streak, Best Streak, Gym Time, and Strength PRs, plus mutual friend requests.

5. **Offline-First Cloud Sync & Security**
   - Local persistence via `AsyncStorage` queues workouts offline and syncs to Supabase (`leaderboard_users`, `user_workouts`, `friend_requests`).
   - Supports **Google Sign-In** (Supabase OAuth) and **Continue without Google** (Supabase Anonymous Auth) with `auth.uid()` Row-Level Security policies.

---

## Project Structure

```text
fitness_app/
├── assets/                          # App icon, 512x512 Play Store icon, feature graphic
├── docs/
│   └── privacy-policy.html          # Public GitHub Pages Privacy Policy
├── scripts/
│   ├── fetch_ca_gyms.js             # Overpass API California gym extractor
│   ├── enrich_ca_gyms.js            # Reverse-geocoding backfill for CA gyms
│   ├── fetch_us_gyms.js             # Overpass API 50-state + DC extractor
│   └── enrich_us_gyms.js            # Reverse-geocoding backfill for US gyms
├── src/
│   ├── app/
│   │   ├── _layout.tsx              # Root stack & FitnessProvider
│   │   └── (tabs)/
│   │       ├── _layout.tsx          # Swipe-enabled tab navigator
│   │       ├── index.tsx            # Streak dashboard & gym status
│   │       ├── history.tsx          # Workout history & contribution graph
│   │       ├── leaderboard.tsx      # Global, Gym & Friends leaderboards
│   │       ├── goal.tsx             # Weekly goal & gym setup
│   │       └── profile.tsx          # Athlete profile, PRs, Privacy Policy & Delete Account
│   ├── components/                  # Cards, modals, charts, and sliders
│   ├── constants/                   # Theme colors, config flags, fallback gyms
│   ├── context/FitnessContext.tsx   # Global app state, OAuth, GPS & cloud sync
│   ├── services/
│   │   ├── cloud/                   # CloudDatabaseProvider & SupabaseDatabaseProvider
│   │   ├── locationService.ts       # Geofencing, permissions & Haversine helpers
│   │   ├── storageService.ts        # AsyncStorage persistence & dwell evaluation
│   │   └── streakManager.ts         # Streak, cooldown & weekly reset logic
│   ├── types/fitness.ts             # TypeScript interfaces & constants
│   └── utils/                       # Date, duration & weight unit helpers
├── supabase/
│   ├── schema.sql                   # Tables, indexes & production RLS policies
│   ├── ca_gyms_seed.sql             # California gym seed SQL
│   └── us_gyms/                     # Chunked US gym seed SQL files (01–08)
├── app.json                         # Expo config, permissions & splash/icon
├── eas.json                         # EAS Build profiles (development, preview, production)
├── test_streak_logic.js             # Streak & reset unit tests
└── LICENSE                          # Proprietary All Rights Reserved license
```

---

## Running & Building

### 1. Start Development Server
```bash
npx expo start
```

### 2. Typecheck & Unit Tests
```bash
npm run typecheck    # npx tsc --noEmit
npm test             # node test_streak_logic.js
```

### 3. Supabase & OAuth Setup
- Run [supabase/schema.sql](supabase/schema.sql) and `supabase/us_gyms/us_gyms_part_01.sql`–`08.sql` in **Supabase → SQL Editor**.
- Enable **Allow anonymous sign-ins** in **Supabase → Authentication**.
- Set **Site URL** to `fitnesstracker://auth-callback` / 'exp://192.168.50.188:8081/--/auth-callback' (and keep `exp://**` in **Redirect URLs** for local Expo Go dev).

### 4. EAS Android Builds
```bash
eas build -p android --profile preview     # Standalone .apk for device testing
eas build -p android --profile production  # Signed .aab for Google Play Console
```

---

## License

All Rights Reserved — see [LICENSE](LICENSE).
