import { useState } from "react";
import { Link } from "react-router-dom";
import ContactModal from "./ContactModal";

// Subtle global footer rendered on every route. Keeps the legal links +
// contact reachable without competing with the main UI for attention.
// Theme-aware so it doesn't blow out the chrome on dark themes.
//
// Contact opens a modal (not a mailto: link) because mailto silently fails
// when the user has no default mail client configured — the modal shows
// the address as plain text + a Copy button + an Open-in-mail-client link
// for users who *do* have one set up.

// padding + inline-block expand the tap target to ≈44px tall without making
// the visible text any bigger (a11y target, especially relevant on mobile).
const LINK_RESET = { color: "inherit", textDecoration: "none", background: "none", border: "none", padding: "13px 12px", display: "inline-block", font: "inherit", cursor: "pointer" };

export default function Footer({ t }) {
  const year = new Date().getFullYear();
  const [showContact, setShowContact] = useState(false);

  return (
    <>
      <footer
        style={{
          borderTop: `1px solid ${t.borderSoft}`,
          // Horizontal padding only. The 44px tap-target padding on each link
          // (Privacy/Terms/Contact) defines the footer's height, so adding
          // wrapper vertical padding on top of that doubles the visual
          // whitespace. Footer ends up ≈44px tall instead of ≈76px.
          padding: "0 24px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 12,
          // Matches the "Try demo article" CTA color (t.accent). Footer text
          // reads on-brand instead of muted-gray, and the brand color stays
          // in the user's eye even at the bottom of the page. Updates on
          // theme change automatically — `t` is a fresh object from
          // useThemePreference each theme switch, so React re-renders with
          // the new t.accent. No key={theme} remount needed for plain color
          // bindings (that trick is only for re-firing once-only effects).
          color: t.accent,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <span>© {year} ReadFlow</span>
        <nav style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Link to="/privacy" style={LINK_RESET}>Privacy</Link>
          <Link to="/terms" style={LINK_RESET}>Terms</Link>
          <a
            href="#contact"
            onClick={(e) => { e.preventDefault(); setShowContact(true); }}
            style={{ color: t.accent, textDecoration: "none", fontSize: 12, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", padding: "13px 12px", display: "inline-block" }}
          >
            Contact
          </a>
        </nav>
      </footer>
      <ContactModal open={showContact} onOpenChange={setShowContact} t={t} />
    </>
  );
}
