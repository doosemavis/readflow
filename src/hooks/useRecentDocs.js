import { useState, useCallback, useEffect } from "react";
import { cloudListRecent, cloudSaveDoc, cloudLoadDoc, cloudRemoveDoc, migrateLocalToCloud } from "../utils/cloudDocs";

// Recent-docs index, backed by Supabase (recent_docs table + documents
// storage bucket). userId is passed in by the caller (from useAuth's
// settled user); cloudDocs uses it directly instead of calling
// supabase.auth.getUser(), which triggers a token refresh that fails
// against this project's `sb_publishable_` key and silently signs the
// user out on page load. authReady gates the initial fetch so we don't
// query Supabase before the session has been restored.
export function useRecentDocs(authReady, userId) {
  const [recentList, setRecentList] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    if (!userId) {
      setRecentList([]); setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // One-time migration of pre-Supabase localStorage docs into the
        // cloud. No-op once the localStorage entries are gone, so this
        // is cheap on every subsequent load.
        const result = await migrateLocalToCloud(userId);
        if (result.migrated || result.failed) {
          console.info(`[migration] localStorage→Supabase: migrated=${result.migrated} failed=${result.failed}`);
        }
        const list = await cloudListRecent(userId);
        if (!cancelled) setRecentList(list);
      } catch (e) {
        if (!cancelled) console.warn("Failed to load recent docs:", e.message);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [authReady, userId]);

  const saveDoc = useCallback(async (name, sections, fullText) => {
    if (!userId) throw new Error("Not signed in");
    await cloudSaveDoc(userId, name, sections, fullText);
    // Refresh from the server — cloudSaveDoc handles dedup-by-name and
    // trim-to-MAX_RECENT_DOCS server-side, so the authoritative state
    // lives there. Cheaper than rebuilding the same logic client-side.
    const list = await cloudListRecent(userId);
    setRecentList(list);
  }, [userId]);

  const loadDoc = useCallback(async (entry) => {
    if (!userId) return null;
    return cloudLoadDoc(userId, entry);
  }, [userId]);

  const removeDoc = useCallback(async (id) => {
    if (!userId) return;
    await cloudRemoveDoc(userId, id);
    const list = await cloudListRecent(userId);
    setRecentList(list);
  }, [userId]);

  return { recentList, loaded, saveDoc, loadDoc, removeDoc };
}
