# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # Production build
npm run preview   # Preview production build
```

No test runner or linter is currently configured.

## Architecture

**ReadFlow** is a React + Vite single-page app for reading documents with adaptive typography and visual accessibility aids.

### State Management

`App.jsx` is the single state hub (~28KB). It owns all UI state via ~20+ `useState` hooks covering document content, typography settings, visual enhancements, modal visibility, and subscription context. There is no global state library — everything flows down as props.

### Custom Hooks

- `useSubscription` — Plan tier, trial lifecycle, upload quota enforcement
- `useRecentDocs(authReady, userId)` — Reads/writes the recent-docs index to Supabase via `cloudDocs`. Refreshes from server after each mutation; one-time migration of pre-Supabase localStorage docs runs on first authed load.
- `useReadingGuide` — Generates highlight/underline overlay positioning

### Document Parsing Pipeline

```
File upload → type-specific parser → docSections[]
```

- **PDF**: pdf.js (CDN-loaded via `utils/scriptLoader.js`)
- **EPUB**: EPub.js (CDN-loaded)
- **DOCX**: mammoth (bundled)
- **Plain text/HTML**: `utils/detectStructure.js` uses regex to detect chapters/parts/sections/acts

All parsers return `{ type, title, number, content }` section objects consumed by `DocumentBody`.

### Storage Layer

Two-tier:

- **Supabase** for documents (blob in `documents` storage bucket at path `{user_id}/{doc_id}.json`) and the recent-docs index (`recent_docs` table). Accessed via `src/utils/cloudDocs.js`. Schema lives in `supabase/migrations/`. RLS policies enforce per-user isolation on both surfaces.
- **localStorage** (via `src/utils/storage.js`) for small per-device KV: subscription state (`useSubscription`), theme persistence (`useThemePreference`), avatar (`useAvatar`). Keys are user-scoped: `rf:u:{user_id}:KEY`.

`storage.js` also provides one-time GC helpers (`storageGcOrphanChunks`, `storageGcUnscopedKeys`) used by `cloudDocs.migrateLocalToCloud` to clean up legacy chunk data and pre-scoping leftovers on first authed load.

### Key Known TODOs (from README)

- Replace demo Stripe flow with real Checkout Sessions (CheckoutModal currently fake-Promises a delay then calls onSuccess — no Stripe API call yet)
- Move `useSubscription` from localStorage to Supabase (reads from `subscriptions` table populated by Stripe webhooks); pairs with the Stripe work
- Remove DEV bypass button before deploy (`App.jsx` admin-only `setDevBypass` button)
- Add error boundaries around parsers
- ~~Swap `storage.js` adapter for documents~~ ✅ done — recent docs now in Supabase; small KV stays on localStorage by design
- ~~Add `React.lazy()` for modals~~ ✅ done — six modals lazy-loaded, vendor chunks split via `vite.config.js` manualChunks

### Production Deployment Checklist (Phase 10)

When promoting from local dev → production hosting (Vercel / Netlify / etc.), update these in the Supabase Dashboard. The codebase has no environment-specific URLs hardcoded (besides `import.meta.env.VITE_SUPABASE_*`), so all URL configuration lives in Supabase + the host's env-var panel.

**Supabase Dashboard → Authentication → URL Configuration:**
- **Site URL**: set to the production domain (e.g. `https://readflow.app`). This is the default redirect target Supabase uses for password-reset and email-verification links.
- **Redirect URLs (allowlist)**: add the production domain plus any specific paths used by OAuth callbacks. Wildcard suffix `https://readflow.app/*` covers all paths cleanly. Keep `http://localhost:5173/*` in the list while developing in parallel.

**Supabase Dashboard → Authentication → Email Templates:**
- Customize the "Confirm signup", "Reset password", and "Magic Link" templates with the production sender name + branding. The default templates use generic Supabase wording.
- Verify that the `{{ .ConfirmationURL }}` / `{{ .RecoveryURL }}` template placeholders point to the production domain (they're derived from Site URL above, so this should follow automatically).

**Supabase Dashboard → Authentication → Providers → Google (and any other OAuth provider):**
- Update the OAuth callback URL on the provider's side too (Google Cloud Console → OAuth client → Authorized redirect URIs) — Supabase's callback shows as `https://YOUR-SUPABASE-PROJECT.supabase.co/auth/v1/callback`. The app-side redirect after auth uses the Site URL configured above.

**Supabase Dashboard → Database → Extensions:**
- Confirm `pg_cron` is enabled (already required for the doc-TTL and account-deletion sweeps). It carries forward when promoting between environments only if you re-enable it; it's a per-project toggle.

**Hosting platform env vars:**
- `VITE_SUPABASE_URL` — same as dev (Supabase project URL)
- `VITE_SUPABASE_ANON_KEY` — same as dev (publishable anon key)
- *Phase 9 will add server-side env vars*: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` — none of these belong in `VITE_*` (browser-exposed). They live in the hosting platform's server-side env config, used only by Stripe-handling functions.
- `.env.example` should be created at repo root listing the public ones for any teammate cloning the repo.

**Email verification:**
- Confirm Supabase project has email confirmation **enabled** (Authentication → Settings → "Confirm email"). The Phase 8c gate at `handleSelectPlan` only blocks subscription if `user.email_confirmed_at` is null — that field is only `null` when confirmation is enabled and the user hasn't clicked the link yet.

### Component Exports

`src/components/index.js` and `src/utils/index.js` are barrel exports — import from those, not directly from individual files.

### Fonts

Six accessibility-focused font families are preconnected in `index.html` from Google Fonts. Font config lives in `src/config/constants.js` alongside themes, color palettes, and demo text.
