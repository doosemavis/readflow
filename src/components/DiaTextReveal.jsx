// Port of magicui's DiaTextReveal (apps/www/registry/magicui/dia-text-reveal.tsx).
// Same gradient sweep effect: a colored band travels from off-screen-left to
// off-screen-right across the text using `background-clip: text`. Replaces
// motion's useMotionValue/useTransform/useInView with a vanilla RAF loop +
// IntersectionObserver, so no motion runtime is needed.
//
// Multi-text rotation (`text` as an array) from the source isn't ported —
// can be added if needed.
import { useEffect, useRef, useState } from "react";

const DEFAULT_COLORS = ["#c679c4", "#fa3d1d", "#ffb005", "#e1e1fe", "#0358f7"];
const BAND_HALF = 17;
const SWEEP_START = -BAND_HALF;
const SWEEP_END = 100 + BAND_HALF;

const sweepEase = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

function buildGradient(pos, colors, textColor) {
  const bandStart = pos - BAND_HALF;
  const bandEnd = pos + BAND_HALF;

  if (bandStart >= 100) {
    return `linear-gradient(90deg, ${textColor}, ${textColor})`;
  }

  const n = colors.length;
  const parts = [];

  if (bandStart > 0) {
    parts.push(`${textColor} 0%`, `${textColor} ${bandStart.toFixed(2)}%`);
  }

  colors.forEach((c, i) => {
    const pct = n === 1 ? pos : bandStart + (i / (n - 1)) * BAND_HALF * 2;
    parts.push(`${c} ${pct.toFixed(2)}%`);
  });

  if (bandEnd < 100) {
    parts.push(`transparent ${bandEnd.toFixed(2)}%`, `transparent 100%`);
  }

  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

export function DiaTextReveal({
  text,
  colors = DEFAULT_COLORS,
  textColor = "currentColor",
  duration = 1.5,
  delay = 0,
  startOnView = true,
  once = true,
  className,
  style,
  ...rest
}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(!startOnView);
  const playedRef = useRef(false);

  useEffect(() => {
    if (!startOnView) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [startOnView, once]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      el.style.backgroundImage = `linear-gradient(90deg, ${textColor}, ${textColor})`;
      return;
    }
    if (!inView) {
      el.style.backgroundImage = buildGradient(SWEEP_START, colors, textColor);
      return;
    }
    if (once && playedRef.current) {
      // Already played: keep the post-reveal solid color in sync with theme changes.
      el.style.backgroundImage = `linear-gradient(90deg, ${textColor}, ${textColor})`;
      return;
    }
    playedRef.current = true;

    let startTime = null;
    let rafId = 0;

    const tick = (now) => {
      if (startTime == null) startTime = now;
      const elapsedMs = now - startTime - delay * 1000;
      if (elapsedMs < 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(elapsedMs / (duration * 1000), 1);
      const eased = sweepEase(t);
      const pos = SWEEP_START + (SWEEP_END - SWEEP_START) * eased;
      el.style.backgroundImage = buildGradient(pos, colors, textColor);
      if (t < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [inView, colors, textColor, duration, delay, once]);

  return (
    <span
      ref={ref}
      className={className}
      style={{
        color: "transparent",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        backgroundSize: "100% 100%",
        backgroundImage: `linear-gradient(90deg, ${textColor}, ${textColor})`,
        ...style,
      }}
      {...rest}
    >
      {text}
    </span>
  );
}
