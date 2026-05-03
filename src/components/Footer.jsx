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

const LINK_RESET = { color: "inherit", textDecoration: "none", background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer" };

export default function Footer({ t }) {
  const year = new Date().getFullYear();
  const [showContact, setShowContact] = useState(false);

  return (
    <>
      <footer
        style={{
          borderTop: `1px solid ${t.borderSoft}`,
          padding: "16px 24px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 12,
          color: t.fgSoft,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <span>© {year} ReadFlow</span>
        <nav style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Link to="/privacy" style={{ ...LINK_RESET, color: t.fgSoft }}>Privacy</Link>
          <Link to="/terms" style={{ ...LINK_RESET, color: t.fgSoft }}>Terms</Link>
          <a
            href="#contact"
            onClick={(e) => { e.preventDefault(); setShowContact(true); }}
            style={{ color: t.fgSoft, textDecoration: "none", fontSize: 12, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
          >
            Contact
          </a>
        </nav>
      </footer>
      <ContactModal open={showContact} onOpenChange={setShowContact} t={t} />
    </>
  );
}
