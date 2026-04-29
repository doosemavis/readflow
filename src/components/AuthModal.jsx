import { useState } from "react";
import { X, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const INPUT_STYLE = (t) => ({
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${t.border}`,
  background: t.surface,
  color: t.fg,
  fontSize: 14,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  boxSizing: "border-box",
});

const BTN_STYLE = (t) => ({
  width: "100%",
  padding: "11px",
  borderRadius: 10,
  border: "none",
  background: t.accent,
  color: "#fff",
  fontSize: 14,
  fontWeight: 650,
  fontFamily: "'DM Sans', sans-serif",
  cursor: "pointer",
});

const LINK_STYLE = (t) => ({
  background: "none",
  border: "none",
  color: t.accent,
  cursor: "pointer",
  fontSize: 13,
  fontFamily: "'DM Sans', sans-serif",
  padding: 0,
});

export default function AuthModal({ onClose, t }) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [view, setView] = useState("login"); // login | signup | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const clear = () => { setError(""); setInfo(""); };

  const handleLogin = async (e) => {
    e.preventDefault();
    clear();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Invalid email or password." : error.message);
    } else {
      onClose();
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    clear();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setBusy(true);
    const { error } = await signUp(email, password);
    setBusy(false);
    if (error) {
      setError(error.message);
    } else {
      setInfo("Check your email to confirm your account, then log in.");
      setView("login");
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    clear();
    setBusy(true);
    const { error } = await resetPassword(email);
    setBusy(false);
    if (error) {
      setError(error.message);
    } else {
      setInfo("Password reset link sent — check your email.");
    }
  };

  const title = view === "login" ? "Sign in" : view === "signup" ? "Create account" : "Reset password";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div style={{ background: t.bg, borderRadius: 20, width: "100%", maxWidth: 380, padding: 28, position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "transparent", border: "none", cursor: "pointer", color: t.icon, padding: 4, borderRadius: 6 }}><X size={16} /></button>

        <h2 style={{ fontSize: 20, fontWeight: 720, color: t.fg, marginBottom: 20, fontFamily: "'DM Sans', sans-serif" }}>{title}</h2>

        {error && <div style={{ padding: "10px 12px", borderRadius: 8, background: "#E25C5C18", border: "1px solid #E25C5C44", color: "#E25C5C", fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 14 }}>{error}</div>}
        {info && <div style={{ padding: "10px 12px", borderRadius: 8, background: `${t.accent}18`, border: `1px solid ${t.accent}44`, color: t.accent, fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 14 }}>{info}</div>}

        {view === "login" && (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={INPUT_STYLE(t)} />
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ ...INPUT_STYLE(t), paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: t.icon, padding: 2 }}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            </div>
            <button type="submit" disabled={busy} style={BTN_STYLE(t)}>{busy ? "Signing in…" : "Sign in"}</button>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <button type="button" onClick={() => { setView("reset"); clear(); }} style={LINK_STYLE(t)}>Forgot password?</button>
              <button type="button" onClick={() => { setView("signup"); clear(); }} style={LINK_STYLE(t)}>Create account</button>
            </div>
          </form>
        )}

        {view === "signup" && (
          <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={INPUT_STYLE(t)} />
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ ...INPUT_STYLE(t), paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: t.icon, padding: 2 }}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            </div>
            <input type={showPw ? "text" : "password"} placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={INPUT_STYLE(t)} />
            <button type="submit" disabled={busy} style={BTN_STYLE(t)}>{busy ? "Creating account…" : "Create account"}</button>
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <button type="button" onClick={() => { setView("login"); clear(); }} style={LINK_STYLE(t)}>Already have an account? Sign in</button>
            </div>
          </form>
        )}

        {view === "reset" && (
          <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={INPUT_STYLE(t)} />
            <button type="submit" disabled={busy} style={BTN_STYLE(t)}>{busy ? "Sending…" : "Send reset link"}</button>
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <button type="button" onClick={() => { setView("login"); clear(); }} style={LINK_STYLE(t)}>Back to sign in</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
