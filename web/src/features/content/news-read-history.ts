"use client";

import { useMemo, useSyncExternalStore } from "react";
import { readLocal, writeLocal } from "./storage";

const KEY = "news-read-history";
const EVENT = "kakehashi-news-read-change";

function readIds(): string[] {
  const value = readLocal<unknown>(KEY, []);
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : [];
}

function snapshot() {
  return JSON.stringify(readIds());
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key.endsWith(`:${KEY}`)) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, listener);
  };
}

export function setNewsRead(id: string, read: boolean) {
  const ids = new Set(readIds());
  if (ids.has(id) === read) return true;
  if (read) ids.add(id);
  else ids.delete(id);
  if (!writeLocal(KEY, [...ids])) return false;
  window.dispatchEvent(new Event(EVENT));
  return true;
}

export function useNewsReadHistory() {
  const value = useSyncExternalStore(subscribe, snapshot, () => "[]");
  return useMemo(() => new Set<string>(JSON.parse(value)), [value]);
}
