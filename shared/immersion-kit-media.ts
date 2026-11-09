const MEDIA_BASE = "https://immersionkit.s3.bhs.io.cloud.ovh.net/media/";
const LEGACY_MEDIA_BASE = "https://us-southeast-1.linodeobjects.com/immersionkit/media/";

export function immersionKitMediaUrl(category: string, folder: string, filename?: string) {
  if (!filename) return undefined;
  return `${MEDIA_BASE}${category}/${encodeURIComponent(folder)}/media/${encodeURIComponent(filename)}`;
}

export function migrateImmersionKitMediaUrl(url?: string) {
  return typeof url === "string" && url.startsWith(LEGACY_MEDIA_BASE)
    ? MEDIA_BASE + url.slice(LEGACY_MEDIA_BASE.length)
    : url;
}
