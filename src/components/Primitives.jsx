import { useState, memo } from "react";
import { ChevronDown } from "lucide-react";
import { FONTS } from "../config/constants";

export const Toggle = memo(function Toggle({ on, onChange, label, icon: Icon, t }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 12px", borderRadius: 10, border: "none", cursor: "pointer",
      background: on ? t.accentSoft : "transparent", transition: "all 0.2s ease", boxSizing: "border-box",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 550, color: on ? t.accent : t.fgSoft, fontFamily: "'DM Sans', sans-serif" }}>
        {Icon && <Icon size={15} strokeWidth={2} />}{label}
      </span>
      <div style={{ width: 36, height: 20, borderRadius: 10, padding: 2, background: on ? t.accent : t.border, transition: "background 0.2s ease", display: "flex", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)", transform: on ? "translateX(16px)" : "translateX(0)", transition: "transform 0.2s cubic-bezier(0.4,0,0.2,1)" }} />
      </div>
    </button>
  );
});

export const Slider = memo(function Slider({ value, min, max, step, onChange, label, display, t }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ padding: "6px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: t.fgSoft, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color: t.accent, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, minWidth: 40, textAlign: "right" }}>{display ?? value}</span>
      </div>
      <div style={{ position: "relative", height: 24, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 4, borderRadius: 2, background: t.border }} />
        <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 4, borderRadius: 2, background: t.accent }} />
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ position: "absolute", width: "100%", height: 24, opacity: 0, cursor: "pointer", margin: 0 }} />
        <div style={{ position: "absolute", left: `calc(${pct}% - 7px)`, width: 14, height: 14, borderRadius: 7, background: t.accent, boxShadow: `0 0 0 3px ${t.accentSoft}, 0 2px 6px rgba(0,0,0,0.12)`, pointerEvents: "none" }} />
      </div>
    </div>
  );
});

export const Segment = memo(function Segment({ options, value, onChange, t }) {
  const isDark = t.bg === "#111116" || t.bg === "#0B0E14";
  return (
    <div style={{ display: "flex", background: t.surface, borderRadius: 10, padding: 3, gap: 2 }}>
      {options.map(opt => {
        const active = value === opt.value; const Icon = opt.icon;
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)} style={{
            flex: 1, padding: "6px 6px", borderRadius: 8, border: "none", cursor: "pointer",
            background: active ? (isDark ? t.surfaceHover : "#fff") : "transparent",
            boxShadow: active ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            color: active ? t.accent : t.fgSoft, fontSize: 11, fontWeight: active ? 650 : 500,
            fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s ease",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
          }}>
            {Icon && <Icon size={12} strokeWidth={2.2} />}{opt.label}
          </button>
        );
      })}
    </div>
  );
});

export function Section({ title, icon: Icon, children, t, open: defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: `1px solid ${t.borderSoft}` }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", border: "none", cursor: "pointer", background: "transparent", color: t.fg,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 650, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
          <Icon size={14} strokeWidth={2.2} style={{ color: t.icon }} />{title}
        </span>
        <ChevronDown size={14} style={{ color: t.icon, transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform 0.2s" }} />
      </button>
      {open && <div style={{ paddingBottom: 10 }}>{children}</div>}
    </div>
  );
}

export function FontPicker({ value, onChange, t }) {
  const [open, setOpen] = useState(false);
  const cur = FONTS.find(f => f.name === value);
  return (
    <div style={{ padding: "4px 12px", position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface,
        cursor: "pointer", color: t.fg, fontSize: 13, fontFamily: cur?.css, fontWeight: 500, boxSizing: "border-box",
      }}>
        {value}
        <ChevronDown size={14} style={{ color: t.icon, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 12, right: 12, zIndex: 50, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, marginTop: 4, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          {FONTS.map(f => (
            <button key={f.name} onClick={() => { onChange(f.name); setOpen(false); }} style={{
              width: "100%", padding: "10px 14px", border: "none", cursor: "pointer",
              background: value === f.name ? t.accentSoft : "transparent",
              color: value === f.name ? t.accent : t.fg, fontFamily: f.css, fontSize: 14, fontWeight: 500, textAlign: "left",
            }}>{f.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}
