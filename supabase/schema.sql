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
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 30),
  user_tag TEXT NOT NULL DEFAULT LPAD((FLOOR(RANDOM() * 9000) + 1000)::INT::TEXT, 4, '0'),
  email TEXT,
  auth_provider TEXT DEFAULT 'device',
  auth_user_id TEXT,
  gender TEXT,
  age INTEGER,
  gym_id TEXT,
  gym_name TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  verified_streak INTEGER NOT NULL DEFAULT 0,
  best_verified_streak INTEGER NOT NULL DEFAULT 0,
  total_gym_time_minutes INTEGER NOT NULL DEFAULT 0,
  workouts_count INTEGER NOT NULL DEFAULT 0,
  weekly_goal INTEGER NOT NULL DEFAULT 2,
  squat_pr_kg DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (squat_pr_kg BETWEEN 0 AND 550),
  bench_pr_kg DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (bench_pr_kg BETWEEN 0 AND 550),
  deadlift_pr_kg DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (deadlift_pr_kg BETWEEN 0 AND 550),
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
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
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

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 4. Gyms Directory Table (CA / US Gyms)
CREATE TABLE IF NOT EXISTS public.gyms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT TRUE,
  is_partnered BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'osm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gyms_name_trgm
  ON public.gyms USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_gyms_address_trgm
  ON public.gyms USING gin (address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_gyms_state
  ON public.gyms (state);

CREATE INDEX IF NOT EXISTS idx_gyms_lat_lon
  ON public.gyms (latitude, longitude);

-- 5. User-Submitted Gym Reports Table (Moved, Closed, or Missing Gyms)
CREATE TABLE IF NOT EXISTS public.gym_reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT,
  auth_user_id TEXT,
  gym_id TEXT,
  gym_name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('moved', 'closed', 'missing')),
  suggested_address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gym_reports_status
  ON public.gym_reports (status, created_at DESC);

-- 6. User-Submitted Bug Reports Table
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT,
  auth_user_id TEXT,
  category TEXT NOT NULL CHECK (category IN ('ui', 'location', 'sync', 'other')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  app_version TEXT,
  platform TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_status
  ON public.bug_reports (status, created_at DESC);

-- 7. Partnered Gym Applications (Website /partners -> Stripe Checkout)
CREATE TABLE IF NOT EXISTS public.partner_applications (
  id TEXT PRIMARY KEY,
  gym_id TEXT,
  gym_name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  owner_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  phone TEXT,
  stripe_session_id TEXT,
  stripe_customer_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_applications_status
  ON public.partner_applications (payment_status, created_at DESC);

-- 8. Gym Owners Portal Accounts (linked to Supabase Auth + Stripe Subscription)
CREATE TABLE IF NOT EXISTS public.gym_owners (
  id TEXT PRIMARY KEY,
  auth_user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  gym_id TEXT NOT NULL,
  gym_name TEXT NOT NULL,
  stripe_customer_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gym_owners_auth_user_id
  ON public.gym_owners (auth_user_id);

CREATE INDEX IF NOT EXISTS idx_gym_owners_gym_id
  ON public.gym_owners (gym_id);

-- 9. PR Verification Submissions (User submits -> Gym Owner approves/rejects)
CREATE TABLE IF NOT EXISTS public.pr_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  auth_user_id TEXT,
  user_name TEXT NOT NULL,
  gym_id TEXT,
  gym_name TEXT NOT NULL,
  lift_type TEXT NOT NULL CHECK (lift_type IN ('squat', 'bench', 'deadlift')),
  weight_kg DOUBLE PRECISION NOT NULL CHECK (weight_kg > 0 AND weight_kg <= 550),
  video_url TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pr_verifications_gym_status
  ON public.pr_verifications (gym_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pr_verifications_user_id
  ON public.pr_verifications (user_id, created_at DESC);

-- ============================================================================
-- Supabase Row Level Security (RLS) & Table Grants (Production)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.gyms TO anon, authenticated;
GRANT INSERT ON public.gym_reports TO authenticated;
GRANT INSERT ON public.bug_reports TO authenticated;
GRANT SELECT ON public.gym_owners TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pr_verifications TO authenticated;
GRANT SELECT ON public.leaderboard_users TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.leaderboard_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_workouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO authenticated;

ALTER TABLE public.leaderboard_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gyms are publicly readable" ON public.gyms;
CREATE POLICY "Gyms are publicly readable"
  ON public.gyms FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER TABLE public.gym_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can submit gym reports" ON public.gym_reports;
CREATE POLICY "Users can submit gym reports"
  ON public.gym_reports FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid())::text = auth_user_id);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can submit bug reports" ON public.bug_reports;
CREATE POLICY "Users can submit bug reports"
  ON public.bug_reports FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid())::text = auth_user_id);

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.gym_owners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gym owners can read own profile" ON public.gym_owners;
CREATE POLICY "Gym owners can read own profile"
  ON public.gym_owners FOR SELECT
  TO authenticated
  USING ((select auth.uid())::text = auth_user_id);

ALTER TABLE public.pr_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can submit own PR verifications" ON public.pr_verifications;
CREATE POLICY "Users can submit own PR verifications"
  ON public.pr_verifications FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid())::text = auth_user_id);

DROP POLICY IF EXISTS "Users can view own PR verifications" ON public.pr_verifications;
CREATE POLICY "Users can view own PR verifications"
  ON public.pr_verifications FOR SELECT
  TO authenticated
  USING (
    (select auth.uid())::text = auth_user_id
    OR EXISTS (
      SELECT 1 FROM public.gym_owners go
      WHERE go.auth_user_id = (select auth.uid())::text
        AND go.gym_id = pr_verifications.gym_id
        AND go.subscription_status IN ('active', 'trialing')
    )
  );

DROP POLICY IF EXISTS "Gym owners can review PR verifications" ON public.pr_verifications;
CREATE POLICY "Gym owners can review PR verifications"
  ON public.pr_verifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gym_owners go
      WHERE go.auth_user_id = (select auth.uid())::text
        AND go.gym_id = pr_verifications.gym_id
        AND go.subscription_status IN ('active', 'trialing')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gym_owners go
      WHERE go.auth_user_id = (select auth.uid())::text
        AND go.gym_id = pr_verifications.gym_id
        AND go.subscription_status IN ('active', 'trialing')
    )
  );

-- leaderboard_users: public leaderboard reads; owners can insert/update/delete only their own row
DROP POLICY IF EXISTS "Allow public read leaderboard_users" ON public.leaderboard_users;
DROP POLICY IF EXISTS "Allow public upsert leaderboard_users" ON public.leaderboard_users;
DROP POLICY IF EXISTS "Allow public update leaderboard_users" ON public.leaderboard_users;
DROP POLICY IF EXISTS "Allow public delete leaderboard_users" ON public.leaderboard_users;

CREATE POLICY "Leaderboard is readable by app users"
  ON public.leaderboard_users FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can insert own leaderboard profile"
  ON public.leaderboard_users FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid())::text = auth_user_id);

CREATE POLICY "Users can update own leaderboard profile"
  ON public.leaderboard_users FOR UPDATE
  TO authenticated
  USING ((select auth.uid())::text = auth_user_id)
  WITH CHECK ((select auth.uid())::text = auth_user_id);

CREATE POLICY "Users can delete own leaderboard profile"
  ON public.leaderboard_users FOR DELETE
  TO authenticated
  USING ((select auth.uid())::text = auth_user_id);

-- user_workouts: only the owning user can read/insert/update/delete their workouts
DROP POLICY IF EXISTS "Allow public read user_workouts" ON public.user_workouts;
DROP POLICY IF EXISTS "Allow public insert user_workouts" ON public.user_workouts;
DROP POLICY IF EXISTS "Allow public update user_workouts" ON public.user_workouts;
DROP POLICY IF EXISTS "Allow public delete user_workouts" ON public.user_workouts;

CREATE POLICY "Users can read own workouts"
  ON public.user_workouts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboard_users u
      WHERE u.id = user_id AND u.auth_user_id = (select auth.uid())::text
    )
  );

CREATE POLICY "Users can insert own workouts"
  ON public.user_workouts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leaderboard_users u
      WHERE u.id = user_id AND u.auth_user_id = (select auth.uid())::text
    )
  );

CREATE POLICY "Users can update own workouts"
  ON public.user_workouts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboard_users u
      WHERE u.id = user_id AND u.auth_user_id = (select auth.uid())::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leaderboard_users u
      WHERE u.id = user_id AND u.auth_user_id = (select auth.uid())::text
    )
  );

CREATE POLICY "Users can delete own workouts"
  ON public.user_workouts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboard_users u
      WHERE u.id = user_id AND u.auth_user_id = (select auth.uid())::text
    )
  );

-- friend_requests: only requester or receiver can view/modify their friend requests
DROP POLICY IF EXISTS "Allow public read friend_requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Allow public insert friend_requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Allow public update friend_requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Allow public delete friend_requests" ON public.friend_requests;

CREATE POLICY "Users can read own friend requests"
  ON public.friend_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboard_users u
      WHERE (u.id = requester_id OR u.id = receiver_id)
        AND u.auth_user_id = (select auth.uid())::text
    )
  );

CREATE POLICY "Users can send friend requests as themselves"
  ON public.friend_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leaderboard_users u
      WHERE u.id = requester_id AND u.auth_user_id = (select auth.uid())::text
    )
  );

CREATE POLICY "Users can update own friend requests"
  ON public.friend_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboard_users u
      WHERE (u.id = requester_id OR u.id = receiver_id)
        AND u.auth_user_id = (select auth.uid())::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leaderboard_users u
      WHERE (u.id = requester_id OR u.id = receiver_id)
        AND u.auth_user_id = (select auth.uid())::text
    )
  );

CREATE POLICY "Users can delete own friend requests"
  ON public.friend_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboard_users u
      WHERE (u.id = requester_id OR u.id = receiver_id)
        AND u.auth_user_id = (select auth.uid())::text
    )
  );
