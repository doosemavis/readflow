import { loadScript } from "./scriptLoader";

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
    const lines = []; let lastY = null; let firstLine = null;
    for (const item of tc.items) {
      if (item.str === undefined) continue;
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) lines.push("\n");
      if (!firstLine && item.str.trim()) firstLine = { text: item.str.trim() };
      lines.push(item.str); lastY = item.transform[5];
    }
    const content = lines.join("").trim();
    let title = null;
    if (firstLine) {
      const m = content.match(/^(chapter\s+[\divxlc]+[.:—\-\s]*.*|part\s+[\divxlc]+[.:—\-\s]*.*|section\s+[\divxlc]+[.:—\-\s]*.*)$/im);
      if (m) title = m[1].trim();
    }
    if (content) {
      sections.push({ type: "page", title, number: i, content: title ? content.replace(title, "").trim() : content });
    }
  }
  return sections;
}
