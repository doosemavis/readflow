import { defineConfig } from "vitest/config";

// Vitest config for the parser-test suite (Phase 0 of the parser-rewrite
// plan). happy-dom provides a lightweight DOM environment so parseEPUB,
// parseHTMLStructured, and parseDOCX (all of which use DOMParser) can run
// inside Node. See docs/superpowers/plans/2026-05-18-parser-rewrite.md.
export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["tests/**/*.test.{js,jsx}"],
    setupFiles: ["tests/setup.js"],
    testTimeout: 30000,
  },
});
