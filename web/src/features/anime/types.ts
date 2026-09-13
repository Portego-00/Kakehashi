export const ALL_ANIME_SOURCE = "*";
export const NO_ANIME_SOURCE = "!";

export type AnimeListProvider = "myanimelist" | "anilist";

export interface AnimeCatalogItem {
  id: string;
  title: string;
  malTitle: string | null;
  imageUrl: string | null;
  synopsis: string | null;
  score: number | null;
  episodes: number | null;
  mediaType: string | null;
  malId: number | null;
  aniListId: number | null;
}

export interface AnimeSyncResult {
  provider: AnimeListProvider;
  username: string;
  watched: number;
  matchedSources: string[];
}

export function isAllAnimeSelected(sources: string[]) {
  return sources.includes(ALL_ANIME_SOURCE);
}

export function hasSelectedAnime(sources: string[]) {
  return !sources.includes(NO_ANIME_SOURCE) && (isAllAnimeSelected(sources) || sources.length > 0);
}

export function selectedAnimeIds(sources: string[], catalog: AnimeCatalogItem[]) {
  if (isAllAnimeSelected(sources)) return catalog.map((anime) => anime.id);
  if (sources.includes(NO_ANIME_SOURCE)) return [];
  const available = new Set(catalog.map((anime) => anime.id));
  return [...new Set(sources.filter((source) => available.has(source)))];
}

export function normalizeAnimeSelection(ids: string[], catalog: AnimeCatalogItem[]) {
  const available = new Set(catalog.map((anime) => anime.id));
  const selected = [...new Set(ids.filter((id) => available.has(id)))];
  if (catalog.length > 0 && selected.length === catalog.length) return [ALL_ANIME_SOURCE];
  return selected.length > 0 ? selected : [NO_ANIME_SOURCE];
}

export function toggleAnimeSelection(sources: string[], animeId: string, catalog: AnimeCatalogItem[]) {
  const selected = new Set(selectedAnimeIds(sources, catalog));
  if (selected.has(animeId)) selected.delete(animeId);
  else selected.add(animeId);
  return normalizeAnimeSelection([...selected], catalog);
}

export function formatAnimeMediaType(value: string | null) {
  if (!value) return null;
  const labels: Record<string, string> = { tv: "TV", movie: "Movie", ova: "OVA", ona: "ONA", special: "Special", music: "Music", tv_special: "TV special" };
  return labels[value] ?? value.toLocaleUpperCase();
}
