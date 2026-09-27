export const COMMUNITY_IMAGE_MAX_BYTES = 4_000_000;
export const COMMUNITY_IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp,image/avif,image/heic,image/heif,.heic,.heif";
export const COMMUNITY_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/heic", "image/heif"]);

export function isHeicUrl(value: string) {
  try { return /\.hei[cf]$/i.test(new URL(value).pathname); } catch { return false; }
}

export function communityImageSource(url: string) {
  return isHeicUrl(url) ? `/community/media?url=${encodeURIComponent(url)}` : url;
}
