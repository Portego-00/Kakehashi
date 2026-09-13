import { normalizeNewsImageUrl } from "@/features/content/news-images";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
export const runtime = "nodejs";

function failure(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function readImage(url: string, redirects = 0): Promise<Response> {
  const response = await fetch(url, {
    headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif", "User-Agent": "KakehashiWeb/1.0" },
    cache: "force-cache",
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
  });
  if (response.status >= 300 && response.status < 400 && redirects < 2) {
    const redirected = normalizeNewsImageUrl(response.headers.get("location"), url);
    if (!redirected) throw new Error("The news image redirected to an unsupported location.");
    return readImage(redirected, redirects + 1);
  }
  return response;
}

export async function GET(request: Request) {
  const source = normalizeNewsImageUrl(new URL(request.url).searchParams.get("url"));
  if (!source) return failure("That news image URL is not supported.", 400);
  try {
    const upstream = await readImage(source);
    if (!upstream.ok) return failure("The news image is unavailable.", upstream.status === 404 ? 404 : 502);
    const contentType = upstream.headers.get("content-type")?.split(";", 1)[0]?.trim().toLocaleLowerCase() || "";
    const declaredSize = Number(upstream.headers.get("content-length"));
    if (!IMAGE_TYPES.has(contentType)) return failure("The news asset is not a supported image.", 415);
    if (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_BYTES) return failure("The news image is too large.", 413);
    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_IMAGE_BYTES) return failure("The news image is too large.", 413);
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return failure("The news image could not be loaded.", 502);
  }
}
