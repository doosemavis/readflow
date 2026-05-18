// CONTRACT: emits Section[] per docs/architecture/PARSER_CONTRACT.md.
// Tested in tests/utils/parseMarkdownTokens.test.js.
//
// Phase 3 of the parser rewrite. Replaces the regex-based preprocessor
// (preprocessMarkdown + detectTextStructure) with a real Markdown tokenizer
// from `marked`. The codex review insisted: use marked.lexer() — NOT marked's
// HTML output — so the tokens reach this adapter with structure intact.
//
// The adapter walks marked's token stream and renders the SAME private
// pseudo-Markdown body language the legacy parser produced. That keeps the
// renderer (DocumentBody.jsx) untouched by this swap — it's a producer
// change behind a fixed contract.
//
// Section boundary rule (codex Q2 answer):
//   heading depth 1-2 → new section, token.text as title
//   heading depth 3+  → inline ##/### + text in current section content
//   everything else   → append to current section content
//
// Inline mapping:
//   text        → text
//   strong      → **bold**
//   em          → __italic__
//   link        → label only (drop URL)
//   image       → dropped entirely
//   code        → text without backticks
//
// Block mapping:
//   paragraph   → render inline tokens, append
//   list        → "- item" or "N. item" lines, preserves start number
//   code        → plain text, no fence markers, no lang tag
//   blockquote  → unwrapped paragraphs
//   space       → skip
//   html (e.g. <!-- comment -->) → drop
//   hr          → drop

import { marked } from "marked";

const HEADING_NEW_SECTION_DEPTH = 2; // depth 1 + 2 start sections; 3+ inline

function renderInline(tokens) {
  if (!Array.isArray(tokens)) return "";
  let out = "";
  for (const t of tokens) {
    switch (t.type) {
      case "text":
        // marked unescapes \* into * in token.text. Use the unescaped form
        // so "\\*not italic\\*" survives as literal asterisks.
        out += t.text;
        break;
      case "strong":
        out += "**" + renderInline(t.tokens) + "**";
        break;
      case "em":
        out += "__" + renderInline(t.tokens) + "__";
        break;
      case "del":
        // Strikethrough: render the plain text. The renderer has no
        // strike style; dropping the tilde markers is the lowest-loss
        // mapping.
        out += renderInline(t.tokens);
        break;
      case "link":
        // Drop the URL, keep the label.
        out += renderInline(t.tokens);
        break;
      case "image":
        // Drop entirely — we don't render images in the reader, and the
        // alt text is usually filename-y noise ("screenshot-1.png").
        break;
      case "codespan":
        // Inline `code` — strip backticks (no monospace style in renderer).
        out += t.text;
        break;
      case "br":
        out += "\n";
        break;
      case "html":
        // Inline HTML (rare in normal MD). Drop — the renderer can't
        // interpret HTML inside a paragraph.
        break;
      default:
        // Unknown inline token type — fall back to its raw text if
        // present, otherwise skip silently.
        if (typeof t.text === "string") out += t.text;
        break;
    }
  }
  return out;
}

function renderListItem(item, marker) {
  // list_item.tokens contains a paragraph (or text token) holding the
  // item's inline content. Render to inline string + prepend the marker.
  let inner = "";
  if (Array.isArray(item.tokens)) {
    for (const t of item.tokens) {
      if (t.type === "text" || t.type === "paragraph") {
        inner += renderInline(t.tokens || []);
      } else if (t.type === "list") {
        // Nested list — render as indented lines on a new line.
        inner += "\n" + renderList(t).replace(/^/gm, "  ");
      } else if (typeof t.text === "string") {
        inner += t.text;
      }
    }
  }
  return `${marker} ${inner.trim()}`;
}

function renderList(token) {
  const lines = [];
  let n = token.ordered ? (parseInt(token.start, 10) || 1) : null;
  for (const item of token.items || []) {
    const marker = n === null ? "-" : `${n}.`;
    lines.push(renderListItem(item, marker));
    if (n !== null) n += 1;
  }
  return lines.join("\n");
}

function renderBlock(token) {
  switch (token.type) {
    case "paragraph":
      return renderInline(token.tokens);
    case "list":
      return renderList(token);
    case "code":
      // Plain text body. No fence, no lang tag.
      return token.text;
    case "blockquote": {
      // Render the inner tokens as plain paragraphs (we have no quote style).
      const inner = (token.tokens || []).map(renderBlock).filter(Boolean).join("\n\n");
      return inner;
    }
    case "hr":
    case "space":
    case "html":
      // hr → drop. space → skip whitespace-only tokens. html → drop
      // (HTML comments and stray blocks; we don't render HTML inside MD).
      return "";
    case "table":
      // Render as plain rows (cells joined by " | "). No table styling
      // in the renderer yet; flat text is the least-confusing mapping.
      return (token.rows || [])
        .map((row) => (Array.isArray(row) ? row.map((c) => renderInline(c.tokens || [])).join(" | ") : ""))
        .filter(Boolean)
        .join("\n");
    default:
      // Unknown block type — fall back to .text if available, otherwise
      // skip. Keeps the adapter forward-compatible with new marked
      // tokens without crashing.
      return typeof token.text === "string" ? token.text : "";
  }
}

function appendContent(section, text) {
  if (!text) return;
  section.content = section.content ? `${section.content}\n\n${text}` : text;
}

export function parseMarkdownTokens(md) {
  const tokens = marked.lexer(md);
  const sections = [];
  let sectionNum = 0;
  let current = { type: "document", title: null, number: 1, content: "" };

  function pushIfNonEmpty() {
    // Empty heading-only sections (`# Empty` with no body) are dropped —
    // they would render as phantom chapter labels with zero paragraphs.
    if (current.content.trim()) sections.push(current);
  }

  for (const token of tokens) {
    if (token.type === "heading" && token.depth <= HEADING_NEW_SECTION_DEPTH) {
      // Close previous section and open a new one.
      pushIfNonEmpty();
      sectionNum += 1;
      current = {
        type: "chapter",
        title: renderInline(token.tokens || []).trim() || null,
        number: sectionNum,
        content: "",
      };
      continue;
    }
    if (token.type === "heading") {
      // h3+ becomes an inline heading prefix on its own line.
      const marker = "#".repeat(Math.min(token.depth, 6));
      const text = renderInline(token.tokens || []);
      appendContent(current, `${marker} ${text}`);
      continue;
    }
    const rendered = renderBlock(token);
    if (rendered) appendContent(current, rendered);
  }
  pushIfNonEmpty();

  // No headings → single document section (matches detectTextStructure's
  // no-structure fallback shape).
  if (sections.length === 0) {
    return [{ type: "document", title: null, number: 1, content: md.trim() }];
  }

  // Renumber after dropping any empty heading-only sections so the
  // `number` field is contiguous.
  return sections.map((s, i) => ({ ...s, number: i + 1 }));
}
