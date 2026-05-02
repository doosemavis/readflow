import { useCallback, useEffect, useState } from "react";
import { storageGet, storageSet, storageDel } from "../utils/storage";

const PERSIST_KEY = "theme-persist";
const THEME_KEY = "theme";

// User-scoped opt-in: when `persistEnabled` is true the active theme is
// written to storage on every change and restored on next login. When false
// the theme behaves transiently (resets to the app default each session).
export function useThemePreference(userId) {
  const [persistEnabled, setPersistEnabled] = useState(false);
  const [savedTheme, setSavedTheme] = useState(null);

  useEffect(() => {
    if (!userId) {
      setPersistEnabled(false);
      setSavedTheme(null);
      return;
    }
    Promise.all([storageGet(PERSIST_KEY), storageGet(THEME_KEY)]).then(([p, th]) => {
      setPersistEnabled(p === "true");
      setSavedTheme(th);
    });
  }, [userId]);

  const togglePersist = useCallback(async (next, currentTheme) => {
    if (!userId) return;
    setPersistEnabled(next);
    await storageSet(PERSIST_KEY, String(next));
    if (next && currentTheme) {
      await storageSet(THEME_KEY, currentTheme);
      setSavedTheme(currentTheme);
    } else if (!next) {
      await storageDel(THEME_KEY);
      setSavedTheme(null);
    }
  }, [userId]);

  const saveTheme = useCallback(async (theme) => {
    if (!userId || !persistEnabled) return;
    await storageSet(THEME_KEY, theme);
    setSavedTheme(theme);
  }, [userId, persistEnabled]);

  return { persistEnabled, savedTheme, togglePersist, saveTheme };
}
