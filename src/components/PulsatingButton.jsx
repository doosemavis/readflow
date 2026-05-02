// Port of magicui's PulsatingButton (apps/www/registry/magicui/pulsating-button.tsx).
// Same two variants ("pulse" expanding box-shadow, "ripple" emanating ring with cubic-bezier easing);
// reimplemented without Tailwind/cn and without the MutationObserver-based bg-color sync — callers
// pass `pulseColor` directly since we always know the active theme at render time.
import { forwardRef } from "react";

const PulsatingButton = forwardRef(function PulsatingButton(
  {
    pulseColor = "currentColor",
    duration = "1.5s",
    distance = "8px",
    variant = "pulse",
    style,
    children,
    ...props
  },
  ref
) {
  const animationName = variant === "ripple" ? "rf-pulse-ripple" : "rf-pulse";
  const easing = variant === "ripple" ? "cubic-bezier(0.16, 1, 0.3, 1)" : "ease-out";
  return (
    <button
      ref={ref}
      style={{
        position: "relative",
        ...style,
        ["--rf-pulse-color"]: pulseColor,
        ["--rf-pulse-distance"]: distance,
        ["--rf-pulse-duration"]: duration,
      }}
      {...props}
    >
      <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "inherit" }}>
        {children}
      </span>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          borderRadius: "inherit",
          background: "transparent",
          animation: `${animationName} var(--rf-pulse-duration) ${easing} infinite`,
        }}
      />
    </button>
  );
});

export default PulsatingButton;
