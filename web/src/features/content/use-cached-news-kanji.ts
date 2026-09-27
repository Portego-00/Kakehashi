"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { readLocal, writeLocal } from "./storage";

const CHANGE_EVENT = "kakehashi-news-known-kanji-change";

// Cache the small set of known characters, so new or updated stories can also
// calculate their percentages before the full study dataset finishes loading.
function cacheKey(account: string) {
  return `news-known-kanji-v1:${encodeURIComponent(account)}`;
}

function readSnapshot(key: string | null) {
  if (!key) return "null";
  try {
    const value = readLocal<unknown>(key, null);
    if (!Array.isArray(value) || value.length > 10000 ||
      !value.every((character) => typeof character === "string" && character.length > 0 && character.length <= 8)) {
      return "null";
    }
    return JSON.stringify(value);
  } catch {
    // Storage may be disabled. Live study data still provides percentages.
    return "null";
  }
}

export function useCachedNewsKanji(account: string | null, fresh: Set<string> | null) {
  const key = account ? cacheKey(account) : null;
  const subscribe = useCallback((onChange: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key || (key && event.key.endsWith(`:${key}`))) onChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, [key]);
  const getSnapshot = useCallback(() => readSnapshot(key), [key]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "null");
  const cached = useMemo(() => {
    const characters: string[] | null = JSON.parse(snapshot);
    return characters ? new Set(characters) : null;
  }, [snapshot]);

  useEffect(() => {
    if (!key || !fresh) return;
    const characters = [...fresh].sort();
    if (JSON.stringify(characters) === readSnapshot(key)) return;
    try {
      if (writeLocal(key, characters)) window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // Cache failures must not interrupt news or replace live percentages.
    }
  }, [key, fresh]);

  return key ? fresh ?? cached : null;
}
