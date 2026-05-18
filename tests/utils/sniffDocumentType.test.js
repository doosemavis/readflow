import { describe, it, expect } from "vitest";
import { sniffDocumentType } from "../../src/utils/sniffDocumentType.js";

// sniffDocumentType decides what parser to dispatch when the file
// extension is unreliable. Two roles:
//   1. Magic-byte detection for binary formats (PDF, EPUB, DOCX) so we
//      route by content even when the user dropped a "report.pdf"
//      that's actually a Word doc someone renamed.
//   2. Text-content heuristics for text-like extensions (.txt) — a .txt
//      that's secretly HTML or Markdown should reach the right parser.
//
// Guardrail: the sniffer NEVER overrides a recognized binary extension
// (.pdf stays pdf even if magic bytes look weird). Only text-like
// extensions are eligible for upgrade.

function bufFrom(...parts) {
  const enc = new TextEncoder();
  const chunks = parts.map((p) => (typeof p === "string" ? enc.encode(p) : p));
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out.buffer;
}

describe("sniffDocumentType — magic bytes (binary formats)", () => {
  it("identifies PDF by %PDF- magic bytes regardless of extension", async () => {
    const buf = bufFrom("%PDF-1.4\n", new Uint8Array(1000));
    expect(await sniffDocumentType("doc.unknown", buf)).toBe("pdf");
    expect(await sniffDocumentType("doc.txt", buf)).toBe("pdf");
  });

  it("identifies EPUB by ZIP header + epub mimetype entry", async () => {
    // Real EPUBs have the mimetype as the first file in the zip; the bytes
    // "application/epub+zip" appear shortly after the PK\x03\x04 header.
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const buf = bufFrom(zip, "mimetypeapplication/epub+zip", new Uint8Array(200));
    expect(await sniffDocumentType("book.unknown", buf)).toBe("epub");
  });

  it("identifies DOCX by ZIP header + word/ entry path", async () => {
    // DOCX is a zip whose archive contains the path "word/document.xml".
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const buf = bufFrom(zip, "....word/document.xml", new Uint8Array(200));
    expect(await sniffDocumentType("memo.unknown", buf)).toBe("docx");
  });

  it("returns null for an unrecognized binary file (image, audio)", async () => {
    const buf = bufFrom(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])); // JPEG header
    expect(await sniffDocumentType("photo.jpg", buf)).toBeNull();
  });
});

describe("sniffDocumentType — text heuristics", () => {
  it("upgrades .txt with leading <!DOCTYPE html> to html", async () => {
    const buf = bufFrom("<!DOCTYPE html>\n<html><body><p>Hi</p></body></html>");
    expect(await sniffDocumentType("page.txt", buf)).toBe("html");
  });

  it("upgrades .txt with strong markdown signals to md", async () => {
    // ATX headings + fenced code + link syntax — multi-signal hit.
    const md = `# Heading One\n\nSome text with [a link](url).\n\n\`\`\`js\nconst x = 1;\n\`\`\`\n\n## Heading Two\n\n- bullet\n- bullet\n`;
    expect(await sniffDocumentType("notes.txt", bufFrom(md))).toBe("md");
  });

  it("does NOT upgrade a .txt with a single # in body (weak signal)", async () => {
    const txt = "This sentence happens to have # in the middle.\n\nAnother paragraph entirely.";
    expect(await sniffDocumentType("doc.txt", bufFrom(txt))).toBeNull();
  });

  it("identifies JSON by leading { and successful JSON.parse", async () => {
    const json = '{"hello": "world", "count": 3}';
    expect(await sniffDocumentType("data.txt", bufFrom(json))).toBe("json");
  });
});

describe("sniffDocumentType — extension-wins guardrail", () => {
  it("never overrides a recognized binary extension based on text heuristics", async () => {
    // A .docx whose bytes happen to start with "# Heading" should still
    // be treated as docx — the user's extension wins for binary formats.
    const buf = bufFrom("# Heading\n\nLooks like markdown but the file said .docx");
    expect(await sniffDocumentType("memo.docx", buf)).toBeNull();
  });

  it("never overrides .pdf based on text heuristics", async () => {
    const buf = bufFrom("<!DOCTYPE html><html><body>Suspicious</body></html>");
    expect(await sniffDocumentType("doc.pdf", buf)).toBeNull();
  });

  it("returns null when no clear signal — caller falls back to extension", async () => {
    const buf = bufFrom("Just some plain prose. Nothing structural.");
    expect(await sniffDocumentType("essay.txt", buf)).toBeNull();
  });
});
