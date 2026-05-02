import { useRef } from "react";
import { X, Upload } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { PREMADE_AVATARS, PremadeAvatarSvg } from "./PremadeAvatarSvg";

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 1010 };

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
    <Dialog.Root open onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay style={OVERLAY} />
        <Dialog.Content
          aria-describedby={undefined}
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: t.bg, borderRadius: 20, maxWidth: 400, width: "calc(100% - 48px)", padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", zIndex: 1011, outline: "none" }}
        >
          <Dialog.Close asChild>
            <button aria-label="Close" style={{ position: "absolute", top: 14, right: 14, width: 34, height: 34, borderRadius: 8, border: "none", background: "transparent", color: t.icon, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={16} strokeWidth={2} />
            </button>
          </Dialog.Close>

          <Dialog.Title style={{ fontSize: 16, fontWeight: 720, color: t.fg, margin: "0 0 16px", fontFamily: "'DM Sans', sans-serif" }}>
            Choose avatar
          </Dialog.Title>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 16 }}>
            {PREMADE_AVATARS.map(({ id, bg }) => (
              <button
                key={id}
                onClick={() => { onSave({ type: "premade", id, bg }); onClose(); }}
                style={{ padding: 0, border: currentId === id ? `3px solid ${t.accent}` : "3px solid transparent", borderRadius: 14, cursor: "pointer", background: "none", boxShadow: currentId === id ? `0 0 0 2px ${t.accentSoft}` : "none", transition: "all 0.15s" }}
                aria-label={`Select avatar ${id}`}
              >
                <PremadeAvatarSvg id={id} bg={bg} size={44} borderRadius={10} />
              </button>
            ))}
          </div>

          <button
            onClick={() => fileRef.current?.click()}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px dashed ${t.border}`, background: "transparent", color: t.fgSoft, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxSizing: "border-box" }}
          >
            <Upload size={14} /> Upload image
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{ display: "none" }} onChange={handleFile} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
