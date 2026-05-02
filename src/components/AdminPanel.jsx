import { useState, useEffect, useCallback } from "react";
import { X, RefreshCw } from "lucide-react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../contexts/AuthContext";
import { ROLES } from "../config/roles";
import * as Dialog from "@radix-ui/react-dialog";
import * as ScrollArea from "@radix-ui/react-scroll-area";

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 1000 };
const ROLE_OPTIONS = Object.entries(ROLES).map(([value, { label }]) => ({ value, label }));

export default function AdminPanel({ onClose, t }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true); setError("");
    const { data, error } = await supabase.from("profiles").select("id, email, role, created_at").order("created_at", { ascending: true });
    setLoading(false);
    if (error) { setError("Failed to load users: " + error.message); return; }
    setProfiles(data ?? []);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleRoleChange = async (profileId, newRole) => {
    if (profileId === user.id) { setError("You cannot change your own role."); return; }
    setSaving(profileId);
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", profileId);
    setSaving(null);
    if (error) { setError("Failed to update role: " + error.message); return; }
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role: newRole } : p));
  };

  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay style={OVERLAY} />
        <Dialog.Content
          aria-describedby={undefined}
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: t.bg, borderRadius: 20, width: "calc(100% - 48px)", maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden", zIndex: 1001, outline: "none" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${t.borderSoft}` }}>
            <Dialog.Title style={{ fontSize: 16, fontWeight: 720, color: t.fg, fontFamily: "'DM Sans', sans-serif", margin: 0 }}>User Management</Dialog.Title>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={fetchProfiles} aria-label="Refresh users" style={{ background: "transparent", border: "none", cursor: "pointer", color: t.icon, padding: "4px 8px", borderRadius: 6 }}><RefreshCw size={14} /></button>
              <Dialog.Close asChild>
                <button aria-label="Close" style={{ width: 34, height: 34, borderRadius: 8, border: "none", background: "transparent", color: t.icon, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} strokeWidth={2} /></button>
              </Dialog.Close>
            </div>
          </div>

          {error && <div style={{ margin: "12px 20px 0", padding: "10px 12px", borderRadius: 8, background: "#E25C5C18", border: "1px solid #E25C5C44", color: "#E25C5C", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>{error}</div>}

          <ScrollArea.Root style={{ flex: 1, overflow: "hidden" }}>
            <ScrollArea.Viewport style={{ height: "100%", width: "100%" }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: "center", color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>Loading users…</div>
              ) : profiles.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>No users found.</div>
              ) : profiles.map((profile, i) => {
                const isSelf = profile.id === user.id;
                return (
                  <div key={profile.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: i < profiles.length - 1 ? `1px solid ${t.borderSoft}` : "none" }}>
                    <span style={{ width: 32, height: 32, borderRadius: 16, background: t.accentSoft, color: t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
                      {profile.email?.[0]?.toUpperCase() ?? "?"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.fg, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {profile.email} {isSelf && <span style={{ fontSize: 11, color: t.fgSoft }}>(you)</span>}
                      </div>
                      <div style={{ fontSize: 11, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>
                        Joined {new Date(profile.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <select
                      value={profile.role}
                      disabled={isSelf || saving === profile.id}
                      onChange={e => handleRoleChange(profile.id, e.target.value)}
                      style={{ padding: "5px 8px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: isSelf ? t.fgSoft : t.fg, fontSize: 12, fontFamily: "'DM Sans', sans-serif", cursor: isSelf ? "not-allowed" : "pointer", opacity: isSelf ? 0.5 : 1 }}
                    >
                      {ROLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                );
              })}
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="vertical" style={{ display: "flex", userSelect: "none", touchAction: "none", padding: 2, width: 8 }}>
              <ScrollArea.Thumb style={{ flex: 1, background: t.border, borderRadius: 4 }} />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
