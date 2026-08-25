const NEWS_IMAGE_BASE = "https://nhkeasier.com/";
const NEWS_IMAGE_HOSTS = new Set([
  "nhkeasier.com",
  "www.nhkeasier.com",
  "www3.nhk.or.jp",
  "www.nhk.or.jp",
  "img.web.nhk",
  "imgu.web.nhk",
  "img.embed.nhk",
]);

function isAllowedNewsImageHost(hostname: string) {
  const normalized = hostname.toLocaleLowerCase();
  return NEWS_IMAGE_HOSTS.has(normalized)
    || normalized.endsWith(".img.web.nhk")
    || normalized.endsWith(".imgu.web.nhk")
    || normalized.endsWith(".nhk.or.jp");
}

function decodeAttribute(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .trim();
}

function unwrapLocalProxy(value: string) {
  try {
    const parsed = new URL(value, "https://kakehashi.invalid");
    if (parsed.hostname === "kakehashi.invalid" && parsed.pathname === "/news/image") {
      return parsed.searchParams.get("url") || "";
    }
  } catch {
    return "";
  }
  return value;
}

export function normalizeNewsImageUrl(value: string | null | undefined, baseUrl = NEWS_IMAGE_BASE) {
  if (!value?.trim()) return undefined;
  const unwrapped = unwrapLocalProxy(decodeAttribute(value));
  if (!unwrapped) return undefined;
  try {
    const base = new URL(baseUrl, NEWS_IMAGE_BASE);
    const url = new URL(unwrapped.startsWith("//") ? `https:${unwrapped}` : unwrapped, base);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return undefined;
    url.hash = "";
    return isAllowedNewsImageHost(url.hostname) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function proxyNewsImageUrl(value: string | null | undefined, baseUrl = NEWS_IMAGE_BASE) {
  const normalized = normalizeNewsImageUrl(value, baseUrl);
  return normalized ? `/news/image?url=${encodeURIComponent(normalized)}` : undefined;
}
