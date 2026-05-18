// CONTRACT: posts back Section[] per docs/architecture/PARSER_CONTRACT.md.
// Phase 3 will swap the MD path to a marked.lexer() token→section adapter.
//
// Parser Worker (Phase 2: text + Markdown only).
//
// Runs the worker-safe parsers off the main thread so document parsing
// doesn't starve the loader's animation. The worker is intentionally minimal:
// one message type per parser, request-id correlation for promise resolution,
// errors marshaled as { id, error: string } so the main thread can re-throw.
//
// Worker-safe = no DOMParser, no window, no document. detectStructure.js's
// `detectTextStructure` and `parseMarkdownStructured` are pure-JS; they
// import without touching DOM. `parseHTMLStructured` from the same file uses
// DOMParser and must stay on the main thread (or get a polyfill — Phase 3
// territory if we want it in the worker).
//
// Why named imports: tree-shaking. If we imported the whole module, the
// `parseHTMLStructured` symbol would land in the worker bundle as dead
// code referencing `DOMParser`. Vite *should* tree-shake it, but the
// explicit import keeps the dependency clear at the file boundary.

import { detectTextStructure, parseMarkdownStructured } from "../utils/detectStructure";
import { parseMarkdownTokens } from "../utils/parseMarkdownTokens";
import { analyzePDF } from "./pdfAnalysis";
import { USE_MARKDOWN_TOKEN_PARSER } from "../config/constants";

self.onmessage = (e) => {
  const { id, type, payload } = e.data || {};
  if (typeof id !== "number") return; // ignore malformed messages

  try {
    let sections;
    switch (type) {
      case "parse-text":
        sections = detectTextStructure(payload);
        break;
      case "parse-md":
        // Phase 3: flag selects between marked.lexer + adapter (default)
        // and the legacy regex preprocessor. Both emit the same Section[]
        // shape so the renderer doesn't care which ran.
        sections = USE_MARKDOWN_TOKEN_PARSER
          ? parseMarkdownTokens(payload)
          : parseMarkdownStructured(payload);
        break;
      case "parse-pdf":
        // payload: { rawPages, resolvedOutline, debug }
        // pdf.js calls (load, getDocument, getTextContent, outline resolution)
        // happen on main thread; this branch runs the heuristics-heavy analysis.
        sections = analyzePDF(payload);
        break;
      default:
        throw new Error(`Unknown parser type: ${type}`);
    }
    self.postMessage({ id, sections });
  } catch (err) {
    // Errors don't structured-clone cleanly across the postMessage boundary
    // (Error.constructor, .stack, and any custom properties get dropped).
    // Previously we serialized to a plain string, which lost the error
    // name and stack — the main thread re-threw as a generic Error with
    // no provenance, making parser bugs hard to trace.
    //
    // Now serialize { message, name, stack }; parserWorker.js rebuilds an
    // Error with the original name + stack preserved.
    const errorPayload = err instanceof Error
      ? { message: err.message, name: err.name, stack: err.stack }
      : { message: String(err), name: "Error", stack: undefined };
    self.postMessage({ id, error: errorPayload });
  }
};
