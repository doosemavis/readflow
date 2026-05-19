import { describe, it, expect } from "vitest";
import {
  detectTextStructure,
  parseHTMLStructured,
  parseMarkdownStructured,
} from "../../src/utils/detectStructure.js";

// Renderer contract — docs/architecture/PARSER_CONTRACT.md §1.
// Every parser MUST return Section[] where each section has:
//   type: "chapter" | "page" | "section" | "document"
//   title: string | null
//   number: positive integer | null
//   content: non-empty string after trim
//
// This test locks the shape at the parser boundary so silent
// divergence (empty-string title, missing keys, novel type values)
// surfaces as a red test instead of as hollow UI.

const ALLOWED_TYPES = ["chapter", "page", "section", "document"];

function assertSectionShape(section) {
  expect(section).toHaveProperty("type");
  expect(section).toHaveProperty("title");
  expect(section).toHaveProperty("number");
  expect(section).toHaveProperty("content");

  expect(ALLOWED_TYPES).toContain(section.type);

  // title: string OR null; empty-string is NOT allowed (PARSER_CONTRACT.md §1
  // invariant #3 — empty string bypasses the synthesis fallback).
  if (section.title !== null) {
    expect(typeof section.title).toBe("string");
    expect(section.title.trim()).not.toBe("");
  }

  // number: positive integer OR null.
  if (section.number !== null) {
    expect(typeof section.number).toBe("number");
    expect(Number.isInteger(section.number)).toBe(true);
    expect(section.number).toBeGreaterThan(0);
  }

  // content: string, non-empty after trim (PARSER_CONTRACT.md §1 invariant #2).
  expect(typeof section.content).toBe("string");
  expect(section.content.trim()).not.toBe("");
}

describe("Renderer contract — every parser emits the documented Section[] shape", () => {
  describe("parseMarkdownStructured", () => {
    it("emits valid Section[] for a multi-chapter doc", () => {
      const sections = parseMarkdownStructured("# Chapter 1\n\nHello.\n\n# Chapter 2\n\nWorld.");
      expect(Array.isArray(sections)).toBe(true);
      expect(sections.length).toBeGreaterThan(0);
      sections.forEach(assertSectionShape);
    });

    it("emits a single valid Section for unstructured prose", () => {
      const sections = parseMarkdownStructured("Just some plain prose with no headings at all.");
      expect(Array.isArray(sections)).toBe(true);
      expect(sections.length).toBe(1);
      sections.forEach(assertSectionShape);
    });
  });

  describe("detectTextStructure", () => {
    it("emits valid Section[] for a doc with CHAPTER headings", () => {
      const sections = detectTextStructure("CHAPTER 1\n\nFirst body.\n\nCHAPTER 2\n\nSecond body.");
      expect(Array.isArray(sections)).toBe(true);
      expect(sections.length).toBeGreaterThan(0);
      sections.forEach(assertSectionShape);
    });

    it("emits a single document-typed Section for unstructured prose", () => {
      const sections = detectTextStructure("Just plain prose. No headings.");
      expect(Array.isArray(sections)).toBe(true);
      expect(sections.length).toBe(1);
      expect(sections[0].type).toBe("document");
      sections.forEach(assertSectionShape);
    });
  });

  describe("parseHTMLStructured", () => {
    it("emits valid Section[] for an HTML doc with h1 headings", () => {
      const html = "<html><body><h1>Chapter 1</h1><p>Body one.</p><h1>Chapter 2</h1><p>Body two.</p></body></html>";
      const sections = parseHTMLStructured(html);
      expect(Array.isArray(sections)).toBe(true);
      expect(sections.length).toBeGreaterThan(0);
      sections.forEach(assertSectionShape);
    });

    it("falls back to detectTextStructure when no headings are present", () => {
      const html = "<html><body><p>Just a paragraph, no headings.</p></body></html>";
      const sections = parseHTMLStructured(html);
      expect(Array.isArray(sections)).toBe(true);
      expect(sections.length).toBeGreaterThan(0);
      sections.forEach(assertSectionShape);
    });
  });
});
