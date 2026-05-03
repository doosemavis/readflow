import { useState, useCallback, useEffect } from "react";
import { FREE_UPLOAD_LIMIT } from "../config/constants";
import { getRolePermissions } from "../config/roles";
import { supabase } from "../utils/supabase";

// Plan/status come from the public.subscriptions table, populated by the
// stripe-webhook edge function. The client never writes to that table —
// state changes happen via Stripe (Checkout starts a sub, cancel-subscription
// edge function ends one) and propagate back through the webhook + realtime.
//
// Upload counter is server-authoritative now (profiles.uploads_this_month,
// reset monthly). Client mirrors the server value via check_upload_allowed
// RPC; record_upload increments after successful upload.
export function useSubscription(role, user) {
  const [subRow, setSubRow] = useState(null);
  const [subLoaded, setSubLoaded] = useState(false);

  const [uploadsUsed, setUploadsUsed] = useState(0);
  const [uploadLimit, setUploadLimit] = useState(FREE_UPLOAD_LIMIT);
  const [maxFileSize, setMaxFileSize] = useState(26214400); // 25 MB default
  const [uploadsLoaded, setUploadsLoaded] = useState(false);

  // Refetches upload allowance from the server. Single source of truth —
  // server resets the monthly counter at the calendar boundary, so we don't
  // do month math on the client.
  const refetchUploadAllowance = useCallback(async () => {
    if (!user?.id) {
      setUploadsUsed(0);
      setUploadLimit(FREE_UPLOAD_LIMIT);
      setUploadsLoaded(true);
      return;
    }
    const { data, error } = await supabase.rpc("check_upload_allowed");
    if (error) {
      console.warn("check_upload_allowed failed:", error.message);
      setUploadsLoaded(true);
      return;
    }
    setUploadsUsed(data?.used ?? 0);
    setUploadLimit(data?.limit ?? FREE_UPLOAD_LIMIT);
    setMaxFileSize(data?.max_file_size_bytes ?? 26214400);
    setUploadsLoaded(true);
  }, [user?.id]);

  useEffect(() => { refetchUploadAllowance(); }, [refetchUploadAllowance]);

  useEffect(() => {
    if (!user?.id) {
      setSubRow(null);
      setSubLoaded(true);
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) console.error("useSubscription fetch failed:", error);
      setSubRow(data ?? null);
      setSubLoaded(true);
    })();

    // Realtime: webhook writes propagate within ~1s without a refetch.
    const channel = supabase
      .channel(`sub-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") setSubRow(null);
          else setSubRow(payload.new);
          // Tier change → server limit changes too. Refresh the cache.
          refetchUploadAllowance();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const permissions = getRolePermissions(role);
  const adminBypass = permissions.canBypassPaywall;

  const status = subRow?.status;
  const isTrialing = status === "trialing";
  const isActiveOrPastDue = status === "active" || status === "past_due";

  const isPro = adminBypass || isTrialing || isActiveOrPastDue;
  const isTrial = isTrialing && !adminBypass;
  const plan = adminBypass
    ? "pro"
    : isTrialing
      ? "trial"
      : isActiveOrPastDue
        ? "pro"
        : "free";
  const billingCycle = subRow?.billing_cycle ?? null;
  const isPastDue = status === "past_due";
  const cancelAtPeriodEnd = subRow?.cancel_at_period_end ?? false;
  const currentPeriodEnd = subRow?.current_period_end ?? null;
  const hasStripeHistory = subRow != null;

  const trialDaysLeft = isTrialing && subRow?.trial_end
    ? Math.max(0, Math.ceil((new Date(subRow.trial_end).getTime() - Date.now()) / 86400000))
    : 0;

  // Server-derived limit (uploadLimit) wins over the role-based override.
  // adminBypass still short-circuits to Infinity for our owner account.
  const effectiveLimit = adminBypass ? Infinity : uploadLimit;
  const canUpload = uploadsUsed < effectiveLimit;

  const loaded = subLoaded && uploadsLoaded;

  // Increments the server counter via RPC, then mirrors the change locally.
  // Callers should already have checked canUpload before invoking; this is
  // the post-success bookkeeping. Optimistic local bump if RPC succeeds.
  const recordUpload = useCallback(async () => {
    if (isPro) return;  // Pro is unlimited; nothing to track.
    const { error } = await supabase.rpc("record_upload");
    if (error) {
      console.warn("record_upload failed:", error.message);
      // Refetch to get the truth — local count would be stale.
      await refetchUploadAllowance();
      return;
    }
    setUploadsUsed(p => p + 1);
  }, [isPro, refetchUploadAllowance]);

  // Routes through the cancel-subscription edge function. Stripe handles the
  // immediate-vs-end-of-period decision based on current status; webhook then
  // updates the subscriptions row, realtime fires, UI updates.
  const cancelSubscription = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not signed in");
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Cancellation failed");
    }
    return await res.json();
  }, []);

  return {
    plan,
    isPro,
    isTrial,
    isPastDue,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    trialDaysLeft,
    billingCycle,
    hasStripeHistory,
    uploadsUsed,
    uploadLimit,
    maxFileSize,
    canUpload,
    loaded,
    recordUpload,
    refetchUploadAllowance,
    cancelSubscription,
    // Alias retained because SubscriptionModal currently calls cancelTrial()
    // for both trial and Pro cancellations. Edge function branches internally.
    cancelTrial: cancelSubscription,
  };
}
