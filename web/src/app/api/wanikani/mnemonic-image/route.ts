import { extractMnemonicImageUrl } from "./mnemonic-image-parser";

const DOCUMENT_ORIGIN = "https://www.wanikani.com";
const IMAGE_ORIGIN = "https://files.wanikani.com";
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/svg+xml", "image/webp"]);

export const runtime = "nodejs";

function failure(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function trustedUrl(value: string | null, origin: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.origin !== origin || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

async function fetchTrusted(url: URL, origin: string, init: RequestInit, redirects = 0): Promise<Response> {
  const response = await fetch(url, { ...init, redirect: "manual" });
  if (response.status >= 300 && response.status < 400 && redirects < 2) {
    const redirected = trustedUrl(response.headers.get("location") ? new URL(response.headers.get("location")!, url).toString() : null, origin);
    if (!redirected) throw new Error("The WaniKani resource redirected to an unsupported location.");
    return fetchTrusted(redirected, origin, init, redirects + 1);
  }
  return response;
}

export async function GET(request: Request) {
  const documentUrl = trustedUrl(new URL(request.url).searchParams.get("documentUrl"), DOCUMENT_ORIGIN);
  if (!documentUrl) return failure("That WaniKani subject URL is not supported.", 400);

  try {
    const documentResponse = await fetchTrusted(documentUrl, DOCUMENT_ORIGIN, {
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "KakehashiWeb/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!documentResponse.ok) return failure("The WaniKani subject page is unavailable.", documentResponse.status === 404 ? 404 : 502);
    const documentSize = Number(documentResponse.headers.get("content-length"));
    if (Number.isFinite(documentSize) && documentSize > MAX_DOCUMENT_BYTES) return failure("The WaniKani subject page is too large.", 413);

    const html = await documentResponse.text();
    if (new TextEncoder().encode(html).byteLength > MAX_DOCUMENT_BYTES) return failure("The WaniKani subject page is too large.", 413);
    const imageUrl = trustedUrl(extractMnemonicImageUrl(html), IMAGE_ORIGIN);
    if (!imageUrl) return failure("This radical does not have a mnemonic illustration.", 404);

    const imageResponse = await fetchTrusted(imageUrl, IMAGE_ORIGIN, {
      headers: { Accept: "image/avif,image/webp,image/svg+xml,image/png,image/jpeg,image/gif", "User-Agent": "KakehashiWeb/1.0" },
      cache: "force-cache",
      signal: AbortSignal.timeout(12_000),
    });
    if (!imageResponse.ok) return failure("The mnemonic illustration is unavailable.", imageResponse.status === 404 ? 404 : 502);

    const contentType = imageResponse.headers.get("content-type")?.split(";", 1)[0]?.trim().toLocaleLowerCase() || "";
    const declaredSize = Number(imageResponse.headers.get("content-length"));
    if (!IMAGE_TYPES.has(contentType)) return failure("The mnemonic asset is not a supported image.", 415);
    if (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_BYTES) return failure("The mnemonic illustration is too large.", 413);

    const body = await imageResponse.arrayBuffer();
    if (body.byteLength > MAX_IMAGE_BYTES) return failure("The mnemonic illustration is too large.", 413);
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return failure("The mnemonic illustration could not be loaded.", 502);
  }
}
