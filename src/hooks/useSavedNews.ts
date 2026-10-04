import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";
import { normalizeCachedNewsItems, type NewsItem } from "../services/NhkNewsService";
import { newsReadKey } from "./useNewsReadHistory";

const STORAGE_KEY = "kakehashi:news-saved:v1";
let articles: readonly NewsItem[] = [];
let loaded = false;
let loading: Promise<void> | undefined;
let writes = Promise.resolve();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function loadSavedNews(): Promise<readonly NewsItem[]> {
  if (loaded) return Promise.resolve(articles);
  if (!loading) {
    loading = AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      let value: unknown;
      try { value = raw ? JSON.parse(raw) : []; } catch { value = []; }
      articles = normalizeCachedNewsItems(value, "easy");
      loaded = true;
      notify();
    }).finally(() => { loading = undefined; });
  }
  return loading.then(() => articles);
}

export function setNewsSaved(item: NewsItem, saved: boolean) {
  const operation = writes.then(async () => {
    await loadSavedNews();
    const remaining = articles.filter((article) => newsReadKey(article) !== newsReadKey(item));
    const next = saved ? [{ ...item, id: newsReadKey(item) }, ...remaining] : remaining;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    articles = next;
    notify();
  });
  writes = operation.catch(() => undefined);
  return operation;
}

export function useSavedNews() {
  const saved = useSyncExternalStore(subscribe, () => articles, () => articles);
  useEffect(() => {
    void loadSavedNews().catch((error) => console.warn("Could not load saved news", error));
  }, []);
  return saved;
}
