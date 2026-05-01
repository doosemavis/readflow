import { useState } from "react";
import { X, Crown, Check, Zap, Gift, ArrowRight } from "lucide-react";
import { FREE_UPLOAD_LIMIT, TRIAL_DAYS } from "../config/constants";
import * as Dialog from "@radix-ui/react-dialog";

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 1000 };

export default function PricingModal({ onClose, onSelectPlan, hasUsedTrial, t }) {
  const [billing, setBilling] = useState("annual");
  const [hoverCard, setHoverCard] = useState(null);
  const [hoverBtn, setHoverBtn] = useState(null);

  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay style={OVERLAY} />
        <Dialog.Content
          aria-describedby={undefined}
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: t.bg, borderRadius: 24, maxWidth: 680, width: "calc(100% - 48px)", boxShadow: "0 32px 80px rgba(0,0,0,0.25)", overflow: "hidden", zIndex: 1001, outline: "none", fontFamily: "'DM Sans', sans-serif" }}
        >
          <div style={{ padding: "28px 32px 20px", borderBottom: `1px solid ${t.borderSoft}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <Dialog.Title style={{ fontSize: 24, fontWeight: 740, color: t.fg, margin: 0, letterSpacing: "-0.02em", fontFamily: "'DM Sans', sans-serif" }}>Upgrade to ReadFlow Pro</Dialog.Title>
              <p style={{ fontSize: 14, color: t.fgSoft, margin: "6px 0 0" }}>Unlimited documents, all formats, one reader built for you.</p>
            </div>
            <Dialog.Close asChild>
              <button style={{ background: t.surface, border: "none", cursor: "pointer", color: t.icon, padding: "8px 16px", borderRadius: 10 }}><X size={18} /></button>
            </Dialog.Close>
          </div>

          <div style={{ padding: "20px 32px 0", display: "flex", justifyContent: "center" }}>
            <div style={{ display: "flex", background: t.surface, borderRadius: 12, padding: 4, gap: 2 }}>
              {[{ key: "monthly", label: "Monthly" }, { key: "annual", label: "Annual", badge: "Save 25%" }].map(b => (
                <button key={b.key} onClick={() => setBilling(b.key)} style={{ padding: "8px 20px", borderRadius: 10, border: "none", cursor: "pointer", background: billing === b.key ? (["#111116","#0B0E14","#0D1410","#100E18","#080806"].includes(t.bg) ? t.surfaceHover : "#fff") : "transparent", boxShadow: billing === b.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none", color: billing === b.key ? t.fg : t.fgSoft, fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}>
                  {b.label}{b.badge && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "#22C55E", padding: "2px 7px", borderRadius: 6 }}>{b.badge}</span>}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: "20px 32px 32px", display: "flex", gap: 16, alignItems: "stretch" }}>
            <div onClick={onClose} onMouseEnter={() => setHoverCard("free")} onMouseLeave={() => setHoverCard(null)} style={{ flex: 1, borderRadius: 16, padding: "24px 20px", border: hoverCard === "free" ? `2px solid ${t.fgSoft}55` : `1px solid ${t.border}`, background: hoverCard === "free" ? t.surfaceHover : t.surface, display: "flex", flexDirection: "column", cursor: "pointer", transform: hoverCard === "free" ? "translateY(-3px)" : "translateY(0)", boxShadow: hoverCard === "free" ? "0 8px 24px rgba(0,0,0,0.08)" : "none", transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)" }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: t.fg, margin: 0 }}>Free</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "12px 0 16px" }}><span style={{ fontSize: 36, fontWeight: 780, color: t.fg, letterSpacing: "-0.03em" }}>$0</span><span style={{ fontSize: 14, color: t.fgSoft }}>forever</span></div>
              <div style={{ flex: 1 }}>{[`${FREE_UPLOAD_LIMIT} documents / month`, "All reading enhancements", "All themes & typography", "TXT & MD files"].map((f, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><Check size={14} style={{ color: t.fgSoft, flexShrink: 0 }} /><span style={{ fontSize: 13, color: t.fgSoft }}>{f}</span></div>)}</div>
              <button onMouseEnter={() => setHoverBtn("free")} onMouseLeave={() => setHoverBtn(null)} onClick={e => { e.stopPropagation(); onClose(); }} style={{ width: "100%", padding: "10px 16px", borderRadius: 10, border: `1px solid ${hoverBtn === "free" ? t.fgSoft : t.border}`, background: hoverBtn === "free" ? t.surface : "transparent", color: hoverBtn === "free" ? t.fg : t.fgSoft, fontSize: 13, fontWeight: 650, marginTop: 12, boxSizing: "border-box", cursor: "pointer", transition: "all 0.2s ease", transform: hoverBtn === "free" ? "scale(1.02)" : "scale(1)" }}>Stay on Free</button>
            </div>

            <div onClick={() => onSelectPlan(billing)} onMouseEnter={() => setHoverCard("pro")} onMouseLeave={() => setHoverCard(null)} style={{ flex: 1, borderRadius: 16, padding: "24px 20px", border: `2px solid ${hoverCard === "pro" ? t.accent : t.accent + "AA"}`, background: hoverCard === "pro" ? `${t.accent}18` : t.accentSoft, position: "relative", display: "flex", flexDirection: "column", cursor: "pointer", transform: hoverCard === "pro" ? "translateY(-3px)" : "translateY(0)", boxShadow: hoverCard === "pro" ? `0 8px 28px ${t.accent}25` : "none", transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)" }}>
              <div style={{ position: "absolute", top: -1, right: 20, background: t.accent, color: "#fff", fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: "0 0 8px 8px", letterSpacing: "0.05em", textTransform: "uppercase" }}>Recommended</div>
              <p style={{ fontSize: 15, fontWeight: 700, color: t.fg, margin: 0, display: "flex", alignItems: "center", gap: 6 }}><Crown size={15} style={{ color: t.accent }} /> Pro</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "12px 0 4px" }}><span style={{ fontSize: 36, fontWeight: 780, color: t.fg, letterSpacing: "-0.03em" }}>{billing === "monthly" ? "$5" : "$45"}</span><span style={{ fontSize: 14, color: t.fgSoft }}>/ {billing === "monthly" ? "month" : "year"}</span></div>
              <div style={{ height: 20, display: "flex", alignItems: "center" }}>{billing === "annual" && <p style={{ fontSize: 12, color: t.accent, fontWeight: 600, margin: 0 }}>$3.75/mo — save $15/year</p>}</div>
              <div style={{ height: 8 }} />
              <div style={{ flex: 1 }}>
                {!hasUsedTrial && <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, background: `${t.accent}18`, marginBottom: 14 }}><Gift size={14} style={{ color: t.accent }} /><span style={{ fontSize: 12, fontWeight: 600, color: t.accent }}>{TRIAL_DAYS}-day free trial included</span></div>}
                {["Unlimited documents", "PDF, EPUB, DOCX & all formats", "All reading enhancements", "All themes & typography", "Priority support"].map((f, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><Check size={14} style={{ color: t.accent, flexShrink: 0 }} /><span style={{ fontSize: 13, color: t.fgSoft }}>{f}</span></div>)}
              </div>
              <button onMouseEnter={() => setHoverBtn("pro")} onMouseLeave={() => setHoverBtn(null)} onClick={e => { e.stopPropagation(); onSelectPlan(billing); }} className="rf-btn-solid" style={{ width: "100%", padding: "12px 24px", borderRadius: 12, border: "none", background: hoverBtn === "pro" ? t.fg : t.accent, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 660, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 12, boxSizing: "border-box", transition: "all 0.2s ease" }}>
                <Zap size={14} />{hasUsedTrial ? "Subscribe now" : `Start ${TRIAL_DAYS}-day free trial`}<ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div style={{ padding: "14px 32px 18px", borderTop: `1px solid ${t.borderSoft}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            {["Cancel anytime", "Secure checkout via Stripe", "No hidden fees"].map((s, i) => (
              <span key={i} style={{ fontSize: 11, color: t.fgSoft, display: "flex", alignItems: "center", gap: 4 }}><Check size={11} style={{ color: t.icon }} /> {s}</span>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
