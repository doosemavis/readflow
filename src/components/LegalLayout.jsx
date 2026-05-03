import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import Footer from "./Footer";

// Shared layout for static legal pages (Privacy, Terms). Renders a slim
// header (logo + back link), a max-width prose column, and the global
// Footer. Picks up the user's active theme via t prop so the page matches
// their preferred chrome instead of jumping to a different look.

const LINK_STYLE_RESET = { color: "inherit", textDecoration: "none" };

export default function LegalLayout({ t, title, lastUpdated, children }) {
  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.fg, display: "flex", flexDirection: "column", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header style={{ borderBottom: `1px solid ${t.borderSoft}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" style={{ ...LINK_STYLE_RESET, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BookOpen size={16} style={{ color: t.accent, transform: "translateY(1px)" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.fg }}>ReadFlow</span>
        </Link>
        <Link to="/" style={{ ...LINK_STYLE_RESET, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: t.fgSoft, padding: "6px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: "transparent" }}>
          <ArrowLeft size={13} /> Back to app
        </Link>
      </header>

      {/* Main */}
      <main style={{ flex: 1, padding: "40px 24px 60px", display: "flex", justifyContent: "center" }}>
        <article
          className="rf-legal-prose"
          style={{
            maxWidth: 720,
            width: "100%",
            color: t.fg,
            fontFamily: "'Literata', Georgia, serif",
            fontSize: 16,
            lineHeight: 1.7,
          }}
        >
          <h1 style={{ fontSize: 32, fontWeight: 740, color: t.fg, margin: "0 0 8px", letterSpacing: "-0.02em", fontFamily: "'DM Sans', sans-serif" }}>{title}</h1>
          <p style={{ fontSize: 13, color: t.fgSoft, margin: "0 0 32px", fontFamily: "'DM Sans', sans-serif" }}>Last updated: {lastUpdated}</p>
          <style>{`
            .rf-legal-prose h2 {
              font-size: 22px;
              font-weight: 700;
              color: ${t.fg};
              margin: 36px 0 12px;
              letter-spacing: -0.01em;
              font-family: 'DM Sans', sans-serif;
            }
            .rf-legal-prose h3 {
              font-size: 16px;
              font-weight: 700;
              color: ${t.fg};
              margin: 24px 0 8px;
              font-family: 'DM Sans', sans-serif;
            }
            .rf-legal-prose p {
              margin: 0 0 14px;
              color: ${t.fgSoft};
            }
            .rf-legal-prose ul {
              list-style: none;
              padding-left: 0;
              margin: 0 0 14px;
              color: ${t.fgSoft};
            }
            .rf-legal-prose li {
              position: relative;
              padding-left: 26px;
              margin-bottom: 10px;
            }
            /* Branded book-icon bullet — lucide BookOpen path inlined as
               a data-URI background, tinted with the active theme accent. */
            .rf-legal-prose li::before {
              content: '';
              position: absolute;
              left: 0;
              top: 0.42em;
              width: 16px;
              height: 16px;
              background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23${t.accent.replace("#", "")}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 7v14'/%3E%3Cpath d='M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z'/%3E%3C/svg%3E");
              background-size: contain;
              background-repeat: no-repeat;
            }
            .rf-legal-prose strong {
              color: ${t.fg};
            }
            .rf-legal-prose code {
              font-size: 13px;
              padding: 1px 6px;
              border-radius: 4px;
              background: ${t.surface};
              color: ${t.fg};
              font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            }
            .rf-legal-prose a {
              text-decoration: underline;
              text-underline-offset: 3px;
            }
          `}</style>
          {children}
        </article>
      </main>

      <Footer t={t} />
    </div>
  );
}
