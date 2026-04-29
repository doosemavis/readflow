import { useCallback, useRef } from "react";
import { GUIDE_COLORS } from "../config/constants";

export function useReadingGuide({ guideMode, guideColor, fontSize, lineHeight, t }) {
  const guideRef = useRef(null);
  const guideRef2 = useRef(null);
  const guideYRef = useRef(0);       // content-relative y (highlight/underline)
  const clientYRef = useRef(0);      // viewport-relative y (dim)
  const readerLeftRef = useRef(0);   // reader's left edge in viewport (dim bounds)
  const readerElRef = useRef(null);
  const rafRef = useRef(null);
  const showGuideRef = useRef(false);

  const applyPositions = useCallback((y, clientY) => {
    const lh = fontSize * lineHeight;
    if (guideMode === "highlight" && guideRef.current) {
      guideRef.current.style.transform = `translateY(${y - lh / 2}px)`;
    } else if (guideMode === "underline" && guideRef.current) {
      guideRef.current.style.transform = `translateY(${y + 2}px)`;
    } else if (guideMode === "dim" && guideRef.current) {
      guideRef.current.style.top = `${clientY + lh * 0.5}px`;
      guideRef.current.style.left = `${readerLeftRef.current}px`;
    }
  }, [guideMode, fontSize, lineHeight]);

  const handleMouseMove = useCallback((e, readerEl) => {
    if (guideMode === "none" || !readerEl) return;
    const rect = readerEl.getBoundingClientRect();
    const y = e.clientY - rect.top + readerEl.scrollTop;
    guideYRef.current = y;
    clientYRef.current = e.clientY;
    readerLeftRef.current = rect.left;
    readerElRef.current = readerEl;
    showGuideRef.current = true;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => applyPositions(y, e.clientY));
  }, [guideMode, applyPositions]);

  const handleScroll = useCallback(() => {
    if (guideMode === "none" || !showGuideRef.current || !readerElRef.current) return;
    // Only needed for absolute-positioned modes (highlight/underline)
    if (guideMode === "dim") return;
    const readerEl = readerElRef.current;
    const rect = readerEl.getBoundingClientRect();
    const y = clientYRef.current - rect.top + readerEl.scrollTop;
    guideYRef.current = y;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => applyPositions(y, clientYRef.current));
  }, [guideMode, applyPositions]);

  const handleMouseLeave = useCallback(() => {
    showGuideRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const renderOverlay = (showGuide) => {
    if (guideMode === "none" || !showGuide) return null;
    const lh = fontSize * lineHeight, y = guideYRef.current, cy = clientYRef.current;
    const gc = GUIDE_COLORS[guideColor];
    const hl = gc.highlight || `${t.accent}35`, ul = gc.underline || t.accent;

    if (guideMode === "highlight") return (
      <div ref={guideRef} style={{ position: "absolute", left: 0, right: 0, pointerEvents: "none", height: lh, background: hl, borderRadius: 4, transform: `translateY(${y - lh / 2}px)`, willChange: "transform" }} />
    );
    if (guideMode === "underline") return (
      <div ref={guideRef} style={{ position: "absolute", left: 0, right: 0, pointerEvents: "none", height: 3, background: ul, borderRadius: 2, opacity: 0.8, transform: `translateY(${y + 2}px)`, willChange: "transform" }} />
    );
    if (guideMode === "dim") return (
      // position: fixed keeps the cover anchored to the viewport during scroll
      // left is constrained to the reader element's left edge to exclude the sidebar
      <div ref={guideRef} style={{ position: "fixed", left: readerLeftRef.current, right: 0, top: cy + lh * 0.5, bottom: 0, pointerEvents: "none", background: `${t.fg}40`, backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", willChange: "top", zIndex: 10 }} />
    );
    return null;
  };

  return { handleMouseMove, handleMouseLeave, handleScroll, renderOverlay, showGuideRef };
}
