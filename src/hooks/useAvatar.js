import { useState, useEffect } from "react";
import { storageGet, storageSet, storageDel } from "../utils/storage";

export function useAvatar(userId) {
  const [avatar, setAvatar] = useState(null);

  useEffect(() => {
    if (!userId) { setAvatar(null); return; }
    storageGet("avatar").then(val => {
      if (!val) { setAvatar(null); return; }
      try { setAvatar(JSON.parse(val)); } catch { setAvatar(null); }
    });
  }, [userId]);

  const saveAvatar = async (avatarObj) => {
    setAvatar(avatarObj);
    await storageSet("avatar", JSON.stringify(avatarObj));
  };

  const clearAvatar = async () => {
    setAvatar(null);
    await storageDel("avatar");
  };

  return { avatar, saveAvatar, clearAvatar };
}
