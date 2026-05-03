// cancel-subscription
//
// Auth'd POST endpoint. No body params (cancels whatever sub the caller owns).
// Response: { status: 'canceled' | 'cancel_at_period_end' }
//
// Branches on current Stripe status:
//   trialing  → stripe.subscriptions.cancel(id)
//               immediate cancellation, no charge ever happens
//   active    → stripe.subscriptions.update(id, { cancel_at_period_end: true })
//               keeps Pro features until current_period_end (user paid for it)
// past_due/etc → cancel immediately (treat like trialing — no value to preserve)

import Stripe from "npm:stripe@17.5.0";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Missing Authorization" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    return jsonResponse({ error: "Invalid session" }, 401);
  }
  const user = userData.user;

  const { data: subRow, error: subErr } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", user.id)
    .single();

  if (subErr || !subRow) {
    return jsonResponse({ error: "No active subscription" }, 404);
  }

  const subId = subRow.stripe_subscription_id;
  const status = subRow.status;

  // Trial cancellation = immediate (no charge); active cancellation =
  // end-of-period (user paid for the period and should keep access).
  if (status === "active") {
    await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
    return jsonResponse({ status: "cancel_at_period_end" });
  } else {
    await stripe.subscriptions.cancel(subId);
    return jsonResponse({ status: "canceled" });
  }
});
