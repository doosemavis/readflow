import { useState, useCallback, useEffect, useRef } from "react";
import { MAX_RECENT_DOCS } from "../config/constants";
import { storageGet, storageSet, storageDel } from "../utils/storage";

const CHUNK = 3_500_000;

async function deleteChunks(id, chunks) {
  for (let c = 0; c < (chunks || 1); c++) await storageDel(`readflow-doc:${id}:${c}`);
  await storageDel(`readflow-doc:${id}`);
}

export function useRecentDocs() {
  const [recentList, setRecentList] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef([]);

  useEffect(() => { listRef.current = recentList; }, [recentList]);

  useEffect(() => {
    (async () => {
      const val = await storageGet("readflow-recent");
      if (val) { try { const p = JSON.parse(val); setRecentList(p); listRef.current = p; } catch {} }
      setLoaded(true);
    })();
  }, []);

  const saveDoc = useCallback(async (name, sections, fullText) => {
    const id = name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40) + "_" + Date.now().toString(36);
    const prev = listRef.current.find(r => r.name === name);
    if (prev) await deleteChunks(prev.id, prev.chunks);

    const payload = JSON.stringify({ sections, text: fullText });
    const numChunks = Math.ceil(payload.length / CHUNK);
    let ok = true;
    for (let c = 0; c < numChunks; c++) {
      if (!(await storageSet(`readflow-doc:${id}:${c}`, payload.slice(c * CHUNK, (c + 1) * CHUNK)))) { ok = false; break; }
    }
    if (!ok) { await deleteChunks(id, numChunks); return null; }

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
