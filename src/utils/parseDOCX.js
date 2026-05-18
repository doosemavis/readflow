import mammoth from "mammoth";
import { detectTextStructure } from "./detectStructure";

// CONTRACT: emits Section[] per docs/architecture/PARSER_CONTRACT.md.
// Currently emits type:"section" — Phase 4 of the parser-rewrite plan
// harmonizes to type:"chapter". title from h1-h3 textContent (null if
// no heading present in section), sequential number, content in the
// private pseudo-Markdown format.
//
// NOTE: parseDOCX stays on main thread (same reasoning as parseEPUB).
// Uses `new DOMParser().parseFromString(...)` to walk mammoth's HTML output;
// DOMParser isn't available in standard Web Workers. DOCX files are
// typically small (<5MB) and the parse runs fast (~50-200ms on a typical
// memo), so the cost-benefit of a parse5-based worker rewrite doesn't
// justify the effort right now. Tracked alongside EPUB as a deferred
// optimization in TAILORMYTEXT_LAUNCH_PLAN.md.

export async function parseDOCX(file) {
  const buf = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer: buf });

  // mammoth surfaces problems via result.messages. Warnings are common
  // (unsupported style mapping, unknown smart-tags) and we just log them.
  // An error-typed message means mammoth couldn't process some hard part
  // of the doc — fail loudly so App.jsx shows a real error.
  if (Array.isArray(result.messages) && result.messages.length > 0) {
    const errors = result.messages.filter((m) => m.type === "error");
    const warnings = result.messages.filter((m) => m.type === "warning");
    if (warnings.length > 0) {
      console.warn("[parseDOCX] mammoth warnings:", warnings.map((m) => m.message));
    }
    if (errors.length > 0) {
      throw new Error(`DOCX conversion failed: ${errors[0].message}`);
    }
  }

  const doc = new DOMParser().parseFromString(result.value, "text/html");
  const sections = [];
  let currentTitle = null;
  let currentContent = [];
  let sectionNum = 0;

  const flush = () => {
    const text = currentContent.join("\n\n").trim();
    if (text) { sectionNum++; sections.push({ type: "section", title: currentTitle, number: sectionNum, content: text }); }
    currentContent = [];
  };

  for (const node of doc.body.children) {
    const tag = node.tagName.toLowerCase();
    if (/^h[1-3]$/.test(tag)) { flush(); currentTitle = node.textContent.trim(); }
    else { const txt = node.textContent.trim(); if (txt) currentContent.push(txt); }
  }
  flush();

  if (sections.length === 0) {
    // mammoth produced HTML but it had no headings — we've lost structure.
    // Surface the fallback in logs so a degraded parse doesn't masquerade
    // as a clean one.
    console.warn("[parseDOCX] no headings detected — falling back to extractRawText (structure lost)");
    const raw = (await mammoth.extractRawText({ arrayBuffer: buf })).value;
    return detectTextStructure(raw);
  }
  return sections;
}
