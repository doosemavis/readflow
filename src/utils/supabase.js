import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn("ReadFlow: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — auth will not work.");
}

// autoRefreshToken: false because the SDK's silent token refresh hangs/fails
// against `sb_publishable_` keys (same root cause as the email-auth raw-fetch
// workaround in AuthContext). With it on, every page refresh triggers a
// background refresh that clears the session and signs the user out. The
// access_token JWT is valid for 1 hour after sign-in; we accept that as the
// session length until the publishable-key SDK issues are addressed upstream.
//
// persistSession + detectSessionInUrl stay on so:
//   - the session survives page refreshes (read from localStorage at init)
//   - Google OAuth callback's URL hash is parsed automatically
export const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
