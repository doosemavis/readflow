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

### Component Exports

`src/components/index.js` and `src/utils/index.js` are barrel exports — import from those, not directly from individual files.

### Fonts

Six accessibility-focused font families are preconnected in `index.html` from Google Fonts. Font config lives in `src/config/constants.js` alongside themes, color palettes, and demo text.
