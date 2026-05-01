import { memo, useMemo, useCallback } from "react";
import { PALETTES } from "../config/constants";

const renderWord = (word, wi, total, huePalette, neuroDivIntensity) => {
  const colors = PALETTES[huePalette].colors;
  const cIdx = total > 1 ? Math.floor((wi / (total - 1)) * (colors.length - 1)) : 0;
  const color = colors[Math.min(cIdx, colors.length - 1)];
  const bl = Math.max(1, Math.round(word.length * neuroDivIntensity));
  return (
    <span key={wi} className="rf-word" style={{ "--hue-color": color }}>
      <strong>{word.slice(0, bl)}</strong>{word.slice(bl)}{" "}
    </span>
  );
};

// Typography-driven dimensions read entirely from CSS custom properties set on the wrapper via ref.
// Every var() includes a fallback so a transient unset state (between mount and first ref-write)
// still renders correctly — important because calc() with an unresolved var has no implicit fallback.
const PARA_STYLE = { marginBottom: "calc(var(--rf-line-height, 1.8) * 0.7em)" };
const LINE_STYLE = { margin: "0 0 0.25em 0" };
const DIVIDER_BAR_STYLE = { margin: "calc(var(--rf-line-height, 1.8) * 1.5em) 0", display: "flex", alignItems: "center", gap: 16 };
const DIVIDER_LINE_BASE = { flex: 1, height: 1 };
const DIVIDER_PLAIN_STYLE = { margin: "calc(var(--rf-line-height, 1.8) * 1.5em) 0", height: 1 };
const TITLE_WRAP_STYLE = { marginBottom: "calc(var(--rf-line-height, 1.8) * 0.8em)" };
const TYPE_LABEL_STYLE = { fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" };
const INNER_STYLE = { textAlign: "var(--rf-text-align, left)" };

const Paragraph = memo(function Paragraph({ para, idx, huePalette, neuroDivIntensity, onMouseEnter }) {
  const lines = para.split("\n").filter(l => l.trim());
  return (
    <div className="rf-para" data-idx={idx} onMouseEnter={() => onMouseEnter(idx)} style={PARA_STYLE}>
      {lines.map((line, li) => {
        const words = line.split(/\s+/).filter(Boolean);
        return <p key={li} style={LINE_STYLE}>{words.map((w, wi) => renderWord(w, wi, words.length, huePalette, neuroDivIntensity))}</p>;
      })}
    </div>
  );
});

const Section = memo(function Section({ section, si, settings, onParaMouseEnter, refCallback }) {
  const { t, huePalette, neuroDivIntensity } = settings;
  const paras = useMemo(() => section.content.split(/\n\s*\n/).filter(p => p.trim()), [section.content]);
  const isPage = section.type === "page";
  const typeLabel = isPage ? `Page ${section.number}` : null;
  const titleScale = isPage ? 1.4 : 1.5;

  return (
    <div ref={refCallback} className="rf-section">
      {si > 0 && (typeLabel ? (
        <div style={DIVIDER_BAR_STYLE}>
          <div style={{ ...DIVIDER_LINE_BASE, background: t.border }} />
          <span style={{ ...TYPE_LABEL_STYLE, color: t.fgSoft }}>{typeLabel}</span>
          <div style={{ ...DIVIDER_LINE_BASE, background: t.border }} />
        </div>
      ) : (
        <div style={{ ...DIVIDER_PLAIN_STYLE, background: t.border }} />
      ))}
      {section.title && (
        <div style={TITLE_WRAP_STYLE}>
          <h2 style={{
            fontSize: `calc(var(--rf-font-size, 18px) * ${titleScale})`,
            fontWeight: isPage ? 740 : 760,
            color: t.fg,
            margin: 0,
            lineHeight: isPage ? 1.3 : 1.25,
            fontFamily: "var(--rf-font-family, 'Literata', serif)",
            letterSpacing: isPage ? "-0.01em" : "-0.02em",
          }}>
            {section.title.split(/\s+/).map((w, wi, arr) => renderWord(w, wi, arr.length, huePalette, neuroDivIntensity))}
          </h2>
        </div>
      )}
      {paras.map((p, pi) => (
        <Paragraph
          key={pi}
          para={p}
          idx={si * 10000 + pi}
          huePalette={huePalette}
          neuroDivIntensity={neuroDivIntensity}
          onMouseEnter={onParaMouseEnter}
        />
      ))}
    </div>
  );
});

const DocumentBody = memo(function DocumentBody({ text, docSections, hasSections, wrapperRef, featureClassRef, settings, focusModeRef, setFocusPara, sectionRefs }) {
  const { huePalette, neuroDivIntensity, t } = settings;

  // focusModeRef is owned by App and kept fresh there — read at hover time so the callback
  // stays stable and memoized Paragraphs never re-render when Focus toggles.
  const onParaMouseEnter = useCallback((idx) => {
    if (focusModeRef.current) setFocusPara(idx);
  }, [focusModeRef, setFocusPara]);

  const paragraphs = useMemo(() => text.split(/\n\s*\n/).filter(p => p.trim()), [text]);

  // Stable per-section ref callbacks — avoids creating fresh inline refs each render
  // that would otherwise force ref churn on memoized Sections.
  const sectionRefCallbacks = useMemo(() => {
    if (!docSections) return [];
    return docSections.map((_, si) => (el) => {
      if (sectionRefs) sectionRefs.current[si] = el;
    });
  }, [docSections, sectionRefs]);

  // Wrapper consumes typography exclusively via CSS custom properties written by the parent (App)
  // directly to wrapperRef.current.style — no typography props live in this subtree's render path.
  // Fallbacks match initial App state so the first paint (before rAF fires) still looks correct.
  const wrapperStyle = useMemo(() => ({
    width: "var(--rf-column-width, 95%)",
    margin: "0 auto",
    padding: "48px 8px 120px",
    fontFamily: "var(--rf-font-family, 'Literata', serif)",
    fontSize: "var(--rf-font-size, 18px)",
    lineHeight: "var(--rf-line-height, 1.8)",
    letterSpacing: "var(--rf-letter-spacing, 0px)",
    wordSpacing: "var(--rf-word-spacing, 0px)",
    color: t.fg,
    transition: "width 0.3s ease",
    boxSizing: "border-box",
  }), [t.fg]);

  // Inner div's className is written by App via featureClassRef (no React reconciliation on toggle).
  return (
    <div ref={wrapperRef} className="rf-doc-wrapper" style={wrapperStyle}>
      <div ref={featureClassRef} style={INNER_STYLE}>
        {hasSections && docSections ? (
          docSections.map((section, si) => (
            <Section
              key={si}
              section={section}
              si={si}
              settings={settings}
              onParaMouseEnter={onParaMouseEnter}
              refCallback={sectionRefCallbacks[si]}
            />
          ))
        ) : (
          paragraphs.map((p, i) => (
            <Paragraph
              key={i}
              para={p}
              idx={i}
              huePalette={huePalette}
              neuroDivIntensity={neuroDivIntensity}
              onMouseEnter={onParaMouseEnter}
            />
          ))
        )}
      </div>
    </div>
  );
});

export default DocumentBody;
