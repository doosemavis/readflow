import { loadScript } from "./scriptLoader";

// pdf.js text-content items expose:
//   item.str        — the text fragment
//   item.transform  — affine matrix; transform[4] = x, transform[5] = y
//   item.height     — font height in user units (≈ font size)
//   item.width      — text width in user units
// Items aren't always in reading order, so we group by line (same y) and
// sort within page before stitching.

const TITLE_FONT_RATIO = 1.35;       // line is a title if median item height > median * this
const PARAGRAPH_GAP_RATIO = 1.7;     // gap between lines that signals a paragraph break
const SAME_LINE_Y_TOLERANCE = 1.5;   // items within this many user units share a line

function median(nums) {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Group raw pdf.js items into lines keyed by y-position. Items inside one
// line are sorted left→right; lines themselves are sorted top→bottom.
function groupIntoLines(items) {
  const buckets = []; // { y, items }
  for (const item of items) {
    if (item.str === undefined) continue;
    const y = item.transform[5];
    let bucket = buckets.find(b => Math.abs(b.y - y) <= SAME_LINE_Y_TOLERANCE);
    if (!bucket) { bucket = { y, items: [] }; buckets.push(bucket); }
    bucket.items.push(item);
  }
  for (const b of buckets) b.items.sort((a, c) => a.transform[4] - c.transform[4]);
  buckets.sort((a, b) => b.y - a.y); // PDF y-coords increase upward
  return buckets;
}

// Compute the typical vertical distance between consecutive lines.
function medianLineGap(lines) {
  const gaps = [];
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i - 1].y - lines[i].y;
    if (gap > 0) gaps.push(gap);
  }
  return median(gaps);
}

// Stitch a line's text items, joining adjacent items with no space when
// they touch and a single space otherwise (pdf.js sometimes emits one
// glyph per item).
function lineText(line) {
  let out = "";
  let prev = null;
  for (const item of line.items) {
    if (prev) {
      const prevEnd = prev.transform[4] + (prev.width || 0);
      const gap = item.transform[4] - prevEnd;
      // Heuristic: tiny gap → no separator, larger gap → single space.
      if (gap > 0.5 && !out.endsWith(" ") && !item.str.startsWith(" ")) out += " ";
    }
    out += item.str;
    prev = item;
  }
  return out.trim();
}

// Median font height of items in a line (proxy for "this line's font size").
function lineFontHeight(line) {
  return median(line.items.map(i => i.height || 0));
}

export async function parsePDF(file) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
  const pdfjsLib = window["pdfjs-dist/build/pdf"] || window.pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF library failed to load");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const sections = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const lines = groupIntoLines(tc.items).filter(line => lineText(line));
    if (!lines.length) continue;

    const pageMedianFont = median(lines.map(lineFontHeight).filter(h => h > 0));
    const pageMedianGap = medianLineGap(lines);

    // First line that's noticeably larger than the page's body font is
    // treated as the page title (catches "Frankenstein" or "Chapter 1"
    // without needing the regex match below).
    let title = null;
    let bodyStartIdx = 0;
    if (pageMedianFont > 0) {
      const firstFont = lineFontHeight(lines[0]);
      if (firstFont > pageMedianFont * TITLE_FONT_RATIO) {
        title = lineText(lines[0]);
        bodyStartIdx = 1;
      }
    }

    // Fallback: regex against the first body line for chapter/part/section.
    if (!title && lines[bodyStartIdx]) {
      const firstBody = lineText(lines[bodyStartIdx]);
      const m = firstBody.match(/^(chapter\s+[\divxlc]+[.:—\-\s]*.*|part\s+[\divxlc]+[.:—\-\s]*.*|section\s+[\divxlc]+[.:—\-\s]*.*)$/i);
      if (m) { title = m[1].trim(); bodyStartIdx++; }
    }

    // Build content. Insert "\n\n" (paragraph break) when the vertical
    // gap to the previous line is larger than ~1.7x the page's median
    // line gap; otherwise "\n" (soft line break).
    const parts = [];
    for (let li = bodyStartIdx; li < lines.length; li++) {
      const text = lineText(lines[li]);
      if (!text) continue;
      if (parts.length) {
        const prev = lines[li - 1];
        const gap = prev ? prev.y - lines[li].y : 0;
        const isParaBreak = pageMedianGap > 0 && gap > pageMedianGap * PARAGRAPH_GAP_RATIO;
        parts.push(isParaBreak ? "\n\n" : "\n");
      }
      parts.push(text);
    }
    const content = parts.join("").trim();
    if (content || title) {
      sections.push({ type: "page", title, number: i, content });
    }
  }
  return sections;
}
