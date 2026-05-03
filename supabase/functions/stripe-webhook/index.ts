// stripe-webhook
//
// Receives subscription lifecycle events from Stripe and mirrors them into
// the public.subscriptions table. Authentication = Stripe-Signature header
// verification (Stripe doesn't carry a Supabase JWT — verify_jwt is off in
// supabase/config.toml for this function).
//
// Events handled:
//   customer.subscription.created  → INSERT (or UPSERT) row
//   customer.subscription.updated  → UPSERT (status, period, cancel flag)
//   customer.subscription.deleted  → mark status = canceled (row kept for
//                                    invoice-history Portal access)
//
// invoice.payment_failed is NOT handled separately — Stripe also fires
// customer.subscription.updated with status='past_due' alongside it, which
// we already cover.

import Stripe from "npm:stripe@17.5.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PRICE_MONTHLY = Deno.env.get("STRIPE_PRICE_MONTHLY")!;
const PRICE_ANNUAL = Deno.env.get("STRIPE_PRICE_ANNUAL")!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function billingCycleFromPriceId(priceId: string | undefined): "monthly" | "annual" {
  if (priceId === PRICE_ANNUAL) return "annual";
  if (priceId === PRICE_MONTHLY) return "monthly";
  // Unknown price — fall back to monthly so the row still inserts. Worth
  // logging in production so a stale STRIPE_PRICE_* env var is visible.
  console.warn(`Unknown price_id ${priceId}, defaulting to monthly`);
  return "monthly";
}

function tsFromUnix(s: number | null | undefined): string | null {
  if (!s) return null;
  return new Date(s * 1000).toISOString();
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.user_id;
  if (!userId) {
    console.error(`Subscription ${sub.id} has no metadata.user_id — cannot map to user`);
    return;
  }

  const priceId = sub.items.data[0]?.price?.id;
  const billingCycle = billingCycleFromPriceId(priceId);

  const row = {
    user_id: userId,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    status: sub.status,
    billing_cycle: billingCycle,
    current_period_start: tsFromUnix(sub.current_period_start),
    current_period_end: tsFromUnix(sub.current_period_end),
    trial_end: tsFromUnix(sub.trial_end),
    cancel_at_period_end: sub.cancel_at_period_end,
  };

  const { error } = await admin.from("subscriptions").upsert(row, {
    onConflict: "user_id",
  });

  if (error) {
    console.error(`Failed to upsert subscription ${sub.id}:`, error);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    // Async variant — required in Deno because the sync version uses Node's
    // crypto module synchronously, which Deno can't do for the HMAC check.
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscription(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        // Keep the row (so the user can still access Customer Portal for
        // invoice history) but force status to canceled.
        await upsertSubscription({ ...sub, status: "canceled" } as Stripe.Subscription);
        break;
      }
      default:
        // Acknowledge unhandled events so Stripe doesn't retry.
        break;
    }
  } catch (err) {
    console.error(`Handler failed for ${event.type}:`, err);
    // Return 500 so Stripe retries with backoff.
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
