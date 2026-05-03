// update-subscription-plan
//
// Auth'd POST endpoint. Body: { billingCycle: 'monthly' | 'annual' }
// Response: { ok: true }
//
// Swaps the user's existing Stripe subscription to the other billing cycle
// (Monthly ⇄ Annual). Used by the "Upgrade to Annual" button in
// SubscriptionModal. Stripe handles proration automatically — the user
// gets credited for unused time on their old price and charged the
// prorated difference for the new price on their next invoice.
//
// We use proration_behavior='create_prorations' (Stripe default): credits
// + charges land on the next invoice. If the user is mid-trial, no money
// changes hands until trial_end either way.

import Stripe from "npm:stripe@17.5.0";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PRICE_MONTHLY = Deno.env.get("STRIPE_PRICE_MONTHLY")!;
const PRICE_ANNUAL = Deno.env.get("STRIPE_PRICE_ANNUAL")!;

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

  let body: { billingCycle?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { billingCycle } = body;
  if (billingCycle !== "monthly" && billingCycle !== "annual") {
    return jsonResponse({ error: "billingCycle must be 'monthly' or 'annual'" }, 400);
  }

  const newPriceId = billingCycle === "annual" ? PRICE_ANNUAL : PRICE_MONTHLY;

  const { data: subRow, error: subErr } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", user.id)
    .single();

  if (subErr || !subRow) {
    return jsonResponse({ error: "No subscription to update" }, 404);
  }

  // Fetch the current Stripe subscription to get the item ID we need to update.
  const stripeSub = await stripe.subscriptions.retrieve(subRow.stripe_subscription_id);
  const itemId = stripeSub.items.data[0]?.id;
  if (!itemId) {
    return jsonResponse({ error: "Subscription has no items" }, 500);
  }

  // No-op if already on the requested cycle (e.g. double-click).
  const currentPriceId = stripeSub.items.data[0].price.id;
  if (currentPriceId === newPriceId) {
    return jsonResponse({ ok: true, alreadyOnPlan: true });
  }

  await stripe.subscriptions.update(subRow.stripe_subscription_id, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: "create_prorations",
  });

  // Webhook (customer.subscription.updated) fires automatically — that's
  // what updates the subscriptions table + flips billing_cycle in the UI.
  return jsonResponse({ ok: true });
});
