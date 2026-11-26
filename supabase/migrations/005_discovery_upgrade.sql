-- ============================================================================
-- Cafe Desk: Local Discovery Upgrade, Community Corrections & Explorer Badges
-- Run this additive migration in Supabase SQL Editor after 001..004.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.community_corrections (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cafe_key TEXT NOT NULL,
  cafe_name TEXT NOT NULL,
  issue_type TEXT NOT NULL CHECK (
    issue_type IN (
      'wrong_address',
      'closed_business',
      'changed_hours',
      'incorrect_phone',
      'missing_business',
      'incorrect_category'
    )
  ),
  details TEXT NOT NULL DEFAULT '',
  suggested_value TEXT NOT NULL DEFAULT '',
  reporter_name TEXT NOT NULL DEFAULT '',
  reporter_email TEXT NOT NULL DEFAULT '',
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'resolved')),
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_corrections_status
  ON public.community_corrections (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS public.explorer_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('view_place', 'compare_places', 'work_mood')),
  target_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, event_type, target_key)
);

CREATE TABLE IF NOT EXISTS public.places_api_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  endpoint TEXT NOT NULL,
  query_text TEXT NOT NULL DEFAULT '',
  status_code INTEGER NOT NULL DEFAULT 200,
  cached BOOLEAN NOT NULL DEFAULT FALSE,
  result_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.community_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.explorer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places_api_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own corrections" ON public.community_corrections;
CREATE POLICY "Users read own corrections"
  ON public.community_corrections FOR SELECT
  USING (
    auth.uid() = user_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "Users read own achievements" ON public.user_achievements;
CREATE POLICY "Users read own achievements"
  ON public.user_achievements FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own explorer events" ON public.explorer_events;
CREATE POLICY "Users read own explorer events"
  ON public.explorer_events FOR SELECT
  USING (auth.uid() = user_id);

REVOKE ALL ON public.places_api_logs FROM anon, authenticated;
GRANT SELECT ON public.community_corrections TO authenticated;
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT SELECT ON public.explorer_events TO authenticated;
