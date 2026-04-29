import { loadScript } from "./scriptLoader";

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
      ncxDoc.querySelectorAll("navPoint").forEach(np => {
        const label = np.querySelector("navLabel text")?.textContent?.trim();
        const src = np.querySelector("content")?.getAttribute("src")?.split("#")[0];
        if (label && src) tocTitles[src] = label;
      });
    }
  }

  const sections = [];
  let chapterNum = 0;
  for (const idref of spineRefs) {
    const href = manifest[idref]; if (!href) continue;
    const xhtml = await zip.file(opfDir + href)?.async("text"); if (!xhtml) continue;
    const parsed = new DOMParser().parseFromString(xhtml, "application/xhtml+xml");
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
