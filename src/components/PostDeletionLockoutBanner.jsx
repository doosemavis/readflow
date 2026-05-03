import { Lock } from "lucide-react";

// Persistent top-of-app banner shown to users whose email is within the
// 6-month post-deletion lockout window. They can sign in / sign up but
// can't use Free-tier features — only path forward is subscribing. There's
// no dismiss for this one (unlike PendingDeletionBanner) — the lockout is
// a hard gate, not a heads-up.

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function PostDeletionLockoutBanner({ lockoutUntil, onSubscribe }) {
  if (!lockoutUntil) return null;
  return (
    <div
      role="alert"
      style={{
        position: "sticky", top: 0, left: 0, right: 0, zIndex: 1900,
        background: "#7C3AED", color: "#fff",
        padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 12,
        fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      }}
    >
      <Lock size={16} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, lineHeight: 1.4 }}>
        Welcome back. Free-tier benefits are paused until <strong>{formatDate(lockoutUntil)}</strong> because this account was previously deleted. Subscribe to use ReadFlow now.
      </span>
      <button
        onClick={onSubscribe}
        style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#fff", color: "#5B21B6", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}
      >
        Subscribe
      </button>
    </div>
  );
}
