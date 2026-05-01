import { useState, useRef, useEffect } from "react";
import { X, Lock, Check, Gift, BookOpen, Loader2 } from "lucide-react";
import { TRIAL_DAYS } from "../config/constants";
import * as Dialog from "@radix-ui/react-dialog";

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 1100 };

export default function CheckoutModal({ billing, hasUsedTrial, onSuccess, onClose, t }) {
  const [card, setCard] = useState(""); const [expiry, setExpiry] = useState(""); const [cvc, setCvc] = useState("");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [zip, setZip] = useState(""); const [country, setCountry] = useState("US");
  const [processing, setProcessing] = useState(false); const [done, setDone] = useState(false);
  const [quickPayProcessing, setQuickPayProcessing] = useState(null);
  const formRef = useRef(null);

  const price = billing === "monthly" ? "$5.00" : "$45.00";
  const cycle = billing === "monthly" ? "month" : "year";
  const perMonth = billing === "annual" ? "$3.75" : "$5.00";
  const chargeDate = new Date(Date.now() + TRIAL_DAYS * 86400000);

  const formatCard = v => { const d = v.replace(/\D/g, "").slice(0, 16); return d.replace(/(.{4})/g, "$1 ").trim(); };
  const formatExpiry = v => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length >= 3 ? d.slice(0, 2) + " / " + d.slice(2) : d; };
  const detectBrand = n => { const d = n.replace(/\s/g, ""); if (/^4/.test(d)) return "visa"; if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return "mastercard"; if (/^3[47]/.test(d)) return "amex"; return null; };
  const cardBrand = detectBrand(card);
  const brandColors = { visa: "#1A1F71", mastercard: "#EB001B", amex: "#006FCF" };
  const isValid = card.replace(/\s/g, "").length >= 15 && expiry.replace(/\D/g, "").length === 4 && cvc.length >= 3 && name.length > 1 && email.includes("@");

  useEffect(() => {
    const interval = setInterval(() => {
      if (!formRef.current) return;
      const map = { email: ["email", setEmail], name: ["cc-name", setName], card: ["cc-number", setCard], expiry: ["cc-exp", setExpiry], cvc: ["cc-csc", setCvc], zip: ["postal-code", setZip] };
      Object.values(map).forEach(([auto, setter]) => { const el = formRef.current.querySelector(`[autocomplete="${auto}"]`); if (el?.value) setter(p => p || el.value); });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleQuickPay = async (method) => { setQuickPayProcessing(method); await new Promise(r => setTimeout(r, 1800)); setQuickPayProcessing(null); setDone(true); await new Promise(r => setTimeout(r, 1200)); onSuccess(billing); };
  const handleSubmit = async () => { if (!isValid || processing) return; setProcessing(true); await new Promise(r => setTimeout(r, 2000)); setProcessing(false); setDone(true); await new Promise(r => setTimeout(r, 1200)); onSuccess(billing); };

  const inp = { width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface, color: t.fg, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" };
  const lbl = { fontSize: 12, fontWeight: 600, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", marginBottom: 6, display: "block" };
  const qBtn = { flex: 1, padding: "12px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 650, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s", boxSizing: "border-box" };

  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay style={OVERLAY} />
        <Dialog.Content
          aria-describedby={undefined}
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: t.bg, borderRadius: 24, maxWidth: 460, width: "calc(100% - 48px)", boxShadow: "0 32px 80px rgba(0,0,0,0.25)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto", zIndex: 1101, outline: "none", fontFamily: "'DM Sans', sans-serif" }}
        >
          {done ? (
            <div style={{ padding: "48px 32px", textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: 32, background: "#22C55E20", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}><Check size={32} style={{ color: "#22C55E" }} /></div>
              <Dialog.Title style={{ fontSize: 22, fontWeight: 740, color: t.fg, margin: "0 0 8px", fontFamily: "'DM Sans', sans-serif" }}>You're all set!</Dialog.Title>
              <p style={{ fontSize: 14, color: t.fgSoft, margin: 0, lineHeight: 1.6 }}>Your {TRIAL_DAYS}-day free trial has started. Your card will be charged on {chargeDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</p>
            </div>
          ) : (
            <>
              <div style={{ padding: "24px 28px 18px", borderBottom: `1px solid ${t.borderSoft}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}><BookOpen size={18} style={{ color: t.accent }} /></div>
                  <div>
                    <Dialog.Title style={{ fontSize: 15, fontWeight: 700, color: t.fg, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>ReadFlow Pro</Dialog.Title>
                    <p style={{ fontSize: 12, color: t.fgSoft, margin: 0 }}>{billing === "monthly" ? "Monthly" : "Annual"} subscription</p>
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button style={{ background: t.surface, border: "none", cursor: "pointer", color: t.icon, padding: "6px 12px", borderRadius: 8 }}><X size={16} /></button>
                </Dialog.Close>
              </div>

              <div style={{ padding: "16px 28px", borderBottom: `1px solid ${t.borderSoft}`, background: t.surface }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><span style={{ fontSize: 13, color: t.fg, fontWeight: 600 }}>ReadFlow Pro — {billing === "monthly" ? "Monthly" : "Annual"}</span><span style={{ fontSize: 15, fontWeight: 720, color: t.fg }}>{price}/{cycle}</span></div>
                {billing === "annual" && <p style={{ fontSize: 12, color: t.accent, fontWeight: 600, margin: "0 0 4px" }}>{perMonth}/mo — save $15/year</p>}
                {!hasUsedTrial && <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, padding: "8px 12px", borderRadius: 8, background: `${t.accent}12` }}><Gift size={13} style={{ color: t.accent }} /><span style={{ fontSize: 12, fontWeight: 600, color: t.accent }}>{TRIAL_DAYS}-day free trial — won't be charged until {chargeDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></div>}
              </div>

              <div style={{ padding: "20px 28px 0" }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => handleQuickPay("apple")} disabled={!!quickPayProcessing} style={{ ...qBtn, background: "#000", color: "#fff", opacity: quickPayProcessing && quickPayProcessing !== "apple" ? 0.5 : 1 }}>{quickPayProcessing === "apple" ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />…</> : <><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg> Pay</>}</button>
                  <button onClick={() => handleQuickPay("google")} disabled={!!quickPayProcessing} style={{ ...qBtn, background: t.surface, color: t.fg, border: `1px solid ${t.border}`, opacity: quickPayProcessing && quickPayProcessing !== "google" ? 0.5 : 1 }}>{quickPayProcessing === "google" ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />…</> : <><svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Pay</>}</button>
                  <button onClick={() => handleQuickPay("link")} disabled={!!quickPayProcessing} style={{ ...qBtn, background: "#635BFF", color: "#fff", opacity: quickPayProcessing && quickPayProcessing !== "link" ? 0.5 : 1 }}>{quickPayProcessing === "link" ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />…</> : "Link"}</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0 4px" }}><div style={{ flex: 1, height: 1, background: t.border }} /><span style={{ fontSize: 11, color: t.fgSoft, fontWeight: 500, whiteSpace: "nowrap" }}>Or pay with card</span><div style={{ flex: 1, height: 1, background: t.border }} /></div>
              </div>

              <div ref={formRef} style={{ padding: "14px 28px 28px" }}>
                <div style={{ marginBottom: 14 }}><label style={lbl}>Email</label><input name="email" type="email" autoComplete="email" inputMode="email" value={email} placeholder="you@email.com" onChange={e => setEmail(e.target.value)} onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} style={inp} /></div>
                <div style={{ marginBottom: 14 }}><label style={lbl}>Name on card</label><input name="ccname" type="text" autoComplete="cc-name" value={name} placeholder="Full name" onChange={e => setName(e.target.value)} onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} style={inp} /></div>
                <div style={{ marginBottom: 14 }}><label style={lbl}>Card number</label><div style={{ position: "relative" }}><input name="cardnumber" type="text" autoComplete="cc-number" inputMode="numeric" value={card} placeholder="1234 5678 9012 3456" onChange={e => setCard(formatCard(e.target.value))} onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} style={{ ...inp, paddingRight: 56 }} /><div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 4 }}>{cardBrand ? <div style={{ padding: "2px 6px", borderRadius: 4, background: brandColors[cardBrand] || t.icon, fontSize: 9, fontWeight: 700, color: "#fff", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>{cardBrand}</div> : ["#1A1F71","#EB001B","#006FCF"].map((c,i) => <div key={i} style={{ width: 7, height: 7, borderRadius: 4, background: c, opacity: 0.35 }} />)}</div></div></div>
                <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}><label style={lbl}>Expiry</label><input name="cc-exp" type="text" autoComplete="cc-exp" inputMode="numeric" value={expiry} placeholder="MM / YY" onChange={e => setExpiry(formatExpiry(e.target.value))} onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} style={inp} /></div>
                  <div style={{ flex: 1 }}><label style={lbl}>CVC</label><input name="cvc" type="text" autoComplete="cc-csc" inputMode="numeric" value={cvc} placeholder="123" onChange={e => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} style={inp} /></div>
                </div>
                <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                  <div style={{ flex: 2 }}><label style={lbl}>Country</label><select name="country" autoComplete="country" value={country} onChange={e => setCountry(e.target.value)} style={{ ...inp, cursor: "pointer", appearance: "auto" }}><option value="US">United States</option><option value="CA">Canada</option><option value="GB">United Kingdom</option><option value="AU">Australia</option><option value="DE">Germany</option><option value="FR">France</option><option value="JP">Japan</option><option value="OTHER">Other</option></select></div>
                  <div style={{ flex: 1 }}><label style={lbl}>ZIP / Postal</label><input name="postal-code" type="text" autoComplete="postal-code" value={zip} placeholder="10001" onChange={e => setZip(e.target.value)} onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} style={inp} /></div>
                </div>
                <button onClick={handleSubmit} disabled={!isValid || processing} className="rf-btn-solid" style={{ width: "100%", padding: "12px 24px", borderRadius: 12, border: "none", background: isValid && !processing ? t.accent : t.border, color: isValid && !processing ? "#fff" : t.fgSoft, cursor: isValid && !processing ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 670, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxSizing: "border-box", opacity: processing ? 0.8 : 1 }}>
                  {processing ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Processing…</> : <><Lock size={14} />{hasUsedTrial ? `Subscribe — ${price}/${cycle}` : "Start free trial"}</>}
                </button>
                <p style={{ fontSize: 11, color: t.fgSoft, textAlign: "center", margin: "14px 0 0", lineHeight: 1.5 }}>{hasUsedTrial ? `Charged ${price} today, renews every ${cycle}.` : `Card charged ${price} on ${chargeDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Cancel anytime before.`}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 12 }}><Lock size={10} style={{ color: t.icon }} /><span style={{ fontSize: 10, color: t.icon }}>Secured by Stripe · 256-bit encryption</span></div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
