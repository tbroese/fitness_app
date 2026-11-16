-- ============================================================================
-- Portable PostgreSQL Schema for Fitness Streak Tracker (Supabase Free Tier)
-- ============================================================================
-- Why this schema is easy to migrate later:
--   1. Uses 100% standard PostgreSQL types and SQL (no proprietary extensions).
--   2. Can be exported anytime via `pg_dump` to Neon, Railway, AWS RDS, or
--      any self-hosted PostgreSQL database.
--   3. Denormalizes leaderboard stats into `leaderboard_users` so fetching the
--      leaderboard only costs 1 lightweight SELECT query (maximizing the
--      Supabase Free Tier 500 MB storage & 5 GB bandwidth limits).
-- ============================================================================

-- 1. Leaderboard Users Table (1 row per user)
CREATE TABLE IF NOT EXISTS public.leaderboard_users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  gym_id TEXT,
  gym_name TEXT,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  total_gym_time_minutes INTEGER NOT NULL DEFAULT 0,
  workouts_count INTEGER NOT NULL DEFAULT 0,
  weekly_goal INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast leaderboard sorting & gym filtering
CREATE INDEX IF NOT EXISTS idx_leaderboard_current_streak
  ON public.leaderboard_users (current_streak DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_best_streak
  ON public.leaderboard_users (best_streak DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_total_gym_time
  ON public.leaderboard_users (total_gym_time_minutes DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_gym_name
  ON public.leaderboard_users (gym_name);

-- 2. Verified Workouts Table (Optional historical workout log backup)
CREATE TABLE IF NOT EXISTS public.user_workouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.leaderboard_users(id) ON DELETE CASCADE,
  gym_name TEXT NOT NULL,
  date_string TEXT NOT NULL,
  week_id TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 15,
  verified_by_gps BOOLEAN NOT NULL DEFAULT TRUE,
  workout_timestamp TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_workouts_user_id
  ON public.user_workouts (user_id);

-- ============================================================================
-- Supabase Row Level Security (RLS) & Table Grants for Early Development
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.leaderboard_users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_workouts TO anon, authenticated;

ALTER TABLE public.leaderboard_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_workouts ENABLE ROW LEVEL SECURITY;

-- Allow anyone with the anon key to read the leaderboard
DROP POLICY IF EXISTS "Allow public read leaderboard_users" ON public.leaderboard_users;
CREATE POLICY "Allow public read leaderboard_users"
  ON public.leaderboard_users
  FOR SELECT
  USING (true);

-- Allow clients to insert/update their user row during early development
DROP POLICY IF EXISTS "Allow public upsert leaderboard_users" ON public.leaderboard_users;
CREATE POLICY "Allow public upsert leaderboard_users"
  ON public.leaderboard_users
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update leaderboard_users" ON public.leaderboard_users;
CREATE POLICY "Allow public update leaderboard_users"
  ON public.leaderboard_users
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow reading/upserting verified workouts
DROP POLICY IF EXISTS "Allow public read user_workouts" ON public.user_workouts;
CREATE POLICY "Allow public read user_workouts"
  ON public.user_workouts
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow public insert user_workouts" ON public.user_workouts;
CREATE POLICY "Allow public insert user_workouts"
  ON public.user_workouts
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update user_workouts" ON public.user_workouts;
CREATE POLICY "Allow public update user_workouts"
  ON public.user_workouts
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
