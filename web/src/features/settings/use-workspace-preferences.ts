"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEMO_JPDB_KEY } from "@/features/demo/jpdb";
import { DEMO_USERNAME, isDemoMode } from "@/features/demo/runtime";
import { DEFAULT_WEB_SETTINGS, loadWebSettings, settingsStorageKey, WEB_SETTINGS_EVENT } from "./settings";

const serverSettingsSnapshot = JSON.stringify(DEFAULT_WEB_SETTINGS);

export function useWebSettings(username: string) {
  const isDemo = isDemoMode() && username === DEMO_USERNAME;
  const subscribe = useCallback((onChange: () => void) => {
    const storage = (event: StorageEvent) => { if (event.key === settingsStorageKey(username)) onChange(); };
    window.addEventListener("storage", storage);
    window.addEventListener(WEB_SETTINGS_EVENT, onChange);
    return () => { window.removeEventListener("storage", storage); window.removeEventListener(WEB_SETTINGS_EVENT, onChange); };
  }, [username]);
  const getSnapshot = useCallback(() => JSON.stringify(loadWebSettings(window.localStorage, username)), [username]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => serverSettingsSnapshot);
  return useMemo(() => {
    const settings = JSON.parse(snapshot) as typeof DEFAULT_WEB_SETTINGS;
    return isDemo ? { ...settings, integrations: { ...settings.integrations, jpdbApiKey: DEMO_JPDB_KEY } } : settings;
  }, [snapshot, isDemo]);
}

export function useWorkspacePreferences(username: string) {
  return useWebSettings(username).workspace;
}
