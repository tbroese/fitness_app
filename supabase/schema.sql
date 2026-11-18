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
  user_tag TEXT NOT NULL DEFAULT LPAD((FLOOR(RANDOM() * 9000) + 1000)::INT::TEXT, 4, '0'),
  email TEXT,
  auth_provider TEXT DEFAULT 'device',
  auth_user_id TEXT,
  gender TEXT,
  age INTEGER,
  gym_id TEXT,
  gym_name TEXT,
  is_partnered BOOLEAN NOT NULL DEFAULT FALSE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  partner_streak INTEGER NOT NULL DEFAULT 0,
  best_partner_streak INTEGER NOT NULL DEFAULT 0,
  total_gym_time_minutes INTEGER NOT NULL DEFAULT 0,
  workouts_count INTEGER NOT NULL DEFAULT 0,
  weekly_goal INTEGER NOT NULL DEFAULT 1,
  squat_pr_kg DOUBLE PRECISION NOT NULL DEFAULT 0,
  bench_pr_kg DOUBLE PRECISION NOT NULL DEFAULT 0,
  deadlift_pr_kg DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast leaderboard sorting, gym filtering, and account recovery
CREATE INDEX IF NOT EXISTS idx_leaderboard_current_streak
  ON public.leaderboard_users (current_streak DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_best_streak
  ON public.leaderboard_users (best_streak DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_total_gym_time
  ON public.leaderboard_users (total_gym_time_minutes DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_gym_name
  ON public.leaderboard_users (gym_name);

CREATE INDEX IF NOT EXISTS idx_leaderboard_users_email
  ON public.leaderboard_users (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_leaderboard_users_auth_user_id
  ON public.leaderboard_users (auth_user_id);

CREATE INDEX IF NOT EXISTS idx_leaderboard_users_tag
  ON public.leaderboard_users (user_tag);

-- 2. Verified Workouts Table (Historical workout log backup)
CREATE TABLE IF NOT EXISTS public.user_workouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.leaderboard_users(id) ON DELETE CASCADE,
  gym_name TEXT NOT NULL,
  date_string TEXT NOT NULL,
  week_id TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 15,
  verified_by_gps BOOLEAN NOT NULL DEFAULT TRUE,
  is_partnered BOOLEAN NOT NULL DEFAULT FALSE,
  workout_timestamp TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_workouts_user_id
  ON public.user_workouts (user_id);

-- 3. Mutual Friend Requests Table
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES public.leaderboard_users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES public.leaderboard_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_friend_request_pair UNIQUE (requester_id, receiver_id),
  CONSTRAINT chk_no_self_friend CHECK (requester_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_requester_status
  ON public.friend_requests (requester_id, status);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_status
  ON public.friend_requests (receiver_id, status);

-- ============================================================================
-- Supabase Row Level Security (RLS) & Table Grants for Early Development
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leaderboard_users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_workouts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO anon, authenticated;

ALTER TABLE public.leaderboard_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
