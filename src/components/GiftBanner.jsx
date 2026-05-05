import { Gift, X, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

// Banner shown to a user who landed via a gift email link
// (`?gift_email=X&gift_status=queued|applied`). Branches on auth state:
//   • signed out + queued  → "Gift waiting — sign up with X"
//   • signed out + applied → "Welcome back — sign in with X"
//   • signed in as X       → "Your Pro gift is active"
//   • signed in as other Y → "Gift is for X — sign out to redeem"
//
// Color: theme accent gradient (white text). Adapts to whichever theme the
// user has active so the banner stays brand-aligned across all six themes.
//
// Props:
//   giftEmail   — email from URL
//   giftStatus  — "queued" | "applied"
//   t           — active theme object (provides accent + accentSoft)
//   onPrimary   — handler when the primary CTA is clicked. Receives
//                 ({ initialView, initialEmail }) so the parent can open
//                 AuthModal with the right view + prefilled email.
//   onSignOut   — handler for the "Sign out" CTA in the wrong-account state.
//   onDismiss   — handler when user dismisses the banner. Parent should
//                 strip ?gift_email/?gift_status from the URL.
export default function GiftBanner({ giftEmail, giftStatus, t, onPrimary, onSignOut, onDismiss }) {
  const { user } = useAuth();

  if (!giftEmail) return null;

  const isSignedIn = !!user;
  const signedInAsRecipient = isSignedIn && user.email?.toLowerCase() === giftEmail.toLowerCase();
  const signedInAsOther = isSignedIn && !signedInAsRecipient;

  // Compose the message + CTA per state.
  let message;
  let ctaLabel = null;
  let ctaIcon = null;
  let ctaOnClick = null;

  if (signedInAsOther) {
    message = (
      <>This gift is for <strong>{giftEmail}</strong>. Sign out to redeem on the correct account.</>
    );
    ctaLabel = "Sign out";
    ctaIcon = <LogOut size={14} />;
    ctaOnClick = onSignOut;
  } else if (signedInAsRecipient) {
    message = <>Welcome back — your <strong>ReadFlow Pro</strong> gift is active.</>;
    // No CTA; just a dismiss button (handled by the X icon below).
  } else if (giftStatus === "applied") {
    message = (
      <>Welcome back — sign in with <strong>{giftEmail}</strong> to access your Pro gift.</>
    );
    ctaLabel = "Sign in";
    ctaOnClick = () => onPrimary({ initialView: "login", initialEmail: giftEmail });
  } else {
    // Default: queued (or missing/unknown gift_status — treat as queued).
    message = (
      <>You've been gifted <strong>ReadFlow Pro</strong>. Sign up with <strong>{giftEmail}</strong> to redeem.</>
    );
    ctaLabel = "Sign up";
    ctaOnClick = () => onPrimary({ initialView: "signup", initialEmail: giftEmail });
  }

  const accent = t?.accent ?? "#A85E14";
  const accentDeep = t?.fg ?? "#2A2A2A";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "relative",
        background: `linear-gradient(180deg, ${accent} 0%, ${accentDeep} 220%)`,
        color: "#FFFFFF",
        padding: "14px 56px 14px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        zIndex: 100,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <Gift size={18} aria-hidden style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>
        {message}
      </div>
      {ctaLabel && (
        <button
          onClick={ctaOnClick}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: "#FFFFFF",
            color: accent,
            fontSize: 13,
            fontWeight: 720,
            fontFamily: "'DM Sans', sans-serif",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {ctaIcon}
          {ctaLabel}
        </button>
      )}
      <button
        onClick={onDismiss}
        aria-label="Dismiss gift banner"
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          width: 28,
          height: 28,
          borderRadius: 6,
          border: "none",
          background: "transparent",
          color: "#FFFFFF",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.85,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
