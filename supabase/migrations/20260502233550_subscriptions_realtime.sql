-- Enable Supabase Realtime on public.subscriptions so that webhook-driven
-- writes (status changes, billing cycle swaps, cancellations) propagate to
-- the client's useSubscription hook in ~1s without a refetch.
--
-- Tables aren't part of the supabase_realtime publication by default —
-- you have to add them explicitly.
--
-- Run in Supabase SQL Editor. Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'subscriptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
  END IF;
END $$;
