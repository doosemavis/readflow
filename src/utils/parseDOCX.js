import mammoth from "mammoth";
import { detectTextStructure } from "./detectStructure";

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
