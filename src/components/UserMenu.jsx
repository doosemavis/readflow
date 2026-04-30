import { useState, useRef } from "react";
import { LogOut, Settings, ChevronDown, User, ImageIcon } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { ROLES } from "../config/roles";
import { PremadeAvatarSvg } from "./AvatarSettingsModal";

const ROLE_COLORS = {
  admin:    { bg: "#3B82F618", text: "#3B82F6" },
  elevated: { bg: "#22C55E18", text: "#22C55E" },
  user:     { bg: "transparent", text: "inherit" },
};

function Avatar({ avatar, initial, accent, size = 28 }) {
  const br = Math.round(size * 0.28);
  if (avatar?.type === "upload" && avatar?.dataUrl) {
    return <img src={avatar.dataUrl} alt="avatar" style={{ width: size, height: size, borderRadius: br, objectFit: "cover", display: "block", flexShrink: 0 }} />;
  }
  if (avatar?.type === "premade" && avatar?.id) {
    return <PremadeAvatarSvg id={avatar.id} bg={avatar.bg} size={size} borderRadius={br} />;
  }
  return (
    <span style={{ width: size, height: size, borderRadius: br, background: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.46), fontWeight: 700, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
      {initial}
    </span>
  );
}

export default function UserMenu({ t, onShowAuth, onShowAdmin, onShowAvatarSettings, avatar }) {
  const { user, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen(v => !v);
  };

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
    <div style={{ position: "relative" }}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 4px", borderRadius: 8, border: `1px solid ${t.border}`, background: open ? t.surface : "transparent", cursor: "pointer", color: t.fg }}
      >
        <Avatar avatar={avatar} initial={initial} accent={t.accent} size={28} />
        <ChevronDown size={12} style={{ color: t.icon, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
          <div style={{ position: "fixed", top: dropPos.top, right: dropPos.right, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: "0 12px 36px rgba(0,0,0,0.18)", zIndex: 999, minWidth: 220, overflow: "hidden" }}>

            {/* Profile header */}
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${t.borderSoft}`, display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar avatar={avatar} initial={initial} accent={t.accent} size={36} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.fg, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                {role !== "user" && (
                  <span style={{ display: "inline-flex", alignItems: "center", marginTop: 3, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 650, fontFamily: "'DM Sans', sans-serif", background: roleColor.bg, color: roleColor.text }}>{roleLabel}</span>
                )}
              </div>
            </div>

            {/* Avatar settings */}
            <button
              onClick={() => { setOpen(false); onShowAvatarSettings(); }}
              style={{ width: "100%", padding: "10px 14px", border: "none", background: "transparent", color: t.fg, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${t.borderSoft}` }}
              onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <ImageIcon size={14} style={{ color: t.icon }} /> Change avatar
            </button>

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
        </>
      )}
    </div>
  );
}
