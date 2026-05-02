import { Lock, Crown } from "lucide-react";
import { FREE_UPLOAD_LIMIT } from "../config/constants";
import * as Dialog from "@radix-ui/react-dialog";
import PulsatingButton from "./PulsatingButton";

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 1000 };

export default function PaywallModal({ uploadsUsed, onUpgrade, onClose, t }) {
  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay style={OVERLAY} />
        <Dialog.Content
          aria-describedby={undefined}
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: t.bg, borderRadius: 24, maxWidth: 420, width: "calc(100% - 48px)", boxShadow: "0 32px 80px rgba(0,0,0,0.25)", padding: "40px 32px", textAlign: "center", zIndex: 1001, outline: "none", fontFamily: "'DM Sans', sans-serif" }}
        >
          <Dialog.Title style={{ fontSize: 22, fontWeight: 740, color: t.fg, margin: "0 0 8px", fontFamily: "'DM Sans', sans-serif" }}>Upload limit reached</Dialog.Title>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: t.accentSoft, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <Lock size={28} style={{ color: t.accent }} />
          </div>
          <p style={{ fontSize: 14, color: t.fgSoft, margin: "0 0 8px", lineHeight: 1.6 }}>You've used all {FREE_UPLOAD_LIMIT} free documents this month.</p>
          <p style={{ fontSize: 13, color: t.fgSoft, margin: "0 0 28px", lineHeight: 1.5 }}>Upgrade to Pro for unlimited uploads starting at $3.75/mo.</p>
          <PulsatingButton variant="ripple" pulseColor={t.accent} duration="1.6s" distance="10px" onClick={onUpgrade} className="rf-btn-bubble" style={{ width: "100%", padding: "22px 32px", borderRadius: 999, border: "none", background: t.accent, color: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12, boxSizing: "border-box" }}>
            <Crown size={16} /> See plans &amp; pricing
          </PulsatingButton>
          <Dialog.Close asChild>
            <button style={{ width: "100%", padding: "11px 20px", borderRadius: 12, border: `1px solid ${t.border}`, background: "transparent", color: t.fgSoft, cursor: "pointer", fontSize: 13, fontWeight: 550, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}>
              Maybe later
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
