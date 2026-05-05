import { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import * as Dialog from "@radix-ui/react-dialog";

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 1000 };

const INPUT_STYLE = (t) => ({
  width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${t.border}`,
  background: t.surface, color: t.fg, fontSize: 14, fontFamily: "'DM Sans', sans-serif",
  outline: "none", boxSizing: "border-box",
});

const PRIMARY_BTN = (t) => ({
  width: "100%", padding: "12px 24px", borderRadius: 12, border: "none", background: t.accent,
  color: "#fff", fontSize: 14, fontWeight: 650, fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
});

const LINK_STYLE = (t) => ({
  color: t.accent, cursor: "pointer", textDecoration: "none",
  fontSize: 14, fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
});

// Lenient password rules per project decision (NIST 2024 style).
// Min length is the only hard gate; the strength meter is visual
// encouragement to choose longer passwords without forcing complexity.
const MIN_PASSWORD_LENGTH = 8;

// Heuristic strength score 0–100. Length dominates; character-class
// diversity adds modest bonuses. Doesn't block submission — the gate
// is just MIN_PASSWORD_LENGTH.
function passwordStrength(pw) {
  if (!pw) return 0;
  // Length curve: 8→25, 12→55, 16→85, 20+→100
  const len = pw.length;
  let score = Math.min(100, Math.max(0, (len - 4) * 6));
  // Diversity bonuses, only applied above min length so very short
  // passwords don't appear "Strong" just because they have a symbol.
  if (len >= MIN_PASSWORD_LENGTH) {
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 8;
    if (/\d/.test(pw)) score += 8;
    if (/[^A-Za-z0-9]/.test(pw)) score += 8;
  }
  return Math.min(100, score);
}

function strengthLabel(score) {
  if (score < 25) return { label: "Weak", color: "#E25C5C" };
  if (score < 55) return { label: "Fair", color: "#F59E0B" };
  if (score < 80) return { label: "Good", color: "#22C55E" };
  return { label: "Strong", color: "#10B981" };
}

function StrengthMeter({ password, t }) {
  if (!password) return null;
  const score = passwordStrength(password);
  const { label, color } = strengthLabel(score);
  const tooShort = password.length < MIN_PASSWORD_LENGTH;
  return (
    <div style={{ marginTop: -4 }}>
      <div style={{ height: 4, borderRadius: 2, background: t.border, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: tooShort ? t.fgSoft : color, transition: "width 0.2s ease, background 0.2s ease" }} />
      </div>
      <div style={{ fontSize: 11, color: tooShort ? t.fgSoft : color, fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
        {tooShort
          ? `${MIN_PASSWORD_LENGTH - password.length} more character${MIN_PASSWORD_LENGTH - password.length === 1 ? "" : "s"} to meet minimum`
          : label}
      </div>
    </div>
  );
}

function MatchBadge({ password, confirm }) {
  // Live match indicator — red while passwords differ, green when they
  // line up. Hidden until the user has typed in confirm so we don't nag
  // before they've had a chance.
  if (!confirm) return null;
  const matches = password === confirm && password.length > 0;
  const color = matches ? "#10B981" : "#E25C5C";
  const bg    = matches ? "#10B98118" : "#E25C5C18";
  const border = matches ? "#10B98144" : "#E25C5C44";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999,
      background: bg, color, border: `1px solid ${border}`,
      fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
      marginTop: -4, alignSelf: "flex-start",
    }}>
      <span aria-hidden="true">{matches ? "✓" : "✗"}</span>
      {matches ? "Passwords match" : "Passwords do not match"}
    </div>
  );
}

const OAUTH_PROVIDERS = [
  {
    id: "google", label: "Continue with Google",
    bg: "#fff", color: "#3c4043", border: "#dadce0",
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

export default function AuthModal({ onClose, t, initialView = "login", initialEmail = "" }) {
  const { signIn, signUp, resetPassword, signInWithOAuth, updatePassword, signOut, clearRecovery } = useAuth();
  const [view, setView] = useState(initialView);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(null);

  const clear = () => { setError(""); setInfo(""); };

  const handleLogin = async (e) => {
    e.preventDefault(); clear(); setBusy(true);
    try {
      const { error } = await signIn(email, password);
      if (error) setError(error.message === "Invalid login credentials" ? "Invalid email or password." : error.message);
      else onClose();
    } catch { setError("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  const handleSignUp = async (e) => {
    e.preventDefault(); clear();
    if (password.length < MIN_PASSWORD_LENGTH) { setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const { error } = await signUp(email, password);
      if (error) {
        if (error.status === 422 || error.message?.toLowerCase().includes("already registered") || error.message?.toLowerCase().includes("user already registered"))
          setError("An account with this email already exists. Try signing in instead.");
        else setError(error.message);
      } else onClose();
    } catch { setError("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault(); clear(); setBusy(true);
    try {
      const { error } = await resetPassword(email);
      if (error) setError(error.message);
      else setInfo("Password reset link sent — check your email.");
    } catch { setError("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  // Recovery flow: user landed on the app via the email reset link, the SDK
  // established a recovery session, and we're forcing them to choose a new
  // password before letting them continue.
  const handleSetPassword = async (e) => {
    e.preventDefault(); clear();
    if (password.length < MIN_PASSWORD_LENGTH) { setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const { error } = await updatePassword(password);
      if (error) setError(error.message);
      else { clearRecovery?.(); onClose(); }
    } catch { setError("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  const handleOAuth = async (provider) => {
    clear(); setOauthBusy(provider);
    const { error } = await signInWithOAuth(provider);
    setOauthBusy(null);
    if (error) setError(error.message);
  };

  const title = view === "login" ? "Sign in"
    : view === "signup" ? "Create account"
    : view === "setPassword" ? "Set a new password"
    : "Reset password";

  // In recovery mode, hide the close button and offer "Sign out" instead.
  // Closing the modal mid-recovery would leave the user signed in via the
  // recovery token without ever having reset their password — confusing.
  const isRecoveryMode = view === "setPassword";

  return (
    <Dialog.Root open onOpenChange={o => { if (!o && !isRecoveryMode) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay style={OVERLAY} />
        <Dialog.Content
          aria-describedby={undefined}
          onPointerDownOutside={(e) => { if (isRecoveryMode) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (isRecoveryMode) e.preventDefault(); }}
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: t.bg, borderRadius: 20, width: "calc(100% - 48px)", maxWidth: 380, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", zIndex: 1001, outline: "none" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <Dialog.Title style={{ fontSize: 20, fontWeight: 720, color: t.fg, fontFamily: "'DM Sans', sans-serif", margin: 0 }}>
              {title}
            </Dialog.Title>
            {!isRecoveryMode && (
              <Dialog.Close asChild>
                <button aria-label="Close" style={{ width: 34, height: 34, borderRadius: 8, border: "none", background: "transparent", color: t.icon, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={16} strokeWidth={2} />
                </button>
              </Dialog.Close>
            )}
          </div>

          {error && <div style={{ padding: "10px 12px", borderRadius: 8, background: "#E25C5C18", border: "1px solid #E25C5C44", color: "#E25C5C", fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 14 }}>{error}</div>}
          {info && <div style={{ padding: "10px 12px", borderRadius: 8, background: `${t.accent}18`, border: `1px solid ${t.accent}44`, color: t.accent, fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 14 }}>{info}</div>}

          {view !== "reset" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {OAUTH_PROVIDERS.map(({ id, label, bg, color, border, icon }) => (
                  <button
                    key={id} type="button" disabled={oauthBusy !== null} onClick={() => handleOAuth(id)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${border}`, background: bg, color, fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: oauthBusy && oauthBusy !== id ? 0.5 : 1, transition: "opacity 0.15s" }}
                  >
                    {icon}{oauthBusy === id ? "Redirecting…" : label}
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
                <button type="button" onClick={() => setShowPw(v => !v)} aria-label="Toggle password visibility" className="rf-static" style={{ position: "absolute", right: 10, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: t.icon, padding: "0 4px" }}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
              <button type="submit" disabled={busy} className="rf-btn-solid" style={PRIMARY_BTN(t)}>{busy ? "Signing in…" : "Sign in"}</button>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <a href="#" className="rf-link" onClick={(e) => { e.preventDefault(); setView("reset"); clear(); }} style={LINK_STYLE(t)}>Forgot password?</a>
                <a href="#" className="rf-link" onClick={(e) => { e.preventDefault(); setView("signup"); clear(); }} style={LINK_STYLE(t)}>Create account</a>
              </div>
            </form>
          )}

          {view === "signup" && (
            <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={INPUT_STYLE(t)} />
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={MIN_PASSWORD_LENGTH} style={{ ...INPUT_STYLE(t), paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(v => !v)} aria-label="Toggle password visibility" className="rf-static" style={{ position: "absolute", right: 10, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: t.icon, padding: "0 4px" }}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
              <StrengthMeter password={password} t={t} />
              <input type={showPw ? "text" : "password"} placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={INPUT_STYLE(t)} />
              <MatchBadge password={password} confirm={confirm} />
              <button type="submit" disabled={busy} className="rf-btn-solid" style={PRIMARY_BTN(t)}>{busy ? "Creating account…" : "Create account"}</button>
              <div style={{ textAlign: "center", marginTop: 4 }}>
                <a href="#" className="rf-link" onClick={(e) => { e.preventDefault(); setView("login"); clear(); }} style={LINK_STYLE(t)}>Already have an account? Sign in</a>
              </div>
            </form>
          )}

          {view === "reset" && (
            <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={INPUT_STYLE(t)} />
              <button type="submit" disabled={busy} className="rf-btn-solid" style={PRIMARY_BTN(t)}>{busy ? "Sending…" : "Send reset link"}</button>
              <div style={{ textAlign: "center", marginTop: 4 }}>
                <a href="#" className="rf-link" onClick={(e) => { e.preventDefault(); setView("login"); clear(); }} style={LINK_STYLE(t)}>Back to sign in</a>
              </div>
            </form>
          )}

          {view === "setPassword" && (
            <form onSubmit={handleSetPassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 13, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", margin: "0 0 4px", lineHeight: 1.5 }}>
                Choose a new password for your account. You'll be signed in automatically.
              </p>
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} required minLength={MIN_PASSWORD_LENGTH} autoFocus style={{ ...INPUT_STYLE(t), paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(v => !v)} aria-label="Toggle password visibility" className="rf-static" style={{ position: "absolute", right: 10, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: t.icon, padding: "0 4px" }}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
              <StrengthMeter password={password} t={t} />
              <input type={showPw ? "text" : "password"} placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={INPUT_STYLE(t)} />
              <MatchBadge password={password} confirm={confirm} />
              <button type="submit" disabled={busy} className="rf-btn-solid" style={PRIMARY_BTN(t)}>{busy ? "Updating…" : "Set new password"}</button>
              <div style={{ textAlign: "center", marginTop: 4 }}>
                <a href="#" className="rf-link" onClick={(e) => { e.preventDefault(); clearRecovery?.(); signOut(); onClose(); }} style={{ ...LINK_STYLE(t), color: t.fgSoft, fontSize: 12 }}>
                  Cancel and sign out
                </a>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
