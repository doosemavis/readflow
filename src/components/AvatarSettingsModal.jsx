import { useRef } from "react";
import { X, Upload, Lock, Crown } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { PREMADE_AVATARS, PremadeAvatarSvg } from "./PremadeAvatarSvg";
import { useToast } from "./Toast";

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 1010 };

const ACCEPTED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/gif"]);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

export default function AvatarSettingsModal({ open, onOpenChange, onSave, currentAvatar, isPro, onShowPricing, t }) {
  const fileRef = useRef();
  const { showToast } = useToast();

  const handleUploadClick = () => {
    if (!isPro) {
      onOpenChange(false);
      onShowPricing?.();
      return;
    }
    fileRef.current?.click();
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
      showToast("Unsupported image format. Use JPG, PNG, or GIF.", "error");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showToast("Image must be under 2 MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => { onSave({ type: "upload", dataUrl: ev.target.result }); onOpenChange(false); };
    reader.onerror = () => showToast("Couldn't read that image. Try a different file.", "error");
    reader.readAsDataURL(file);
  };

  const currentId = currentAvatar?.type === "premade" ? currentAvatar.id : null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
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
            Choose Avatar
          </Dialog.Title>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 16 }}>
            {PREMADE_AVATARS.map(({ id, bg }) => (
              <button
                key={id}
                onClick={() => { onSave({ type: "premade", id, bg }); onOpenChange(false); }}
                style={{
                  // Lock button to SVG dimensions + center within grid cell —
                  // otherwise the grid stretches the button to fill its 1fr
                  // column, leaving uneven space on the sides while top/bottom
                  // hug the SVG. justifySelf:center keeps the cell flexible.
                  width: 44, height: 44, justifySelf: "center",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 0, lineHeight: 0,
                  border: "none",
                  borderRadius: 10, cursor: "pointer", background: "none",
                  boxShadow: currentId === id
                    ? `0 0 0 1px ${t.bg}, 0 0 0 4px ${t.switchOn}`
                    : "none",
                  transition: "all 0.15s",
                }}
                aria-label={`Select avatar ${id}`}
              >
                <PremadeAvatarSvg id={id} bg={bg} size={44} borderRadius={10} />
              </button>
            ))}
          </div>

          <button
            onClick={handleUploadClick}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px dashed ${t.border}`, background: "transparent", color: t.fgSoft, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxSizing: "border-box", position: "relative", opacity: isPro ? 1 : 0.85 }}
          >
            {isPro ? <Upload size={14} /> : <Lock size={14} />}
            Upload image
            {!isPro && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 999, background: t.accentSoft, color: t.accent, fontSize: 10, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", marginLeft: 4 }}>
                <Crown size={9} /> PRO
              </span>
            )}
          </button>
          <p style={{ fontSize: 11, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", margin: "8px 0 0", textAlign: "center", lineHeight: 1.5 }}>
            {isPro
              ? <>JPG, PNG, or GIF — up to 2&nbsp;MB.<br />For best quality, use a square image at 200&times;200&nbsp;px or larger.</>
              : <>Custom avatar uploads are a Pro feature.<br />Pick from the gallery above, or upgrade to use your own image.</>}
          </p>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif" style={{ display: "none" }} onChange={handleFile} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
