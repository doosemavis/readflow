// create-portal-session
//
// Auth'd POST endpoint. Body: { returnUrl: string }
// Response: { url: string } — client window.location.href = url
//
// Opens Stripe's hosted Customer Portal where the user can view invoices,
// update their payment method, change billing address, etc. Subscription
// cancellation should be DISABLED in the Stripe Dashboard portal config —
// we have our own cancel flow in SubscriptionModal.

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

  let body: { returnUrl?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { returnUrl } = body;
  if (!returnUrl || typeof returnUrl !== "string") {
    return jsonResponse({ error: "returnUrl required" }, 400);
  }

  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (profErr) {
    return jsonResponse({ error: "Profile lookup failed" }, 500);
  }

  const customerId = profile?.stripe_customer_id as string | null;
  if (!customerId) {
    // User has never had a Stripe interaction — no portal to show.
    return jsonResponse({ error: "No payment history" }, 400);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return jsonResponse({ url: session.url });
});
