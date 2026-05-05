import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo, lazy, Suspense } from "react";
import {
  Upload, FileText, Type, Palette, Eye, Sun, Moon, BookOpen,
  ChevronDown, X, Sparkles, Baseline, Highlighter, Underline as UnderlineIcon,
  EyeOff, MousePointer2, Focus, PanelLeftClose, PanelLeft,
  Crown, Clock, Check, List, Lock,
  AlignLeft, AlignCenter, AlignRight, AlignJustify
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { THEMES, PALETTES, GUIDE_COLORS, FONTS, DEMO_TEXT } from "./config/constants";
import { isThemeFree, isPaletteFree, isGuideColorFree } from "./config/proFeatures";
import { getRevealColors } from "./config/themeColors";

// Maps raw parser exceptions to user-friendly messages. Internal pdf.js /
// EPub.js / mammoth error strings ("InvalidPDFException", "Cannot read
// properties of undefined") are leaky and useless to a reader who just
// wants to know "is the file broken or did I do something wrong."
function mapParserErrorToMessage(ext, err) {
  const raw = String(err?.message ?? err ?? "").toLowerCase();
  // Already-friendly messages from our own throws — pass through.
  if (raw.includes("readable text") || raw.includes("doesn't support") || raw.includes("file too large")) {
    return err.message;
  }
  if (ext === "pdf") {
    if (raw.includes("password") || raw.includes("encrypt")) {
      return "This PDF is password-protected. ReadFlow can't open encrypted PDFs.";
    }
    if (raw.includes("invalid") || raw.includes("corrupt") || raw.includes("malformed")) {
      return "This PDF appears corrupted. Try re-downloading it from the source.";
    }
    return "Couldn't read this PDF — it may be malformed or encrypted.";
  }
  if (ext === "epub") {
    return "Couldn't read this EPUB — it may be DRM-protected or malformed.";
  }
  if (ext === "docx") {
    return "Couldn't read this DOCX — try re-saving from Word as a fresh .docx file.";
  }
  if (ext === "html" || ext === "htm") {
    return "Couldn't parse this HTML file. It may use unsupported encoding.";
  }
  return "Couldn't read this file. It may be corrupted or use an unsupported format.";
}

// Stable Slider format helpers (module-level so memo on Slider isn't busted each App render).
const FMT_PX = v => `${v}px`;
const FMT_LH = v => v.toFixed(2);
const FMT_FIXED1_PX = v => `${v.toFixed(1)}px`;
const FMT_PCT = v => `${v}%`;
const FMT_PCT_FROM_FRAC = v => `${Math.round(v * 100)}%`;

// File-picker `accept` attribute (HTML hint) and the strict allowlist
// doUpload validates against. Picker hint and runtime check stay in sync
// because both derive from the same source. The `accept` attribute alone
// can't be relied on — drag-and-drop and "show all files" both bypass it.
const FILE_ACCEPT = ".pdf,.epub,.txt,.md,.docx,.html,.htm,.json";
const SUPPORTED_EXTS = new Set(FILE_ACCEPT.split(",").map(s => s.replace(/^\./, "")));

// Theme picker layout: left column = light themes, right column = dark themes (5 + 5).
// Render order is light-first-then-dark; grid-auto-flow: column with 5 rows places them
// in two visual columns. Add new themes to the appropriate array — order within each is the row order.
const LIGHT_THEME_KEYS = ["warm", "cool", "sepia", "forest", "crimson"];
const DARK_THEME_KEYS = ["phosphor", "jungle", "dark", "midnight", "obsidian"];
import { parsePDF, parseEPUB, parseDOCX, parseHTMLStructured, parseMarkdownStructured, detectTextStructure, runThemeTransition } from "./utils";
import { supabase } from "./utils/supabase";
import { useSubscription } from "./hooks/useSubscription";
import { useRecentDocs } from "./hooks/useRecentDocs";
import { useAvatar } from "./hooks/useAvatar";
import { useThemePreference } from "./hooks/useThemePreference";
import { useAuth } from "./contexts/AuthContext";
import { useToast } from "./components/Toast";
import {
  Toggle, Slider, Segment, Section, FontPicker, Tip,
  UploadBadge, SidebarRecentDocs, LandingRecentDocs,
  DocumentBody, useReadingGuide,
  UserMenu, PendingDeletionBanner, PostDeletionLockoutBanner,
  DiaTextReveal, CatLoader, ErrorBoundary, Footer,
} from "./components";

// Modals are conditionally rendered and not needed at first paint, so
// they're code-split into their own chunks. Each lazy() returns a
// component that triggers a dynamic import the first time it renders.
const PricingModal         = lazy(() => import("./components/PricingModal"));
const PaywallModal         = lazy(() => import("./components/PaywallModal"));
const CheckoutModal        = lazy(() => import("./components/CheckoutModal"));
const AuthModal            = lazy(() => import("./components/AuthModal"));
const AvatarSettingsModal  = lazy(() => import("./components/AvatarSettingsModal"));
const SubscriptionModal    = lazy(() => import("./components/SubscriptionModal"));
const DeleteAccountModal   = lazy(() => import("./components/DeleteAccountModal"));

export default function App() {
  // ── Document state ──
  const [text, setText] = useState("");
  const [docSections, setDocSections] = useState(null);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [hoverUpload, setHoverUpload] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);

  // ── Enhancement state ──
  const [neuroDiv, setNeuroDiv] = useState(false);
  const [neuroDivIntensity, setNeuroDivIntensity] = useState(0.42);
  const [hueGuide, setHueGuide] = useState(false);
  const [huePalette, setHuePalette] = useState("ocean");
  const [hueIntensity, setHueIntensity] = useState(1);  // 0 = plain text fg, 1 = full palette
  const [focusMode, setFocusMode] = useState(false);
  const [focusPara, setFocusPara] = useState(-1);
  const [guideDimOpacity, setGuideDimOpacity] = useState(0.25);
  const [guideMode, setGuideMode] = useState("none");
  const [guideColor, setGuideColor] = useState("yellow");

  // ── Typography state ──
  const [fontFamily, setFontFamily] = useState("Literata");
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [wordSpacing, setWordSpacing] = useState(0);
  const [columnWidth, setColumnWidth] = useState(95);
  const [textAlign, setTextAlign] = useState("left");
  const [theme, setTheme] = useState("warm");

  // ── Auth ──
  const { user, role, loading: authLoading, deletionEffectiveAt, refreshDeletionStatus, isRecovering, clearRecovery } = useAuth();
  const { showToast } = useToast();
  const { avatar, saveAvatar } = useAvatar(user?.id);
  const themePref = useThemePreference(user?.id);
  const [showAuth, setShowAuth] = useState(false);

  // Gift link landing toast — fires once on mount when the URL has
  // ?gift_email=&gift_status= (set by the send-grant-email Edge Function),
  // then watches for the user to sign in as the recipient so it can fire a
  // celebratory follow-up toast at the moment the gift actually "lands."
  //
  // initialFiredRef gates the first-mount toast so it can't re-fire if the
  // user object churns. pendingGift carries the recipient email forward
  // across the auth-state change between the initial toast and the
  // celebration. URL params are stripped only when we know we're done
  // (gift landed, signed in as someone else, or already-recipient case).
  const giftInitialFiredRef = useRef(false);
  const [pendingGift, setPendingGift] = useState(null);
  useEffect(() => {
    if (authLoading) return;

    const stripUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("gift_email");
      url.searchParams.delete("gift_status");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    };

    // First-mount: parse URL, fire the initial toast based on auth state.
    if (!giftInitialFiredRef.current) {
      giftInitialFiredRef.current = true;
      const params = new URLSearchParams(window.location.search);
      const giftEmail = params.get("gift_email");
      const giftStatus = params.get("gift_status");
      if (!giftEmail) return;

      const recipientMatchesUser = user?.email?.toLowerCase() === giftEmail.toLowerCase();
      const signedInAsOther = !!user && !recipientMatchesUser;

      if (signedInAsOther) {
        showToast(`This gift is for ${giftEmail}. Sign out to redeem on that account.`, "info", 10000);
        stripUrl();
      } else if (recipientMatchesUser) {
        showToast("🎁 Your ReadFlow Pro gift is active!", "success", 8000);
        stripUrl();
      } else if (giftStatus === "applied") {
        showToast(`🎁 Welcome back — sign in with ${giftEmail} to access your Pro gift.`, "info", 9000);
        setPendingGift({ email: giftEmail });
      } else {
        showToast(`🎁 You've been gifted ReadFlow Pro. Sign up with ${giftEmail} to redeem.`, "info", 9000);
        setPendingGift({ email: giftEmail });
      }
      return;
    }

    // Follow-up: a pending gift is waiting for the user to sign in. If they
    // just authenticated as the recipient, fire the celebration toast.
    if (pendingGift && user?.email?.toLowerCase() === pendingGift.email.toLowerCase()) {
      showToast("🎁 Your ReadFlow Pro gift is active!", "success", 8000);
      setPendingGift(null);
      stripUrl();
    }
  }, [authLoading, user, showToast, pendingGift]);

  // Force-open AuthModal in "set new password" mode when AuthContext detects
  // a Supabase password-recovery session (user clicked the email reset link).
  // The modal is non-dismissible in this mode — user must complete or sign out.
  useEffect(() => {
    if (isRecovering) setShowAuth(true);
  }, [isRecovering]);
  const [showAvatarSettings, setShowAvatarSettings] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  // Reset document state on signout
  useEffect(() => {
    if (!authLoading && !user) {
      setText("");
      setDocSections(null);
      setFileName("");
      setFocusPara(-1);
    }
  }, [user, authLoading]);

  // Restore the user's saved theme once per login. When the saved theme differs
  // from the current one, run the View Transition reveal (originates from the
  // viewport center since there's no click event) so the swap feels intentional
  // rather than like a layout flash.
  const restoredForUserRef = useRef(null);
  useEffect(() => {
    if (!user) { restoredForUserRef.current = null; return; }
    if (themePref.savedTheme && THEMES[themePref.savedTheme] && restoredForUserRef.current !== user.id) {
      if (themePref.savedTheme !== theme) {
        runThemeTransition(null, () => setTheme(themePref.savedTheme));
      }
      restoredForUserRef.current = user.id;
    }
  }, [themePref.savedTheme, user, theme]);

  // When persistence is on, save the active theme on every change.
  useEffect(() => {
    themePref.saveTheme(theme);
  }, [theme, themePref.saveTheme]);

  const onToggleThemePersist = useCallback(() => {
    themePref.togglePersist(!themePref.persistEnabled, theme);
  }, [themePref, theme]);

  // ── Subscription & modals ──
  const sub = useSubscription(role, user);
  const recentDocs = useRecentDocs(!authLoading, user?.id);
  const [showPricing, setShowPricing] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutBilling, setCheckoutBilling] = useState("monthly");
  const [showChapterNav, setShowChapterNav] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // ── Refs ──
  const fileRef = useRef();
  const readerRef = useRef();
  const sectionRefs = useRef({});
  const docWrapperRef = useRef(null);
  const typographyRafRef = useRef(null);

  // ── Derived ──
  const t = useMemo(() => ({ ...THEMES[theme], key: theme }), [theme]);
  const currentFont = FONTS.find(f => f.name === fontFamily);
  const hasSections = docSections && docSections.length > 0 && (docSections.length > 1 || docSections[0]?.title);

  // Sync favicon + browser-chrome theme-color to the active theme. SVG is
  // regenerated as a data URI on each theme change; the `<link rel="icon">`
  // and `<meta name="theme-color">` in index.html are mutated in place.
  //
  // Dev override: in `vite` (import.meta.env.DEV), force the favicon to
  // magenta so localhost tabs are visually distinct from production tabs.
  // theme-color still tracks the active theme so the browser chrome doesn't
  // flash bright pink — only the tab favicon does.
  useEffect(() => {
    const accent = import.meta.env.DEV ? "#FF1493" : t.accent;

    // Pick white or near-black for the book icon based on the accent's
    // perceived luminance — white on light accents (e.g. midnight's pale
    // blue) reads as low-contrast mush, so flip to dark for those.
    const r = parseInt(accent.slice(1, 3), 16) / 255;
    const g = parseInt(accent.slice(3, 5), 16) / 255;
    const b = parseInt(accent.slice(5, 7), 16) / 255;
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    const iconColor = luminance > 0.55 ? "#1A1A1A" : "#FFFFFF";

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${accent}"/><g transform="translate(14 15)" fill="none" stroke="${iconColor}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><g transform="scale(1.5)"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></g></g></svg>`;
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

    const links = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]');
    links.forEach(link => { link.href = dataUri; });

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t.accent);
  }, [t.accent]);

  // ── Feature toggles (NeuroDiv/HueGuide/Focus) flip a CSS class on the document inner div via ref.
  //     Single className write, no React reconciliation through the Section subtree. ──
  const featureClassRef = useRef(null);
  const featureStateRef = useRef({ neuroDiv, hueGuide, focusMode });
  featureStateRef.current = { neuroDiv, hueGuide, focusMode };
  // Latest focusMode for descendant onMouseEnter callbacks — read at hover time, never drives re-render.
  const focusModeRef = useRef(focusMode);
  focusModeRef.current = focusMode;

  const writeFeatureClass = useCallback(() => {
    const el = featureClassRef.current;
    if (!el) return;
    const s = featureStateRef.current;
    el.className = [s.neuroDiv && "rf-neurodiv", s.hueGuide && "rf-hueguide", s.focusMode && "rf-focus-mode"].filter(Boolean).join(" ");
  }, []);

  // Callback ref: writes the feature class synchronously on mount so initial DOM state is correct.
  const handleFeatureClassRef = useCallback((el) => {
    featureClassRef.current = el;
    if (el) writeFeatureClass();
  }, [writeFeatureClass]);

  // Toggle-driven updates: synchronous className write before paint — click-to-visual on the same frame.
  useLayoutEffect(() => {
    if (featureClassRef.current) writeFeatureClass();
  }, [neuroDiv, hueGuide, focusMode, writeFeatureClass]);

  // ── Focus style management (kept here so DocumentBody never re-renders for focusPara changes) ──
  const focusStyleRef = useRef(null);
  useEffect(() => {
    if (!focusStyleRef.current) { focusStyleRef.current = document.createElement("style"); document.head.appendChild(focusStyleRef.current); }
    if (focusMode && focusPara >= 0) focusStyleRef.current.textContent = `.rf-para{opacity:0.1;transition:opacity 0.35s ease}.rf-para[data-idx="${focusPara}"]{opacity:1}`;
    else if (focusMode) focusStyleRef.current.textContent = `.rf-para{opacity:0.1;transition:opacity 0.35s ease}`;
    else focusStyleRef.current.textContent = `.rf-para{opacity:1;transition:opacity 0.35s ease}`;
  }, [focusMode, focusPara]);

  // ── Reading guide hook ──
  const guide = useReadingGuide({ guideMode, guideColor, guideDimOpacity, fontSize, lineHeight, t });

  // ── Typography → CSS vars written directly to the document wrapper via ref.
  //     Bypasses React entirely on slider drags; rAF coalesces multiple input events per frame. ──
  const currentFontCss = currentFont?.css;

  // Latest typography snapshot, kept on a stable ref so writeTypographyVars / the callback ref
  // can read current values without re-creating themselves on every typography state change.
  const typographyStateRef = useRef(null);
  typographyStateRef.current = { fontSize, lineHeight, columnWidth, letterSpacing, wordSpacing, textAlign, currentFontCss };

  const writeTypographyVars = useCallback(() => {
    const el = docWrapperRef.current;
    if (!el) return;
    const s = typographyStateRef.current;
    el.style.setProperty("--rf-font-size", `${s.fontSize}px`);
    el.style.setProperty("--rf-line-height", String(s.lineHeight));
    el.style.setProperty("--rf-column-width", `${s.columnWidth}%`);
    el.style.setProperty("--rf-letter-spacing", `${s.letterSpacing}px`);
    el.style.setProperty("--rf-word-spacing", `${s.wordSpacing}px`);
    el.style.setProperty("--rf-text-align", s.textAlign || "left");
    el.style.setProperty("--rf-hue-intensity", String(hueIntensity));
    if (s.currentFontCss) el.style.setProperty("--rf-font-family", s.currentFontCss);
  }, [hueIntensity]);

  // Per-slider live writers: write a single CSS var directly to the wrapper on every drag tick.
  // App state isn't touched during drag — we update it once on release via the slider's onChange.
  const liveWriters = useMemo(() => ({
    fontSize: v => docWrapperRef.current?.style.setProperty("--rf-font-size", `${v}px`),
    lineHeight: v => docWrapperRef.current?.style.setProperty("--rf-line-height", String(v)),
    columnWidth: v => docWrapperRef.current?.style.setProperty("--rf-column-width", `${v}%`),
    letterSpacing: v => docWrapperRef.current?.style.setProperty("--rf-letter-spacing", `${v}px`),
    wordSpacing: v => docWrapperRef.current?.style.setProperty("--rf-word-spacing", `${v}px`),
    hueIntensity: v => docWrapperRef.current?.style.setProperty("--rf-hue-intensity", String(v)),
  }), []);

  // Callback ref: writes vars synchronously the moment DocumentBody's wrapper mounts.
  // Without this, calc(var(--rf-font-size) * 1.5) on titles and calc(var(--rf-line-height) * 1.5em)
  // on dividers evaluate to invalid (no value, no fallback in calc) → headings collapse to body size.
  const handleDocWrapperRef = useCallback((el) => {
    docWrapperRef.current = el;
    if (el) writeTypographyVars();
  }, [writeTypographyVars]);

  // Slider-driven updates: rAF-coalesced direct DOM writes, no React reconciliation in document tree.
  useLayoutEffect(() => {
    if (!docWrapperRef.current) return;
    if (typographyRafRef.current) cancelAnimationFrame(typographyRafRef.current);
    typographyRafRef.current = requestAnimationFrame(() => {
      typographyRafRef.current = null;
      writeTypographyVars();
    });
    return () => { if (typographyRafRef.current) cancelAnimationFrame(typographyRafRef.current); };
  }, [fontSize, lineHeight, columnWidth, letterSpacing, wordSpacing, textAlign, currentFontCss, hueIntensity, writeTypographyVars]);

  // ── Render settings: only props that genuinely change paragraph/section JSX (palette colors, bold split, theme). ──
  //     NeuroDiv/HueGuide/Focus are NOT here — they flip via featureClassRef and never trigger Section re-renders.
  const settings = useMemo(() => ({
    neuroDivIntensity,
    huePalette,
    t,
  }), [neuroDivIntensity, huePalette, t]);

  // ── Handlers ──
  const scrollToSection = useCallback((idx) => {
    sectionRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const attemptUpload = useCallback((file) => {
    if (!file) return;
    if (!user) { setShowAuth(true); return; }
    // Lockout users skip the "X free uploads used" paywall (it'd be a lie)
    // and go straight to the pricing modal — only path forward is subscribe.
    if (sub.isLockedOut) { setShowPricing(true); return; }
    if (!sub.canUpload) { setShowPaywall(true); return; }
    // Pre-check file size against the server-derived per-tier ceiling.
    // The storage trigger enforces this too; this is the friendly UX gate
    // so the user doesn't watch a parse spinner before getting rejected.
    if (file.size > sub.maxFileSize) {
      const limitMb = Math.round(sub.maxFileSize / 1048576);
      const proHint = sub.isPro ? "" : " — upgrade to Pro for 50MB.";
      showToast(`This file is too large (${(file.size / 1048576).toFixed(1)}MB). Max ${limitMb}MB${proHint}`, "error", 7000);
      return;
    }
    doUpload(file);
  }, [user, sub.canUpload, sub.isLockedOut, sub.maxFileSize, sub.isPro, showToast]);

  const doUpload = useCallback(async (file) => {
    setLoading(true); setLoadMsg("Reading file…");
    let sections;
    const ext = file.name.split(".").pop().toLowerCase();
    try {
      // Guard: reject anything outside the supported allowlist. Without this,
      // an image (.jpg/.png) or audio file falls through to the plain-text
      // branch and `.text()` decodes its binary bytes as UTF-8 garbage —
      // user sees a screen of gibberish instead of a clear error.
      if (!SUPPORTED_EXTS.has(ext)) {
        throw new Error(`ReadFlow doesn't support .${ext} files. Try a PDF, EPUB, DOCX, or text file (TXT, MD, HTML, JSON).`);
      }
      if (ext === "pdf") { setLoadMsg("Loading PDF engine…"); sections = await parsePDF(file); }
      else if (ext === "epub") { setLoadMsg("Unpacking EPUB…"); sections = await parseEPUB(file); }
      else if (ext === "docx") { setLoadMsg("Extracting DOCX…"); sections = await parseDOCX(file); }
      else if (ext === "html" || ext === "htm") { setLoadMsg("Parsing HTML…"); sections = parseHTMLStructured(await file.text()); }
      else if (ext === "md") { setLoadMsg("Parsing Markdown…"); sections = parseMarkdownStructured(await file.text()); }
      else { sections = detectTextStructure(await file.text()); }
      const fullText = sections.map(s => [s.title, s.content].filter(Boolean).join("\n\n")).join("\n\n");
      // Empty-content guard: if the parser returned no readable text, the
      // file is most likely image-only (scanned PDF without OCR), encrypted,
      // or genuinely empty (e.g. an audio file mis-extension'd as .txt).
      // Fail before recording an upload or showing a blank reader.
      if (!fullText.trim()) {
        throw new Error("This file doesn't contain any readable text. It might be image-based, encrypted, or empty.");
      }
      setText(fullText); setDocSections(sections); setFileName(file.name);
    } catch (e) {
      // Map raw parser exceptions to user-friendly per-format messages.
      // The original exception is still in console for debugging.
      console.error(`[doUpload] ${ext} parser threw:`, e);
      const friendly = mapParserErrorToMessage(ext, e);
      showToast(friendly, "error", 7000);
      setLoading(false); setLoadMsg("");
      return;
    }
    // Save to recents separately so a quota/storage failure leaves the
    // freshly-parsed doc visible instead of being replaced by an error message.
    // recordUpload only fires after successful storage save so a Free user's
    // monthly quota isn't burned by a storage outage.
    try {
      await recentDocs.saveDoc(file.name, sections, sections.map(s => [s.title, s.content].filter(Boolean).join("\n\n")).join("\n\n"));
      await sub.recordUpload();
    }
    catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes("File too large")) {
        showToast(msg, "error", 7000);
      } else {
        showToast("Couldn't save to your library: " + msg, "error");
      }
    }
    finally { setLoading(false); setLoadMsg(""); }
  }, [sub, recentDocs, showToast]);

  // Cosmetic-gate helper: for Pro-only themes/palettes/guide-colors, free
  // users get the PricingModal instead of the change being applied.
  // adminBypass + Pro pass through.
  const gateCosmetic = useCallback((isFreeItem, applyFn) => {
    if (sub.isPro || isFreeItem) { applyFn(); return; }
    setShowPricing(true);
  }, [sub.isPro]);

  const loadRecentDoc = useCallback(async (entry) => {
    setLoading(true); setLoadMsg("Loading saved document…");
    try {
      const data = await recentDocs.loadDoc(entry);
      if (data) { setText(data.text); setDocSections(data.sections); setFileName(data.name); }
      else { setText("Document no longer available. Try uploading it again."); setDocSections(null); setFileName(entry.name); }
    } catch { setText("Error loading saved document."); setDocSections(null); }
    finally { setLoading(false); setLoadMsg(""); }
  }, [recentDocs]);

  const onDrop = useCallback((e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer?.files?.[0]) attemptUpload(e.dataTransfer.files[0]); }, [attemptUpload]);
  // Phase 8c — gate the checkout flow on a verified email. Supabase populates
  // user.email_confirmed_at when the user clicks the confirmation link sent
  // at signup. OAuth users (Google) are pre-verified by the provider, so they
  // pass this check immediately. Email/password signups must verify first.
  const handleSelectPlan = useCallback((billing) => {
    if (user && !user.email_confirmed_at) {
      showToast("Please verify your email before subscribing. Check your inbox for the verification link we sent at signup.", "error", 7000);
      setShowPricing(false);
      return;
    }
    setShowPricing(false);
    setCheckoutBilling(billing);
    setShowCheckout(true);
  }, [user, showToast]);
  // Open Stripe's hosted Customer Portal in the same tab. The function only
  // returns a URL if the user has a stripe_customer_id; we gate the menu
  // item on sub.hasStripeHistory so only past/current subscribers see it.
  const handleShowPaymentReceipts = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ returnUrl: window.location.origin }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't open portal");
      window.location.href = json.url;
    } catch (err) {
      showToast(err.message, "error");
    }
  }, [showToast]);

  // Stripe Checkout return: read ?checkout=success or ?checkout=cancel set
  // by create-checkout-session, surface a toast, then clean the URL so a
  // refresh doesn't re-fire the toast. Subscription state itself is driven
  // by the realtime listener in useSubscription — no fetch needed here.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("checkout");
    if (!status) return;
    if (status === "success") {
      showToast("Welcome to Pro! Your trial has started.", "success");
    } else if (status === "cancel") {
      showToast("Checkout canceled.", "info");
    }
    params.delete("checkout");
    params.delete("session_id");
    const search = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (search ? `?${search}` : ""));
  }, [showToast]);

  // ── Modals ──
  // Wrapped in Suspense because each modal is React.lazy. Fallback is null
  // (no spinner) so the brief chunk fetch on first open isn't visually
  // jarring — modals already have their own enter animation that masks it.
  const modals = (
    <Suspense fallback={null}>
      {showPricing && <PricingModal onClose={() => setShowPricing(false)} onSelectPlan={handleSelectPlan} hasUsedTrial={sub.isTrial || sub.plan === "pro"} t={t} />}
      {showCheckout && <CheckoutModal billing={checkoutBilling} onClose={() => setShowCheckout(false)} t={t} />}
      {showPaywall && <PaywallModal uploadsUsed={sub.uploadsUsed} onUpgrade={() => { setShowPaywall(false); setShowPricing(true); }} onClose={() => setShowPaywall(false)} t={t} />}
      {showAuth && <AuthModal onClose={() => { setShowAuth(false); clearRecovery?.(); }} t={t} initialView={isRecovering ? "setPassword" : "login"} />}
      {/* AvatarSettingsModal stays mounted so Radix Dialog can run its proper
          open→close lifecycle. Force-unmounting via `{show && ...}` (the pattern
          we use for the others) leaks body styles like pointer-events:none on
          rapid open/close cycles, which froze the page after the second avatar
          pick. Controlled `open` lets Radix clean up cleanly each cycle. */}
      <AvatarSettingsModal open={showAvatarSettings} onOpenChange={setShowAvatarSettings} onSave={saveAvatar} currentAvatar={avatar} isPro={sub.isPro} onShowPricing={() => setShowPricing(true)} t={t} />
      {showSubscription && <SubscriptionModal open={showSubscription} onOpenChange={setShowSubscription} sub={sub} onShowPricing={() => setShowPricing(true)} t={t} />}
      {showDeleteAccount && <DeleteAccountModal open={showDeleteAccount} onOpenChange={setShowDeleteAccount} sub={sub} t={t} />}
    </Suspense>
  );

  // ═══════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════
  if (!sub.loaded) return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}><CatLoader size={160} style={{ marginBottom: 14 }} /><p style={{ fontSize: 14, color: t.fgSoft }}>Loading ReadFlow…</p></div>
    </div>
  );

  // ═══════════════════════════════════════════
  // LANDING PAGE
  // ═══════════════════════════════════════════
  if (!text && !loading) return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.fg, display: "flex", flexDirection: "column", fontFamily: "'DM Sans', sans-serif" }}>
      {user && deletionEffectiveAt && <PendingDeletionBanner user={user} effectiveAt={deletionEffectiveAt} onReactivated={refreshDeletionStatus} t={t} />}
      {user && sub.isLockedOut && <PostDeletionLockoutBanner lockoutUntil={sub.lockoutUntil} onSubscribe={() => setShowPricing(true)} />}
      {modals}
      <div style={{ position: "fixed", top: 14, right: 16, zIndex: 100 }}>
        <UserMenu t={t} onShowAuth={() => setShowAuth(true)} onShowAvatarSettings={() => setShowAvatarSettings(true)} onShowSubscription={() => setShowSubscription(true)} onShowPaymentReceipts={handleShowPaymentReceipts} showPaymentReceipts={sub.hasStripeHistory} onShowDeleteAccount={() => setShowDeleteAccount(true)} avatar={avatar} themePersistEnabled={themePref.persistEnabled} onToggleThemePersist={onToggleThemePersist} mockFreeMode={sub.mockFreeMode} onToggleMockFreeMode={sub.toggleMockFreeMode} isProGrantActive={sub.isProGrantActive} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 520 }}>
        <div style={{ width: 68, height: 68, borderRadius: 20, background: t.accentSoft, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}><BookOpen size={32} style={{ color: t.accent, transform: "translateY(1px)" }} /></div>
        <h1 style={{ fontSize: 36, fontWeight: 740, marginBottom: 6, letterSpacing: "-0.025em" }}>
          <DiaTextReveal
            text="ReadFlow"
            colors={getRevealColors(theme)}
            textColor={t.fg}
            duration={2}
          />
        </h1>
        <p style={{ fontSize: 15, color: t.fgSoft, marginBottom: 12, lineHeight: 1.6, maxWidth: 400, margin: "0 auto 12px", textWrap: "balance" }}>
          <DiaTextReveal
            text="Reading that adapts to you — typography, focus, and color tuned to the way your brain reads."
            colors={getRevealColors(theme)}
            textColor={t.fgSoft}
            duration={2}
          />
        </p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: t.surface, border: `1px solid ${t.borderSoft}`, marginBottom: 32, fontSize: 12, fontWeight: 600, color: t.fgSoft }}>
          {sub.isPro ? <><Crown size={12} style={{ color: t.accent }} /><span style={{ color: t.accent }}>{sub.isTrial ? `Pro Trial — ${sub.trialDaysLeft} days left` : "Pro Plan"}</span></> : <><FileText size={12} /> {sub.uploadsUsed}/3 free docs used</>}
          {!sub.isPro && <button onClick={() => setShowPricing(true)} style={{ background: t.accentSoft, border: "none", cursor: "pointer", color: t.accent, fontSize: 11, fontWeight: 650, padding: "2px 8px", borderRadius: 6, marginLeft: 4 }}>Upgrade</button>}
        </div>
        <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => !loading && fileRef.current?.click()} onMouseEnter={() => setHoverUpload(true)} onMouseLeave={() => setHoverUpload(false)} style={{ border: `2px dashed ${dragging || hoverUpload ? t.accent : t.border}`, borderRadius: 18, padding: "52px 32px", cursor: "pointer", background: dragging ? t.accentSoft : hoverUpload ? t.surfaceHover : t.surface, transition: "all 0.25s ease", marginBottom: 24, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", transform: hoverUpload ? "translateY(-2px)" : "translateY(0)", boxShadow: hoverUpload ? `0 8px 24px ${t.accent}15` : "none" }}>
          <Upload size={30} style={{ color: hoverUpload ? t.accent : t.icon, marginBottom: 14, transition: "color 0.2s ease" }} />
          <p style={{ fontSize: 15, fontWeight: 620, color: t.fg, marginBottom: 6 }}>Drop a file here or click to browse</p>
          <p style={{ fontSize: 12, color: hoverUpload ? t.accent : t.fgSoft, letterSpacing: "0.04em", transition: "color 0.2s ease" }}>PDF · EPUB · DOCX · TXT · MD · HTML</p>
          <input ref={fileRef} type="file" accept={FILE_ACCEPT} style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) attemptUpload(f); }} />
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => { const s = detectTextStructure(DEMO_TEXT); setText(DEMO_TEXT); setDocSections(s); setFileName("demo-article.txt"); setPanelOpen(false); }} style={{ padding: "10px 28px", borderRadius: 10, border: "none", background: t.surface, color: t.fg, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", display: "inline-flex", alignItems: "center", gap: 8 }}><FileText size={14} /> Try demo article</button>
          {!sub.isPro && <button onClick={() => setShowPricing(true)} style={{ padding: "10px 28px", borderRadius: 10, border: "none", background: t.accent, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", display: "inline-flex", alignItems: "center", gap: 8 }}><Crown size={14} /> See Pro plans</button>}
        </div>
        <LandingRecentDocs recentList={recentDocs.recentList} onLoad={loadRecentDoc} isPro={sub.isPro} t={t} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 40 }}>
          {Object.entries(THEMES).map(([key, th]) => {
            const free = isThemeFree(key);
            const locked = !sub.isPro && !free;
            const label = `${key[0].toUpperCase()}${key.slice(1)}${locked ? " (Pro)" : ""}`;
            return (
              <Tip key={key} label={label} t={t} themeKey={key} side="top">
                <button
                  onClick={(e) => gateCosmetic(free, () => runThemeTransition(e, () => setTheme(key)))}
                  style={{ position: "relative", width: 26, height: 26, borderRadius: 13, background: th.accent, cursor: "pointer", border: theme === key ? `2.5px solid ${t.fg}` : "2.5px solid transparent", boxShadow: theme === key ? `0 0 0 2.5px ${t.bg}` : "none", transition: "all 0.15s", opacity: locked ? 0.55 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  {locked && <Lock size={10} style={{ color: "#fff", filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />}
                </button>
              </Tip>
            );
          })}
        </div>
      </div>
      </div>
      <Footer t={t} />
    </div>
  );

  // ═══════════════════════════════════════════
  // FULL-SCREEN LOADING
  // ═══════════════════════════════════════════
  if (loading) return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.fg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <CatLoader size={220} style={{ marginBottom: 20 }} />
      <p style={{ fontSize: 16, fontWeight: 620, color: t.fg, marginBottom: 4 }}>{loadMsg}</p>
      <p style={{ fontSize: 13, color: t.fgSoft }}>This may take a moment for large files</p>
    </div>
  );

  // ═══════════════════════════════════════════
  // READER VIEW
  // ═══════════════════════════════════════════
  return (
    <div style={{ height: "100vh", overflow: "hidden", background: t.bg, color: t.fg, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      {user && deletionEffectiveAt && <PendingDeletionBanner user={user} effectiveAt={deletionEffectiveAt} onReactivated={refreshDeletionStatus} t={t} />}
      {user && sub.isLockedOut && <PostDeletionLockoutBanner lockoutUntil={sub.lockoutUntil} onSubscribe={() => setShowPricing(true)} />}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
      {modals}

      {/* ── SIDEBAR ── */}
      <div className="rf-no-select" style={{ width: panelOpen ? 296 : 0, minWidth: panelOpen ? 296 : 0, height: "100%", overflowY: "auto", overflowX: "hidden", borderRight: panelOpen ? `1px solid ${t.border}` : "none", background: t.bg, transition: "width 0.3s ease, min-width 0.3s ease" }}>
        {panelOpen && (
          <div style={{ width: 296 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "12px 12px 0px" }}>
              <Tip label="Close panel" t={t} side="bottom">
                <button onClick={() => setPanelOpen(false)} style={{ width: 34, height: 34, borderRadius: 8, border: "none", background: "transparent", color: t.icon, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><PanelLeftClose size={16} strokeWidth={2} /></button>
              </Tip>
            </div>

            <div style={{ padding: "10px 0 2px" }}>
              <UploadBadge sub={sub} onUpgrade={() => setShowPricing(true)} onCancel={() => sub.cancelTrial()} t={t} />
              {/* DEV ONLY — admin role only */}
            </div>

            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${t.borderSoft}` }}>
              <p style={{ fontSize: 11, fontWeight: 650, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 8px", padding: "0 2px" }}>Currently Reading</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: t.fgSoft }}>
                <FileText size={13} /><span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</span>
                <button aria-label="Close document" onClick={() => { setText(""); setDocSections(null); setFileName(""); setFocusPara(-1); }} style={{ width: 34, height: 34, borderRadius: 8, border: "none", background: "transparent", color: t.icon, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><X size={16} strokeWidth={2} /></button>
              </div>
            </div>

            <Section title="Enhancements" icon={Sparkles} t={t} open={false}>
              <Toggle on={neuroDiv} onChange={setNeuroDiv} label="NeuroDiv Anchoring" icon={Baseline} t={t} />
              {neuroDiv && <Slider value={neuroDivIntensity} min={0.2} max={0.7} step={0.01} onChange={setNeuroDivIntensity} label="Bold intensity" format={FMT_PCT_FROM_FRAC} t={t} />}
              <Toggle on={hueGuide} onChange={setHueGuide} label="HueGuide Tracking" icon={Palette} t={t} />
              {hueGuide && <div style={{ padding: "6px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>{Object.entries(PALETTES).map(([k, pal]) => {
                const free = isPaletteFree(k);
                const locked = !sub.isPro && !free;
                const tipLabel = `${pal.label}${pal.cvdSafe ? " · colorblind-safe" : ""}${locked ? " (Pro)" : ""}`;
                return (
                  <Tip key={k} label={tipLabel} t={t} side="top">
                    <button
                      onClick={() => gateCosmetic(free, () => setHuePalette(k))}
                      style={{ position: "relative", width: 42, height: 26, borderRadius: 8, overflow: "hidden", display: "flex", padding: 0, cursor: "pointer", border: huePalette === k ? `2px solid ${t.accent}` : `1px solid ${t.border}`, boxShadow: huePalette === k ? `0 0 0 2px ${t.accentSoft}` : "none", transition: "all 0.15s", opacity: locked ? 0.55 : 1 }}
                    >
                      {pal.colors.map((c, i) => <div key={i} style={{ flex: 1, background: c, height: "100%" }} />)}
                      {locked && <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Lock size={11} style={{ color: "#fff", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }} /></span>}
                    </button>
                  </Tip>
                );
              })}</div>}
              {hueGuide && <Slider value={hueIntensity} min={0} max={1} step={0.01} onChange={setHueIntensity} onLiveChange={liveWriters.hueIntensity} label="Hue intensity" format={FMT_PCT_FROM_FRAC} t={t} />}
              <Toggle on={focusMode} onChange={v => { setFocusMode(v); if (!v) setFocusPara(-1); }} label="Focus Mode" icon={Focus} t={t} />
            </Section>

            <Section title="Reading Guide" icon={MousePointer2} t={t} open={false}>
              <div style={{ padding: "4px 12px" }}>
                <Segment options={[{ value: "none", label: "Off", icon: EyeOff }, { value: "highlight", label: "Highlight", icon: Highlighter }, { value: "underline", label: "Line", icon: UnderlineIcon }, { value: "dim", label: "Dim", icon: Eye }]} value={guideMode} onChange={setGuideMode} t={t} />
              </div>
              {guideMode === "dim" && <Slider value={guideDimOpacity} min={0.05} max={0.7} step={0.01} onChange={setGuideDimOpacity} label="Dim opacity" format={FMT_PCT_FROM_FRAC} t={t} />}
              {(guideMode === "highlight" || guideMode === "underline") && (
                <div style={{ padding: "10px 12px 4px" }}>
                  <span style={{ fontSize: 12, color: t.fgSoft, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", marginBottom: 8, display: "block" }}>Guide color</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {Object.entries(GUIDE_COLORS).map(([k, gc]) => {
                      const active = guideColor === k;
                      const dot = gc.dot || t.accent;
                      const free = isGuideColorFree(k);
                      const locked = !sub.isPro && !free;
                      return (
                        <button
                          key={k}
                          onClick={() => gateCosmetic(free, () => setGuideColor(k))}
                          title={`${gc.label}${locked ? " (Pro)" : ""}`}
                          style={{ width: 28, height: 28, borderRadius: 8, cursor: "pointer", border: active ? `2px solid ${dot}` : `1.5px solid ${t.border}`, background: k === "accent" ? `conic-gradient(from 0deg, ${t.accent}, ${t.accent}88, ${t.accent})` : (gc.highlight || dot), boxShadow: active ? `0 0 0 2px ${dot}33` : "none", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", opacity: locked ? 0.55 : 1 }}
                        >
                          {locked
                            ? <Lock size={11} style={{ color: "#fff", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }} />
                            : (active && <Check size={12} style={{ color: k === "accent" || k === "yellow" || k === "orange" ? "#333" : "#fff" }} />)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </Section>

            <Section title="Typography" icon={Type} t={t} open={false}>
              <FontPicker value={fontFamily} onChange={setFontFamily} t={t} />
              <Slider value={fontSize} min={12} max={36} step={1} onChange={setFontSize} onLiveChange={liveWriters.fontSize} label="Font size" format={FMT_PX} t={t} />
              <Slider value={lineHeight} min={1.0} max={3} step={0.05} onChange={setLineHeight} onLiveChange={liveWriters.lineHeight} label="Line height" format={FMT_LH} t={t} />
              <Slider value={letterSpacing} min={-1} max={5} step={0.1} onChange={setLetterSpacing} onLiveChange={liveWriters.letterSpacing} label="Letter spacing" format={FMT_FIXED1_PX} t={t} />
              <Slider value={wordSpacing} min={0} max={12} step={0.5} onChange={setWordSpacing} onLiveChange={liveWriters.wordSpacing} label="Word spacing" format={FMT_FIXED1_PX} t={t} />
              <Slider value={columnWidth} min={40} max={100} step={1} onChange={setColumnWidth} onLiveChange={liveWriters.columnWidth} label="Column width" format={FMT_PCT} t={t} />
              <div style={{ padding: "4px 12px 8px" }}>
                <span style={{ fontSize: 12, color: t.fgSoft, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", marginBottom: 6, display: "block" }}>Text alignment</span>
                <Segment options={[{ value: "left", label: "Left", icon: AlignLeft }, { value: "center", label: "Center", icon: AlignCenter }, { value: "right", label: "Right", icon: AlignRight }, { value: "justify", label: "Justify", icon: AlignJustify }]} value={textAlign} onChange={setTextAlign} t={t} />
              </div>
            </Section>

            <Section title="Theme" icon={Sun} t={t} open={false}>
              <div style={{ padding: "6px 12px 4px", display: "grid", gridTemplateColumns: "1fr 1fr", gridAutoFlow: "column", gridTemplateRows: "repeat(5, auto)", gap: 10 }}>
                {[...LIGHT_THEME_KEYS, ...DARK_THEME_KEYS].map(key => {
                  const th = THEMES[key];
                  const isActive = theme === key;
                  const isDark = DARK_THEME_KEYS.includes(key);
                  const free = isThemeFree(key);
                  const locked = !sub.isPro && !free;
                  return (
                    <button
                      key={key}
                      onClick={(e) => gateCosmetic(free, () => runThemeTransition(e, () => setTheme(key)))}
                      className="rf-btn-icon-active"
                      style={{
                        padding: "9px 14px",
                        borderRadius: 10,
                        border: isActive ? `2px solid ${t.accent}` : "2px solid transparent",
                        backgroundColor: th.bg,
                        // Suppress the rf-btn-icon-active radial white highlight on dark tiles
                        // (it reads as a glaring shine on dark backgrounds). Light tiles keep it
                        // because there it adds a subtle paper-like sheen.
                        backgroundImage: isDark ? "none" : undefined,
                        color: th.fg,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        minHeight: 40,
                        fontFamily: "'DM Sans', sans-serif",
                        boxSizing: "border-box",
                        outline: "none",
                        transition: "transform 0.15s, box-shadow 0.15s, filter 0.15s, border-color 0.15s",
                        opacity: locked ? 0.55 : 1,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: th.fg, textTransform: "capitalize", letterSpacing: "0.02em", textAlign: "left" }}>
                        {locked && <Lock size={11} style={{ color: th.fg }} />}
                        {key}
                      </span>
                      <span style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        background: th.accent,
                        flexShrink: 0,
                        border: isActive ? `2px solid ${th.fg}` : "2px solid transparent",
                        boxShadow: isActive ? `0 0 0 2px ${th.bg}` : "none",
                        boxSizing: "border-box",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                      }} />
                    </button>
                  );
                })}
              </div>
            </Section>

            <div style={{ padding: 14 }}>
              <button onClick={() => sub.canUpload ? fileRef.current?.click() : setShowPaywall(true)} className="rf-btn" style={{ width: "100%", padding: "10px 16px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface, color: t.fgSoft, cursor: "pointer", fontSize: 13, fontWeight: 560, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxSizing: "border-box" }}><Upload size={14} /> Upload new file</button>
              <input ref={fileRef} type="file" accept={FILE_ACCEPT} style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) attemptUpload(f); }} />
            </div>

            <SidebarRecentDocs recentList={recentDocs.recentList} fileName={fileName} onLoad={loadRecentDoc} onRemove={id => recentDocs.removeDoc(id)} isPro={sub.isPro} t={t} />
          </div>
        )}
      </div>

      {/* ── READER ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 16px", borderBottom: `1px solid ${t.borderSoft}`, minHeight: 44, background: t.bg }}>
          {!panelOpen && (
            <Tip label="Open panel" t={t} side="bottom">
              <button onClick={() => setPanelOpen(true)} style={{ width: 34, height: 34, borderRadius: 8, border: "none", background: "transparent", color: t.icon, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><PanelLeft size={16} strokeWidth={2} /></button>
            </Tip>
          )}
          <button
            onClick={() => { setText(""); setDocSections(null); setFileName(""); setFocusPara(-1); }}
            className="rf-static"
            title="Back to library"
            style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontSize: 20, fontWeight: 620, color: t.fg, fontFamily: currentFont?.css ?? "'DM Sans', sans-serif", outline: "none", transition: "font-family 0.2s" }}
          >
            {/* key={fontFamily} forces remount on font change so the gradient
                sweep animation re-fires — a cute visual confirmation that the
                font swap took effect. */}
            <DiaTextReveal
              key={fontFamily}
              text="ReadFlow"
              colors={getRevealColors(theme)}
              textColor={t.fg}
              duration={1.5}
            />
          </button>
          <div style={{ flex: 1 }} />

          {sub.isPro && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: t.accentSoft, fontSize: 11, fontWeight: 620, color: t.accent, fontFamily: "'DM Sans', sans-serif" }}>
              {sub.isTrial
                ? <><Clock size={12} /> Trial — {sub.trialDaysLeft}d left</>
                : <><Crown size={12} /> Pro</>}
            </div>
          )}

          {/* Chapter navigator */}
          {hasSections && docSections.length > 1 && (
            <DropdownMenu.Root open={showChapterNav} onOpenChange={setShowChapterNav}>
              <DropdownMenu.Trigger asChild>
                <button className="rf-static" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: showChapterNav ? t.surface : "transparent", color: t.fgSoft, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", outline: "none" }}>
                  <List size={14} />
                  <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{docSections.length} {docSections[0]?.type === "page" ? "pages" : "chapters"}</span>
                  <ChevronDown size={12} style={{ transform: showChapterNav ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: "0 12px 36px rgba(0,0,0,0.18)", maxHeight: "60vh", overflowY: "auto", width: 280, zIndex: 999, outline: "none" }}
                >
                  <div style={{ padding: "10px 14px 8px", borderBottom: `1px solid ${t.borderSoft}` }}>
                    <span style={{ fontSize: 11, fontWeight: 650, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>Table of Contents</span>
                  </div>
                  {docSections.map((sec, si) => (
                    <DropdownMenu.Item
                      key={si}
                      onSelect={() => scrollToSection(si)}
                      onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      style={{ padding: "10px 14px", cursor: "pointer", color: t.fg, display: "flex", alignItems: "center", gap: 10, borderBottom: si < docSections.length - 1 ? `1px solid ${t.borderSoft}` : "none", outline: "none", userSelect: "none" }}
                    >
                      <span style={{ width: 26, height: 26, borderRadius: 7, background: t.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: t.accent, flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}>{sec.number || si + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 550, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sec.title || (sec.type === "page" ? `Page ${sec.number || si + 1}` : "Untitled section")}</span>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {[{ on: neuroDiv, set: setNeuroDiv, icon: Baseline, tip: "NeuroDiv" }, { on: hueGuide, set: setHueGuide, icon: Palette, tip: "HueGuide" }, { on: focusMode, set: v => { setFocusMode(v); if (!v) setFocusPara(-1); }, icon: Focus, tip: "Focus" }].map(({ on, set, icon: Icon, tip }) => (
              <Tip key={tip} label={tip} t={t} side="bottom">
                <button onClick={() => set(!on)} className={on ? "rf-btn-icon-active" : ""} style={{ width: 34, height: 34, borderRadius: 8, border: "none", background: on ? t.accent : "transparent", color: on ? "#fff" : t.icon, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={16} strokeWidth={2} /></button>
              </Tip>
            ))}
          </div>
          <UserMenu t={t} onShowAuth={() => setShowAuth(true)} onShowAvatarSettings={() => setShowAvatarSettings(true)} onShowSubscription={() => setShowSubscription(true)} onShowPaymentReceipts={handleShowPaymentReceipts} showPaymentReceipts={sub.hasStripeHistory} onShowDeleteAccount={() => setShowDeleteAccount(true)} avatar={avatar} themePersistEnabled={themePref.persistEnabled} onToggleThemePersist={onToggleThemePersist} mockFreeMode={sub.mockFreeMode} onToggleMockFreeMode={sub.toggleMockFreeMode} isProGrantActive={sub.isProGrantActive} />
        </div>

        {/* Reader scroll area */}
        <div ref={readerRef} className="rf-reader-scroll"
          onMouseMove={e => { guide.handleMouseMove(e, readerRef.current); if (!showGuide && guideMode !== "none") setShowGuide(true); }}
          onMouseLeave={() => { guide.handleMouseLeave(); setShowGuide(false); }}
          onScroll={() => guide.handleScroll()}
          style={{ flex: 1, overflowY: "auto", position: "relative", background: t.reader }}>
          {guide.renderOverlay(showGuide)}
          <ErrorBoundary
            t={t}
            title="Couldn't render this document"
            description="The reader hit an error displaying this file. It may be malformed or use unsupported markup. Try another document, or reset to clear the error."
            onReset={() => { setText(""); setDocSections(null); setFileName(""); }}
          >
            <DocumentBody
              text={text} docSections={docSections} hasSections={hasSections}
              wrapperRef={handleDocWrapperRef} featureClassRef={handleFeatureClassRef}
              settings={settings} focusModeRef={focusModeRef}
              setFocusPara={setFocusPara} sectionRefs={sectionRefs}
            />
          </ErrorBoundary>
        </div>
      </div>
      </div>
    </div>
  );
}
