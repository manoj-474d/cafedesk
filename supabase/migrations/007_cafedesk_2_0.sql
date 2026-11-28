-- ============================================================================
-- Cafe Desk 2.0: Community Trust, Personalisation, Owner Ecosystem & Controls
-- Additive migration safe to run after 001..006.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cafe_reviews (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cafe_id TEXT NOT NULL DEFAULT '',
  cafe_key TEXT NOT NULL,
  cafe_name TEXT NOT NULL,
  user_id BIGINT NOT NULL,
  author_name TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  visit_purpose TEXT NOT NULL DEFAULT 'coffee_food',
  wifi_confirmed TEXT NOT NULL DEFAULT 'unknown',
  sockets_confirmed TEXT NOT NULL DEFAULT 'unknown',
  noise_observed SMALLINT,
  review_text TEXT NOT NULL,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  moderation_status TEXT NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  content_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.community_contributions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cafe_id TEXT NOT NULL DEFAULT '',
  cafe_key TEXT NOT NULL,
  cafe_name TEXT NOT NULL,
  user_id BIGINT NOT NULL,
  contributor_name TEXT NOT NULL,
  contribution_type TEXT NOT NULL CHECK (contribution_type IN ('photo', 'menu_price', 'facility_update')),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  photo_url TEXT NOT NULL DEFAULT '',
  points_awarded INTEGER NOT NULL DEFAULT 0,
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  reviewer_note TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_points_ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_type TEXT NOT NULL DEFAULT '',
  reference_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cafe_follows (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  cafe_key TEXT NOT NULL,
  cafe_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, cafe_key)
);

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  cafe_key TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id BIGINT PRIMARY KEY,
  favourite_areas_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  favourite_categories_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_max_budget INTEGER,
  personalisation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  public_profile_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  save_visit_history BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_visit_checklists (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  cafe_key TEXT NOT NULL,
  checklist_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  feedback_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  visited_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, cafe_key)
);

CREATE TABLE IF NOT EXISTS public.cafe_owners (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  business_name TEXT NOT NULL DEFAULT '',
  owner_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  plan_tier TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cafe_claim_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cafe_id TEXT NOT NULL,
  cafe_name TEXT NOT NULL,
  user_id BIGINT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  verification_proof TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.owner_change_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cafe_id TEXT NOT NULL,
  user_id BIGINT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('cafe_info', 'menu_update', 'offer', 'photo')),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.cafe_promotions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cafe_id TEXT NOT NULL,
  cafe_name TEXT NOT NULL,
  owner_user_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  badge_label TEXT NOT NULL DEFAULT 'Sponsored',
  placement TEXT NOT NULL DEFAULT 'homepage' CHECK (placement IN ('homepage', 'category', 'city')),
  area TEXT NOT NULL DEFAULT '',
  budget_inr INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'ended', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pg_cafe_reviews_key_status ON public.cafe_reviews (cafe_key, moderation_status);
CREATE INDEX IF NOT EXISTS idx_pg_contrib_key_status ON public.community_contributions (cafe_key, moderation_status);
CREATE INDEX IF NOT EXISTS idx_pg_user_notifications_user ON public.user_notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pg_claims_status ON public.cafe_claim_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pg_owner_changes_status ON public.owner_change_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pg_promotions_status ON public.cafe_promotions (status, starts_at, ends_at);

ALTER TABLE public.cafe_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_visit_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_claim_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read approved cafe_reviews" ON public.cafe_reviews;
CREATE POLICY "Public read approved cafe_reviews"
  ON public.cafe_reviews FOR SELECT
  USING (moderation_status = 'approved');

DROP POLICY IF EXISTS "Public read approved contributions" ON public.community_contributions;
CREATE POLICY "Public read approved contributions"
  ON public.community_contributions FOR SELECT
  USING (moderation_status = 'approved');

DROP POLICY IF EXISTS "Public read active promotions" ON public.cafe_promotions;
CREATE POLICY "Public read active promotions"
  ON public.cafe_promotions FOR SELECT
  USING (status = 'active');

GRANT SELECT ON public.cafe_reviews TO anon, authenticated;
GRANT SELECT ON public.community_contributions TO anon, authenticated;
GRANT SELECT ON public.cafe_promotions TO anon, authenticated;
