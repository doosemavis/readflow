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

vi.mock("../../src/utils/supabase.js", () => ({
  supabase: {
    storage: {
      from: () => ({ download: downloadMock }),
    },
    from: () => ({ update: updateMock }),
  },
}));

vi.mock("../../src/utils/storage.js", () => ({
  storageGet: vi.fn(),
  storageDel: vi.fn(),
  storageGcOrphanChunks: vi.fn(),
  storageGcUnscopedKeys: vi.fn(),
}));

const { cloudLoadDoc } = await import("../../src/utils/cloudDocs.js");

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
