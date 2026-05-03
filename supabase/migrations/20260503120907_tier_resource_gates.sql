-- Phase 9a-10: Server-side resource gates for the Free vs Pro tiers.
--
-- A. Per-month upload counter on profiles, gated by check_upload_allowed()
--    (called before each upload) and incremented by record_upload() (after).
--    Pro = unlimited; Free = 3/month, resets at calendar month boundary.
--
-- B. Storage bucket cap raised to 50 MB. A BEFORE INSERT trigger on
--    storage.objects enforces the per-tier ceiling: Pro 50 MB, Free 25 MB.
--
-- C. cleanup_expired_docs() now applies tier-aware TTL: 30 days for Pro,
--    7 days for Free. Cron schedule unchanged (04:00 UTC daily).
--
-- Run in Supabase SQL Editor. Idempotent.

-- ─────────────────────────────────────────────────────────────────────────
-- A. Upload counter on profiles + RPCs.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS uploads_this_month integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uploads_month_key text NOT NULL DEFAULT '';

-- Returns the user's current upload allowance + tier-derived limits.
-- Auto-resets the counter on month rollover so the client never has to.
CREATE OR REPLACE FUNCTION public.check_upload_allowed()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  current_month text := to_char(now(), 'YYYY-MM');
  used integer;
  is_pro boolean;
  upload_limit integer;
  max_size bigint;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Reset counter on month rollover.
  UPDATE public.profiles
  SET uploads_this_month = 0,
      uploads_month_key = current_month
  WHERE id = uid
    AND uploads_month_key <> current_month;

  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = uid
      AND status IN ('trialing', 'active', 'past_due')
  ) INTO is_pro;

  upload_limit := CASE WHEN is_pro THEN 999999 ELSE 3 END;
  max_size := CASE WHEN is_pro THEN 52428800 ELSE 26214400 END;  -- 50 / 25 MB

  SELECT uploads_this_month INTO used
  FROM public.profiles WHERE id = uid;

  RETURN json_build_object(
    'allowed', used < upload_limit,
    'used', coalesce(used, 0),
    'limit', upload_limit,
    'is_pro', is_pro,
    'max_file_size_bytes', max_size
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_upload_allowed() TO authenticated;

-- Increment the upload counter. Called by the client after a successful
-- upload. Fails closed: returns false if user is over limit (caller can
-- log/ignore — the storage trigger and the pre-upload check_upload_allowed
-- gate are the actual enforcement points).
CREATE OR REPLACE FUNCTION public.record_upload()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  current_month text := to_char(now(), 'YYYY-MM');
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET uploads_this_month = CASE
        WHEN uploads_month_key = current_month THEN uploads_this_month + 1
        ELSE 1
      END,
      uploads_month_key = current_month
  WHERE id = uid;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_upload() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- B. File size cap by tier — bucket 50 MB ceiling + BEFORE INSERT trigger.
-- ─────────────────────────────────────────────────────────────────────────
UPDATE storage.buckets
SET file_size_limit = 52428800             -- 50 MB
WHERE id = 'documents';

CREATE OR REPLACE FUNCTION public.enforce_doc_size_by_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  doc_size bigint;
  user_id_str text;
  is_pro boolean;
  free_limit constant bigint := 26214400;  -- 25 MB
  pro_limit  constant bigint := 52428800;  -- 50 MB
BEGIN
  IF NEW.bucket_id <> 'documents' THEN RETURN NEW; END IF;

  doc_size := (NEW.metadata->>'size')::bigint;
  IF doc_size IS NULL THEN RETURN NEW; END IF;     -- size not yet computed

  user_id_str := (storage.foldername(NEW.name))[1];

  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id::text = user_id_str
      AND status IN ('trialing', 'active', 'past_due')
  ) INTO is_pro;

  IF is_pro AND doc_size > pro_limit THEN
    RAISE EXCEPTION 'File too large (max 50 MB on Pro)';
  ELSIF NOT is_pro AND doc_size > free_limit THEN
    RAISE EXCEPTION 'File too large for Free tier (max 25 MB) — upgrade to Pro for 50 MB';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_doc_size_by_tier_trigger ON storage.objects;
CREATE TRIGGER enforce_doc_size_by_tier_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_doc_size_by_tier();

-- ─────────────────────────────────────────────────────────────────────────
-- C. Tier-aware TTL: 30d for Pro, 7d for Free. Replaces the prior 7d-flat
--    cleanup_expired_docs(). Cron schedule unchanged.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_expired_docs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count integer := 0;
BEGIN
  -- One-shot CTE: collect (user_id, id) pairs whose last_accessed_at is
  -- past the user's tier-specific TTL. LEFT JOIN so users without a
  -- subscription row (free tier) get the 7d default.
  CREATE TEMP TABLE _expired ON COMMIT DROP AS
    SELECT r.user_id, r.id
    FROM public.recent_docs r
    LEFT JOIN public.subscriptions s ON s.user_id = r.user_id
    WHERE r.last_accessed_at < now() - (
      CASE
        WHEN s.status IN ('trialing', 'active', 'past_due') THEN interval '30 days'
        ELSE interval '7 days'
      END
    );

  IF NOT EXISTS (SELECT 1 FROM _expired) THEN
    RETURN 0;
  END IF;

  DELETE FROM storage.objects
  WHERE bucket_id = 'documents'
    AND name IN (SELECT user_id::text || '/' || id || '.json' FROM _expired);

  DELETE FROM public.recent_docs r
  USING _expired e
  WHERE r.user_id = e.user_id AND r.id = e.id;

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;
