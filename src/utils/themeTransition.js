import { flushSync } from "react-dom";

const VT_DURATION_MS = 450;
const ROOT_DATA_ATTR = "rfThemeVt";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

const supportsViewTransitions = () =>
  typeof document !== "undefined" &&
  typeof document.startViewTransition === "function";

function originFromEvent(event) {
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const fallback = { x: viewportWidth / 2, y: viewportHeight / 2, viewportWidth, viewportHeight };

  if (!event) return fallback;

  // Keyboard-activated clicks report (0, 0); detect that and use the target's center instead.
  const isKeyboardSynthetic = event.detail === 0 && event.clientX === 0 && event.clientY === 0;
  if (!isKeyboardSynthetic && typeof event.clientX === "number") {
    return { x: event.clientX, y: event.clientY, viewportWidth, viewportHeight };
  }

  const rect = event.currentTarget?.getBoundingClientRect?.();
  if (rect) {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      viewportWidth,
      viewportHeight,
    };
  }
  return fallback;
}

/**
 * Apply a theme change inside a circular View Transition reveal originating from the click point.
 * Falls back to a plain apply when the View Transitions API isn't available or the user prefers
 * reduced motion.
 */
export function runThemeTransition(event, applyFn) {
  if (!supportsViewTransitions() || prefersReducedMotion()) {
    applyFn();
    return;
  }

  const { x, y, viewportWidth, viewportHeight } = originFromEvent(event);
  const maxRadius = Math.hypot(
    Math.max(x, viewportWidth - x),
    Math.max(y, viewportHeight - y),
  );

  const root = document.documentElement;
  root.dataset[ROOT_DATA_ATTR] = "active";
  const cleanup = () => { delete root.dataset[ROOT_DATA_ATTR]; };

  const transition = document.startViewTransition(() => {
    flushSync(applyFn);
  });

  if (transition?.finished?.finally) {
    transition.finished.finally(cleanup);
  } else {
    cleanup();
  }

  if (transition?.ready?.then) {
    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: VT_DURATION_MS,
          easing: "ease-in-out",
          fill: "forwards",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    }).catch(() => {});
  }
}
