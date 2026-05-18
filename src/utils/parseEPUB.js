import { loadScript } from "./scriptLoader";

// CONTRACT: emits Section[] per docs/architecture/PARSER_CONTRACT.md.
// Sections have type:"chapter", title from NCX/h1-h3 (null if neither),
// number from spine order, content in the private pseudo-Markdown format.
//
// NOTE on main-thread vs worker placement (Phase 4 decision, 2026-05-13):
//
// parseEPUB stays on the main thread for now. The blocker is `DOMParser` +
// DOM tree walking (node.nodeType, node.childNodes, querySelectorAll):
// Web Workers don't have a DOM. To move this into a worker we'd either
//   (a) swap DOMParser for parse5 / linkedom (~50-100KB worker bundle,
//       ~half-day to rewrite walk() against the new tree shape), or
//   (b) extract XHTML strings in the worker and parse DOM on main thread —
//       which doesn't help, because the main-thread cost IS the DOM walk.
//
// Empirically the per-chapter walk() is ~5-20ms on typical novels — below
// the loader's ~50ms stutter threshold. PDF analysis was the big offender
// (moved to worker in Phase 3, src/workers/pdfAnalysis.js). EPUB stays
// main-thread until measured stutter on real EPUBs justifies the parse5
// rewrite. Tracked as a deferred TODO in TAILORMYTEXT_LAUNCH_PLAN.md.

export async function parseEPUB(file) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error("ZIP library failed to load");

  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const containerXml = await zip.file("META-INF/container.xml")?.async("text");
  if (!containerXml) throw new Error("Invalid EPUB: missing container.xml");
  const rootMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!rootMatch) throw new Error("Invalid EPUB: no rootfile found");

  const opfPath = rootMatch[1];
  const opfDir = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1) : "";
  const opfXml = await zip.file(opfPath)?.async("text");
  if (!opfXml) throw new Error("Invalid EPUB: missing OPF");

  const opfDoc = new DOMParser().parseFromString(opfXml, "application/xml");
  // OPF is the spine; without it we cannot enumerate chapters. Hard-fail
  // so App.jsx surfaces a real error message instead of "no content".
  if (opfDoc.querySelector("parsererror")) {
    throw new Error("Invalid EPUB: OPF metadata is malformed");
  }
  const manifest = {};
  opfDoc.querySelectorAll("item").forEach(item => { manifest[item.getAttribute("id")] = item.getAttribute("href"); });
  const spineRefs = [];
  opfDoc.querySelectorAll("itemref").forEach(ref => { spineRefs.push(ref.getAttribute("idref")); });

  const tocTitles = {};
  const ncxItem = Array.from(opfDoc.querySelectorAll("item")).find(i => i.getAttribute("media-type") === "application/x-dtbncx+xml");
  if (ncxItem) {
    const ncxHref = opfDir + ncxItem.getAttribute("href");
    const ncxXml = await zip.file(ncxHref)?.async("text");
    if (ncxXml) {
      const ncxDoc = new DOMParser().parseFromString(ncxXml, "application/xml");
      // NCX only supplies human titles. Soft-fail: warn and skip TOC; the
      // book still reads, chapters fall back to null/h1 titles.
      if (ncxDoc.querySelector("parsererror")) {
        console.warn("[parseEPUB] NCX (table of contents) is malformed — chapter titles will be lost");
      } else {
        ncxDoc.querySelectorAll("navPoint").forEach(np => {
          const label = np.querySelector("navLabel text")?.textContent?.trim();
          const src = np.querySelector("content")?.getAttribute("src")?.split("#")[0];
          if (label && src) tocTitles[src] = label;
        });
      }
    }
  }

  const sections = [];
  let chapterNum = 0;
  for (const idref of spineRefs) {
    const href = manifest[idref]; if (!href) continue;
    const xhtml = await zip.file(opfDir + href)?.async("text"); if (!xhtml) continue;
    const parsed = new DOMParser().parseFromString(xhtml, "application/xhtml+xml");
    // Soft-fail per chapter: warn and skip this one; remaining chapters
    // still parse so the user gets a usable subset of the book.
    if (parsed.querySelector("parsererror")) {
      console.warn(`[parseEPUB] chapter XHTML is malformed; skipping: ${href}`);
      continue;
    }
    const body = parsed.body || parsed.documentElement;
    const headings = body.querySelectorAll("h1, h2, h3");
    let title = tocTitles[href] || null;
    if (!title && headings.length > 0) title = headings[0].textContent.trim();

    const walk = (node) => {
      if (node.nodeType === 3) return node.textContent.replace(/[\r\n]+/g, " ").replace(/ {2,}/g, " ");
      if (node.nodeName === "BR") return " ";
      const tag = node.nodeName.toLowerCase();
      const isBlock = /^(p|div|h[1-6]|li|blockquote|section|article|tr|dt|dd)$/.test(tag);
      let inner = Array.from(node.childNodes).map(walk).join("");
      if (isBlock && inner.trim()) return "\n\n" + inner.trim();
      return inner;
    };
    const rawText = walk(body).trim();
    if (!rawText) continue;

    chapterNum++;
    let content = rawText;
    if (title && content.startsWith(title)) content = content.slice(title.length).trim();
    sections.push({ type: "chapter", title: title || null, number: chapterNum, content });
  }
  if (sections.length === 0) throw new Error("No readable content found in EPUB");
  return sections;
}
