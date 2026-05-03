// create-checkout-session
//
// Auth'd POST endpoint. Body: { billingCycle: 'monthly' | 'annual', returnUrl: string }
// Response: { url: string } — client window.location.href = url
//
// Looks up (or creates) the user's Stripe Customer, then creates a Checkout
// Session for a 14-day-trial subscription on the chosen price. The trial
// captures the card without charging; first invoice fires on day 14.

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

  // Auth: extract user from the JWT in the Authorization header.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Missing Authorization" }, 401);

  // Service-role client to read/write profiles (bypasses RLS).
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Decode the user from the JWT.
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    return jsonResponse({ error: "Invalid session" }, 401);
  }
  const user = userData.user;

  // Body validation.
  let body: { billingCycle?: string; returnUrl?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { billingCycle, returnUrl } = body;
  if (billingCycle !== "monthly" && billingCycle !== "annual") {
    return jsonResponse({ error: "billingCycle must be 'monthly' or 'annual'" }, 400);
  }
  if (!returnUrl || typeof returnUrl !== "string") {
    return jsonResponse({ error: "returnUrl required" }, 400);
  }

  const priceId = billingCycle === "annual" ? PRICE_ANNUAL : PRICE_MONTHLY;

  // Look up the existing Stripe customer for this user, or create one.
  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (profErr) {
    return jsonResponse({ error: "Profile lookup failed" }, 500);
  }

  let customerId = profile?.stripe_customer_id as string | null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  // Build success/cancel URLs from the client-supplied origin.
  const sep = returnUrl.includes("?") ? "&" : "?";
  const successUrl = `${returnUrl}${sep}checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${returnUrl}${sep}checkout=cancel`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { user_id: user.id, billing_cycle: billingCycle },
    },
    metadata: { user_id: user.id, billing_cycle: billingCycle },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
  });

  return jsonResponse({ url: session.url });
});
