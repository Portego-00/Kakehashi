const LOCAL_BASE = "https://kakehashi.invalid";

export function safeInternalPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  try {
    const parsed = new URL(value, LOCAL_BASE);
    if (parsed.origin !== LOCAL_BASE) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
