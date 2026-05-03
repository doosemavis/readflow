import { useState, useCallback, useEffect } from "react";
import { FREE_UPLOAD_LIMIT } from "../config/constants";
import { getRolePermissions } from "../config/roles";
import { storageGet, storageSet } from "../utils/storage";
import { supabase } from "../utils/supabase";

// Plan/status come from the public.subscriptions table, populated by the
// stripe-webhook edge function. The client never writes to that table —
// state changes happen via Stripe (Checkout starts a sub, cancel-subscription
// edge function ends one) and propagate back through the webhook + realtime.
//
// Upload counter (uploadsUsed) still lives in localStorage; it's a
// per-device free-tier nudge, not a billing-grade quota. Server-side upload
// gating comes in task 9a-10.
export function useSubscription(role, user) {
  const [subRow, setSubRow] = useState(null);
  const [subLoaded, setSubLoaded] = useState(false);

  const [uploadsUsed, setUploadsUsed] = useState(0);
  const [uploadsLoaded, setUploadsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const val = await storageGet("readflow-uploads");
      if (val) {
        try {
          const d = JSON.parse(val);
          if (d.month === new Date().getMonth()) setUploadsUsed(d.count);
        } catch {}
      }
      setUploadsLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!uploadsLoaded) return;
    storageSet("readflow-uploads", JSON.stringify({
      month: new Date().getMonth(),
      count: uploadsUsed,
    }));
  }, [uploadsUsed, uploadsLoaded]);

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

  const effectiveLimit = adminBypass
    ? Infinity
    : isPro
      ? Infinity
      : (permissions.uploadLimit ?? FREE_UPLOAD_LIMIT);
  const canUpload = uploadsUsed < effectiveLimit;

  const loaded = subLoaded && uploadsLoaded;

  const recordUpload = useCallback(() => {
    if (!isPro) setUploadsUsed(p => p + 1);
  }, [isPro]);

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
    canUpload,
    loaded,
    recordUpload,
    cancelSubscription,
    // Alias retained because SubscriptionModal currently calls cancelTrial()
    // for both trial and Pro cancellations. Edge function branches internally.
    cancelTrial: cancelSubscription,
  };
}
