// Port of magicui's SmoothCursor (apps/www/registry/magicui/smooth-cursor.tsx).
// Same physics (spring-damped position, rotation, scale + velocity-based heading);
// reimplemented with a vanilla integrator + RAF + direct DOM transforms instead of
// motion/react's useSpring, so we avoid the framer-motion runtime dependency.
import { useEffect, useRef } from "react";

const POSITION_SPRING = { stiffness: 400, damping: 45, mass: 1, restDelta: 0.001 };
const ROTATION_SPRING = { stiffness: 300, damping: 60, mass: 1, restDelta: 0.001 };
const SCALE_SPRING    = { stiffness: 500, damping: 35, mass: 1, restDelta: 0.001 };
const DESKTOP_POINTER_QUERY = "(any-hover: hover) and (any-pointer: fine)";
const SCALE_RELEASE_MS = 150;

function stepSpring(s, cfg, dt) {
  const force = cfg.stiffness * (s.target - s.value);
  const damping = cfg.damping * s.velocity;
  const accel = (force - damping) / cfg.mass;
  s.velocity += accel * dt;
  s.value += s.velocity * dt;
  if (Math.abs(s.velocity) < cfg.restDelta && Math.abs(s.target - s.value) < cfg.restDelta) {
    s.value = s.target;
    s.velocity = 0;
  }
}

const DefaultCursor = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={50} height={54} viewBox="0 0 50 54" fill="none" style={{ transform: "scale(0.5)", display: "block" }}>
    <g filter="url(#rf_smoothcursor_shadow)">
      <path d="M42.6817 41.1495L27.5103 6.79925C26.7269 5.02557 24.2082 5.02558 23.3927 6.79925L7.59814 41.1495C6.75833 42.9759 8.52712 44.8902 10.4125 44.1954L24.3757 39.0496C24.8829 38.8627 25.4385 38.8627 25.9422 39.0496L39.8121 44.1954C41.6849 44.8902 43.4884 42.9759 42.6817 41.1495Z" fill="black" />
      <path d="M43.7146 40.6933L28.5431 6.34306C27.3556 3.65428 23.5772 3.69516 22.3668 6.32755L6.57226 40.6778C5.3134 43.4156 7.97238 46.298 10.803 45.2549L24.7662 40.109C25.0221 40.0147 25.2999 40.0156 25.5494 40.1082L39.4193 45.254C42.2261 46.2953 44.9254 43.4347 43.7146 40.6933Z" stroke="white" strokeWidth={2.25825} />
    </g>
    <defs>
      <filter id="rf_smoothcursor_shadow" x={0.602397} y={0.952444} width={49.0584} height={52.428} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity={0} result="BackgroundImageFix" />
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
        <feOffset dy={2.25825} />
        <feGaussianBlur stdDeviation={2.25825} />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.08 0" />
        <feBlend mode="normal" in2="BackgroundImageFix" result="ds" />
        <feBlend mode="normal" in="SourceGraphic" in2="ds" result="shape" />
      </filter>
    </defs>
  </svg>
);

// `hotspot` aligns the OS pointer position (where clicks/hovers actually fire)
// with a specific point on the cursor element. Numbers are pixels from the
// element's top-left; strings (e.g. "50%", "8%") are CSS lengths. Default is
// the element's center.
const formatHotspotOffset = (v) =>
  typeof v === "number" ? `${-v}px` : `-${v}`;

export default function SmoothCursor({
  cursor = <DefaultCursor />,
  rotate = true,
  hotspot = { x: "50%", y: "50%" },
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mq = window.matchMedia(DESKTOP_POINTER_QUERY);
    if (!mq.matches) return;

    const x = { value: 0, velocity: 0, target: 0 };
    const y = { value: 0, velocity: 0, target: 0 };
    const rot = { value: 0, velocity: 0, target: 0 };
    const sc = { value: 1, velocity: 0, target: 1 };

    const tx = formatHotspotOffset(hotspot.x);
    const ty = formatHotspotOffset(hotspot.y);

    const lastMouse = { x: 0, y: 0, time: performance.now() };
    const mouseVel = { x: 0, y: 0 };
    let prevAngle = 0;
    let accumulatedRotation = 0;
    let firstMove = true;
    let visible = false;
    let scaleReset = null;
    let lastFrame = performance.now();
    let rafId = 0;
    let pointerMoveQueued = false;

    document.documentElement.classList.add("rf-smooth-cursor-active");

    const tick = (now) => {
      let dt = (now - lastFrame) / 1000;
      if (dt > 0.05) dt = 0.05; // clamp so a backgrounded tab doesn't snap on resume
      lastFrame = now;

      stepSpring(x, POSITION_SPRING, dt);
      stepSpring(y, POSITION_SPRING, dt);
      stepSpring(rot, ROTATION_SPRING, dt);
      stepSpring(sc, SCALE_SPRING, dt);

      el.style.transform =
        `translate3d(${x.value}px, ${y.value}px, 0) translate(${tx}, ${ty}) rotate(${rot.value}deg) scale(${sc.value})`;
      el.style.opacity = visible ? "1" : "0";

      rafId = requestAnimationFrame(tick);
    };

    const onMove = (e) => {
      if (e.pointerType === "touch") return;
      if (pointerMoveQueued) return;
      pointerMoveQueued = true;

      requestAnimationFrame(() => {
        pointerMoveQueued = false;

        const now = performance.now();
        const dt = now - lastMouse.time;
        if (dt > 0) {
          mouseVel.x = (e.clientX - lastMouse.x) / dt;
          mouseVel.y = (e.clientY - lastMouse.y) / dt;
        }
        lastMouse.x = e.clientX;
        lastMouse.y = e.clientY;
        lastMouse.time = now;

        x.target = e.clientX;
        y.target = e.clientY;

        if (firstMove) {
          x.value = x.target;
          y.value = y.target;
          firstMove = false;
        }

        visible = true;

        const speed = Math.hypot(mouseVel.x, mouseVel.y);
        if (speed > 0.1) {
          if (rotate) {
            let angle = Math.atan2(mouseVel.y, mouseVel.x) * (180 / Math.PI) + 90;
            let diff = angle - prevAngle;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            accumulatedRotation += diff;
            rot.target = accumulatedRotation;
            prevAngle = angle;
          }

          sc.target = 0.95;
          if (scaleReset) clearTimeout(scaleReset);
          scaleReset = setTimeout(() => { sc.target = 1; }, SCALE_RELEASE_MS);
        }
      });
    };

    rafId = requestAnimationFrame(tick);
    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.classList.remove("rf-smooth-cursor-active");
      if (scaleReset) clearTimeout(scaleReset);
    };
  }, [rotate, hotspot.x, hotspot.y]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 9000,
        pointerEvents: "none",
        willChange: "transform, opacity",
        opacity: 0,
        transition: "opacity 0.15s",
      }}
    >
      {cursor}
    </div>
  );
}
