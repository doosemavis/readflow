import { useRef } from "react";
import { X, Upload } from "lucide-react";

export const PREMADE_AVATARS = [
  { id: "p1",  bg: "#6366F1" },
  { id: "p2",  bg: "#EC4899" },
  { id: "p3",  bg: "#F59E0B" },
  { id: "p4",  bg: "#10B981" },
  { id: "p5",  bg: "#3B82F6" },
  { id: "p6",  bg: "#8B5CF6" },
  { id: "p7",  bg: "#EF4444" },
  { id: "p8",  bg: "#0EA5E9" },
  { id: "p9",  bg: "#14B8A6" },
  { id: "p10", bg: "#F97316" },
  { id: "p11", bg: "#6B7280" },
  { id: "p12", bg: "#BE185D" },
];

const SHAPES = {
  p1:  <><circle cx="20" cy="15" r="8" fill="#fff" opacity=".9"/><ellipse cx="20" cy="34" rx="13" ry="9" fill="#fff" opacity=".7"/></>,
  p2:  <polygon points="20,5 35,32 5,32" fill="#fff" opacity=".9"/>,
  p3:  <rect x="8" y="8" width="24" height="24" rx="4" fill="#fff" opacity=".9"/>,
  p4:  <><polygon points="20,4 36,28 4,28" fill="#fff" opacity=".5"/><polygon points="20,12 33,34 7,34" fill="#fff" opacity=".9"/></>,
  p5:  <><circle cx="20" cy="20" r="14" fill="none" stroke="#fff" strokeWidth="4" opacity=".9"/><circle cx="20" cy="20" r="5" fill="#fff" opacity=".9"/></>,
  p6:  <polygon points="20,4 38,20 30,37 10,37 2,20" fill="#fff" opacity=".9"/>,
  p7:  <><line x1="8" y1="8" x2="32" y2="32" stroke="#fff" strokeWidth="5" strokeLinecap="round"/><line x1="32" y1="8" x2="8" y2="32" stroke="#fff" strokeWidth="5" strokeLinecap="round"/></>,
  p8:  <><rect x="5" y="17" width="30" height="6" rx="3" fill="#fff" opacity=".9"/><rect x="17" y="5" width="6" height="30" rx="3" fill="#fff" opacity=".9"/></>,
  p9:  <><circle cx="13" cy="20" r="9" fill="#fff" opacity=".75"/><circle cx="27" cy="20" r="9" fill="#fff" opacity=".75"/></>,
  p10: <polygon points="20,4 23,15 35,15 26,22 29,34 20,26 11,34 14,22 5,15 17,15" fill="#fff" opacity=".9"/>,
  p11: <><rect x="7" y="7" width="11" height="11" rx="2" fill="#fff" opacity=".9"/><rect x="22" y="7" width="11" height="11" rx="2" fill="#fff" opacity=".9"/><rect x="7" y="22" width="11" height="11" rx="2" fill="#fff" opacity=".9"/><rect x="22" y="22" width="11" height="11" rx="2" fill="#fff" opacity=".9"/></>,
  p12: <><circle cx="20" cy="20" r="14" fill="#fff" opacity=".2"/><circle cx="20" cy="20" r="9" fill="#fff" opacity=".5"/><circle cx="20" cy="20" r="4" fill="#fff" opacity=".95"/></>,
};

export function PremadeAvatarSvg({ id, bg, size = 40, borderRadius = 10 }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} style={{ borderRadius, display: "block", flexShrink: 0 }}>
      <rect width="40" height="40" fill={bg} />
      {SHAPES[id]}
    </svg>
  );
}

export default function AvatarSettingsModal({ onClose, onSave, currentAvatar, t }) {
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Image must be under 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { onSave({ type: "upload", dataUrl: ev.target.result }); onClose(); };
    reader.readAsDataURL(file);
  };

  const currentId = currentAvatar?.type === "premade" ? currentAvatar.id : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010, padding: 24 }}>
      <div style={{ background: t.bg, borderRadius: 20, width: "100%", maxWidth: 400, padding: 24, position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "transparent", border: "none", cursor: "pointer", color: t.icon, padding: 4, borderRadius: 6 }}><X size={16} /></button>

        <h2 style={{ fontSize: 17, fontWeight: 720, color: t.fg, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>Choose Avatar</h2>
        <p style={{ fontSize: 12, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", marginBottom: 18 }}>Pick a preset or upload your own image.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 20 }}>
          {PREMADE_AVATARS.map(preset => {
            const isActive = currentId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => { onSave({ type: "premade", id: preset.id, bg: preset.bg }); onClose(); }}
                style={{ padding: 0, border: isActive ? `3px solid ${t.accent}` : "3px solid transparent", borderRadius: 12, cursor: "pointer", background: "none", transition: "transform 0.1s", display: "block" }}
                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
              >
                <PremadeAvatarSvg id={preset.id} bg={preset.bg} size={46} borderRadius={8} />
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 1, background: t.border }} />
          <span style={{ fontSize: 12, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif" }}>or upload your own</span>
          <div style={{ flex: 1, height: 1, background: t.border }} />
        </div>

        <button
          onClick={() => fileRef.current?.click()}
          style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px dashed ${t.border}`, background: t.surface, color: t.fgSoft, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxSizing: "border-box" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = t.accent}
          onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
        >
          <Upload size={14} /> Upload image (JPG, PNG — max 2MB)
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{ display: "none" }} onChange={handleFile} />
      </div>
    </div>
  );
}
