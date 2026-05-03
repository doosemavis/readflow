-- Phase 9c-6: Owner analytics dashboard.
--
-- profiles.is_owner gates access to a privileged analytics tab in AdminPanel.
-- Distinct from the existing 'admin' role — admins moderate users; owner is
-- a stricter privilege for the business owner only (sensitive metrics like
-- MRR, conversion, deletion volume).
--
-- All analytics RPCs are SECURITY DEFINER and check is_owner before returning
-- anything — clients without the owner flag get a permission error, never
-- the underlying data.
--
-- Run in Supabase SQL Editor. Idempotent.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. profiles.is_owner column. Seeded TRUE for moosedavis2011@gmail.com only.
--    Future ownership changes are a manual SQL UPDATE (or build a UI later).
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET is_owner = true
WHERE id = (SELECT id FROM auth.users WHERE lower(email) = 'moosedavis2011@gmail.com')
  AND is_owner = false;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Helper: is_current_user_owner()
--    Used as the gatekeeper at the top of every analytics RPC. Pulls the
--    flag from profiles for the current auth.uid().
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_current_user_owner()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  flag boolean;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  SELECT is_owner INTO flag FROM public.profiles WHERE id = uid;
  RETURN coalesce(flag, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_owner() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Analytics RPCs. Each starts with an is_current_user_owner() check that
--    raises an exception for non-owners — no silent permission failures.
--    Each returns JSON so additions to the shape don't break the client.
-- ─────────────────────────────────────────────────────────────────────────

-- Total signups + breakdown by recency window.
CREATE OR REPLACE FUNCTION public.analytics_user_counts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_current_user_owner() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN json_build_object(
    'total',     (SELECT count(*) FROM public.profiles),
    'today',     (SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '1 day'),
    'last_7d',   (SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '7 days'),
    'last_30d',  (SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '30 days')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_user_counts() TO authenticated;

-- Active subscription counts grouped by Stripe status.
CREATE OR REPLACE FUNCTION public.analytics_subscription_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.is_current_user_owner() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT json_object_agg(status, cnt) INTO result
  FROM (
    SELECT status, count(*) AS cnt
    FROM public.subscriptions
    GROUP BY status
  ) s;
  RETURN coalesce(result, '{}'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_subscription_status() TO authenticated;

-- MRR estimate. Monthly subs count at $5; annual at $45/12 ≈ $3.75/mo.
-- Trialing subs not counted (haven't been charged yet).
-- Past_due counts (we'll get paid eventually for most of these).
CREATE OR REPLACE FUNCTION public.analytics_mrr_cents()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  monthly_count bigint;
  annual_count bigint;
BEGIN
  IF NOT public.is_current_user_owner() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT count(*) INTO monthly_count FROM public.subscriptions
    WHERE status IN ('active', 'past_due') AND billing_cycle = 'monthly';
  SELECT count(*) INTO annual_count FROM public.subscriptions
    WHERE status IN ('active', 'past_due') AND billing_cycle = 'annual';
  -- Monthly = $5/mo = 500 cents. Annual = $45/yr = 3750 cents per month.
  RETURN (monthly_count * 500) + (annual_count * 375);
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_mrr_cents() TO authenticated;

-- Trial → paid conversion rate over the last 30 days.
-- Numerator: distinct emails with a 'paid_started' event AFTER their 'trial_used' event in the window.
-- Denominator: distinct emails with a 'trial_used' event in the window.
CREATE OR REPLACE FUNCTION public.analytics_trial_conversion_30d()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  trials bigint;
  conversions bigint;
BEGIN
  IF NOT public.is_current_user_owner() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT count(DISTINCT email) INTO trials
  FROM public.account_history
  WHERE event_type = 'trial_used'
    AND created_at >= now() - interval '30 days';

  SELECT count(DISTINCT email) INTO conversions
  FROM public.account_history a
  WHERE event_type = 'paid_started'
    AND created_at >= now() - interval '30 days'
    AND EXISTS (
      SELECT 1 FROM public.account_history t
      WHERE t.email = a.email
        AND t.event_type = 'trial_used'
        AND t.created_at <= a.created_at
    );

  RETURN json_build_object(
    'trials', trials,
    'conversions', conversions,
    'rate', CASE WHEN trials = 0 THEN 0 ELSE round((conversions::numeric / trials) * 100, 1) END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_trial_conversion_30d() TO authenticated;

-- Pending deletion queue size + recently completed deletions (last 30d).
CREATE OR REPLACE FUNCTION public.analytics_deletion_volume()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_owner() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN json_build_object(
    'pending',
      (SELECT count(*) FROM public.profiles WHERE deletion_requested_at IS NOT NULL),
    'completed_last_30d',
      (SELECT count(*) FROM public.account_history
        WHERE event_type = 'deleted' AND created_at >= now() - interval '30 days')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_deletion_volume() TO authenticated;

-- Daily signup chart data for last 30 days. Returns rows of (day, count).
CREATE OR REPLACE FUNCTION public.analytics_daily_signups_30d()
RETURNS TABLE(day date, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_current_user_owner() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT
    d::date AS day,
    coalesce(c.cnt, 0)::bigint AS count
  FROM generate_series(
    (now() - interval '29 days')::date,
    now()::date,
    interval '1 day'
  ) d
  LEFT JOIN (
    SELECT created_at::date AS day, count(*) AS cnt
    FROM auth.users
    WHERE created_at >= now() - interval '30 days'
    GROUP BY created_at::date
  ) c ON c.day = d::date
  ORDER BY d::date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_daily_signups_30d() TO authenticated;
