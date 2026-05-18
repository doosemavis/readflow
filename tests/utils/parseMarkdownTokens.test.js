import { describe, it, expect } from "vitest";
import { parseMarkdownTokens } from "../../src/utils/parseMarkdownTokens.js";

// Token→Section adapter contract — see docs/architecture/PARSER_CONTRACT.md.
//
// marked.lexer() produces a token stream; this adapter walks it into
// Section[] using the private pseudo-Markdown content body language the
// renderer understands. The mapping below is locked by these tests so a
// future marked version bump (or a misguided refactor) can't silently
// drift the content shape.

describe("parseMarkdownTokens — section boundaries", () => {
  it("emits a single 'document' section for prose with no headings", () => {
    const sections = parseMarkdownTokens("Just one paragraph of prose. No headings at all.");
    expect(sections).toHaveLength(1);
    expect(sections[0].type).toBe("document");
    expect(sections[0].title).toBeNull();
    expect(sections[0].content).toContain("Just one paragraph");
  });

  it("starts a new section at every h1", () => {
    const md = "# One\n\nBody one.\n\n# Two\n\nBody two.";
    const sections = parseMarkdownTokens(md);
    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({ type: "chapter", title: "One", number: 1 });
    expect(sections[1]).toMatchObject({ type: "chapter", title: "Two", number: 2 });
  });

  it("starts a new section at h2 as well", () => {
    const md = "## A\n\nbody\n\n## B\n\nbody";
    const sections = parseMarkdownTokens(md);
    expect(sections).toHaveLength(2);
    expect(sections.map((s) => s.title)).toEqual(["A", "B"]);
  });

  it("h3+ does NOT start a section; it becomes an inline ## / ### heading", () => {
    const md = "# Chapter\n\n### Inline heading\n\nBody.";
    const sections = parseMarkdownTokens(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].content).toContain("### Inline heading");
  });

  it("content before the first heading lands in a leading 'document' section", () => {
    const md = "Intro paragraph before any heading.\n\n# First Heading\n\nBody.";
    const sections = parseMarkdownTokens(md);
    expect(sections).toHaveLength(2);
    expect(sections[0].type).toBe("document");
    expect(sections[0].content).toContain("Intro paragraph");
    expect(sections[1].title).toBe("First Heading");
  });
});

describe("parseMarkdownTokens — inline emphasis mapping", () => {
  it("**bold** stays **bold** (renderer's private marker)", () => {
    const [s] = parseMarkdownTokens("Some **bold word** here.");
    expect(s.content).toContain("**bold word**");
  });

  it("*italic* and _italic_ both become __italic__", () => {
    const a = parseMarkdownTokens("Some *italicised* word.")[0];
    expect(a.content).toContain("__italicised__");
    const b = parseMarkdownTokens("Some _underscored_ word.")[0];
    expect(b.content).toContain("__underscored__");
  });

  it("[link text](url) keeps the label and drops the URL", () => {
    const [s] = parseMarkdownTokens("Click [the link](https://example.com) please.");
    expect(s.content).toContain("the link");
    expect(s.content).not.toContain("example.com");
    expect(s.content).not.toContain("(https");
  });

  it("inline `code` drops the backticks (no monospace style in renderer)", () => {
    const [s] = parseMarkdownTokens("Use the `useState` hook.");
    expect(s.content).toContain("useState");
    expect(s.content).not.toContain("`useState`");
  });

  it("![image](src) is dropped entirely", () => {
    const [s] = parseMarkdownTokens("Look at this ![cool pic](/img.png) image.");
    expect(s.content).not.toContain("cool pic");
    expect(s.content).not.toContain("/img.png");
  });
});

describe("parseMarkdownTokens — block elements", () => {
  it("- bullet lists render as one '- item' line per entry", () => {
    const md = "- alpha\n- beta\n- gamma";
    const [s] = parseMarkdownTokens(md);
    expect(s.content).toContain("- alpha");
    expect(s.content).toContain("- beta");
    expect(s.content).toContain("- gamma");
  });

  it("numbered lists render as '1. item' with the original start number", () => {
    const [s] = parseMarkdownTokens("3. third\n4. fourth");
    expect(s.content).toContain("3. third");
    expect(s.content).toContain("4. fourth");
  });

  it("fenced code blocks render as plain text without backticks or lang tag", () => {
    const md = "```js\nconst x = 1;\nconst y = 2;\n```";
    const [s] = parseMarkdownTokens(md);
    expect(s.content).toContain("const x = 1");
    expect(s.content).toContain("const y = 2");
    expect(s.content).not.toContain("```");
    expect(s.content).not.toContain("js\n");
  });

  it("blockquote lines render as plain paragraphs (no '> ' prefix)", () => {
    const [s] = parseMarkdownTokens("> A pithy thought.\n> Continued thought.");
    expect(s.content).toContain("A pithy thought");
    expect(s.content).toContain("Continued thought");
    expect(s.content).not.toContain("> ");
  });

  it("HTML comments are dropped", () => {
    const [s] = parseMarkdownTokens("Some prose.\n\n<!-- editor's note -->\n\nMore prose.");
    expect(s.content).toContain("Some prose");
    expect(s.content).toContain("More prose");
    expect(s.content).not.toContain("editor");
    expect(s.content).not.toContain("<!--");
  });

  it("horizontal rules (---, ***) are dropped", () => {
    const md = "Paragraph one.\n\n---\n\nParagraph two.";
    const [s] = parseMarkdownTokens(md);
    expect(s.content).toContain("Paragraph one");
    expect(s.content).toContain("Paragraph two");
    expect(s.content).not.toMatch(/^---$/m);
  });

  it("strikethrough ~~text~~ is rendered as plain text (we don't have a strike style)", () => {
    const [s] = parseMarkdownTokens("This is ~~struck out~~ text.");
    expect(s.content).toContain("struck out");
    expect(s.content).not.toContain("~~");
  });
});

describe("parseMarkdownTokens — edge cases", () => {
  it("link inside heading: title keeps the label, not the URL", () => {
    const md = "# Chapter [with link](https://example.com)\n\nBody.";
    const [s] = parseMarkdownTokens(md);
    expect(s.title).toBe("Chapter with link");
  });

  it("escaped emphasis (\\*not italic\\*) survives as literal characters", () => {
    const [s] = parseMarkdownTokens("Some \\*not italic\\* text.");
    expect(s.content).toContain("*not italic*");
    expect(s.content).not.toContain("__not italic__");
  });

  it("setext headings (=== / ---) work the same as ATX", () => {
    const md = "First Heading\n=============\n\nBody one.\n\nSecond Heading\n--------------\n\nBody two.";
    const sections = parseMarkdownTokens(md);
    expect(sections).toHaveLength(2);
    expect(sections.map((s) => s.title)).toEqual(["First Heading", "Second Heading"]);
  });

  it("YAML front matter does NOT appear in any section's content", () => {
    const md = "---\ntitle: Hello\nauthor: Me\n---\n\n# Real Heading\n\nBody.";
    const sections = parseMarkdownTokens(md);
    // Either a leading "document" section with the frontmatter dropped, or
    // just the # Real Heading section. Either way: no YAML in output.
    for (const s of sections) {
      expect(s.content).not.toMatch(/^title:/m);
      expect(s.content).not.toMatch(/^author:/m);
    }
  });

  it("sections without content are dropped (no phantom 'empty chapter')", () => {
    const md = "# Empty\n\n# Real\n\nThis one has content.";
    const sections = parseMarkdownTokens(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Real");
  });

  it("returns Section[] satisfying the renderer contract", () => {
    const ALLOWED = ["chapter", "page", "section", "document"];
    const sections = parseMarkdownTokens("# A\n\ntext\n\n# B\n\nmore");
    for (const s of sections) {
      expect(ALLOWED).toContain(s.type);
      expect(typeof s.content).toBe("string");
      expect(s.content.trim()).not.toBe("");
      if (s.title !== null) expect(s.title.trim()).not.toBe("");
      if (s.number !== null) expect(s.number).toBeGreaterThan(0);
    }
  });
});
