import { useState, useEffect, useRef } from "react";
import { LogOut, Settings, ChevronDown, User } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { ROLES } from "../config/roles";

const ROLE_COLORS = {
  admin:    { bg: "#3B82F618", text: "#3B82F6" },
  elevated: { bg: "#22C55E18", text: "#22C55E" },
  user:     { bg: "transparent", text: "inherit" },
};

export default function UserMenu({ t, onShowAuth, onShowAdmin }) {
  const { user, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!user) {
    return (
      <button
        onClick={onShowAuth}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: "transparent", color: t.fgSoft, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}
      >
        <User size={13} /> Sign in
      </button>
    );
  }

  const initial = user.email?.[0]?.toUpperCase() ?? "?";
  const roleColor = ROLE_COLORS[role] ?? ROLE_COLORS.user;
  const roleLabel = ROLES[role]?.label ?? "User";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 4px", borderRadius: 8, border: `1px solid ${t.border}`, background: open ? t.surface : "transparent", cursor: "pointer", color: t.fg }}
      >
        <span style={{ width: 26, height: 26, borderRadius: 13, background: t.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>{initial}</span>
        <ChevronDown size={12} style={{ color: t.icon, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div style={{ position: "fixed", top: "auto", right: 16, marginTop: 6, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: "0 12px 36px rgba(0,0,0,0.18)", zIndex: 999, minWidth: 220, overflow: "hidden" }}
          ref={node => { if (node && ref.current) { const btn = ref.current.getBoundingClientRect(); node.style.top = (btn.bottom + 6) + "px"; } }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${t.borderSoft}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.fg, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
            {role !== "user" && (
              <span style={{ display: "inline-flex", alignItems: "center", marginTop: 4, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 650, fontFamily: "'DM Sans', sans-serif", background: roleColor.bg, color: roleColor.text }}>{roleLabel}</span>
            )}
          </div>

          {role === "admin" && (
            <button
              onClick={() => { setOpen(false); onShowAdmin(); }}
              style={{ width: "100%", padding: "10px 14px", border: "none", background: "transparent", color: t.fg, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${t.borderSoft}` }}
              onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <Settings size={14} style={{ color: t.icon }} /> Admin Panel
            </button>
          )}

          <button
            onClick={() => { setOpen(false); signOut(); }}
            style={{ width: "100%", padding: "10px 14px", border: "none", background: "transparent", color: "#E25C5C", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8 }}
            onMouseEnter={e => e.currentTarget.style.background = "#E25C5C10"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
