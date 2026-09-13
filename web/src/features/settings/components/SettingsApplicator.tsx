"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/session";
import { migrateLegacyJitaiFonts } from "../jitai";
import { applyWebSettings, loadWebSettings, saveWebSettings, settingsStorageKey, WEB_SETTINGS_EVENT } from "../settings";

export function SettingsApplicator() {
  const { user } = useSession();
  const username = user?.data.username;
  useEffect(() => {
    if (!username) return;
    const apply = () => {
      const settings = loadWebSettings(window.localStorage, username);
      applyWebSettings(settings);
      void migrateLegacyJitaiFonts(settings.study.jitaiCustomFonts).then((migrated) => {
        if (migrated) saveWebSettings(window.localStorage, username, settings);
      }).catch(() => undefined);
    };
    const onStorage = (event: StorageEvent) => { if (event.key === settingsStorageKey(username)) apply(); };
    apply();
    window.addEventListener("storage", onStorage);
    window.addEventListener(WEB_SETTINGS_EVENT, apply);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(WEB_SETTINGS_EVENT, apply); };
  }, [username]);
  return null;
}
