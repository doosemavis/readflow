-- Account deletion with grace period (Phase 8).
-- Adds deletion request tracking to profiles, the cleanup function that
-- processes expired deletions, an email-based check for blocking re-signup
-- during the grace period, and the pg_cron schedule that runs daily.
--
-- PREREQUISITE: pg_cron already enabled (see prior migration).
-- Run this in the Supabase SQL Editor. Idempotent.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. profiles: add deletion tracking columns
--    deletion_requested_at = when the user clicked Delete
--    deletion_effective_at = when cron actually wipes them (tier-dependent)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_effective_at timestamptz;

-- Index supports the cron sweep predicate.
CREATE INDEX IF NOT EXISTS idx_profiles_deletion_effective
  ON public.profiles (deletion_effective_at)
  WHERE deletion_effective_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. delete_user_completely(uuid) — wipes all user data + auth row
--    SECURITY DEFINER so it can touch auth.users and storage.objects.
--    Does NOT touch account_history (Phase 9 anti-abuse table —
--    by-email, not by-user_id; survives forever to block trial reuse).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_user_completely(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
BEGIN
  -- Storage objects under this user's folder.
  DELETE FROM storage.objects
  WHERE bucket_id = 'documents'
    AND (storage.foldername(name))[1] = target_user_id::text;

  -- Recent docs index.
  DELETE FROM public.recent_docs
  WHERE user_id = target_user_id;

  -- Profile row (where deletion timestamps live).
  DELETE FROM public.profiles
  WHERE id = target_user_id;

  -- Finally the auth identity. profiles' FK to auth.users is ON DELETE
  -- CASCADE so this would handle the row above too — explicit deletes
  -- above are belt-and-suspenders + clearer audit.
  DELETE FROM auth.users
  WHERE id = target_user_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. process_pending_deletions() — cron-callable sweep
--    Walks every profile whose deletion_effective_at has passed and runs
--    delete_user_completely() for each. Returns count for observability.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_pending_deletions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  processed_count integer := 0;
  user_rec RECORD;
BEGIN
  FOR user_rec IN
    SELECT id FROM public.profiles
    WHERE deletion_effective_at IS NOT NULL
      AND deletion_effective_at < now()
  LOOP
    PERFORM public.delete_user_completely(user_rec.id);
    processed_count := processed_count + 1;
  END LOOP;
  RETURN processed_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. email_has_pending_deletion(text) — used by the signup flow to block
--    re-signup with an email that has an active deletion request. Anon-
--    callable so the check happens before the user has a session.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.email_has_pending_deletion(check_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  has_pending boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE lower(u.email) = lower(check_email)
      AND p.deletion_requested_at IS NOT NULL
  ) INTO has_pending;
  RETURN coalesce(has_pending, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.email_has_pending_deletion(text)
  TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Schedule the cleanup daily at 04:15 UTC (15min after the doc TTL job
--    so they don't compete for the same connection slot).
-- ─────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-pending-deletions-daily') THEN
    PERFORM cron.unschedule('process-pending-deletions-daily');
  END IF;
  PERFORM cron.schedule(
    'process-pending-deletions-daily',
    '15 4 * * *',                                  -- 04:15 UTC every day
    $cron$SELECT public.process_pending_deletions();$cron$
  );
END $$;
