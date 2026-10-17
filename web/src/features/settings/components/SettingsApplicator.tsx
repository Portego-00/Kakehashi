"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/session";
import { migrateLegacyJitaiFonts } from "../jitai";
import { applyWebSettings, readWebSettings, saveWebSettings, settingsStorageKey, WEB_SETTINGS_EVENT } from "../settings";

export function SettingsApplicator() {
  const { user } = useSession();
  const username = user?.data.username;
  useEffect(() => {
    if (!username) return;
    let active = true;
    let revision = 0;
    const key = settingsStorageKey(username);
    const apply = () => {
      const expectedRevision = ++revision;
      try {
        const raw = window.localStorage.getItem(key);
        const settings = readWebSettings({ getItem: () => raw }, username);
        applyWebSettings(settings);
        void migrateLegacyJitaiFonts(settings.study.jitaiCustomFonts).then((migrated) => {
          if (!migrated || !active || expectedRevision !== revision) return;
          // Migration only removes inline font data from the snapshot it actually migrated.
          if (window.localStorage.getItem(key) === raw) saveWebSettings(window.localStorage, username, settings);
        }).catch(() => undefined);
      } catch { /* Preserve the applied appearance when saved settings cannot be read. */ }
    };
    const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === key) apply(); };
    const onChange = (event: Event) => {
      const owner = (event as CustomEvent<{ username?: string }>).detail?.username;
      if (!owner || settingsStorageKey(owner) === key) apply();
    };
    apply();
    window.addEventListener("storage", onStorage);
    window.addEventListener(WEB_SETTINGS_EVENT, onChange);
    return () => { active = false; window.removeEventListener("storage", onStorage); window.removeEventListener(WEB_SETTINGS_EVENT, onChange); };
  }, [username]);
  return null;
}
