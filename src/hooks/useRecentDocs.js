import { useState, useCallback, useEffect, useRef } from "react";
import { MAX_RECENT_DOCS } from "../config/constants";
import { storageGet, storageSet, storageDel, storageGcOrphanChunks } from "../utils/storage";

const CHUNK = 3_500_000;

async function deleteChunks(id, chunks) {
  for (let c = 0; c < (chunks || 1); c++) await storageDel(`readflow-doc:${id}:${c}`);
  await storageDel(`readflow-doc:${id}`);
}

export function useRecentDocs(authReady) {
  const [recentList, setRecentList] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef([]);

  useEffect(() => { listRef.current = recentList; }, [recentList]);

  // Wait for auth to settle before the initial read. AuthContext sets the
  // storage scope (rf:u:UUID:) once auth resolves; reading earlier would land
  // on the unscoped key and miss the user's docs. Effect runs exactly once
  // when authReady flips false→true, so it never races with saveDoc's
  // multi-await chunk writes.
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      const val = await storageGet("readflow-recent");
      if (cancelled) return;
      let list = [];
      if (val) {
        try { list = JSON.parse(val) || []; }
        catch { /* leave list as [] on parse error */ }
      }
      setRecentList(list); listRef.current = list;
      // Sweep any chunks left behind from previous saves whose entries are no
      // longer in the list. Without this, localStorage fills up over time and
      // future saveDoc chunk writes fail silently with QuotaExceededError.
      storageGcOrphanChunks(list.map(r => r.id));
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [authReady]);

  const saveDoc = useCallback(async (name, sections, fullText) => {
    const id = name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40) + "_" + Date.now().toString(36);
    const prev = listRef.current.find(r => r.name === name);
    if (prev) await deleteChunks(prev.id, prev.chunks);

    // Reclaim space from any orphan chunks not in the current list before
    // attempting the new write. Cheaper than discovering quota mid-loop.
    storageGcOrphanChunks(listRef.current.map(r => r.id));

    const payload = JSON.stringify({ sections, text: fullText });
    const numChunks = Math.ceil(payload.length / CHUNK);
    let ok = true;
    for (let c = 0; c < numChunks; c++) {
      if (!(await storageSet(`readflow-doc:${id}:${c}`, payload.slice(c * CHUNK, (c + 1) * CHUNK)))) { ok = false; break; }
    }
    if (!ok) {
      await deleteChunks(id, numChunks);
      throw new Error("Storage is full. Remove some recent documents to free up space.");
    }

    const entry = { id, name, timestamp: Date.now(), chunks: numChunks };
    const updated = [entry, ...listRef.current.filter(r => r.name !== name)].slice(0, MAX_RECENT_DOCS);
    listRef.current = updated;
    setRecentList(updated);
    await storageSet("readflow-recent", JSON.stringify(updated));
    return id;
  }, []);

  const loadDoc = useCallback(async (entry) => {
    const n = entry.chunks || 1;
    const parts = [];
    for (let c = 0; c < n; c++) {
      const val = await storageGet(`readflow-doc:${entry.id}:${c}`);
      if (val !== null) { parts.push(val); }
      else {
        if (n === 1) { const leg = await storageGet(`readflow-doc:${entry.id}`); if (leg) { parts.push(leg); break; } }
        return null;
      }
    }
    try { const d = JSON.parse(parts.join("")); return { sections: d.sections, text: d.text, name: entry.name }; }
    catch { return null; }
  }, []);

  const removeDoc = useCallback(async (id) => {
    const entry = listRef.current.find(r => r.id === id);
    await deleteChunks(id, entry?.chunks);
    const updated = listRef.current.filter(r => r.id !== id);
    listRef.current = updated;
    setRecentList(updated);
    await storageSet("readflow-recent", JSON.stringify(updated));
  }, []);

  return { recentList, loaded, saveDoc, loadDoc, removeDoc };
}
