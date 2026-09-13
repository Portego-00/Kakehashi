const NEWS_AUDIO_BASE = "https://nhkeasier.com/";

function isAllowedNewsAudioHost(hostname: string) {
  const normalized = hostname.toLocaleLowerCase();
  return normalized === "nhkeasier.com" || normalized === "www.nhkeasier.com";
}

function decodeAttribute(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .trim();
}

export function normalizeNewsAudioUrl(
  value: string | null | undefined,
  baseUrl = NEWS_AUDIO_BASE,
) {
  if (!value?.trim()) return undefined;
  try {
    const base = new URL(baseUrl, NEWS_AUDIO_BASE);
    const decoded = decodeAttribute(value);
    const url = new URL(decoded.startsWith("//") ? `https:${decoded}` : decoded, base);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      !isAllowedNewsAudioHost(url.hostname)
    ) {
      return undefined;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}
