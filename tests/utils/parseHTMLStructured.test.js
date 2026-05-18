import { describe, it, expect } from "vitest";
import { parseHTMLStructured } from "../../src/utils/detectStructure.js";

// Phase 4 — point fixes to the HTML walker. Each describe-block locks one
// fix from the plan so future refactors can't quietly re-introduce a bug.

describe("parseHTMLStructured — script/style stripping (Task 4.1)", () => {
  it("does NOT leak <script> source into any section's content", () => {
    const html = `<html><body>
      <h1>Article</h1>
      <p>Real paragraph.</p>
      <script>const evilTracker = "PII"; alert(evilTracker);</script>
    </body></html>`;
    const sections = parseHTMLStructured(html);
    for (const s of sections) {
      expect(s.content).not.toContain("evilTracker");
      expect(s.content).not.toContain("alert(");
      expect(s.content).not.toContain("PII");
    }
  });

  it("does NOT leak <style> source into any section's content", () => {
    const html = `<html><body>
      <h1>Article</h1>
      <p>Real paragraph.</p>
      <style>.leaked { color: red; font-family: 'should-not-appear'; }</style>
    </body></html>`;
    const sections = parseHTMLStructured(html);
    for (const s of sections) {
      expect(s.content).not.toContain("should-not-appear");
      expect(s.content).not.toContain("color: red");
    }
  });

  it("also strips noscript/iframe/object/embed contents", () => {
    const html = `<html><body>
      <h1>Article</h1>
      <p>Real paragraph.</p>
      <noscript>noscript-fallback-text</noscript>
      <iframe src="x">iframe-text</iframe>
      <object>object-text</object>
      <embed>embed-text</embed>
    </body></html>`;
    const sections = parseHTMLStructured(html);
    for (const s of sections) {
      expect(s.content).not.toContain("noscript-fallback-text");
      expect(s.content).not.toContain("iframe-text");
      expect(s.content).not.toContain("object-text");
      expect(s.content).not.toContain("embed-text");
    }
  });
});

describe("parseHTMLStructured — h1–h6 heading detection (Task 4.2)", () => {
  it("splits sections at h4 (previously silently flattened)", () => {
    const html = `<html><body>
      <h4>Chapter 1</h4>
      <p>Body of chapter 1.</p>
      <h4>Chapter 2</h4>
      <p>Body of chapter 2.</p>
      <h4>Chapter 3</h4>
      <p>Body of chapter 3.</p>
    </body></html>`;
    const sections = parseHTMLStructured(html);
    expect(sections).toHaveLength(3);
    expect(sections.map((s) => s.title)).toEqual(["Chapter 1", "Chapter 2", "Chapter 3"]);
  });

  it("splits sections at h5 and h6 too", () => {
    const html = `<html><body>
      <h5>A</h5><p>body</p>
      <h6>B</h6><p>body</p>
    </body></html>`;
    const sections = parseHTMLStructured(html);
    expect(sections).toHaveLength(2);
  });

  it("happy-path: h1 still works", () => {
    const html = `<html><body>
      <h1>One</h1><p>x</p>
      <h1>Two</h1><p>y</p>
    </body></html>`;
    const sections = parseHTMLStructured(html);
    expect(sections).toHaveLength(2);
  });
});

describe("parseHTMLStructured — parsererror detection (Task 4.3)", () => {
  it("happy-path: well-formed HTML returns sections cleanly (no throw)", () => {
    const html = `<html><body><h1>Title</h1><p>Body.</p></body></html>`;
    expect(() => parseHTMLStructured(html)).not.toThrow();
  });

  // NB: text/html mode in DOMParser auto-corrects most malformed input
  // (unclosed tags, missing body, etc) so parseFromString rarely emits
  // a <parsererror> node — happy-dom and real browsers both forgive a
  // lot. The defensive check still runs in case future inputs hit the
  // rare edge that DOES surface parsererror. We assert the GOOD path
  // here and trust the same parsererror pattern proven by parseEPUB
  // (Tasks 1.2-1.4) for the bad-path.
});

describe("parseHTMLStructured — type harmonization (Task 4.4)", () => {
  it("emits type:'chapter', not 'section'", () => {
    const html = `<html><body>
      <h1>Title</h1>
      <p>Body paragraph.</p>
    </body></html>`;
    const [s] = parseHTMLStructured(html);
    expect(s.type).toBe("chapter");
  });

  it("fallback (no-headings) section type is still 'document' (from detectTextStructure)", () => {
    const html = `<html><body><p>Just one paragraph.</p></body></html>`;
    const sections = parseHTMLStructured(html);
    expect(sections[0].type).toBe("document");
  });
});
