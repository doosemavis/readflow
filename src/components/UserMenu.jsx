import { LogOut, Settings, ChevronDown, ChevronRight, User, ImageIcon, Palette, CreditCard, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { ROLES } from "../config/roles";
import { PremadeAvatarSvg } from "./PremadeAvatarSvg";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Switch from "@radix-ui/react-switch";

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

export default function UserMenu({ t, onShowAuth, onShowAdmin, onShowAvatarSettings, onShowSubscription, onShowDeleteAccount, avatar, themePersistEnabled, onToggleThemePersist }) {
  const { user, role, signOut } = useAuth();

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
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button className="rf-static" style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 4px", borderRadius: 8, border: `1px solid ${t.border}`, background: "transparent", cursor: "pointer", color: t.fg, outline: "none" }}>
          <Avatar avatar={avatar} initial={initial} accent={t.accent} size={28} />
          <ChevronDown size={12} style={{ color: t.icon, transition: "transform 0.2s" }} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: "0 12px 36px rgba(0,0,0,0.18)", minWidth: 220, overflow: "hidden", zIndex: 999, outline: "none" }}
        >
          {/* Profile header — not interactive */}
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${t.borderSoft}`, display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar avatar={avatar} initial={initial} accent={t.accent} size={36} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.fg, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
              {role !== "user" && (
                <span style={{ display: "inline-flex", alignItems: "center", marginTop: 3, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 650, fontFamily: "'DM Sans', sans-serif", background: roleColor.bg, color: roleColor.text }}>{roleLabel}</span>
              )}
            </div>
          </div>

          {/* Settings submenu — consolidates Change avatar, Manage subscription,
              and (for admins) Admin panel into a single nested flyout. Each
              child still opens its own dedicated modal (SRP preserved). */}
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger
              onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              style={{ padding: "10px 14px", cursor: "pointer", color: t.fg, fontSize: 13, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", borderBottom: `1px solid ${t.borderSoft}`, outline: "none", userSelect: "none" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Settings size={14} style={{ color: t.icon }} /> Settings
              </span>
              <ChevronRight size={14} style={{ color: t.icon }} />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                sideOffset={4}
                style={{ minWidth: 200, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 12, padding: 4, boxShadow: "0 12px 32px rgba(0,0,0,0.15)", zIndex: 1100 }}
              >
                <DropdownMenu.Item
                  onSelect={onShowAvatarSettings}
                  onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  style={{ padding: "10px 12px", cursor: "pointer", color: t.fg, fontSize: 13, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8, borderRadius: 8, outline: "none", userSelect: "none" }}
                >
                  <ImageIcon size={14} style={{ color: t.icon }} /> Change avatar
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={onShowSubscription}
                  onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  style={{ padding: "10px 12px", cursor: "pointer", color: t.fg, fontSize: 13, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8, borderRadius: 8, outline: "none", userSelect: "none" }}
                >
                  <CreditCard size={14} style={{ color: t.icon }} /> Manage subscription
                </DropdownMenu.Item>
                {role === "admin" && (
                  <DropdownMenu.Item
                    onSelect={onShowAdmin}
                    onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    style={{ padding: "10px 12px", cursor: "pointer", color: t.fg, fontSize: 13, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8, borderRadius: 8, outline: "none", userSelect: "none" }}
                  >
                    <User size={14} style={{ color: t.icon }} /> Admin Panel
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Separator style={{ height: 1, background: t.borderSoft, margin: "4px 0" }} />
                <DropdownMenu.Item
                  onSelect={onShowDeleteAccount}
                  onMouseEnter={e => e.currentTarget.style.background = "#E25C5C18"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  style={{ padding: "10px 12px", cursor: "pointer", color: "#E25C5C", fontSize: 13, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8, borderRadius: 8, outline: "none", userSelect: "none" }}
                >
                  <Trash2 size={14} /> Delete account
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Item
            onSelect={(e) => { e.preventDefault(); onToggleThemePersist?.(); }}
            onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            style={{ padding: "10px 14px", cursor: "pointer", color: t.fg, fontSize: 13, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", borderBottom: `1px solid ${t.borderSoft}`, outline: "none", userSelect: "none" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Palette size={14} style={{ color: t.icon }} /> Remember theme
            </span>
            <Switch.Root
              checked={!!themePersistEnabled}
              onCheckedChange={() => onToggleThemePersist?.()}
              onClick={e => e.stopPropagation()}
              className="rf-static"
              style={{
                width: 36, height: 20, borderRadius: 10, padding: 2, flexShrink: 0,
                background: themePersistEnabled ? (t.switchOn ?? t.accent) : t.border, border: "none", cursor: "pointer",
                transition: "background 0.2s ease", display: "flex", alignItems: "center",
                outline: "none",
              }}
            >
              <Switch.Thumb style={{
                display: "block", width: 16, height: 16, borderRadius: 8,
                background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                transition: "transform 0.2s cubic-bezier(0.4,0,0.2,1)",
                transform: themePersistEnabled ? "translateX(16px)" : "translateX(0)",
              }} />
            </Switch.Root>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={signOut}
            onMouseEnter={e => e.currentTarget.style.background = "#E25C5C10"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            style={{ padding: "10px 14px", cursor: "pointer", color: "#E25C5C", fontSize: 13, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8, outline: "none", userSelect: "none" }}
          >
            <LogOut size={14} /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
