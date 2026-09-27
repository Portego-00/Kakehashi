import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";
import type { NewsItem } from "../services/NhkNewsService";

const STORAGE_KEY = "kakehashi:news-read:v1";
let readIds: ReadonlySet<string> = new Set();
let loaded = false;
let loading: Promise<void> | undefined;
let writes = Promise.resolve();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function newsReadKey(item: Pick<NewsItem, "id" | "source">) {
  return item.id.startsWith(`${item.source}:`)
    ? item.id
    : `${item.source}:${item.id}`;
}

export function loadNewsReadHistory(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loading) {
    loading = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        let value: unknown;
        try {
          value = raw ? JSON.parse(raw) : [];
        } catch {
          value = [];
        }
        readIds = new Set(
          Array.isArray(value)
            ? value.filter((id): id is string => typeof id === "string")
            : [],
        );
        loaded = true;
        notify();
      })
      .finally(() => {
        loading = undefined;
      });
  }
  return loading;
}

// Serialize writes and finish hydration first so rapid taps cannot lose history.
export function setNewsRead(
  item: Pick<NewsItem, "id" | "source">,
  read: boolean,
) {
  const operation = writes.then(async () => {
    await loadNewsReadHistory();
    const key = newsReadKey(item);
    if (readIds.has(key) === read) return;
    const next = new Set(readIds);
    if (read) next.add(key);
    else next.delete(key);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    readIds = next;
    notify();
  });
  writes = operation.catch(() => undefined);
  return operation;
}

export function useNewsReadHistory() {
  const ids = useSyncExternalStore(
    subscribe,
    () => readIds,
    () => readIds,
  );
  useEffect(() => {
    void loadNewsReadHistory().catch((error) =>
      console.warn("Could not load news read history", error),
    );
  }, []);
  return ids;
}
