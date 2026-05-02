import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import {
  Upload, FileText, Type, Palette, Eye, Sun, Moon, BookOpen,
  ChevronDown, X, Sparkles, Baseline, Highlighter, Underline as UnderlineIcon,
  EyeOff, MousePointer2, Focus, PanelLeftClose, PanelLeft, Loader2,
  Crown, Clock, Check, List,
  AlignLeft, AlignCenter, AlignRight, AlignJustify
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { THEMES, PALETTES, GUIDE_COLORS, FONTS, DEMO_TEXT } from "./config/constants";
import { getRevealColors } from "./config/themeColors";

// Stable Slider format helpers (module-level so memo on Slider isn't busted each App render).
const FMT_PX = v => `${v}px`;
const FMT_LH = v => v.toFixed(2);
const FMT_FIXED1_PX = v => `${v.toFixed(1)}px`;
const FMT_PCT = v => `${v}%`;
const FMT_PCT_FROM_FRAC = v => `${Math.round(v * 100)}%`;

// Theme picker layout: left column = light themes, right column = dark themes (5 + 5).
// Render order is light-first-then-dark; grid-auto-flow: column with 5 rows places them
// in two visual columns. Add new themes to the appropriate array — order within each is the row order.
const LIGHT_THEME_KEYS = ["warm", "cool", "sepia", "forest", "crimson"];
const DARK_THEME_KEYS = ["phosphor", "jungle", "dark", "midnight", "obsidian"];
import { parsePDF, parseEPUB, parseDOCX, parseHTMLStructured, detectTextStructure, runThemeTransition } from "./utils";
import { useSubscription } from "./hooks/useSubscription";
import { useRecentDocs } from "./hooks/useRecentDocs";
import { useAvatar } from "./hooks/useAvatar";
import { useThemePreference } from "./hooks/useThemePreference";
import { useAuth } from "./contexts/AuthContext";
import {
  Toggle, Slider, Segment, Section, FontPicker, Tip,
  UploadBadge, SidebarRecentDocs, LandingRecentDocs,
  DocumentBody, useReadingGuide,
  PricingModal, PaywallModal, CheckoutModal,
  AuthModal, UserMenu, AdminPanel, AvatarSettingsModal,
  DiaTextReveal,
} from "./components";

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
  const { user, role, loading: authLoading } = useAuth();
  const { avatar, saveAvatar } = useAvatar(user?.id);
  const themePref = useThemePreference(user?.id);
  const [showAuth, setShowAuth] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAvatarSettings, setShowAvatarSettings] = useState(false);

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
  const sub = useSubscription(role);
  const recentDocs = useRecentDocs();
  const [showPricing, setShowPricing] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutBilling, setCheckoutBilling] = useState("monthly");
  const [showChapterNav, setShowChapterNav] = useState(false);
  const [devBypass, setDevBypass] = useState(false);
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
    if (s.currentFontCss) el.style.setProperty("--rf-font-family", s.currentFontCss);
  }, []);

  // Per-slider live writers: write a single CSS var directly to the wrapper on every drag tick.
  // App state isn't touched during drag — we update it once on release via the slider's onChange.
  const liveWriters = useMemo(() => ({
    fontSize: v => docWrapperRef.current?.style.setProperty("--rf-font-size", `${v}px`),
    lineHeight: v => docWrapperRef.current?.style.setProperty("--rf-line-height", String(v)),
    columnWidth: v => docWrapperRef.current?.style.setProperty("--rf-column-width", `${v}%`),
    letterSpacing: v => docWrapperRef.current?.style.setProperty("--rf-letter-spacing", `${v}px`),
    wordSpacing: v => docWrapperRef.current?.style.setProperty("--rf-word-spacing", `${v}px`),
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
  }, [fontSize, lineHeight, columnWidth, letterSpacing, wordSpacing, textAlign, currentFontCss, writeTypographyVars]);

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
    if (!sub.canUpload && !devBypass) { setShowPaywall(true); return; }
    doUpload(file);
  }, [user, sub.canUpload, devBypass]);

  const doUpload = useCallback(async (file) => {
    setLoading(true); setLoadMsg("Reading file…");
    try {
      const ext = file.name.split(".").pop().toLowerCase();
      let sections;
      if (ext === "pdf") { setLoadMsg("Loading PDF engine…"); sections = await parsePDF(file); }
      else if (ext === "epub") { setLoadMsg("Unpacking EPUB…"); sections = await parseEPUB(file); }
      else if (ext === "docx") { setLoadMsg("Extracting DOCX…"); sections = await parseDOCX(file); }
      else if (ext === "html" || ext === "htm") { setLoadMsg("Parsing HTML…"); sections = parseHTMLStructured(await file.text()); }
      else { sections = detectTextStructure(await file.text()); }
      sub.recordUpload();
      const fullText = sections.map(s => [s.title, s.content].filter(Boolean).join("\n\n")).join("\n\n");
      setText(fullText); setDocSections(sections); setFileName(file.name);
      await recentDocs.saveDoc(file.name, sections, fullText);
    } catch (e) { setText("Error reading file: " + e.message); setDocSections(null); setFileName(file.name); }
    finally { setLoading(false); setLoadMsg(""); }
  }, [sub, recentDocs]);

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
  const handleSelectPlan = useCallback((billing) => { setShowPricing(false); setCheckoutBilling(billing); setShowCheckout(true); }, []);
  const handleCheckoutSuccess = useCallback((billing) => { setShowCheckout(false); if (!sub.isTrial && sub.plan === "free") sub.startTrial(billing); else sub.activatePro(billing); }, [sub]);

  const FILE_ACCEPT = ".pdf,.epub,.txt,.md,.docx,.html,.htm,.csv,.json,.log,.rtf";

  // ── Modals ──
  const modals = (<>
    {showPricing && <PricingModal onClose={() => setShowPricing(false)} onSelectPlan={handleSelectPlan} hasUsedTrial={sub.isTrial || sub.plan === "pro"} t={t} />}
    {showCheckout && <CheckoutModal billing={checkoutBilling} hasUsedTrial={sub.isTrial || sub.plan === "pro"} onSuccess={handleCheckoutSuccess} onClose={() => setShowCheckout(false)} t={t} />}
    {showPaywall && <PaywallModal uploadsUsed={sub.uploadsUsed} onUpgrade={() => { setShowPaywall(false); setShowPricing(true); }} onClose={() => setShowPaywall(false)} t={t} />}
    {showAuth && <AuthModal onClose={() => setShowAuth(false)} t={t} />}
    {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} t={t} />}
    {showAvatarSettings && <AvatarSettingsModal onClose={() => setShowAvatarSettings(false)} onSave={saveAvatar} currentAvatar={avatar} t={t} />}
  </>);

  // ═══════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════
  if (!sub.loaded) return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center" }}><BookOpen size={28} style={{ color: t.accent, marginBottom: 10 }} /><p style={{ fontSize: 14, color: t.fgSoft }}>Loading ReadFlow…</p></div>
    </div>
  );

  // ═══════════════════════════════════════════
  // LANDING PAGE
  // ═══════════════════════════════════════════
  if (!text && !loading) return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.fg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 24 }}>
      {modals}
      <div style={{ position: "fixed", top: 14, right: 16, zIndex: 100 }}>
        <UserMenu t={t} onShowAuth={() => setShowAuth(true)} onShowAdmin={() => setShowAdmin(true)} onShowAvatarSettings={() => setShowAvatarSettings(true)} avatar={avatar} themePersistEnabled={themePref.persistEnabled} onToggleThemePersist={onToggleThemePersist} />
      </div>
      <div style={{ textAlign: "center", maxWidth: 520 }}>
        <div style={{ width: 68, height: 68, borderRadius: 20, background: t.accentSoft, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}><BookOpen size={32} style={{ color: t.accent }} /></div>
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
            text="Adaptive reading enhancement with word anchoring, color-gradient tracking, focus mode, and full typography control."
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
          <input ref={fileRef} type="file" accept={FILE_ACCEPT} style={{ display: "none" }} onChange={e => e.target.files?.[0] && attemptUpload(e.target.files[0])} />
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => { const s = detectTextStructure(DEMO_TEXT); setText(DEMO_TEXT); setDocSections(s); setFileName("demo-article.txt"); }} style={{ padding: "10px 28px", borderRadius: 10, border: "none", background: t.surface, color: t.fg, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", display: "inline-flex", alignItems: "center", gap: 8 }}><FileText size={14} /> Try demo article</button>
          {!sub.isPro && <button onClick={() => setShowPricing(true)} style={{ padding: "10px 28px", borderRadius: 10, border: "none", background: t.accent, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", display: "inline-flex", alignItems: "center", gap: 8 }}><Crown size={14} /> See Pro plans</button>}
        </div>
        <LandingRecentDocs recentList={recentDocs.recentList} onLoad={loadRecentDoc} t={t} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 40 }}>
          {Object.entries(THEMES).map(([key, th]) => (
            <Tip key={key} label={key[0].toUpperCase() + key.slice(1)} t={t} themeKey={key} side="top">
              <button onClick={(e) => runThemeTransition(e, () => setTheme(key))} style={{ width: 26, height: 26, borderRadius: 13, background: th.accent, cursor: "pointer", border: theme === key ? `2.5px solid ${t.fg}` : "2.5px solid transparent", boxShadow: theme === key ? `0 0 0 2.5px ${t.bg}` : "none", transition: "all 0.15s" }} />
            </Tip>
          ))}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════
  // FULL-SCREEN LOADING
  // ═══════════════════════════════════════════
  if (loading && !text) return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.fg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <Loader2 size={36} style={{ color: t.accent, marginBottom: 16, animation: "spin 1s linear infinite" }} />
      <p style={{ fontSize: 16, fontWeight: 620, color: t.fg, marginBottom: 4 }}>{loadMsg}</p>
      <p style={{ fontSize: 13, color: t.fgSoft }}>This may take a moment for large files</p>
    </div>
  );

  // ═══════════════════════════════════════════
  // READER VIEW
  // ═══════════════════════════════════════════
  return (
    <div style={{ height: "100vh", overflow: "hidden", background: t.bg, color: t.fg, fontFamily: "'DM Sans', sans-serif", display: "flex" }}>
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
              {role === "admin" && <div style={{ padding: "0 14px 4px" }}><button onClick={() => setDevBypass(!devBypass)} style={{ width: "100%", padding: "5px 10px", borderRadius: 7, border: `1px dashed ${devBypass ? "#22C55E" : "#E25C5C"}`, background: devBypass ? "#22C55E12" : "transparent", color: devBypass ? "#22C55E" : "#E25C5C", cursor: "pointer", fontSize: 10, fontWeight: 650, fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, boxSizing: "border-box" }}>{devBypass ? "✓ DEV: Uploads unlimited" : "⚙ DEV: Disable upload limit"}</button></div>}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${t.borderSoft}`, fontSize: 12, color: t.fgSoft }}>
              <FileText size={13} /><span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</span>
              <button aria-label="Close document" onClick={() => { setText(""); setDocSections(null); setFileName(""); setFocusPara(-1); }} style={{ width: 34, height: 34, borderRadius: 8, border: "none", background: "transparent", color: t.icon, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><X size={16} strokeWidth={2} /></button>
            </div>

            <Section title="Enhancements" icon={Sparkles} t={t} open={false}>
              <Toggle on={neuroDiv} onChange={setNeuroDiv} label="NeuroDiv Anchoring" icon={Baseline} t={t} />
              {neuroDiv && <Slider value={neuroDivIntensity} min={0.2} max={0.7} step={0.01} onChange={setNeuroDivIntensity} label="Bold intensity" format={FMT_PCT_FROM_FRAC} t={t} />}
              <Toggle on={hueGuide} onChange={setHueGuide} label="HueGuide Tracking" icon={Palette} t={t} />
              {hueGuide && <div style={{ padding: "6px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>{Object.entries(PALETTES).map(([k, pal]) => <button key={k} onClick={() => setHuePalette(k)} title={pal.label} style={{ width: 42, height: 26, borderRadius: 8, overflow: "hidden", display: "flex", padding: 0, cursor: "pointer", border: huePalette === k ? `2px solid ${t.accent}` : `1px solid ${t.border}`, boxShadow: huePalette === k ? `0 0 0 2px ${t.accentSoft}` : "none", transition: "all 0.15s" }}>{pal.colors.map((c, i) => <div key={i} style={{ flex: 1, background: c, height: "100%" }} />)}</button>)}</div>}
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
                    {Object.entries(GUIDE_COLORS).map(([k, gc]) => { const active = guideColor === k; const dot = gc.dot || t.accent; return (
                      <button key={k} onClick={() => setGuideColor(k)} title={gc.label} style={{ width: 28, height: 28, borderRadius: 8, cursor: "pointer", border: active ? `2px solid ${dot}` : `1.5px solid ${t.border}`, background: k === "accent" ? `conic-gradient(from 0deg, ${t.accent}, ${t.accent}88, ${t.accent})` : (gc.highlight || dot), boxShadow: active ? `0 0 0 2px ${dot}33` : "none", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center" }}>{active && <Check size={12} style={{ color: k === "accent" || k === "yellow" || k === "orange" ? "#333" : "#fff" }} />}</button>
                    ); })}
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
                  return (
                    <button
                      key={key}
                      onClick={(e) => runThemeTransition(e, () => setTheme(key))}
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
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: th.fg, textTransform: "capitalize", letterSpacing: "0.02em", textAlign: "left" }}>{key}</span>
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
              <button onClick={() => (sub.canUpload || devBypass) ? fileRef.current?.click() : setShowPaywall(true)} className="rf-btn" style={{ width: "100%", padding: "10px 16px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface, color: t.fgSoft, cursor: "pointer", fontSize: 13, fontWeight: 560, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxSizing: "border-box" }}><Upload size={14} /> Upload new file</button>
              <input ref={fileRef} type="file" accept={FILE_ACCEPT} style={{ display: "none" }} onChange={e => e.target.files?.[0] && attemptUpload(e.target.files[0])} />
            </div>

            <SidebarRecentDocs recentList={recentDocs.recentList} fileName={fileName} onLoad={loadRecentDoc} onRemove={id => recentDocs.removeDoc(id)} t={t} />
          </div>
        )}
      </div>

      {/* ── READER ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 16px", borderBottom: `1px solid ${t.borderSoft}`, minHeight: 44, background: t.bg }}>
          {!panelOpen && (<>
            <Tip label="Open panel" t={t} side="bottom">
              <button onClick={() => setPanelOpen(true)} style={{ width: 34, height: 34, borderRadius: 8, border: "none", background: "transparent", color: t.icon, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><PanelLeft size={16} strokeWidth={2} /></button>
            </Tip>
            <span style={{ fontSize: 14, fontWeight: 620, color: t.fg }}>ReadFlow</span>
          </>)}
          <div style={{ flex: 1 }} />

          {sub.isPro && !sub.isTrial && <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: t.accentSoft, fontSize: 11, fontWeight: 620, color: t.accent, fontFamily: "'DM Sans', sans-serif" }}><Crown size={12} /> Pro</div>}

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

          {sub.isTrial && <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: t.accentSoft, fontSize: 11, fontWeight: 620, color: t.accent, fontFamily: "'DM Sans', sans-serif" }}><Clock size={12} /> Trial — {sub.trialDaysLeft}d left</div>}

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {[{ on: neuroDiv, set: setNeuroDiv, icon: Baseline, tip: "NeuroDiv" }, { on: hueGuide, set: setHueGuide, icon: Palette, tip: "HueGuide" }, { on: focusMode, set: v => { setFocusMode(v); if (!v) setFocusPara(-1); }, icon: Focus, tip: "Focus" }].map(({ on, set, icon: Icon, tip }) => (
              <Tip key={tip} label={tip} t={t} side="bottom">
                <button onClick={() => set(!on)} className={on ? "rf-btn-icon-active" : ""} style={{ width: 34, height: 34, borderRadius: 8, border: "none", background: on ? t.accent : "transparent", color: on ? "#fff" : t.icon, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={16} strokeWidth={2} /></button>
              </Tip>
            ))}
          </div>
          <UserMenu t={t} onShowAuth={() => setShowAuth(true)} onShowAdmin={() => setShowAdmin(true)} onShowAvatarSettings={() => setShowAvatarSettings(true)} avatar={avatar} themePersistEnabled={themePref.persistEnabled} onToggleThemePersist={onToggleThemePersist} />
        </div>

        {/* Reader scroll area */}
        <div ref={readerRef} className="rf-reader-scroll"
          onMouseMove={e => { guide.handleMouseMove(e, readerRef.current); if (!showGuide && guideMode !== "none") setShowGuide(true); }}
          onMouseLeave={() => { guide.handleMouseLeave(); setShowGuide(false); }}
          onScroll={() => guide.handleScroll()}
          style={{ flex: 1, overflowY: "auto", position: "relative", background: t.reader }}>
          {guide.renderOverlay(showGuide)}
          <DocumentBody
            text={text} docSections={docSections} hasSections={hasSections}
            wrapperRef={handleDocWrapperRef} featureClassRef={handleFeatureClassRef}
            settings={settings} focusModeRef={focusModeRef}
            setFocusPara={setFocusPara} sectionRefs={sectionRefs}
          />
        </div>
      </div>
    </div>
  );
}
