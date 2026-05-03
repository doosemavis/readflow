import { useEffect, useState } from "react";
import { X, Lock, BookOpen, AlertCircle } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import CatLoader from "./CatLoader";
import { supabase } from "../utils/supabase";

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 1100 };

// Thin "redirecting to Stripe" loader. The actual card form, payment method
// pickers, 3DS handling, etc. all live on Stripe's hosted Checkout page.
// On mount we ask the create-checkout-session edge function for a Session
// URL and then full-page-navigate the browser there.
export default function CheckoutModal({ billing, onClose, t }) {
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Please sign in first");

        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            billingCycle: billing,
            returnUrl: window.location.origin,
          }),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Checkout failed");
        if (cancelled) return;

        window.location.href = json.url;
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Something went wrong");
      }
    })();

    return () => { cancelled = true; };
  }, [billing]);

  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay style={OVERLAY} />
        <Dialog.Content
          aria-describedby={undefined}
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: t.bg, borderRadius: 24, maxWidth: 380, width: "calc(100% - 48px)", boxShadow: "0 32px 80px rgba(0,0,0,0.25)", overflow: "hidden", zIndex: 1101, outline: "none", fontFamily: "'DM Sans', sans-serif" }}
        >
          <div style={{ padding: "24px 28px 18px", borderBottom: `1px solid ${t.borderSoft}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={18} style={{ color: t.accent }} />
              </div>
              <div>
                <Dialog.Title style={{ fontSize: 15, fontWeight: 700, color: t.fg, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>ReadFlow Pro</Dialog.Title>
                <p style={{ fontSize: 12, color: t.fgSoft, margin: 0 }}>{billing === "monthly" ? "Monthly" : "Annual"} subscription</p>
              </div>
            </div>
            <Dialog.Close asChild>
              <button aria-label="Close" style={{ width: 34, height: 34, borderRadius: 8, border: "none", background: t.surface, color: t.icon, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} strokeWidth={2} />
              </button>
            </Dialog.Close>
          </div>

          <div style={{ padding: "40px 28px", textAlign: "center" }}>
            {error ? (
              <>
                <div style={{ width: 56, height: 56, borderRadius: 28, background: "#EF444420", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <AlertCircle size={28} style={{ color: "#EF4444" }} />
                </div>
                <p style={{ fontSize: 14, color: t.fg, fontWeight: 600, margin: "0 0 6px" }}>Couldn't start checkout</p>
                <p style={{ fontSize: 13, color: t.fgSoft, margin: "0 0 20px", lineHeight: 1.5 }}>{error}</p>
                <button
                  onClick={onClose}
                  style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface, color: t.fg, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <CatLoader size={48} />
                </div>
                <p style={{ fontSize: 14, color: t.fg, fontWeight: 600, margin: "16px 0 6px" }}>Redirecting to secure checkout…</p>
                <p style={{ fontSize: 12, color: t.fgSoft, margin: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Lock size={11} /> Powered by Stripe
                </p>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
