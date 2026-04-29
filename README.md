# ReadFlow — Project Architecture

## Setup
```bash
npm install
npm run dev
```

## File Structure (Single Responsibility Principle)

```
readflow/
├── index.html                    # Entry HTML
├── package.json                  # Dependencies & scripts
├── vite.config.js                # Vite + React plugin
│
└── src/
    ├── main.jsx                  # React root mount
    ├── App.jsx                   # Root orchestrator — state + composition
    │
    ├── config/
    │   └── constants.js          # Themes, fonts, palettes, Stripe config, demo text
    │
    ├── utils/
    │   ├── index.js              # Barrel export
    │   ├── storage.js            # Storage adapter (swap for IndexedDB/Supabase)
    │   ├── scriptLoader.js       # CDN script loader
    │   ├── parsePDF.js           # PDF → structured sections
    │   ├── parseEPUB.js          # EPUB → structured chapters
    │   ├── parseDOCX.js          # DOCX → structured sections
    │   └── detectStructure.js    # Plain text/HTML → auto-detected chapters
    │
    ├── hooks/
    │   ├── useSubscription.js    # Plan state, trial lifecycle, upload limits
    │   └── useRecentDocs.js      # Chunked persistent document storage
    │
    ├── components/
    │   ├── index.js              # Barrel export
    │   ├── Primitives.jsx        # Toggle, Slider, Segment, Section, FontPicker
    │   ├── DocumentBody.jsx      # Document renderer (memo'd)
    │   ├── UploadBadge.jsx       # Plan status badge (memo'd)
    │   ├── RecentDocsList.jsx    # Recent docs — sidebar + landing variants
    │   ├── ReadingGuideOverlay.jsx # Highlight/underline/dim (ref-based)
    │   ├── PricingModal.jsx      # Plan selection
    │   ├── PaywallModal.jsx      # Upload limit gate
    │   └── CheckoutModal.jsx     # Payment form with autofill
    │
    └── styles/
        └── global.css            # Static CSS, scrollbars, OpenDyslexic @font-face
```

## Production TODOs
- [ ] Replace demo Stripe flow with real Checkout Sessions
- [ ] Swap storage.js adapter for IndexedDB or backend API
- [ ] Remove DEV bypass button before deploy
- [ ] Add error boundaries around parsers
- [ ] Add React.lazy() for modals (code-split)
