import { describe, it, expect, vi, beforeEach } from "vitest";

// cloudDocs.cloudLoadDoc has three real outcomes:
//   1. blob downloads and parses cleanly → { sections, text, name }
//   2. blob is missing (Supabase returns null + error) → null
//   3. blob downloads but JSON.parse throws (corrupted on disk) → MUST be
//      distinguishable from case 2 so the UI can show "this document is
//      damaged, re-upload" instead of the generic "no longer available".
//
// Before the fix, cases 2 and 3 both collapsed to `null` so the renderer
// said the same thing for two different failure modes.

const downloadMock = vi.fn();
const updateMock = vi.fn(() => ({
  eq: () => ({ eq: () => ({ then: (cb) => cb({ error: null }) }) }),
}));

// Programmable mock for from() — each describe-block can install its own
// builder responses via `fromBuilders[tableName] = () => ({...})`.
const fromBuilders = {};

vi.mock("../../src/utils/supabase.js", () => ({
  supabase: {
    storage: {
      from: () => ({ download: downloadMock, remove: vi.fn(() => Promise.resolve({ error: null })) }),
    },
    from: (table) => (fromBuilders[table] ? fromBuilders[table]() : { update: updateMock }),
  },
}));

vi.mock("../../src/utils/storage.js", () => ({
  storageGet: vi.fn(),
  storageDel: vi.fn(),
  storageGcOrphanChunks: vi.fn(),
  storageGcUnscopedKeys: vi.fn(),
}));

const { cloudLoadDoc, cloudLoadLibraryPosition, cloudOpenLibraryBook } = await import("../../src/utils/cloudDocs.js");

describe("cloudLoadDoc — missing-vs-corrupted distinguishability", () => {
  beforeEach(() => {
    downloadMock.mockReset();
  });

  it("returns the parsed payload on a clean blob", async () => {
    const payload = JSON.stringify({
      sections: [{ type: "chapter", title: "X", number: 1, content: "y" }],
      text: "y",
    });
    downloadMock.mockResolvedValue({ data: new Blob([payload]), error: null });

    const result = await cloudLoadDoc("user-abc", { id: "doc-1", name: "demo.txt" });

    expect(result).toMatchObject({ name: "demo.txt", text: "y" });
    expect(result.sections).toHaveLength(1);
  });

  it("returns null when the blob is missing (Supabase storage error)", async () => {
    downloadMock.mockResolvedValue({ data: null, error: { message: "not found" } });

    const result = await cloudLoadDoc("user-abc", { id: "doc-1", name: "demo.txt" });

    expect(result).toBeNull();
  });

  it("returns { error: 'corrupted', name } when the blob parses to non-JSON", async () => {
    downloadMock.mockResolvedValue({ data: new Blob(["this is not json at all"]), error: null });

    const result = await cloudLoadDoc("user-abc", { id: "doc-1", name: "demo.txt" });

    expect(result).toEqual({ error: "corrupted", name: "demo.txt" });
  });

  it("returns { error: 'corrupted', name } when the JSON parses but is structurally invalid", async () => {
    // null is valid JSON but blowing up later when DocumentBody reads
    // .sections is the same UX outcome as a parse failure. Return the
    // corrupted shape so the UI can warn instead of silently rendering
    // an empty document.
    downloadMock.mockResolvedValue({ data: new Blob(["null"]), error: null });

    const result = await cloudLoadDoc("user-abc", { id: "doc-1", name: "demo.txt" });

    expect(result).toEqual({ error: "corrupted", name: "demo.txt" });
  });
});

describe("cloudLoadLibraryPosition — error vs no-row (Task 1.11)", () => {
  beforeEach(() => {
    Object.keys(fromBuilders).forEach((k) => delete fromBuilders[k]);
  });

  it("returns the row when one exists", async () => {
    fromBuilders.library_reads = () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { position: { sectionIdx: 3 }, last_open: "2026-05-18" }, error: null }),
          }),
        }),
      }),
    });
    const row = await cloudLoadLibraryPosition("user-abc", "book-1");
    expect(row?.position?.sectionIdx).toBe(3);
  });

  it("returns null when no row exists (user never opened the book)", async () => {
    fromBuilders.library_reads = () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    });
    expect(await cloudLoadLibraryPosition("user-abc", "book-1")).toBeNull();
  });

  it("throws on actual Supabase error (was silently collapsing to null)", async () => {
    fromBuilders.library_reads = () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: { message: "permission denied" } }),
          }),
        }),
      }),
    });
    await expect(cloudLoadLibraryPosition("user-abc", "book-1")).rejects.toThrow(/permission|library/i);
  });
});

describe("cloudOpenLibraryBook — surfaces recent_docs mirror failures (Task 1.12)", () => {
  beforeEach(() => {
    Object.keys(fromBuilders).forEach((k) => delete fromBuilders[k]);
    downloadMock.mockReset();
  });

  function installBookRow(book) {
    fromBuilders.library_books = () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: book, error: null }),
        }),
      }),
    });
  }

  function installRecentDocsUpsert(error) {
    fromBuilders.recent_docs = () => ({
      upsert: () => Promise.resolve({ error }),
    });
  }

  function installLibraryReadsUpsert() {
    fromBuilders.library_reads = () => ({
      upsert: () => ({ then: (cb) => cb({ error: null }) }),
    });
  }

  it("returns { blob, book } on success with no mirrorError flag", async () => {
    installBookRow({ id: "b1", title: "Demo", blob_path: "demo.epub", tier_required: "free" });
    installRecentDocsUpsert(null);
    installLibraryReadsUpsert();
    downloadMock.mockResolvedValue({ data: new Blob(["x"]), error: null });

    const result = await cloudOpenLibraryBook("user-abc", "b1", true);
    expect(result.book.id).toBe("b1");
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.mirrorError).toBeFalsy();
  });

  it("returns mirrorError: true when the recent_docs upsert fails", async () => {
    installBookRow({ id: "b1", title: "Demo", blob_path: "demo.epub", tier_required: "free" });
    installRecentDocsUpsert({ message: "rls denied" });
    installLibraryReadsUpsert();
    downloadMock.mockResolvedValue({ data: new Blob(["x"]), error: null });

    const result = await cloudOpenLibraryBook("user-abc", "b1", true);
    expect(result.book.id).toBe("b1");
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.mirrorError).toBe(true);
  });
});
