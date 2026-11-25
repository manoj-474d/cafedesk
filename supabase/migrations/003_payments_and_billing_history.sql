-- ============================================================================
-- Cafe Desk: Payments & Subscription Billing History (for Cloudflare Workers / Supabase)
-- Run this migration in Supabase Project -> SQL Editor after 001 & 002 migrations.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  amount_inr INTEGER NOT NULL CHECK (amount_inr >= 1),
  currency TEXT NOT NULL DEFAULT 'INR',
  method TEXT NOT NULL DEFAULT 'upi' CHECK (method IN ('upi', 'card', 'netbanking', 'admin_grant')),
  provider TEXT NOT NULL DEFAULT 'razorpay' CHECK (provider IN ('razorpay')),
  provider_order_id TEXT NOT NULL UNIQUE,
  provider_payment_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed', 'refunded')),
  failure_reason TEXT NOT NULL DEFAULT '',
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments (provider_order_id);

CREATE TABLE IF NOT EXISTS public.subscription_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  from_plan TEXT NOT NULL DEFAULT 'free',
  to_plan TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_history_user_id ON public.subscription_history (user_id, created_at DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own payments" ON public.payments;
CREATE POLICY "Users read own payments"
  ON public.payments FOR SELECT
  USING (
    auth.uid() = user_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "Users read own subscription history" ON public.subscription_history;
CREATE POLICY "Users read own subscription history"
  ON public.subscription_history FOR SELECT
  USING (
    auth.uid() = user_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin')
  );

REVOKE ALL ON public.payments FROM anon;
REVOKE ALL ON public.subscription_history FROM anon;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.subscription_history TO authenticated;
