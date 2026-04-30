import { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
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

const PRIMARY_BTN = (t) => ({
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

const OAUTH_PROVIDERS = [
  {
    id: "google",
    label: "Continue with Google",
    bg: "#fff",
    color: "#3c4043",
    border: "#dadce0",
    icon: (
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v8.51h12.84c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.19-10.36 7.19-17.14z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.5-1.45-.78-2.99-.78-4.59s.27-3.14.78-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.97 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      </svg>
    ),
  },
];

export default function AuthModal({ onClose, t }) {
  const { signIn, signUp, resetPassword, signInWithOAuth } = useAuth();
  const [view, setView] = useState("login"); // login | signup | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(null);

  const clear = () => { setError(""); setInfo(""); };

  const handleLogin = async (e) => {
    e.preventDefault();
    clear();
    setBusy(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message === "Invalid login credentials" ? "Invalid email or password." : error.message);
      } else {
        onClose();
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    clear();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setBusy(true);
    try {
      const { error } = await signUp(email, password);
      if (error) {
        if (error.status === 422 || error.message?.toLowerCase().includes("already registered") || error.message?.toLowerCase().includes("user already registered")) {
          setError("An account with this email already exists. Try signing in instead.");
        } else {
          setError(error.message);
        }
      } else {
        onClose();
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    clear();
    setBusy(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        setError(error.message);
      } else {
        setInfo("Password reset link sent — check your email.");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleOAuth = async (provider) => {
    clear();
    setOauthBusy(provider);
    const { error } = await signInWithOAuth(provider);
    setOauthBusy(null);
    if (error) setError(error.message);
    // On success the browser redirects — modal stays until redirect completes
  };

  const title = view === "login" ? "Sign in" : view === "signup" ? "Create account" : "Reset password";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div style={{ background: t.bg, borderRadius: 20, width: "100%", maxWidth: 380, padding: 28, position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "transparent", border: "none", cursor: "pointer", color: t.icon, padding: 4, borderRadius: 6 }}><X size={16} /></button>

        <h2 style={{ fontSize: 20, fontWeight: 720, color: t.fg, marginBottom: 20, fontFamily: "'DM Sans', sans-serif" }}>{title}</h2>

        {error && <div style={{ padding: "10px 12px", borderRadius: 8, background: "#E25C5C18", border: "1px solid #E25C5C44", color: "#E25C5C", fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 14 }}>{error}</div>}
        {info && <div style={{ padding: "10px 12px", borderRadius: 8, background: `${t.accent}18`, border: `1px solid ${t.accent}44`, color: t.accent, fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 14 }}>{info}</div>}

        {/* OAuth buttons — shown on login and signup views */}
        {view !== "reset" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {OAUTH_PROVIDERS.map(({ id, label, bg, color, border, icon }) => (
                <button
                  key={id}
                  type="button"
                  disabled={oauthBusy !== null}
                  onClick={() => handleOAuth(id)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${border}`, background: bg, color, fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: oauthBusy && oauthBusy !== id ? 0.5 : 1, transition: "opacity 0.15s" }}
                >
                  {icon}
                  {oauthBusy === id ? "Redirecting…" : label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: t.border }} />
              <span style={{ fontSize: 12, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif" }}>or</span>
              <div style={{ flex: 1, height: 1, background: t.border }} />
            </div>
          </>
        )}

        {view === "login" && (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={INPUT_STYLE(t)} />
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ ...INPUT_STYLE(t), paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: t.icon, padding: 2 }}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            </div>
            <button type="submit" disabled={busy} style={PRIMARY_BTN(t)}>{busy ? "Signing in…" : "Sign in"}</button>
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
            <button type="submit" disabled={busy} style={PRIMARY_BTN(t)}>{busy ? "Creating account…" : "Create account"}</button>
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <button type="button" onClick={() => { setView("login"); clear(); }} style={LINK_STYLE(t)}>Already have an account? Sign in</button>
            </div>
          </form>
        )}

        {view === "reset" && (
          <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={INPUT_STYLE(t)} />
            <button type="submit" disabled={busy} style={PRIMARY_BTN(t)}>{busy ? "Sending…" : "Send reset link"}</button>
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <button type="button" onClick={() => { setView("login"); clear(); }} style={LINK_STYLE(t)}>Back to sign in</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
