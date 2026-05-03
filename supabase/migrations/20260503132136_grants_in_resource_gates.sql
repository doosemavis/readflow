-- Phase 9c-8 follow-up: teach the three server-side resource-gate functions
-- (file size trigger, upload-count RPC, TTL cron) to recognize active
-- pro_grant_until grants as "Pro" — without it, gifted-Pro users would
-- still see Free-tier limits and lose their docs at 7 days.
--
-- Run in Supabase SQL Editor. Idempotent — REPLACEs existing definitions.

-- ─────────────────────────────────────────────────────────────────────────
-- A. Storage trigger now also checks profiles.pro_grant_until.
-- ─────────────────────────────────────────────────────────────────────────
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
  IF doc_size IS NULL THEN RETURN NEW; END IF;

  user_id_str := (storage.foldername(NEW.name))[1];

  SELECT
    EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE user_id::text = user_id_str
        AND status IN ('trialing', 'active', 'past_due')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id::text = user_id_str
        AND pro_grant_until IS NOT NULL
        AND pro_grant_until > now()
    )
  INTO is_pro;

  IF is_pro AND doc_size > pro_limit THEN
    RAISE EXCEPTION 'File too large (max 50 MB on Pro)';
  ELSIF NOT is_pro AND doc_size > free_limit THEN
    RAISE EXCEPTION 'File too large for Free tier (max 25 MB) — upgrade to Pro for 50 MB';
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- B. check_upload_allowed now treats active pro_grant_until as Pro.
-- ─────────────────────────────────────────────────────────────────────────
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

  UPDATE public.profiles
  SET uploads_this_month = 0,
      uploads_month_key = current_month
  WHERE id = uid
    AND uploads_month_key <> current_month;

  SELECT
    EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE user_id = uid
        AND status IN ('trialing', 'active', 'past_due')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = uid
        AND pro_grant_until IS NOT NULL
        AND pro_grant_until > now()
    )
  INTO is_pro;

  upload_limit := CASE WHEN is_pro THEN 999999 ELSE 3 END;
  max_size := CASE WHEN is_pro THEN 52428800 ELSE 26214400 END;

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

-- ─────────────────────────────────────────────────────────────────────────
-- C. cleanup_expired_docs uses 30d TTL for either real Pro OR active grant.
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
  CREATE TEMP TABLE _expired ON COMMIT DROP AS
    SELECT r.user_id, r.id
    FROM public.recent_docs r
    LEFT JOIN public.subscriptions s ON s.user_id = r.user_id
    LEFT JOIN public.profiles p ON p.id = r.user_id
    WHERE r.last_accessed_at < now() - (
      CASE
        WHEN s.status IN ('trialing', 'active', 'past_due') THEN interval '30 days'
        WHEN p.pro_grant_until IS NOT NULL AND p.pro_grant_until > now() THEN interval '30 days'
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
