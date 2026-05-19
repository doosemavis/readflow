import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// parsePDF previously had two bare `catch {}` blocks (outline fetch +
// per-entry destination resolution). Failures vanished into the void;
// when most outline entries failed, the user got a doc with a useless
// flat page list and no warning that the TOC had silently dropped.
//
// These tests cover the extracted helpers — the parsePDF entrypoint
// itself depends on a real CDN-loaded pdf.js global, which we can't
// reproduce in Node. The helpers are the actual error-handling units.

vi.mock("../../src/utils/scriptLoader.js", () => ({
  loadScript: () => Promise.resolve(),
}));

const { resolveDestToPage, resolveOutlineSafe } = await import("../../src/utils/parsePDF.js");

describe("resolveDestToPage — single-entry warn behavior (Task 1.6)", () => {
  let warnSpy;
  beforeEach(() => { warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { warnSpy.mockRestore(); });

  it("resolves a string destination to a 1-indexed page number", async () => {
    const doc = {
      getDestination: vi.fn(() => Promise.resolve(["page-ref", "Fit"])),
      getPageIndex: vi.fn(() => Promise.resolve(4)),
    };
    expect(await resolveDestToPage(doc, "ch1")).toBe(5);
  });

  it("returns null and warns when getDestination throws", async () => {
    const doc = {
      getDestination: vi.fn(() => Promise.reject(new Error("dead link"))),
      getPageIndex: vi.fn(),
    };
    expect(await resolveDestToPage(doc, "ch1")).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/outline|destination/i), expect.anything());
  });

  it("returns null and warns when getPageIndex throws", async () => {
    const doc = {
      getDestination: vi.fn(() => Promise.resolve(["page-ref"])),
      getPageIndex: vi.fn(() => Promise.reject(new Error("invalid ref"))),
    };
    expect(await resolveDestToPage(doc, ["page-ref"])).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/outline|destination/i), expect.anything());
  });
});

describe("resolveOutlineSafe — bulk + threshold warn behavior (Task 1.6)", () => {
  let warnSpy;
  beforeEach(() => { warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { warnSpy.mockRestore(); });

  it("returns null when getOutline throws (Task 1.5)", async () => {
    const doc = { getOutline: vi.fn(() => Promise.reject(new Error("oops"))) };
    const result = await resolveOutlineSafe(doc);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/outline/i), expect.anything());
  });

  it("returns null when getOutline returns empty", async () => {
    const doc = { getOutline: vi.fn(() => Promise.resolve([])) };
    expect(await resolveOutlineSafe(doc)).toBeNull();
  });

  it("returns flattened resolved entries when all destinations resolve", async () => {
    const doc = {
      getOutline: vi.fn(() => Promise.resolve([
        { title: "Ch 1", dest: "d1", items: [] },
        { title: "Ch 2", dest: "d2", items: [] },
      ])),
      getDestination: vi.fn((d) => Promise.resolve([d, "Fit"])),
      getPageIndex: vi.fn(() => Promise.resolve(0)),
    };
    const result = await resolveOutlineSafe(doc);
    expect(result).toHaveLength(2);
    expect(result[0].page).toBe(1);
  });

  it("warns loudly when >50% of outline entries fail to resolve", async () => {
    const doc = {
      getOutline: vi.fn(() => Promise.resolve([
        { title: "Ch 1", dest: "good", items: [] },
        { title: "Ch 2", dest: "bad", items: [] },
        { title: "Ch 3", dest: "bad", items: [] },
        { title: "Ch 4", dest: "bad", items: [] },
      ])),
      getDestination: vi.fn((d) => d === "good" ? Promise.resolve(["p", "Fit"]) : Promise.reject(new Error("dead"))),
      getPageIndex: vi.fn(() => Promise.resolve(0)),
    };
    const result = await resolveOutlineSafe(doc);
    expect(result).toHaveLength(4);
    // The >50% threshold message specifically — separate from the per-entry warns.
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/most outline|majority|broken/i));
  });
});
