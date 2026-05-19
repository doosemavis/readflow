import { describe, it, expect, vi, beforeEach } from "vitest";
import { stripLeadingTitle } from "../../src/utils/parseEPUB.js";
import { Window } from "happy-dom";

// parseEPUB has three DOMParser sites that previously didn't check for
// the <parsererror> node browsers emit when XML is malformed. The error
// went undetected and downstream code silently produced empty sections
// or wrong-titled chapters.
//
// Severity policy (matches plan Tasks 1.2-1.4):
//   - OPF malformed       → HARD-fail (throw). The OPF is the spine; we
//                            cannot recover any chapters without it.
//   - NCX malformed       → SOFT-fail (warn + skip TOC). Chapters still
//                            parse from the spine; they just lose
//                            human-readable titles.
//   - XHTML malformed     → SOFT-fail (warn + skip THAT chapter). Other
//                            chapters in the book remain readable.

// happy-dom Window provides DOMParser that emits parsererror like browsers do.
const win = new Window();
globalThis.DOMParser = win.DOMParser;

// loadScript would inject a CDN <script>; in Node we no-op and stub the
// global ourselves below.
vi.mock("../../src/utils/scriptLoader.js", () => ({
  loadScript: () => Promise.resolve(),
}));

// Fake JSZip — `JSZip.loadAsync` returns an object whose `.file(path)`
// resolves text-string contents. Matches the slice of the real API
// parseEPUB.js depends on.
function fakeJSZipFor(files) {
  return {
    file: (path) => (files[path] !== undefined
      ? { async: () => Promise.resolve(files[path]) }
      : undefined),
  };
}

function installJSZip(files) {
  globalThis.window = globalThis.window ?? globalThis;
  globalThis.window.JSZip = {
    loadAsync: () => Promise.resolve(fakeJSZipFor(files)),
  };
}

const CONTAINER = `<?xml version="1.0"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles>
</container>`;

const VALID_OPF = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf">
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`;

const VALID_NCX = `<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
  <navMap>
    <navPoint><navLabel><text>Chapter One</text></navLabel><content src="ch1.xhtml"/></navPoint>
    <navPoint><navLabel><text>Chapter Two</text></navLabel><content src="ch2.xhtml"/></navPoint>
  </navMap>
</ncx>`;

const VALID_XHTML = (body) => `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml"><body>${body}</body></html>`;

// Deliberately broken XML to trigger DOMParser parsererror emission.
const MALFORMED_XML = `<?xml version="1.0"?><package><manifest><item></manifest></package>`;

describe("parseEPUB — DOMParser parsererror detection", () => {
  let parseEPUB;

  beforeEach(async () => {
    const mod = await import("../../src/utils/parseEPUB.js");
    parseEPUB = mod.parseEPUB;
  });

  it("throws when OPF XML is malformed (Task 1.2 — hard-fail)", async () => {
    installJSZip({
      "META-INF/container.xml": CONTAINER,
      "OEBPS/content.opf": MALFORMED_XML,
    });
    const fakeFile = { arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) };
    await expect(parseEPUB(fakeFile)).rejects.toThrow(/malformed/i);
  });

  it("logs a warning and keeps chapters when NCX is malformed (Task 1.3 — soft-fail)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    installJSZip({
      "META-INF/container.xml": CONTAINER,
      "OEBPS/content.opf": VALID_OPF,
      "OEBPS/toc.ncx": MALFORMED_XML,
      "OEBPS/ch1.xhtml": VALID_XHTML("<p>Body of chapter one.</p>"),
      "OEBPS/ch2.xhtml": VALID_XHTML("<p>Body of chapter two.</p>"),
    });
    const fakeFile = { arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) };
    const sections = await parseEPUB(fakeFile);

    expect(sections).toHaveLength(2);
    // TOC titles are gone because NCX was malformed — chapters fall back
    // to null (no h1 in our test bodies).
    expect(sections[0].title).toBeNull();
    expect(sections[1].title).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/ncx/i));
    warnSpy.mockRestore();
  });

  it("logs a warning and skips one chapter when its XHTML is malformed (Task 1.4 — soft-fail)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    installJSZip({
      "META-INF/container.xml": CONTAINER,
      "OEBPS/content.opf": VALID_OPF,
      "OEBPS/toc.ncx": VALID_NCX,
      "OEBPS/ch1.xhtml": MALFORMED_XML,
      "OEBPS/ch2.xhtml": VALID_XHTML("<p>Body of chapter two.</p>"),
    });
    const fakeFile = { arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) };
    const sections = await parseEPUB(fakeFile);

    // Only the second chapter parses; first was skipped on parsererror.
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Chapter Two");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/xhtml|chapter/i));
    warnSpy.mockRestore();
  });

  it("happy-path: valid OPF + NCX + XHTML produces titled chapters", async () => {
    installJSZip({
      "META-INF/container.xml": CONTAINER,
      "OEBPS/content.opf": VALID_OPF,
      "OEBPS/toc.ncx": VALID_NCX,
      "OEBPS/ch1.xhtml": VALID_XHTML("<p>Body of chapter one.</p>"),
      "OEBPS/ch2.xhtml": VALID_XHTML("<p>Body of chapter two.</p>"),
    });
    const fakeFile = { arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) };
    const sections = await parseEPUB(fakeFile);

    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe("Chapter One");
    expect(sections[1].title).toBe("Chapter Two");
  });
});

describe("parseEPUB — multi-chapter-per-file (NCX fragment anchors)", () => {
  let parseEPUB;

  beforeEach(async () => {
    const mod = await import("../../src/utils/parseEPUB.js");
    parseEPUB = mod.parseEPUB;
  });

  it("splits a single XHTML file into multiple sections when NCX has multiple navPoints targeting different fragment anchors", async () => {
    installJSZip({
      "META-INF/container.xml": `<?xml version="1.0"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles>
</container>`,
      "OEBPS/content.opf": `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf">
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="chunk-a" href="chunk-a.xhtml" media-type="application/xhtml+xml"/>
    <item id="chunk-b" href="chunk-b.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="chunk-a"/>
    <itemref idref="chunk-b"/>
  </spine>
</package>`,
      "OEBPS/toc.ncx": `<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
  <navMap>
    <navPoint><navLabel><text>Etymology</text></navLabel><content src="chunk-a.xhtml#ch1"/></navPoint>
    <navPoint><navLabel><text>Chapter 1. Loomings</text></navLabel><content src="chunk-a.xhtml#ch2"/></navPoint>
    <navPoint><navLabel><text>Chapter 2. The Carpet-Bag</text></navLabel><content src="chunk-b.xhtml#ch3"/></navPoint>
  </navMap>
</ncx>`,
      "OEBPS/chunk-a.xhtml": `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml"><body>
<h2 id="ch1">Etymology</h2><p>Etymology prose.</p>
<h2 id="ch2">Chapter 1. Loomings</h2><p>Loomings prose.</p>
</body></html>`,
      "OEBPS/chunk-b.xhtml": `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml"><body>
<h2 id="ch3">Chapter 2. The Carpet-Bag</h2><p>Carpet-bag prose.</p>
</body></html>`,
    });

    const fakeFile = { arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) };
    const sections = await parseEPUB(fakeFile);

    expect(sections).toHaveLength(3);
    expect(sections[0].title).toBe("Etymology");
    expect(sections[0].content).toContain("Etymology prose");
    expect(sections[0].content).not.toContain("Loomings"); // splits at fragment
    expect(sections[1].title).toBe("Chapter 1. Loomings");
    expect(sections[1].content).toContain("Loomings prose");
    expect(sections[1].content).not.toContain("Etymology prose"); // doesn't bleed back
    expect(sections[2].title).toBe("Chapter 2. The Carpet-Bag");
    expect(sections[2].content).toContain("Carpet-bag prose");
  });
});

describe("stripLeadingTitle", () => {
  it("strips an exact-match title", () => {
    expect(stripLeadingTitle("Chapter 1\n\nProse here.", "Chapter 1")).toBe("Prose here.");
  });
  it("strips a case-mismatched title (NCX vs rendered HTML)", () => {
    expect(stripLeadingTitle("CHAPTER 1\n\nProse here.", "Chapter 1")).toBe("Prose here.");
  });
  it("does not strip a coincidental prefix mid-content", () => {
    expect(stripLeadingTitle("Some prose. Chapter 1.", "Chapter 1")).toBe("Some prose. Chapter 1.");
  });
  it("returns content unchanged when title is falsy", () => {
    expect(stripLeadingTitle("Hello.", "")).toBe("Hello.");
    expect(stripLeadingTitle("Hello.", null)).toBe("Hello.");
    expect(stripLeadingTitle("Hello.", undefined)).toBe("Hello.");
  });
  it("escapes regex metacharacters in the title", () => {
    // Title containing regex special chars must be matched literally
    expect(stripLeadingTitle("Section (a). Body.", "Section (a).")).toBe("Body.");
  });
});
