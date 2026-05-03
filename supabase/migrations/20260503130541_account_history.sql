-- Phase 9c-1: account_history — email-keyed event log that survives account
-- deletion, used to enforce two anti-abuse rules:
--
--   1. **Once-per-email free trial.** After a user trials, they can never
--      get a second free 14-day trial with the same email — even after
--      cancel or full account deletion. They subscribe at checkout instead.
--      Enforced by create-checkout-session checking email_has_used_trial().
--
--   2. **6-month post-deletion subscription lockout.** When an account
--      is fully deleted (post-grace-period), the email is "marked" for
--      6 months. New signups with the same email work, but Free tier
--      benefits are suspended (no uploads, no trial) until the lockout
--      expires or they subscribe.
--      Enforced by useSubscription reading email_post_deletion_lockout_until().
--
-- Run in Supabase SQL Editor. Idempotent.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. account_history table — append-only event log keyed by lowercase email.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.account_history (
  id          bigserial PRIMARY KEY,
  email       text NOT NULL CHECK (email = lower(email)),
  event_type  text NOT NULL CHECK (event_type IN (
    'signup', 'trial_used', 'paid_started', 'canceled', 'deleted'
  )),
  created_at  timestamptz NOT NULL DEFAULT now(),
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_account_history_email_event
  ON public.account_history (email, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_history_email
  ON public.account_history (email);

-- RLS: read denied to clients. The two RPCs below are SECURITY DEFINER and
-- the only intended access path. The webhook (service role) writes directly.
ALTER TABLE public.account_history ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. RPC: email_has_used_trial(email)
--    Anon-callable so create-checkout-session can check before creating
--    the Stripe session.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.email_has_used_trial(check_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF check_email IS NULL OR check_email = '' THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.account_history
    WHERE email = lower(check_email)
      AND event_type = 'trial_used'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.email_has_used_trial(text)
  TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. RPC: email_post_deletion_lockout_until(email)
--    Returns the timestamp when the lockout expires, or null if no lockout.
--    Lockout = 6 months from the most recent 'deleted' event for this email.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.email_post_deletion_lockout_until(check_email text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  last_deletion timestamptz;
  lockout_end timestamptz;
BEGIN
  IF check_email IS NULL OR check_email = '' THEN RETURN NULL; END IF;

  SELECT max(created_at) INTO last_deletion
  FROM public.account_history
  WHERE email = lower(check_email)
    AND event_type = 'deleted';

  IF last_deletion IS NULL THEN RETURN NULL; END IF;

  lockout_end := last_deletion + interval '6 months';
  IF lockout_end <= now() THEN RETURN NULL; END IF;     -- expired
  RETURN lockout_end;
END;
$$;

GRANT EXECUTE ON FUNCTION public.email_post_deletion_lockout_until(text)
  TO anon, authenticated;

-- Convenience wrapper for authenticated-user self-check (no email arg —
-- pulls from auth.email() so the client doesn't need to know its own email).
CREATE OR REPLACE FUNCTION public.my_post_deletion_lockout_until()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
  user_email text;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT email INTO user_email FROM auth.users WHERE id = uid;
  RETURN public.email_post_deletion_lockout_until(user_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_post_deletion_lockout_until()
  TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Update delete_user_completely() to record the 'deleted' event in
--    account_history BEFORE removing auth.users (we need the email).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_user_completely(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  user_email text;
BEGIN
  -- Capture the email before we delete auth.users so account_history can
  -- key on it even after the user row is gone.
  SELECT email INTO user_email FROM auth.users WHERE id = target_user_id;
  IF user_email IS NOT NULL THEN
    INSERT INTO public.account_history (email, event_type, metadata)
    VALUES (lower(user_email), 'deleted', jsonb_build_object('user_id', target_user_id));
  END IF;

  -- Storage objects under this user's folder.
  DELETE FROM storage.objects
  WHERE bucket_id = 'documents'
    AND (storage.foldername(name))[1] = target_user_id::text;

  -- Recent docs index.
  DELETE FROM public.recent_docs
  WHERE user_id = target_user_id;

  -- Subscription row (FK CASCADE would handle this too, belt-and-suspenders).
  DELETE FROM public.subscriptions
  WHERE user_id = target_user_id;

  -- Profile row.
  DELETE FROM public.profiles
  WHERE id = target_user_id;

  -- Auth identity. profiles' FK to auth.users is ON DELETE CASCADE so this
  -- would handle the row above too — explicit deletes above are clearer audit.
  DELETE FROM auth.users
  WHERE id = target_user_id;
END;
$$;
