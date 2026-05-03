import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Mail, Copy, Check, ExternalLink } from "lucide-react";

const SUPPORT_EMAIL = "support@myreadflow.com";

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 1010 };

// Click "Contact" in the footer → this modal. Avoids the mailto:-silently-
// fails-when-no-default-mail-client problem; gives the user the address as
// plain text + a Copy button + an explicit Open-in-mail-client link.
export default function ContactModal({ open, onOpenChange, t }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API blocked (insecure context, permissions). User can
      // still select-and-copy from the input below; just don't show the
      // confirmation animation.
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={OVERLAY} />
        <Dialog.Content
          aria-describedby={undefined}
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: t.bg, borderRadius: 18, maxWidth: 420, width: "calc(100% - 48px)", padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", zIndex: 1011, outline: "none", fontFamily: "'DM Sans', sans-serif" }}
        >
          <Dialog.Close asChild>
            <button aria-label="Close" style={{ position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: t.icon, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={16} strokeWidth={2} />
            </button>
          </Dialog.Close>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mail size={17} style={{ color: t.accent }} />
            </div>
            <Dialog.Title style={{ fontSize: 17, fontWeight: 720, color: t.fg, margin: 0 }}>
              Get in touch
            </Dialog.Title>
          </div>

          <p style={{ fontSize: 13, color: t.fgSoft, margin: "0 0 16px", lineHeight: 1.55 }}>
            Questions, feedback, billing issues, or feature requests — email us and we'll get back to you as soon as we can.
          </p>

          <div style={{ display: "flex", alignItems: "stretch", gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              value={SUPPORT_EMAIL}
              readOnly
              onFocus={e => e.target.select()}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.fg, fontSize: 13, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", outline: "none", boxSizing: "border-box" }}
            />
            <button
              onClick={handleCopy}
              className="rf-static"
              style={{ padding: "10px 14px", borderRadius: 8, border: "none", background: copied ? "#22C55E" : t.accent, color: "#fff", fontSize: 13, fontWeight: 660, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "background 0.2s ease", outline: "none" }}
            >
              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>

          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", textDecoration: "none" }}
            onMouseEnter={e => e.currentTarget.style.color = t.accent}
            onMouseLeave={e => e.currentTarget.style.color = t.fgSoft}
          >
            Open in your mail client <ExternalLink size={11} />
          </a>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
