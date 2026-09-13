"use client";

import { useSyncExternalStore } from "react";

const key = "kakehashi:anki-export:enabled:v1";
const changed = "kakehashi:anki-export:changed";

function enabled() {
  try { return localStorage.getItem(key) === "true"; }
  catch { return false; }
}

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) notify(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener(changed, notify);
  return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(changed, notify); };
}

export function useAnkiExportEnabled() {
  return useSyncExternalStore(subscribe, enabled, () => false);
}

export function setAnkiExportEnabled(value: boolean) {
  localStorage.setItem(key, String(value));
  window.dispatchEvent(new Event(changed));
}
