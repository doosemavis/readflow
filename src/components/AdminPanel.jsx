import { useState, useEffect, useCallback } from "react";
import { X, RefreshCw, Users, Gift, BarChart3, Crown, Trash2, AlertCircle, ChevronDown, Check } from "lucide-react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../contexts/AuthContext";
import { ROLES } from "../config/roles";
import * as Dialog from "@radix-ui/react-dialog";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import CatLoader from "./CatLoader";
import { useToast } from "./Toast";

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 1000 };
const ROLE_OPTIONS = Object.entries(ROLES).map(([value, { label }]) => ({ value, label }));

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatCard({ label, value, sub, t }) {
  return (
    <div style={{ flex: 1, minWidth: 130, padding: "14px 16px", borderRadius: 12, background: t.surface, border: `1px solid ${t.borderSoft}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: t.fgSoft, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 720, color: t.fg, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab: Users (existing role management)
// ─────────────────────────────────────────────────────────────────────────
function UsersTab({ t }) {
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
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 0" }}>
        <span style={{ fontSize: 12, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif" }}>{profiles.length} user{profiles.length === 1 ? "" : "s"}</span>
        <button onClick={fetchProfiles} aria-label="Refresh" style={{ background: "transparent", border: "none", cursor: "pointer", color: t.icon, padding: "4px 8px", borderRadius: 6 }}><RefreshCw size={14} /></button>
      </div>
      {error && <div style={{ margin: "12px 20px 0", padding: "10px 12px", borderRadius: 8, background: "#E25C5C18", border: "1px solid #E25C5C44", color: "#E25C5C", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>{error}</div>}
      {loading ? (
        <div style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}><CatLoader size={120} /><span>Loading users…</span></div>
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
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab: Grant Pro (gift Pro access by email — admin or owner)
// ─────────────────────────────────────────────────────────────────────────
function GrantProTab({ t }) {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [months, setMonths] = useState(3);
  const [busy, setBusy] = useState(false);
  const [grants, setGrants] = useState([]);
  const [loadingGrants, setLoadingGrants] = useState(true);

  const fetchGrants = useCallback(async () => {
    setLoadingGrants(true);
    const { data, error } = await supabase.rpc("list_active_pro_grants");
    setLoadingGrants(false);
    if (error) { showToast("Couldn't load grants: " + error.message, "error"); return; }
    setGrants(data ?? []);
  }, [showToast]);

  useEffect(() => { fetchGrants(); }, [fetchGrants]);

  const handleGrant = async () => {
    if (!email.trim()) { showToast("Enter an email", "error"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("grant_pro_access", { target_email: email.trim(), months });
    setBusy(false);
    if (error) { showToast("Grant failed: " + error.message, "error"); return; }
    showToast(`Granted ${months} months Pro to ${email.trim()}`, "success");
    setEmail("");
    fetchGrants();
  };

  const handleRevoke = async (targetEmail) => {
    setBusy(true);
    const { error } = await supabase.rpc("revoke_pro_access", { target_email: targetEmail });
    setBusy(false);
    if (error) { showToast("Revoke failed: " + error.message, "error"); return; }
    showToast(`Revoked Pro access for ${targetEmail}`, "info");
    fetchGrants();
  };

  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ padding: "14px 16px", borderRadius: 12, background: t.surface, border: `1px solid ${t.borderSoft}`, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.fg, fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>Grant Pro access</div>
        <p style={{ fontSize: 12, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", margin: "0 0 12px", lineHeight: 1.5 }}>
          The user must already have a ReadFlow account. Grants stack onto active grants and don't require Stripe.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="user@email.com"
            disabled={busy}
            style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.bg, color: t.fg, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }}
          />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                disabled={busy}
                className="rf-static"
                style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.bg, color: t.fg, fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, minWidth: 88, outline: "none" }}
              >
                <span style={{ flex: 1, textAlign: "left" }}>{months} mo</span>
                <ChevronDown size={14} style={{ color: t.icon }} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.15)", padding: 4, minWidth: 100, zIndex: 1100, outline: "none" }}
              >
                {[1, 3, 6, 12].map(n => (
                  <DropdownMenu.Item
                    key={n}
                    onSelect={() => setMonths(n)}
                    onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    style={{ padding: "8px 10px", cursor: "pointer", color: t.fg, fontSize: 13, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 6, outline: "none", userSelect: "none" }}
                  >
                    {n} mo
                    {months === n && <Check size={13} style={{ color: t.accent }} />}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <button
            onClick={handleGrant}
            disabled={busy || !email.trim()}
            style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: t.accent, color: "#fff", fontSize: 13, fontWeight: 660, fontFamily: "'DM Sans', sans-serif", cursor: busy || !email.trim() ? "not-allowed" : "pointer", opacity: busy || !email.trim() ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}
          >
            <Gift size={13} /> Grant
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        Active grants {!loadingGrants && `(${grants.length})`}
      </div>
      {loadingGrants ? (
        <div style={{ padding: 20, color: t.fgSoft, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Loading…</div>
      ) : grants.length === 0 ? (
        <div style={{ padding: 20, color: t.fgSoft, fontSize: 13, fontFamily: "'DM Sans', sans-serif", textAlign: "center", border: `1px dashed ${t.border}`, borderRadius: 10 }}>No active grants.</div>
      ) : grants.map(g => (
        <div key={g.email} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: t.surface, border: `1px solid ${t.borderSoft}`, marginBottom: 6 }}>
          <Crown size={14} style={{ color: t.accent, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.fg, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.email}</div>
            <div style={{ fontSize: 11, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif" }}>Until {formatDate(g.pro_grant_until)}</div>
          </div>
          <button
            onClick={() => handleRevoke(g.email)}
            disabled={busy}
            aria-label={`Revoke grant for ${g.email}`}
            style={{ background: "transparent", border: "none", cursor: busy ? "not-allowed" : "pointer", color: "#E25C5C", padding: "4px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}
          >
            <Trash2 size={12} /> Revoke
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab: Analytics (owner only)
// ─────────────────────────────────────────────────────────────────────────
function AnalyticsTab({ t }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [users, subs, mrr, conv, dels] = await Promise.all([
        supabase.rpc("analytics_user_counts"),
        supabase.rpc("analytics_subscription_status"),
        supabase.rpc("analytics_mrr_cents"),
        supabase.rpc("analytics_trial_conversion_30d"),
        supabase.rpc("analytics_deletion_volume"),
      ]);
      const firstErr = [users, subs, mrr, conv, dels].find(r => r.error);
      if (firstErr) throw new Error(firstErr.error.message);
      setData({
        users: users.data,
        subs: subs.data ?? {},
        mrrCents: mrr.data ?? 0,
        conv: conv.data,
        dels: dels.data,
      });
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) return <div style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}><CatLoader size={120} /><span>Loading analytics…</span></div>;
  if (err) return <div style={{ padding: 24, display: "flex", alignItems: "center", gap: 8, color: "#E25C5C", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}><AlertCircle size={16} /> {err}</div>;
  if (!data) return null;

  const mrrUsd = (data.mrrCents / 100).toFixed(2);
  const arrUsd = (data.mrrCents * 12 / 100).toFixed(2);
  const subEntries = Object.entries(data.subs);

  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: t.fgSoft, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'DM Sans', sans-serif" }}>Owner-only</span>
        <button onClick={refresh} aria-label="Refresh" style={{ background: "transparent", border: "none", cursor: "pointer", color: t.icon, padding: "4px 8px", borderRadius: 6 }}><RefreshCw size={14} /></button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <StatCard label="Total users" value={data.users?.total ?? 0} sub={`+${data.users?.last_7d ?? 0} last 7d`} t={t} />
        <StatCard label="MRR" value={`$${mrrUsd}`} sub={`ARR ≈ $${arrUsd}`} t={t} />
        <StatCard label="Trial → paid" value={`${data.conv?.rate ?? 0}%`} sub={`${data.conv?.conversions ?? 0} of ${data.conv?.trials ?? 0} (30d)`} t={t} />
        <StatCard label="Pending deletions" value={data.dels?.pending ?? 0} sub={`${data.dels?.completed_last_30d ?? 0} completed (30d)`} t={t} />
      </div>

      <div style={{ padding: "14px 16px", borderRadius: 12, background: t.surface, border: `1px solid ${t.borderSoft}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.fgSoft, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}>Subscriptions by status</div>
        {subEntries.length === 0 ? (
          <div style={{ fontSize: 13, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif" }}>No subscriptions yet.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {subEntries.map(([status, count]) => (
              <span key={status} style={{ padding: "4px 10px", borderRadius: 999, background: t.accentSoft, color: t.accent, fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                {status}: {count}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: `${t.accent}10`, border: `1px solid ${t.accent}33`, fontSize: 11, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
        Signups today: <strong style={{ color: t.fg }}>{data.users?.today ?? 0}</strong> · Last 30d: <strong style={{ color: t.fg }}>{data.users?.last_30d ?? 0}</strong>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main panel — tabs gated on role/owner
// ─────────────────────────────────────────────────────────────────────────
export default function AdminPanel({ onClose, t }) {
  const { role, isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState("users");

  const isAdmin = role === "admin";
  const tabs = [
    { id: "users",    label: "Users",     icon: Users,      visible: isAdmin },
    { id: "analytics", label: "Analytics", icon: BarChart3, visible: isOwner },
    { id: "grants",   label: "Grant Pro", icon: Gift,       visible: isAdmin || isOwner },
  ].filter(tab => tab.visible);

  // If active tab is hidden (e.g. role changed), fall back to first available.
  useEffect(() => {
    if (tabs.length > 0 && !tabs.some(tab => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay style={OVERLAY} />
        <Dialog.Content
          aria-describedby={undefined}
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: t.bg, borderRadius: 20, width: "calc(100% - 48px)", maxWidth: 620, height: "min(620px, 85vh)", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden", zIndex: 1001, outline: "none" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${t.borderSoft}` }}>
            <Dialog.Title style={{ fontSize: 16, fontWeight: 720, color: t.fg, fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Admin Panel</Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close" style={{ width: 34, height: 34, borderRadius: 8, border: "none", background: "transparent", color: t.icon, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} strokeWidth={2} /></button>
            </Dialog.Close>
          </div>

          {tabs.length > 1 && (
            <div role="tablist" style={{ display: "flex", gap: 4, padding: "10px 20px 0", borderBottom: `1px solid ${t.borderSoft}` }}>
              {tabs.map(({ id, label, icon: Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={active}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setActiveTab(id)}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.color = t.fg; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.color = t.fgSoft; }}
                    className="rf-static"
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "9px 14px",
                      border: "none",
                      background: "transparent",
                      borderBottom: active ? `2px solid ${t.accent}` : "2px solid transparent",
                      color: active ? t.accent : t.fgSoft,
                      cursor: "pointer",
                      fontSize: 13, fontWeight: 600,
                      fontFamily: "'DM Sans', sans-serif",
                      marginBottom: -1,
                      outline: "none",
                      transition: "color 0.15s, border-color 0.15s",
                    }}
                  >
                    <Icon size={14} /> {label}
                  </button>
                );
              })}
            </div>
          )}

          <ScrollArea.Root style={{ flex: 1, overflow: "hidden" }}>
            <ScrollArea.Viewport style={{ height: "100%", width: "100%" }}>
              {tabs.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>You don't have access to any admin tools.</div>
              ) : activeTab === "users" ? <UsersTab t={t} />
                : activeTab === "grants" ? <GrantProTab t={t} />
                : activeTab === "analytics" ? <AnalyticsTab t={t} />
                : null}
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
