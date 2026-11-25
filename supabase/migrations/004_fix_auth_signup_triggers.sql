-- ============================================================================
-- Cafe Desk: Fix "Database error saving new user" on Google OAuth / Email Signup
-- Run this script once in Supabase Dashboard -> SQL Editor.
-- Safe and idempotent: preserves all existing profiles & active subscriptions.
-- ============================================================================

-- 1. Allow Supabase Auth triggers (session_user = supabase_auth_admin / postgres)
--    to update verified profile fields cleanly.
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT;
  app_role TEXT;
  sess_user TEXT;
BEGIN
  jwt_role := COALESCE(auth.role(), '');
  app_role := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '');
  sess_user := COALESCE(session_user, '');

  IF sess_user NOT IN ('postgres', 'supabase_auth_admin', 'supabase_admin', 'service_role')
     AND jwt_role <> 'service_role'
     AND app_role NOT IN ('admin', 'super_admin') THEN
    NEW.account_status := OLD.account_status;
    NEW.email_verified := OLD.email_verified;
    NEW.auth_provider := OLD.auth_provider;
    NEW.email := OLD.email;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Harden new-user profile creation trigger against empty emails or stale orphaned rows.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_name TEXT;
  meta_phone TEXT;
  meta_avatar TEXT;
  meta_provider TEXT;
  resolved_email TEXT;
BEGIN
  resolved_email := COALESCE(
    NULLIF(LOWER(TRIM(COALESCE(NEW.email, ''))), ''),
    CONCAT(NEW.id::text, '@noemail.cafedesk.local')
  );
  meta_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'), ''),
    SPLIT_PART(resolved_email, '@', 1),
    'Cafe Desk Member'
  );
  meta_phone := COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone, '');
  meta_avatar := COALESCE(
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'picture',
    ''
  );
  meta_provider := COALESCE(NEW.raw_app_meta_data ->> 'provider', 'email');

  DELETE FROM public.profiles p
  WHERE LOWER(p.email) = resolved_email
    AND p.id <> NEW.id
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone,
    avatar_url,
    auth_provider,
    email_verified,
    account_status,
    last_login_at,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    meta_name,
    resolved_email,
    meta_phone,
    meta_avatar,
    CASE WHEN meta_provider = 'google' THEN 'google' ELSE 'email' END,
    (NEW.email_confirmed_at IS NOT NULL OR meta_provider = 'google'),
    'active',
    NEW.last_sign_in_at,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    email = CASE WHEN EXCLUDED.email <> '' THEN EXCLUDED.email ELSE public.profiles.email END,
    phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE public.profiles.phone END,
    avatar_url = CASE WHEN EXCLUDED.avatar_url <> '' THEN EXCLUDED.avatar_url ELSE public.profiles.avatar_url END,
    email_verified = (NEW.email_confirmed_at IS NOT NULL OR meta_provider = 'google' OR public.profiles.email_verified),
    last_login_at = COALESCE(NEW.last_sign_in_at, public.profiles.last_login_at),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- 3. Mark internal Free Explorer initialization with a transaction-local GUC
--    so the subscription write guard allows new signups while blocking direct client tampering.
CREATE OR REPLACE FUNCTION public.handle_new_profile_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscription_plans (
    id, name, tagline, price_inr, interval_days, badge_text, is_recommended, features, permissions, cafe_access_scope, active, sort_order
  ) VALUES (
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
  )
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('cafedesk.internal_free_sub_init', '1', true);

  INSERT INTO public.user_subscriptions (
    user_id, plan_id, subscribed_price_inr, status, started_at, expires_at, auto_renew
  )
  VALUES (NEW.id, 'free', 0, 'active', NOW(), NULL, FALSE)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM set_config('cafedesk.internal_free_sub_init', '', true);
  RETURN NEW;
END;
$$;

-- 4. Fix trg_guard_user_subscriptions:
--    Previously failed with "Database error saving new user" because Supabase Auth
--    runs auth.users triggers as supabase_auth_admin where auth.role() is empty.
CREATE OR REPLACE FUNCTION public.guard_user_subscription_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT;
  app_role TEXT;
  sess_user TEXT;
  internal_free_init TEXT;
BEGIN
  jwt_role := COALESCE(auth.role(), '');
  app_role := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '');
  sess_user := COALESCE(session_user, '');
  internal_free_init := COALESCE(current_setting('cafedesk.internal_free_sub_init', true), '');

  IF sess_user IN ('postgres', 'supabase_auth_admin', 'supabase_admin', 'service_role')
     OR jwt_role = 'service_role'
     OR app_role IN ('admin', 'super_admin')
     OR (
       internal_free_init = '1'
       AND TG_OP = 'INSERT'
       AND NEW.plan_id = 'free'
       AND COALESCE(NEW.subscribed_price_inr, 0) = 0
     ) THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Direct subscription modification is prohibited. Complete verified payment or contact an administrator.';
END;
$$;

-- 5. Backfill any auth.users missing a profile or free subscription row.
INSERT INTO public.profiles (
  id, full_name, email, phone, avatar_url, auth_provider, email_verified, account_status, last_login_at, created_at, updated_at
)
SELECT
  u.id,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data ->> 'name'), ''),
    SPLIT_PART(COALESCE(u.email, u.id::text), '@', 1),
    'Cafe Desk Member'
  ),
  COALESCE(NULLIF(LOWER(TRIM(COALESCE(u.email, ''))), ''), CONCAT(u.id::text, '@noemail.cafedesk.local')),
  COALESCE(u.raw_user_meta_data ->> 'phone', u.phone, ''),
  COALESCE(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture', ''),
  CASE WHEN COALESCE(u.raw_app_meta_data ->> 'provider', 'email') = 'google' THEN 'google' ELSE 'email' END,
  (u.email_confirmed_at IS NOT NULL OR COALESCE(u.raw_app_meta_data ->> 'provider', '') = 'google'),
  'active',
  u.last_sign_in_at,
  COALESCE(u.created_at, NOW()),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT DO NOTHING;

INSERT INTO public.user_subscriptions (
  user_id, plan_id, subscribed_price_inr, status, started_at, expires_at, auto_renew
)
SELECT p.id, 'free', 0, 'active', NOW(), NULL, FALSE
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.user_id = p.id)
ON CONFLICT (user_id) DO NOTHING;
