import decks from "./immersion-kit-decks.json";

const MEDIA_BASE = "https://immersionkit.s3.bhs.io.cloud.ovh.net/media/";
const LEGACY_MEDIA_BASE = "https://us-southeast-1.linodeobjects.com/immersionkit/media/";

// Folder names from ImmersionKit's public /index_meta response, used if the live index is unavailable.
export const immersionKitDecks: Readonly<Record<string, { title: string; category: string }>> = decks;

export function immersionKitSingleDeckQuery(sources: readonly string[] | null | undefined) {
  const source = sources?.length === 1 ? sources[0] : undefined;
  return source && Object.hasOwn(immersionKitDecks, source) ? `&index=${encodeURIComponent(source)}` : "";
}

export function immersionKitMediaUrl(category: string, folder: string, filename?: string) {
  if (!filename) return undefined;
  return `${MEDIA_BASE}${category}/${encodeURIComponent(folder)}/media/${encodeURIComponent(filename)}`;
}

export function retryImmersionKitMediaUrl(url: string) {
  const currentUrl = migrateImmersionKitMediaUrl(url) ?? url;
  if (!currentUrl.startsWith(MEDIA_BASE)) return currentUrl;
  const separator = currentUrl.includes("?") ? "&" : "?";
  return `${currentUrl}${separator}retry=${Date.now()}`;
}

export function migrateImmersionKitMediaUrl(url?: string) {
  return typeof url === "string" && url.startsWith(LEGACY_MEDIA_BASE)
    ? MEDIA_BASE + url.slice(LEGACY_MEDIA_BASE.length)
    : url;
}
