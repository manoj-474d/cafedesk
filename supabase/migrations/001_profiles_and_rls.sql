-- ============================================================================
-- Cafe Desk: Supabase Auth Profiles, Activity Logs & Row Level Security (RLS)
-- Run this migration in your Supabase Project -> SQL Editor.
-- ============================================================================

-- 1. User Profiles Table (linked 1:1 to auth.users, zero passwords stored)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  auth_provider TEXT NOT NULL DEFAULT 'email',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles (account_status);

-- 2. User Login & Account Activity Events Table
CREATE TABLE IF NOT EXISTS public.user_login_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'email',
  event_type TEXT NOT NULL DEFAULT 'login',
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_events_user_id ON public.user_login_events (user_id, created_at DESC);

-- 3. Trigger: Keep updated_at current automatically
CREATE OR REPLACE FUNCTION public.set_profile_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profile_updated_at();

-- 4. Trigger: Prevent non-service-role users from altering privileged fields (account_status / email_verified)
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
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
    NEW.account_status := OLD.account_status;
    NEW.email_verified := OLD.email_verified;
    NEW.auth_provider := OLD.auth_provider;
    NEW.email := OLD.email;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- 5. Trigger: Automatically create a profile row when a user signs up in Supabase Auth
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
BEGIN
  meta_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'), ''),
    SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)
  );
  meta_phone := COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone, '');
  meta_avatar := COALESCE(
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'picture',
    ''
  );
  meta_provider := COALESCE(NEW.raw_app_meta_data ->> 'provider', 'email');

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
    LOWER(COALESCE(NEW.email, '')),
    meta_phone,
    meta_avatar,
    CASE WHEN meta_provider = 'google' THEN 'google' ELSE 'email' END,
    (NEW.email_confirmed_at IS NOT NULL),
    'active',
    NEW.last_sign_in_at,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE public.profiles.phone END,
    avatar_url = CASE WHEN EXCLUDED.avatar_url <> '' THEN EXCLUDED.avatar_url ELSE public.profiles.avatar_url END,
    email_verified = (NEW.email_confirmed_at IS NOT NULL),
    last_login_at = COALESCE(NEW.last_sign_in_at, public.profiles.last_login_at),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- 6. Trigger: Sync email verification and last_login_at on auth.users updates
CREATE OR REPLACE FUNCTION public.handle_updated_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = LOWER(COALESCE(NEW.email, email)),
    email_verified = (NEW.email_confirmed_at IS NOT NULL),
    last_login_at = COALESCE(NEW.last_sign_in_at, last_login_at),
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email_confirmed_at, last_sign_in_at, email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_auth_user();

-- 7. Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_login_events ENABLE ROW LEVEL SECURITY;

-- Users can read only their own profile; Admins (via JWT app_metadata.role) can read all
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin')
  );

-- Users can insert only their own profile row
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update only their own profile (privileged fields guarded by trigger above); Admins can update any
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles
  FOR UPDATE
  USING (
    auth.uid() = id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin')
  )
  WITH CHECK (
    auth.uid() = id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin')
  );

-- Only Admins or service_role can delete profile rows
DROP POLICY IF EXISTS "Admins delete profiles" ON public.profiles;
CREATE POLICY "Admins delete profiles"
  ON public.profiles
  FOR DELETE
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin')
  );

-- Login events: users read their own events, admins read all
DROP POLICY IF EXISTS "Users read own login events" ON public.user_login_events;
CREATE POLICY "Users read own login events"
  ON public.user_login_events
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "Users insert own login events" ON public.user_login_events;
CREATE POLICY "Users insert own login events"
  ON public.user_login_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 8. Enable Realtime publication on public.profiles for live Admin dashboard syncing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'profiles'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
  END IF;
END $$;
