-- ============================================================================
-- Cafe Desk: Cloudflare Worker Admin Accounts, CMS State & Activity Logs
-- Run this additive migration in Supabase SQL Editor after 001..005.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_accounts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT 'Site Administrator',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'admin', 'editor')),
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_secret TEXT NOT NULL DEFAULT '',
  reset_token_hash TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_accounts_username_lower
  ON public.admin_accounts (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_admin_accounts_email_lower
  ON public.admin_accounts (LOWER(email));

CREATE TABLE IF NOT EXISTS public.cms_kv (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  previous_value TEXT NOT NULL DEFAULT '',
  new_value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_kv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Public can read non-sensitive CMS state; only service_role writes
DROP POLICY IF EXISTS "Public read cms_kv" ON public.cms_kv;
CREATE POLICY "Public read cms_kv"
  ON public.cms_kv FOR SELECT
  USING (TRUE);

-- Never grant anon/authenticated access to admin_accounts or admin_activity_logs
REVOKE ALL ON public.admin_accounts FROM anon, authenticated;
REVOKE ALL ON public.admin_activity_logs FROM anon, authenticated;
GRANT SELECT ON public.cms_kv TO anon, authenticated;
