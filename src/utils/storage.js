// Storage adapter — swap this for IndexedDB, Supabase, etc. in production
let userPrefix = "";

export function setUserScope(userId) { userPrefix = `u:${userId}:`; }
export function clearUserScope() { userPrefix = ""; }

function scopedKey(key) { return `rf:${userPrefix}${key}`; }

// Sweep `rf:KEY` keys (no user scope) left over from before user-scoping
// was introduced. Pre-scoping artifact; current code always writes
// `rf:u:UUID:KEY`. Safe to call on every load — only removes keys outside
// the scope namespace.
export function storageGcUnscopedKeys() {
  const toDelete = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("rf:") && !k.startsWith("rf:u:")) toDelete.push(k);
  }
  for (const k of toDelete) { try { localStorage.removeItem(k); } catch {} }
  return toDelete.length;
}

// Garbage-collect document chunks under the current scope whose ID isn't in
// validIds. Returns the count of removed keys. This is what keeps localStorage
// from filling up with chunks for docs no longer in the recent list — without
// it, every save accumulates ~MB and eventually saves silently fail with
// QuotaExceededError, which manifests as "the list won't grow".
export function storageGcOrphanChunks(validIds) {
  const validSet = new Set(validIds);
  const prefix = `rf:${userPrefix}readflow-doc:`;
  const toDelete = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) {
      const tail = k.substring(prefix.length);
      const id = tail.split(":")[0];
      if (!validSet.has(id)) toDelete.push(k);
    }
  }
  for (const k of toDelete) { try { localStorage.removeItem(k); } catch {} }
  return toDelete.length;
}

const storageAdapter = {
  async get(key) {
    try {
      const val = localStorage.getItem(scopedKey(key));
      return val !== null ? { value: val } : null;
    } catch { return null; }
  },
  async set(key, value) {
    try { localStorage.setItem(scopedKey(key), value); return { key, value }; }
    catch { return null; }
  },
  async delete(key) {
    try { localStorage.removeItem(scopedKey(key)); return { key, deleted: true }; }
    catch { return null; }
  },
};

export async function storageGet(key) {
  try { const r = await storageAdapter.get(key); return r?.value ?? null; } catch { return null; }
}
export async function storageSet(key, value) {
  try { const r = await storageAdapter.set(key, value); return r !== null; } catch { return false; }
}
export async function storageDel(key) {
  try { await storageAdapter.delete(key); } catch {}
}
