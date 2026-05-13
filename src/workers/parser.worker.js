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
        sections = parseMarkdownStructured(payload);
        break;
      default:
        throw new Error(`Unknown parser type: ${type}`);
    }
    self.postMessage({ id, sections });
  } catch (err) {
    // Errors don't structured-clone cleanly across the postMessage boundary
    // (the Error object's stack and constructor get lost). Convert to a
    // plain string on the worker side; the main thread re-throws as a
    // standard Error so caller catch blocks see a normal exception.
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
