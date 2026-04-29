import { memo, useMemo, useCallback, useRef } from "react";
import { PALETTES } from "../config/constants";

const DocumentBody = memo(function DocumentBody({
  text, docSections, hasSections,
  neuroDiv, neuroDivIntensity, hueGuide, huePalette,
  focusMode, setFocusPara,
  fontSize, lineHeight, columnWidth, letterSpacing, wordSpacing, textAlign,
  currentFontCss, t, sectionRefs,
}) {
  const paragraphs = useMemo(() => text.split(/\n\s*\n/).filter(p => p.trim()), [text]);

  // Ref so renderParagraph reads focusMode at call time without it being a dependency,
  // keeping renderParagraph (and therefore content) stable across focusMode toggles.
  const focusModeRef = useRef(focusMode);
  focusModeRef.current = focusMode;

  const renderWord = useCallback((word, wi, total) => {
    const colors = PALETTES[huePalette].colors;
    const cIdx = total > 1 ? Math.floor((wi / (total - 1)) * (colors.length - 1)) : 0;
    const color = colors[Math.min(cIdx, colors.length - 1)];
    const bl = Math.max(1, Math.round(word.length * neuroDivIntensity));
    return (
      <span key={wi} className="rf-word" style={{ "--hue-color": color }}>
        <strong>{word.slice(0, bl)}</strong>{word.slice(bl)}{" "}
      </span>
    );
  }, [huePalette, neuroDivIntensity]);

  const renderParagraph = useCallback((para, idx) => {
    const lines = para.split("\n").filter(l => l.trim());
    return (
      <div key={idx} className="rf-para" data-idx={idx} onMouseEnter={() => { if (focusModeRef.current) setFocusPara(idx); }} style={{ marginBottom: `${lineHeight * 0.7}em` }}>
        {lines.map((line, li) => {
          const words = line.split(/\s+/).filter(Boolean);
          return <p key={li} style={{ margin: "0 0 0.25em 0" }}>{words.map((w, wi) => renderWord(w, wi, words.length))}</p>;
        })}
      </div>
    );
  }, [lineHeight, renderWord, setFocusPara]);

  const content = useMemo(() => {
    if (hasSections && docSections) {
      return docSections.map((section, si) => {
        const paras = section.content.split(/\n\s*\n/).filter(p => p.trim());
        const typeLabel = section.type === "page" ? `Page ${section.number}` : null;
        return (
          <div key={si} ref={el => { if (sectionRefs) sectionRefs.current[si] = el; }}>
            {si > 0 && (typeLabel ? (<div style={{ margin: `${lineHeight * 1.5}em 0`, display: "flex", alignItems: "center", gap: 16 }}><div style={{ flex: 1, height: 1, background: t.border }} /><span style={{ fontSize: 11, fontWeight: 600, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}>{typeLabel}</span><div style={{ flex: 1, height: 1, background: t.border }} /></div>) : (<div style={{ margin: `${lineHeight * 1.5}em 0`, height: 1, background: t.border }} />))}
            {section.title && (<div style={{ marginBottom: `${lineHeight * 0.8}em` }}><h2 style={{ fontSize: fontSize * (section.type === "page" ? 1.4 : 1.5), fontWeight: section.type === "page" ? 740 : 760, color: t.fg, margin: 0, lineHeight: section.type === "page" ? 1.3 : 1.25, fontFamily: currentFontCss, letterSpacing: section.type === "page" ? "-0.01em" : "-0.02em" }}>{section.title.split(/\s+/).map((w, wi, arr) => renderWord(w, wi, arr.length))}</h2></div>)}
            {paras.map((p, pi) => renderParagraph(p, si * 10000 + pi))}
          </div>
        );
      });
    }
    return paragraphs.map((p, i) => renderParagraph(p, i));
  }, [hasSections, docSections, paragraphs, renderParagraph, renderWord, lineHeight, fontSize, t, currentFontCss, sectionRefs]);

  const featureClass = [neuroDiv && "rf-neurodiv", hueGuide && "rf-hueguide", focusMode && "rf-focus-mode"].filter(Boolean).join(" ");

  return (
    <div style={{ width: `${columnWidth}%`, margin: "0 auto", padding: "48px 8px 120px", fontFamily: currentFontCss, fontSize, lineHeight, letterSpacing: `${letterSpacing}px`, wordSpacing: `${wordSpacing}px`, color: t.fg, transition: "width 0.3s ease", boxSizing: "border-box" }}>
      <div className={featureClass} style={{ textAlign: textAlign || "left" }}>
        {content}
      </div>
    </div>
  );
});

export default DocumentBody;
