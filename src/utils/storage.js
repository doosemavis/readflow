// Storage adapter — swap this for IndexedDB, Supabase, etc. in production
let userPrefix = "";

export function setUserScope(userId) { userPrefix = `u:${userId}:`; }
export function clearUserScope() { userPrefix = ""; }

function scopedKey(key) { return `rf:${userPrefix}${key}`; }

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
