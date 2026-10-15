"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEMO_JPDB_KEY } from "@/features/demo/jpdb";
import { DEMO_USERNAME, isDemoMode } from "@/features/demo/runtime";
import { DEFAULT_WEB_SETTINGS, readWebSettings, settingsStorageKey, WEB_SETTINGS_EVENT, type WebSettings } from "./settings";

type WebSettingsState =
  | { status: "loading" | "error" }
  | { status: "ready"; settings: WebSettings };
const serverSnapshot = JSON.stringify({ status: "loading" });
const errorSnapshot = JSON.stringify({ status: "error" });

export function useWebSettingsState(username: string): WebSettingsState {
  const subscribe = useCallback((onChange: () => void) => {
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === settingsStorageKey(username)) onChange(); };
    const changed = (event: Event) => {
      const owner = (event as CustomEvent<{ username?: string }>).detail?.username;
      if (!owner || settingsStorageKey(owner) === settingsStorageKey(username)) onChange();
    };
    window.addEventListener("storage", storage);
    window.addEventListener(WEB_SETTINGS_EVENT, changed);
    return () => { window.removeEventListener("storage", storage); window.removeEventListener(WEB_SETTINGS_EVENT, changed); };
  }, [username]);
  const getSnapshot = useCallback(() => {
    try { return JSON.stringify({ status: "ready", settings: readWebSettings(window.localStorage, username) }); }
    catch { return errorSnapshot; }
  }, [username]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  return useMemo(() => JSON.parse(snapshot) as WebSettingsState, [snapshot]);
}

export function useWebSettings(username: string) {
  const state = useWebSettingsState(username);
  const settings = state.status === "ready" ? state.settings : DEFAULT_WEB_SETTINGS;
  const isDemo = isDemoMode() && username === DEMO_USERNAME;
  return useMemo(() => isDemo ? { ...settings, integrations: { ...settings.integrations, jpdbApiKey: DEMO_JPDB_KEY } } : settings, [settings, isDemo]);
}

export function useWorkspacePreferences(username: string) {
  return useWebSettings(username).workspace;
}
