"use client";

import { useMemo, useSyncExternalStore } from "react";
import { normalizeCachedArticle } from "./news-cache";
import { readLocal, writeLocal } from "./storage";
import type { NewsArticle } from "./types";

const KEY = "news-saved-articles";
const EVENT = "kakehashi-news-saved-change";

export function readSavedNews(): NewsArticle[] {
  const value = readLocal<unknown>(KEY, []);
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const article = normalizeCachedArticle(item, "easy");
    return article ? [article] : [];
  });
}

export function setNewsSaved(article: NewsArticle, saved: boolean) {
  const articles = readSavedNews();
  const remaining = articles.filter((item) => item.id !== article.id);
  // Keep the complete article snapshot separately from the rotating feed cache.
  const next = saved ? [article, ...remaining] : remaining;
  if (!writeLocal(KEY, next)) return false;
  window.dispatchEvent(new Event(EVENT));
  return true;
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

export function useSavedNews() {
  const value = useSyncExternalStore(subscribe, () => JSON.stringify(readSavedNews()), () => "[]");
  return useMemo<NewsArticle[]>(() => JSON.parse(value), [value]);
}
