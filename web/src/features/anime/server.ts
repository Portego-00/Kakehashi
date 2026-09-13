import "server-only";
import catalogData from "./catalog-data.generated.json";
import type { AnimeCatalogItem, AnimeListProvider, AnimeSyncResult } from "./types";

const IMMERSION_KIT_API = "https://apiv2.immersionkit.com";
const MY_ANIME_LIST_API = process.env.MAL_API_BASE_URL?.trim() || process.env.EXPO_PUBLIC_MAL_API_BASE_URL?.trim() || "https://api.myanimelist.net/v2";
const ANI_LIST_API = "https://graphql.anilist.co";
const WATCHED_MAL_STATUSES = new Set(["watching", "completed", "rewatching"]);
const WATCHED_ANI_LIST_STATUSES = new Set(["CURRENT", "COMPLETED", "REPEATING"]);

type AnimeMetadata = { malId?: number; title?: string; imageUrl?: string | null; synopsis?: string | null; score?: number | null; episodes?: number | null; mediaType?: string | null };
type AnimeIdMapping = { malId?: number; aniListId?: number };
type IndexMetadata = Record<string, { title?: string; category?: string }>;
type WatchedList = { ids: Set<number>; malIds?: Set<number>; normalizedTitles: Set<string> };

const metadata = catalogData.metadata as Record<string, AnimeMetadata>;
const mappings = catalogData.mappings as Record<string, AnimeIdMapping>;
let catalogPromise: Promise<AnimeCatalogItem[]> | null = null;

export class AnimeSyncError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
    this.name = "AnimeSyncError";
  }
}

function fallbackTitle(id: string) {
  return id.split("_").filter(Boolean).map((word) => word[0]?.toLocaleUpperCase() + word.slice(1)).join(" ");
}

export function buildAnimeCatalog(index: IndexMetadata): AnimeCatalogItem[] {
  const upstreamAnime = Object.entries(index).filter(([id, item]) => item.category === "anime" && id !== "hunter_x_hunter");
  const entries = upstreamAnime.length > 0 ? upstreamAnime : Object.keys(metadata).map((id) => [id, { category: "anime" }] as const);
  return entries.map(([id, item]) => {
    const info = metadata[id];
    const mapping = mappings[id];
    return {
      id,
      title: ("title" in item ? item.title?.trim() : "") || info?.title?.trim() || fallbackTitle(id),
      malTitle: info?.title?.trim() || null,
      imageUrl: info?.imageUrl ?? null,
      synopsis: info?.synopsis?.trim() || null,
      score: info?.score ?? null,
      episodes: info?.episodes ?? null,
      mediaType: info?.mediaType ?? null,
      malId: mapping?.malId ?? info?.malId ?? null,
      aniListId: mapping?.aniListId ?? null,
    };
  }).sort((left, right) => left.title.localeCompare(right.title));
}

export function getAnimeCatalog() {
  catalogPromise ??= fetch(`${IMMERSION_KIT_API}/index_meta`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: 86_400 },
  }).then(async (response) => {
    if (!response.ok) throw new Error(`ImmersionKit returned ${response.status}.`);
    const payload = await response.json() as { data?: IndexMetadata };
    return buildAnimeCatalog(payload.data ?? {});
  }).catch(() => buildAnimeCatalog({}));
  return catalogPromise;
}

export function normalizeAnimeTitle(title: string) {
  return title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
}

function addTitle(target: Set<string>, value: unknown) {
  if (typeof value !== "string") return;
  const normalized = normalizeAnimeTitle(value.trim());
  if (normalized) target.add(normalized);
}

async function fetchMyAnimeList(username: string): Promise<WatchedList> {
  const clientId = process.env.MAL_CLIENT_ID?.trim() || process.env.EXPO_PUBLIC_MAL_CLIENT_ID?.trim();
  if (!clientId) throw new AnimeSyncError("MyAnimeList sync is not configured on this Kakehashi server.", 503);
  let url: string | null = `${MY_ANIME_LIST_API}/users/${encodeURIComponent(username)}/animelist?limit=100&fields=list_status,alternative_titles,title,title_english,title_japanese`;
  const ids = new Set<number>();
  const normalizedTitles = new Set<string>();
  for (let page = 0; url && page < 30; page += 1) {
    const response = await fetch(url, { headers: { "X-MAL-CLIENT-ID": clientId, Accept: "application/json" }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (response.status === 403 || response.status === 404) throw new AnimeSyncError("That MyAnimeList profile could not be found or is private.", 404);
    if (!response.ok) throw new AnimeSyncError(`MyAnimeList sync failed (${response.status}).`);
    const payload = await response.json() as { data?: Array<{ node?: { id?: number; title?: string; title_english?: string; title_japanese?: string; alternative_titles?: { en?: string; ja?: string; synonyms?: string[] } }; list_status?: { status?: string } }>; paging?: { next?: string } };
    for (const entry of payload.data ?? []) {
      const status = entry.list_status?.status;
      if (status && !WATCHED_MAL_STATUSES.has(status)) continue;
      if (typeof entry.node?.id === "number") ids.add(entry.node.id);
      addTitle(normalizedTitles, entry.node?.title);
      addTitle(normalizedTitles, entry.node?.title_english);
      addTitle(normalizedTitles, entry.node?.title_japanese);
      addTitle(normalizedTitles, entry.node?.alternative_titles?.en);
      addTitle(normalizedTitles, entry.node?.alternative_titles?.ja);
      entry.node?.alternative_titles?.synonyms?.forEach((title) => addTitle(normalizedTitles, title));
    }
    const next = payload.paging?.next;
    if (!next) url = null;
    else {
      const parsed = new URL(next);
      if (parsed.origin !== new URL(MY_ANIME_LIST_API).origin) throw new AnimeSyncError("MyAnimeList returned an invalid paging link.");
      url = parsed.toString();
    }
  }
  return { ids, normalizedTitles };
}

const ANI_LIST_QUERY = `query ($userName: String) { MediaListCollection(userName: $userName, type: ANIME) { lists { entries { status media { id idMal title { romaji english native } synonyms } } } } }`;

async function fetchAniList(username: string): Promise<WatchedList> {
  const response = await fetch(ANI_LIST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: ANI_LIST_QUERY, variables: { userName: username } }),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) throw new AnimeSyncError(`AniList sync failed (${response.status}).`, response.status === 404 ? 404 : 502);
  const payload = await response.json() as { data?: { MediaListCollection?: { lists?: Array<{ entries?: Array<{ status?: string; media?: { id?: number; idMal?: number; title?: { romaji?: string; english?: string; native?: string }; synonyms?: string[] } }> }> } }; errors?: Array<{ message?: string }> };
  if (payload.errors?.length) throw new AnimeSyncError(payload.errors[0]?.message || "That AniList profile could not be loaded.", 404);
  const ids = new Set<number>();
  const malIds = new Set<number>();
  const normalizedTitles = new Set<string>();
  for (const list of payload.data?.MediaListCollection?.lists ?? []) {
    for (const entry of list.entries ?? []) {
      if (entry.status && !WATCHED_ANI_LIST_STATUSES.has(entry.status)) continue;
      if (typeof entry.media?.id === "number") ids.add(entry.media.id);
      if (typeof entry.media?.idMal === "number") malIds.add(entry.media.idMal);
      addTitle(normalizedTitles, entry.media?.title?.romaji);
      addTitle(normalizedTitles, entry.media?.title?.english);
      addTitle(normalizedTitles, entry.media?.title?.native);
      entry.media?.synonyms?.forEach((title) => addTitle(normalizedTitles, title));
    }
  }
  return { ids, malIds, normalizedTitles };
}

export function matchAnimeCatalog(provider: AnimeListProvider, watched: WatchedList, catalog: AnimeCatalogItem[]) {
  return catalog.filter((anime) => {
    const providerId = provider === "myanimelist" ? anime.malId : anime.aniListId;
    if (providerId !== null && watched.ids.has(providerId)) return true;
    if (provider === "anilist" && anime.malId !== null && watched.malIds?.has(anime.malId)) return true;
    return [anime.title, anime.malTitle, anime.id].some((title) => title && watched.normalizedTitles.has(normalizeAnimeTitle(title)));
  }).map((anime) => anime.id);
}

export async function syncWatchedAnime(provider: AnimeListProvider, username: string): Promise<AnimeSyncResult> {
  const [watched, catalog] = await Promise.all([provider === "myanimelist" ? fetchMyAnimeList(username) : fetchAniList(username), getAnimeCatalog()]);
  return { provider, username, watched: watched.ids.size, matchedSources: matchAnimeCatalog(provider, watched, catalog) };
}
