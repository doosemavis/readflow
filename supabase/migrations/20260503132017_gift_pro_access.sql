-- Phase 9c-8: Gift Pro access. Owner or admin can grant any user a free
-- N-month Pro experience by email. Useful for support comp, beta testers,
-- influencer/PR seeding, friends.
--
-- Implementation: profiles.pro_grant_until is a future timestamp. The
-- useSubscription hook treats the user as Pro whenever NOW() < that value.
-- No cron / no expiry job needed — comparison is real-time.
--
-- Admins and owner share the grant capability; analytics is owner-only.
--
-- Run in Supabase SQL Editor. Idempotent.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. profiles.pro_grant_until — the grant expires when NOW() passes this.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_grant_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_pro_grant_until
  ON public.profiles (pro_grant_until)
  WHERE pro_grant_until IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Helper: is_caller_owner_or_admin()
--    Same gate as is_current_user_owner() but also accepts role='admin'.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_caller_owner_or_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_owner_flag boolean;
  user_role text;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  SELECT is_owner, role INTO is_owner_flag, user_role
  FROM public.profiles WHERE id = uid;
  RETURN coalesce(is_owner_flag, false) OR coalesce(user_role, '') = 'admin';
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_caller_owner_or_admin() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. grant_pro_access(target_email, months) — extends or sets the grant.
--    If the user already has a future grant, the new grant ADDs months on
--    top of the existing expiry (so back-to-back grants accumulate). If
--    the existing grant is in the past, it's replaced with NOW() + months.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_pro_access(
  target_email text,
  months integer DEFAULT 3
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_user_id uuid;
  current_grant timestamptz;
  new_grant timestamptz;
BEGIN
  IF NOT public.is_caller_owner_or_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF target_email IS NULL OR target_email = '' THEN
    RAISE EXCEPTION 'target_email required';
  END IF;
  IF months IS NULL OR months <= 0 OR months > 60 THEN
    RAISE EXCEPTION 'months must be between 1 and 60';
  END IF;

  SELECT id INTO target_user_id
  FROM auth.users WHERE lower(email) = lower(target_email);

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found for that email';
  END IF;

  SELECT pro_grant_until INTO current_grant
  FROM public.profiles WHERE id = target_user_id;

  -- Stack onto an active grant; replace an expired one.
  IF current_grant IS NOT NULL AND current_grant > now() THEN
    new_grant := current_grant + (months || ' months')::interval;
  ELSE
    new_grant := now() + (months || ' months')::interval;
  END IF;

  UPDATE public.profiles
  SET pro_grant_until = new_grant
  WHERE id = target_user_id;

  RETURN json_build_object(
    'email', lower(target_email),
    'pro_grant_until', new_grant,
    'months_added', months
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_pro_access(text, integer) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. revoke_pro_access(target_email) — clears any active grant immediately.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_pro_access(target_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF NOT public.is_caller_owner_or_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT id INTO target_user_id
  FROM auth.users WHERE lower(email) = lower(target_email);

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found for that email';
  END IF;

  UPDATE public.profiles
  SET pro_grant_until = NULL
  WHERE id = target_user_id;

  RETURN json_build_object('email', lower(target_email), 'revoked', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_pro_access(text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. list_active_pro_grants() — for admin UI to see who currently has a grant.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_active_pro_grants()
RETURNS TABLE(email text, pro_grant_until timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_caller_owner_or_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT u.email, p.pro_grant_until
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.pro_grant_until IS NOT NULL
    AND p.pro_grant_until > now()
  ORDER BY p.pro_grant_until ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_active_pro_grants() TO authenticated;
