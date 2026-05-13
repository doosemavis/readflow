// Main-thread PDF orchestrator. Thin shell around pdf.js + the parser worker.
//
// Why split: the original ~720-line parsePDF lived entirely on the main
// thread. pdf.js's *own* worker handles low-level PDF parsing, but the post-
// extraction analysis (column histograms, font tiers, line stitching,
// hyphenation, chrome stripping) ran in main-thread JS. On heavy PDFs that
// pegged the main thread for hundreds of ms and starved the loader animation.
//
// Now the responsibility splits:
//   - Main thread (this file): load pdf.js (DOM access required), getDocument,
//     getPage/getTextContent for each page (small per-call work; pdf.js's
//     worker does the heavy lifting), getOutline, resolve outline destinations
//     to page numbers (needs doc.getDestination / doc.getPageIndex).
//   - Parser worker (src/workers/pdfAnalysis.js via parserWorker dispatch):
//     all the heuristics-heavy analysis on a serialized snapshot of the raw
//     page data.
//
// The result for the rest of the app is the same: a sections[] array of
// { type, title, number, content }. Callers (App.jsx, demos) don't see the
// worker split.

import { loadScript } from "./scriptLoader";
import { parseInWorker } from "./parserWorker";

// Walk the pdf.js outline tree into a flat list. Each item: { title, dest, depth }.
// dest is a pdf.js destination (either a string name or a [page-ref, fit, ...]
// array). We resolve it to a page number on the main thread before posting to
// the worker, so the worker never needs the live pdf.js doc.
function flattenOutline(items, depth = 0, out = []) {
  if (!items) return out;
  for (const item of items) {
    out.push({ title: item.title?.trim() || "Untitled", dest: item.dest, depth });
    if (item.items?.length) flattenOutline(item.items, depth + 1, out);
  }
  return out;
}

// Resolve a pdf.js destination to a 1-indexed page number. Returns null when
// the destination can't be resolved (broken outline entry, dead link, etc.) —
// the worker filters those out.
async function resolveDestToPage(doc, dest) {
  try {
    let resolved = dest;
    if (typeof resolved === "string") resolved = await doc.getDestination(resolved);
    if (Array.isArray(resolved) && resolved[0]) {
      const pageIdx = await doc.getPageIndex(resolved[0]);
      return pageIdx + 1;
    }
  } catch {}
  return null;
}

export async function parsePDF(file) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
  const pdfjsLib = window["pdfjs-dist/build/pdf"] || window.pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF library failed to load");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;

  // Pre-fetch raw text content per page. Each pdf.js call awaits its internal
  // worker, so the main thread cooperatively yields between pages — RAF
  // callbacks (the loader animation) get scheduled in the gaps. The per-page
  // post-await work is small (just collecting { items, styles, viewport }).
  const rawPages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    rawPages.push({
      pageNum: i,
      items: tc.items,
      styles: tc.styles,
      viewport: { width: viewport.width, height: viewport.height },
    });
  }

  // Resolve outline destinations on the main thread (workers can't call
  // doc.getDestination / doc.getPageIndex). The worker gets a flat list of
  // { title, page, depth } and doesn't need pdf.js at all.
  let resolvedOutline = null;
  try {
    const outline = await doc.getOutline();
    if (outline && outline.length > 0) {
      const flat = flattenOutline(outline);
      resolvedOutline = await Promise.all(
        flat.map(async (entry) => ({
          title: entry.title,
          depth: entry.depth,
          page: await resolveDestToPage(doc, entry.dest),
        })),
      );
    }
  } catch {}

  // Diagnostics flag — the worker has no localStorage, so we read here and
  // pass the resolved boolean across.
  const debug = typeof window !== "undefined" && window.localStorage?.getItem("rf-pdf-debug") === "1";

  return parseInWorker("parse-pdf", { rawPages, resolvedOutline, debug });
}
