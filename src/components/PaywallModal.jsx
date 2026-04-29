import { Lock, Crown } from "lucide-react";
import { FREE_UPLOAD_LIMIT } from "../config/constants";

export default function PaywallModal({ uploadsUsed, onUpgrade, onClose, t }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.bg, borderRadius: 24, maxWidth: 420, width: "100%", boxShadow: "0 32px 80px rgba(0,0,0,0.25)", padding: "40px 32px", textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: t.accentSoft, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}><Lock size={28} style={{ color: t.accent }} /></div>
        <h3 style={{ fontSize: 22, fontWeight: 740, color: t.fg, margin: "0 0 8px", fontFamily: "'DM Sans', sans-serif" }}>Upload limit reached</h3>
        <p style={{ fontSize: 14, color: t.fgSoft, margin: "0 0 8px", lineHeight: 1.6 }}>You've used all {FREE_UPLOAD_LIMIT} free documents this month.</p>
        <p style={{ fontSize: 13, color: t.fgSoft, margin: "0 0 28px", lineHeight: 1.5 }}>Upgrade to Pro for unlimited uploads starting at $3.75/mo.</p>
        <button onClick={onUpgrade} style={{ width: "100%", padding: "13px 20px", borderRadius: 12, border: "none", background: t.accent, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 660, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12, boxSizing: "border-box" }}><Crown size={16} /> See plans & pricing</button>
        <button onClick={onClose} style={{ width: "100%", padding: "11px 20px", borderRadius: 12, border: `1px solid ${t.border}`, background: "transparent", color: t.fgSoft, cursor: "pointer", fontSize: 13, fontWeight: 550, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}>Maybe later</button>
      </div>
    </div>
  );
}
