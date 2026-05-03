-- Phase 9a: Stripe subscriptions table + stripe_customer_id on profiles.
-- This is the source-of-truth for subscription state — populated only by the
-- stripe-webhook edge function (service role bypasses RLS). Clients can read
-- their own row but cannot write; status is whatever Stripe says it is.
--
-- Plan inference for the client:
--   no row                → free
--   status = trialing     → trial
--   status = active       → pro
--   status = past_due     → pro (show "update payment" banner)
--   status = canceled     → free (row kept for invoice-history Portal access)
--   anything else         → free
--
-- Run in Supabase SQL Editor. Idempotent.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. profiles.stripe_customer_id — the per-user Stripe Customer reference.
--    Set once at first checkout; reused for subsequent subs + Portal sessions.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. subscriptions table — one row per user (current state only).
--    UPSERT semantics on user_id; we don't keep historical sub rows here
--    (Stripe holds the full audit trail).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id     text NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  status                 text NOT NULL CHECK (status IN (
    'trialing','active','past_due','canceled','unpaid','incomplete','incomplete_expired'
  )),
  billing_cycle          text NOT NULL CHECK (billing_cycle IN ('monthly','annual')),
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  trial_end              timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
  ON public.subscriptions (stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id
  ON public.subscriptions (stripe_subscription_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own subscription" ON public.subscriptions;
CREATE POLICY "users read own subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for authenticated/anon. The webhook uses
-- the service role (bypasses RLS) — that's the only writer.

-- ─────────────────────────────────────────────────────────────────────────
-- 3. updated_at trigger — webhook doesn't have to set it manually
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscriptions_touch_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_touch_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
