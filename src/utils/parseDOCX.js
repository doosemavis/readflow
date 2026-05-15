import mammoth from "mammoth";
import { detectTextStructure } from "./detectStructure";

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
    const raw = (await mammoth.extractRawText({ arrayBuffer: buf })).value;
    return detectTextStructure(raw);
  }
  return sections;
}
