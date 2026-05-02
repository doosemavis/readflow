// Supabase-backed document storage and recent-docs index.
//
// Files live in the `documents` bucket at path `{user_id}/{doc_id}.json`,
// shaped as the JSON `{ sections, text }` payload that ReadFlow already
// builds. The recent-docs index lives in the `recent_docs` table; RLS
// policies enforce per-user isolation on both surfaces (see the migration
// in supabase/migrations/).
//
// userId is passed in by the caller rather than fetched via
// supabase.auth.getUser(); the latter triggers a token refresh that fails
// against this project's `sb_publishable_` key and silently signs the
// user out (same root cause as the email-auth raw-fetch workaround in
// AuthContext). The user from useAuth() is already settled and safe.
import { supabase } from "./supabase";
import { MAX_RECENT_DOCS } from "../config/constants";
import { storageGet, storageDel, storageGcOrphanChunks, storageGcUnscopedKeys } from "./storage";

const BUCKET = "documents";

function docPath(userId, docId) {
  return `${userId}/${docId}.json`;
}

function requireUserId(userId) {
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

// List this user's recent docs, newest first. RLS scopes results to the
// current auth.uid() too, so the .eq is belt-and-suspenders.
export async function cloudListRecent(userId) {
  requireUserId(userId);
  const { data, error } = await supabase
    .from("recent_docs")
    .select("id, name, timestamp, chunks")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(MAX_RECENT_DOCS);
  if (error) throw error;
  return data ?? [];
}

// Upload a fresh doc, register it in recent_docs, and prune older entries
// past MAX_RECENT_DOCS so the user's library stays bounded. Re-uploading
// the same filename replaces the prior entry.
export async function cloudSaveDoc(userId, name, sections, fullText) {
  requireUserId(userId);

  // Same id-shape useRecentDocs already produces, so migration paths line up.
  const id = name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40) + "_" + Date.now().toString(36);
  const payload = JSON.stringify({ sections, text: fullText });
  const path = docPath(userId, id);

  // Dedup-by-name: find any prior row with this name and remove its
  // storage object + table row first.
  const { data: existing } = await supabase
    .from("recent_docs")
    .select("id")
    .eq("user_id", userId)
    .eq("name", name);
  const priorIds = (existing ?? []).map(r => r.id);
  if (priorIds.length) {
    await supabase.storage.from(BUCKET).remove(priorIds.map(pid => docPath(userId, pid)));
    await supabase.from("recent_docs").delete().eq("user_id", userId).in("id", priorIds);
  }

  // Upload the JSON blob.
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, new Blob([payload], { type: "application/json" }), { upsert: true });
  if (upErr) throw upErr;

  // Register in recent_docs.
  const entry = { id, user_id: userId, name, timestamp: Date.now(), chunks: 1 };
  const { error: insErr } = await supabase.from("recent_docs").insert(entry);
  if (insErr) {
    // Roll back the upload so we don't orphan a blob.
    await supabase.storage.from(BUCKET).remove([path]);
    throw insErr;
  }

  // Trim to MAX_RECENT_DOCS — fetch all this user's entries, drop anything
  // past the limit (oldest by timestamp).
  const { data: all } = await supabase
    .from("recent_docs")
    .select("id, timestamp")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false });
  const overflow = (all ?? []).slice(MAX_RECENT_DOCS);
  if (overflow.length) {
    const overflowIds = overflow.map(r => r.id);
    await supabase.storage.from(BUCKET).remove(overflowIds.map(oid => docPath(userId, oid)));
    await supabase.from("recent_docs").delete().eq("user_id", userId).in("id", overflowIds);
  }

  return { id, name, timestamp: entry.timestamp, chunks: 1 };
}

// Fetch a previously-uploaded doc's content. Returns null if missing or
// unparseable so callers can show a "no longer available" state instead
// of crashing.
//
// Side effect: updates last_accessed_at so the TTL clock resets. Without
// this, opening a doc you read every day would still get it deleted after
// 7 days from upload — the cleanup_expired_docs() cron job uses
// last_accessed_at, not the original timestamp. The update is fire-and-
// forget; a failure to refresh the timer doesn't block the read.
export async function cloudLoadDoc(userId, entry) {
  requireUserId(userId);
  const { data: blob, error } = await supabase.storage
    .from(BUCKET)
    .download(docPath(userId, entry.id));
  if (error || !blob) return null;
  // Refresh the last-access timestamp; ignore errors so a transient DB
  // hiccup doesn't break the user's read.
  supabase
    .from("recent_docs")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", entry.id)
    .then(({ error: upErr }) => {
      if (upErr) console.warn("[cloudDocs] failed to refresh last_accessed_at:", upErr.message);
    });
  try {
    const text = await blob.text();
    const d = JSON.parse(text);
    return { sections: d.sections, text: d.text, name: entry.name };
  } catch {
    return null;
  }
}

// Remove a doc entirely (storage object + recent_docs row).
export async function cloudRemoveDoc(userId, id) {
  requireUserId(userId);
  await supabase.storage.from(BUCKET).remove([docPath(userId, id)]);
  const { error } = await supabase.from("recent_docs").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}

// One-time migration: lift any docs from the previous localStorage layout
// into Supabase, then delete the localStorage entries. Safe to call on
// every load — if there's nothing in localStorage it returns immediately.
// Failures on individual entries don't abort the rest; partial migrations
// can resume on the next call (cloudSaveDoc dedups by name).
//
// Returns { migrated: number, failed: number } so callers can decide
// whether to surface anything to the user.
export async function migrateLocalToCloud(userId) {
  requireUserId(userId);

  // Run the unscoped-key sweep on every call — it's a one-time-per-browser
  // cleanup for pre-user-scoping leftovers and has to run even when there's
  // nothing to actually migrate (otherwise users with no legacy docs never
  // get the cleanup).
  storageGcUnscopedKeys();

  const recentRaw = await storageGet("readflow-recent");
  if (!recentRaw) return { migrated: 0, failed: 0 };

  let entries;
  try { entries = JSON.parse(recentRaw); } catch { entries = null; }
  if (!Array.isArray(entries) || entries.length === 0) {
    // Nothing to migrate but recent key exists — clean it up.
    await storageDel("readflow-recent");
    return { migrated: 0, failed: 0 };
  }

  let migrated = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      const n = entry.chunks || 1;
      const parts = [];
      let allRead = true;
      for (let c = 0; c < n; c++) {
        const v = await storageGet(`readflow-doc:${entry.id}:${c}`);
        if (v === null) { allRead = false; break; }
        parts.push(v);
      }
      if (!allRead) {
        // Partial chunks on disk — can't reconstruct, skip.
        failed++;
        continue;
      }

      const data = JSON.parse(parts.join(""));
      await cloudSaveDoc(userId, entry.name, data.sections, data.text);
      migrated++;

      // Clean up this doc's chunks now that it's safely in Supabase.
      for (let c = 0; c < n; c++) await storageDel(`readflow-doc:${entry.id}:${c}`);
      // Legacy single-key fallback (early useRecentDocs format).
      await storageDel(`readflow-doc:${entry.id}`);
    } catch (e) {
      console.warn(`[migration] failed to migrate "${entry.name}":`, e.message);
      failed++;
    }
  }

  // Always clean the recent-list key — anything still on disk is either
  // already migrated or unrecoverable, and leaving it would re-attempt
  // failed migrations forever.
  await storageDel("readflow-recent");

  // Sweep any remaining orphan chunks under this user's scope (covers the
  // pre-Phase-1 quota-death-spiral case where chunks accumulated without
  // a recent-list entry referencing them).
  storageGcOrphanChunks([]);

  return { migrated, failed };
}
