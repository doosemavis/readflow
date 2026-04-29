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
- `useRecentDocs` — Persists documents to localStorage using 3.5MB chunk splitting to handle large files
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

### Storage Adapter Pattern

`src/utils/storage.js` wraps localStorage behind a consistent interface. This is the swap point if migrating to IndexedDB or a backend API — business logic should not call localStorage directly.

### Key Known TODOs (from README)

- Replace demo Stripe flow with real Checkout Sessions
- Swap `storage.js` adapter for IndexedDB or backend API
- Remove DEV bypass button before deploy
- Add error boundaries around parsers
- Add `React.lazy()` for modals

### Component Exports

`src/components/index.js` and `src/utils/index.js` are barrel exports — import from those, not directly from individual files.

### Fonts

Six accessibility-focused font families are preconnected in `index.html` from Google Fonts. Font config lives in `src/config/constants.js` alongside themes, color palettes, and demo text.
