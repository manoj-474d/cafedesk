-- ============================================================================
-- Cafe Desk: Subscriptions, Access Control Rules & Protected Cafe Data RLS
-- Run this migration in your Supabase Project -> SQL Editor after 001_profiles_and_rls.sql
-- ============================================================================

-- 1. Subscription Plans Catalog
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  price_inr INTEGER NOT NULL DEFAULT 0 CHECK (price_inr >= 0),
  interval_days INTEGER NOT NULL DEFAULT 30 CHECK (interval_days >= 0),
  badge_text TEXT NOT NULL DEFAULT '',
  is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  cafe_access_scope TEXT NOT NULL DEFAULT 'all' CHECK (cafe_access_scope IN ('all', 'specific')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.subscription_plans (
  id, name, tagline, price_inr, interval_days, badge_text, is_recommended, features, permissions, cafe_access_scope, active, sort_order
) VALUES
(
  'free',
  'Free Explorer',
  'Browse public Bengaluru cafe overviews, maps, and save favourites.',
  0,
  0,
  'Free Forever',
  FALSE,
  '["Browse public cafe listings & photos","Explore Bengaluru localities & map pins","Save & bookmark favourite cafes"]'::jsonb,
  '{"wifi_details":false,"power_sockets":false,"workspace_details":false,"food_menu":false,"menu_pricing":false,"amenities":false,"subscriber_benefits":false,"booking":false,"collections":false,"compare":false}'::jsonb,
  'all',
  TRUE,
  1
),
(
  'plus',
  'Cafe Desk Plus (Monthly)',
  'Full Wi-Fi speeds & credentials, charging sockets, food menus & pricing, amenities, and workspace booking.',
  79,
  30,
  'Most Popular',
  TRUE,
  '["Everything in Free Explorer","Wi-Fi availability, speed (Mbps) & network credentials","Power socket counts & ergonomic workspace details","Full food & beverage menus with INR pricing","Subscriber perks, student discounts & seat booking"]'::jsonb,
  '{"wifi_details":true,"power_sockets":true,"workspace_details":true,"food_menu":true,"menu_pricing":true,"amenities":true,"subscriber_benefits":true,"booking":true,"collections":true,"compare":true}'::jsonb,
  'all',
  TRUE,
  2
),
(
  'premium',
  'Cafe Desk Plus (Annual)',
  'Full Cafe Desk Plus access for 365 days — save 47% over monthly billing.',
  499,
  365,
  'Best Value · Save 47%',
  FALSE,
  '["All Cafe Desk Plus features unlocked for 365 days","Wi-Fi speeds, socket access & full pricing transparency","Side-by-side cafe comparison & custom collections","Priority seat booking & exclusive partner perks"]'::jsonb,
  '{"wifi_details":true,"power_sockets":true,"workspace_details":true,"food_menu":true,"menu_pricing":true,"amenities":true,"subscriber_benefits":true,"booking":true,"collections":true,"compare":true}'::jsonb,
  'all',
  TRUE,
  3
)
ON CONFLICT (id) DO NOTHING;

-- 2. User Subscriptions Table (1 active/latest row per Supabase auth user)
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT DEFAULT 'free',
  subscribed_price_inr INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due', 'suspended')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  expired_from_plan TEXT NOT NULL DEFAULT '',
  suspended_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan ON public.user_subscriptions (plan_id);

-- 3. Global Access Control Rules
CREATE TABLE IF NOT EXISTS public.access_control_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_rule TEXT NOT NULL DEFAULT 'subscription_required' CHECK (default_rule IN ('subscription_required', 'free_public')),
  sections JSONB NOT NULL DEFAULT '{"wifi_details":"subscription","power_sockets":"subscription","workspace_details":"subscription","food_menu":"subscription","menu_pricing":"subscription","amenities":"subscription","subscriber_benefits":"subscription","booking":"subscription"}'::jsonb,
  free_cafe_preview_note TEXT NOT NULL DEFAULT 'Basic cafe overview is free to browse. Subscribe to unlock Wi-Fi speeds & credentials, charging sockets, full food & beverage pricing, and workspace booking.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.access_control_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 4. Per-Cafe Access Rules (public metadata governing lock behavior)
CREATE TABLE IF NOT EXISTS public.cafe_access_rules (
  cafe_id TEXT PRIMARY KEY,
  access_rule TEXT NOT NULL DEFAULT 'inherit' CHECK (access_rule IN ('inherit', 'free_public', 'subscription_required', 'specific_plans')),
  allowed_plan_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  locked_sections_override JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Protected Cafe Details Table (STRICTLY gated behind active paid subscription RLS)
CREATE TABLE IF NOT EXISTS public.cafe_premium_details (
  cafe_id TEXT PRIMARY KEY,
  wifi_available TEXT NOT NULL DEFAULT 'unknown',
  wifi_mbps INTEGER,
  wifi_password TEXT NOT NULL DEFAULT '',
  charging_sockets TEXT NOT NULL DEFAULT 'unknown',
  sockets_count INTEGER,
  workspace_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  food_menu JSONB NOT NULL DEFAULT '[]'::jsonb,
  menu_pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
  amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
  subscriber_benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Automatically assign Free Explorer subscription row on new profile signup (never auto-grants paid access)
CREATE OR REPLACE FUNCTION public.handle_new_profile_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan_id, subscribed_price_inr, status, started_at, expires_at, auto_renew)
  VALUES (NEW.id, 'free', 0, 'active', NOW(), NULL, FALSE)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_assign_free_sub ON public.profiles;
CREATE TRIGGER on_profile_created_assign_free_sub
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_profile_subscription();

-- 7. Trigger: Block non-admin / non-service-role clients from mutating subscription status or plans
CREATE OR REPLACE FUNCTION public.guard_user_subscription_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT;
  app_role TEXT;
BEGIN
  jwt_role := COALESCE(auth.role(), '');
  app_role := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '');

  IF jwt_role <> 'service_role' AND app_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Direct subscription modification is prohibited. Complete verified payment or contact an administrator.';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_subscriptions ON public.user_subscriptions;
CREATE TRIGGER trg_guard_user_subscriptions
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_subscription_writes();

-- 8. Helper Function: Verify whether a user currently holds an active, non-expired paid subscription for a cafe
CREATE OR REPLACE FUNCTION public.user_has_active_subscription(p_user_id UUID, p_cafe_id TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule TEXT := 'inherit';
  v_allowed_plans JSONB := '[]'::jsonb;
  v_account_status TEXT;
  v_sub RECORD;
BEGIN
  IF p_cafe_id IS NOT NULL THEN
    SELECT access_rule, allowed_plan_ids
    INTO v_rule, v_allowed_plans
    FROM public.cafe_access_rules
    WHERE cafe_id = p_cafe_id;
    v_rule := COALESCE(v_rule, 'inherit');
  END IF;

  IF v_rule = 'free_public' THEN
    RETURN TRUE;
  END IF;

  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT account_status INTO v_account_status
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_account_status IS DISTINCT FROM 'active' THEN
    RETURN FALSE;
  END IF;

  SELECT us.plan_id, us.status, us.expires_at
  INTO v_sub
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_sub.plan_id = 'free' THEN
    RETURN FALSE;
  END IF;

  IF v_sub.status NOT IN ('active', 'cancelled') THEN
    RETURN FALSE;
  END IF;

  IF v_sub.expires_at IS NOT NULL AND v_sub.expires_at <= NOW() THEN
    RETURN FALSE;
  END IF;

  IF v_rule = 'specific_plans' AND jsonb_array_length(v_allowed_plans) > 0 THEN
    RETURN v_allowed_plans ? v_sub.plan_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- 9. Enable Row Level Security (RLS)
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_control_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_access_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_premium_details ENABLE ROW LEVEL SECURITY;

-- Plans & Access Rules catalog are readable publicly; writable only by admins/service_role
DROP POLICY IF EXISTS "Public read subscription plans" ON public.subscription_plans;
CREATE POLICY "Public read subscription plans"
  ON public.subscription_plans FOR SELECT
  USING (active = TRUE OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "Admins manage subscription plans" ON public.subscription_plans;
CREATE POLICY "Admins manage subscription plans"
  ON public.subscription_plans FOR ALL
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin'))
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "Public read access control settings" ON public.access_control_settings;
CREATE POLICY "Public read access control settings"
  ON public.access_control_settings FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Admins manage access control settings" ON public.access_control_settings;
CREATE POLICY "Admins manage access control settings"
  ON public.access_control_settings FOR ALL
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin'))
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "Public read cafe access rules" ON public.cafe_access_rules;
CREATE POLICY "Public read cafe access rules"
  ON public.cafe_access_rules FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Admins manage cafe access rules" ON public.cafe_access_rules;
CREATE POLICY "Admins manage cafe access rules"
  ON public.cafe_access_rules FOR ALL
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin'))
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin'));

-- Users can ONLY read their own subscription row; only admins/service_role can insert/update/delete
DROP POLICY IF EXISTS "Users read own subscription" ON public.user_subscriptions;
CREATE POLICY "Users read own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (
    auth.uid() = user_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "Admins manage user subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins manage user subscriptions"
  ON public.user_subscriptions FOR ALL
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin'))
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin'));

-- Protected Cafe Details: ONLY active non-expired paid subscribers (or free_public cafes / admins) can SELECT
DROP POLICY IF EXISTS "Subscribed users read protected cafe details" ON public.cafe_premium_details;
CREATE POLICY "Subscribed users read protected cafe details"
  ON public.cafe_premium_details FOR SELECT
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin')
    OR public.user_has_active_subscription(auth.uid(), cafe_id)
  );

DROP POLICY IF EXISTS "Admins manage protected cafe details" ON public.cafe_premium_details;
CREATE POLICY "Admins manage protected cafe details"
  ON public.cafe_premium_details FOR ALL
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin'))
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin'));

-- Explicit least-privilege grants
REVOKE ALL ON public.user_subscriptions FROM anon;
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT SELECT ON public.access_control_settings TO anon, authenticated;
GRANT SELECT ON public.cafe_access_rules TO anon, authenticated;
GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT SELECT ON public.cafe_premium_details TO anon, authenticated;
