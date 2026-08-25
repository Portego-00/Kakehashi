import type { AnimeCatalogItem, AnimeListProvider, AnimeSyncResult } from "./types";

async function responsePayload<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

export async function fetchAnimeCatalog(signal?: AbortSignal) {
  const response = await fetch("/api/anime/catalog", { signal });
  const payload = await responsePayload<{ anime: AnimeCatalogItem[] }>(response);
  return payload.anime;
}

export async function syncAnimeList(provider: AnimeListProvider, username: string) {
  const response = await fetch("/api/anime/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, username }),
  });
  return responsePayload<AnimeSyncResult>(response);
}
