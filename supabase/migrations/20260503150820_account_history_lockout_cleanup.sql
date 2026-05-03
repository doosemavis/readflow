-- Phase 10b: After the 6-month post-deletion lockout window expires, the
-- account_history rows for that email serve no purpose — the user is
-- treated as new again, so the data should genuinely be gone (not just
-- pretended-to-be-gone via "we keep it but ignore it").
--
-- Daily cron sweeps account_history for emails whose most recent 'deleted'
-- event is past the 6-month mark and removes ALL rows for those emails
-- (signup, trial_used, paid_started, canceled, deleted — the whole history).
--
-- After this runs, the email behaves identically to a fresh signup:
-- gets the free trial, gets free-tier benefits, no lockout, no anti-abuse
-- record. By design.
--
-- Run in Supabase SQL Editor. Idempotent.

CREATE OR REPLACE FUNCTION public.cleanup_expired_lockouts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purged_count integer := 0;
BEGIN
  -- Collect every email whose most recent 'deleted' event happened more
  -- than 6 months ago. Use max() because a single email could have multiple
  -- delete cycles over time (delete → 6+ months pass → cleanup → fresh
  -- signup → delete again → another row).
  WITH expired_emails AS (
    SELECT email
    FROM public.account_history
    WHERE event_type = 'deleted'
    GROUP BY email
    HAVING max(created_at) < now() - interval '6 months'
  )
  DELETE FROM public.account_history a
  USING expired_emails e
  WHERE a.email = e.email;

  GET DIAGNOSTICS purged_count = ROW_COUNT;
  RETURN purged_count;
END;
$$;

-- Schedule daily at 04:30 UTC (15min after process_pending_deletions, so
-- they don't compete for connection slots).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-lockouts-daily') THEN
    PERFORM cron.unschedule('cleanup-expired-lockouts-daily');
  END IF;
  PERFORM cron.schedule(
    'cleanup-expired-lockouts-daily',
    '30 4 * * *',                                  -- 04:30 UTC every day
    $cron$SELECT public.cleanup_expired_lockouts();$cron$
  );
END $$;
