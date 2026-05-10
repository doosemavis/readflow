import { useMemo } from "react";
import Lottie from "lottie-react";
import bookLoaderData from "../assets/book-loader.json";

// Theme-aware Lottie loader. The source animation has five baked colors;
// at render time we deep-clone the JSON and remap each one to the active
// theme's palette so the loader looks intentional on all themes — black on
// dark backgrounds, low-contrast violets, etc. are eliminated.
//
//   #000000 → t.fg               outlines / strongest detail
//   #605eed → t.accent           primary fill
//   #7674ef → 80% accent / 20% bg
//   #a5a4ed → 50% accent / 50% bg
//   #c7c7ed → 25% accent / 75% bg
function hexToRgb01(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function mix(a, b, weightA) {
  const wB = 1 - weightA;
  return [a[0] * weightA + b[0] * wB, a[1] * weightA + b[1] * wB, a[2] * weightA + b[2] * wB];
}

function rgbArrToHex(arr) {
  return arr
    .slice(0, 3)
    .map((c) => Math.round(c * 255).toString(16).padStart(2, "0"))
    .join("");
}

// Walks the cloned Lottie tree, swapping every static color (`c.k` as a flat
// number array) whose source hex matches our palette map. Animated colors
// (keyframed) are skipped — the source asset doesn't use them.
function recolorInPlace(node, colorMap) {
  if (Array.isArray(node)) {
    for (const item of node) recolorInPlace(item, colorMap);
    return;
  }
  if (!node || typeof node !== "object") return;

  if (node.c && typeof node.c === "object" && Array.isArray(node.c.k)) {
    const k = node.c.k;
    if (k.length >= 3 && typeof k[0] === "number") {
      const hex = rgbArrToHex(k);
      if (colorMap[hex]) {
        const [r, g, b] = colorMap[hex];
        node.c.k = [r, g, b, k[3] ?? 1];
      }
    }
  }
  for (const v of Object.values(node)) recolorInPlace(v, colorMap);
}

export default function BookLoader({ size = 220, style, t }) {
  const animationData = useMemo(() => {
    if (!t) return bookLoaderData;
    const fg = hexToRgb01(t.fg);
    const accent = hexToRgb01(t.accent);
    const bg = hexToRgb01(t.bg);
    const colorMap = {
      "000000": fg,
      "605eed": accent,
      "7674ef": mix(accent, bg, 0.8),
      "a5a4ed": mix(accent, bg, 0.5),
      "c7c7ed": mix(accent, bg, 0.25),
    };
    const clone = JSON.parse(JSON.stringify(bookLoaderData));
    recolorInPlace(clone, colorMap);
    return clone;
  }, [t?.fg, t?.accent, t?.bg]);

  return (
    <div
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size, ...style }}
    >
      <Lottie
        animationData={animationData}
        loop
        autoplay
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
