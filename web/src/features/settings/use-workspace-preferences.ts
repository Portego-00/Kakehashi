"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_WEB_SETTINGS, loadWebSettings, settingsStorageKey, WEB_SETTINGS_EVENT } from "./settings";

const serverSettingsSnapshot = JSON.stringify(DEFAULT_WEB_SETTINGS);

export function useWebSettings(username: string) {
  const subscribe = useCallback((onChange: () => void) => {
    const storage = (event: StorageEvent) => { if (event.key === settingsStorageKey(username)) onChange(); };
    window.addEventListener("storage", storage);
    window.addEventListener(WEB_SETTINGS_EVENT, onChange);
    return () => { window.removeEventListener("storage", storage); window.removeEventListener(WEB_SETTINGS_EVENT, onChange); };
  }, [username]);
  const getSnapshot = useCallback(() => JSON.stringify(loadWebSettings(window.localStorage, username)), [username]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => serverSettingsSnapshot);
  return useMemo(() => JSON.parse(snapshot) as typeof DEFAULT_WEB_SETTINGS, [snapshot]);
}

export function useWorkspacePreferences(username: string) {
  return useWebSettings(username).workspace;
}
