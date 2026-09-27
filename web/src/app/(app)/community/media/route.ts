import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { communityIdentity, communityMediaStorage } from "@/features/community/server";
import { COMMUNITY_IMAGE_MAX_BYTES, COMMUNITY_IMAGE_TYPES } from "@/features/community/media";
import { allowedCommunityHeicUrl, boundedImageBytes, browserImage } from "@/features/community/media-server";
import { clientAddress, isTrustedMutationOrigin } from "@/lib/server/request-security";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;
const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function POST(request: NextRequest) {
  if (!isTrustedMutationOrigin(request)) return error("Cross-origin uploads are blocked.", 403);
  if (!takeRateLimit(opaqueRateLimitKey("community-upload-ip", clientAddress(request)), 30, 60_000).allowed) return error("Too many uploads. Try again in a minute.", 429);
  let identity;
  try { identity = await communityIdentity(); } catch { return error("Sign in to upload images.", 401); }
  if (!takeRateLimit(opaqueRateLimitKey("community-upload-user", identity.id), 20, 60_000).allowed) return error("Too many uploads. Try again in a minute.", 429);
  const config = communityMediaStorage();
  if (!config.url || !config.key) return error("Image storage is not configured.", 503);
  const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  if (!COMMUNITY_IMAGE_TYPES.has(type)) return error("Choose a PNG, JPEG, GIF, WebP, AVIF or HEIC image.", 415);
  let bytes;
  try { bytes = await boundedImageBytes(request, COMMUNITY_IMAGE_MAX_BYTES); } catch { return error("Each image must be nonempty and smaller than 4 MB.", 413); }
  let image;
  try { image = await browserImage(bytes, type === "image/heic" || type === "image/heif"); }
  catch { return error("This image could not be read. Try exporting it as PNG or JPEG.", 422); }
  const path = `issues/image/${encodeURIComponent(identity.id)}/${randomUUID()}.webp`;
  try {
    for (const bucket of config.buckets) {
      const response = await fetch(`${config.url}/storage/v1/object/${bucket}/${path}`, {
        method: "POST", headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "image/webp", "Cache-Control": "3600", "x-upsert": "false" },
        body: new Uint8Array(image), signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) return NextResponse.json({ url: `${config.url}/storage/v1/object/public/${bucket}/${path}` }, { status: 201 });
      const failure = await response.json().catch(() => null);
      if (/bucket.*not found/i.test(String(failure?.message || failure?.error || ""))) continue;
      return error("Image storage could not accept the upload. Please try again.", 502);
    }
    return error("Community image storage is not available.", 503);
  } catch { return error("The upload could not reach image storage. Please try again.", 502); }
}

export async function GET(request: NextRequest) {
  const url = allowedCommunityHeicUrl(request.nextUrl.searchParams.get("url") || "");
  if (!url) return error("Unsupported community image.", 400);
  if (!takeRateLimit(opaqueRateLimitKey("community-heic", clientAddress(request)), 60, 60_000).allowed) return error("Too many image requests. Try again in a minute.", 429);
  try {
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return error("The original attachment is unavailable.", 404);
    const image = await browserImage(await boundedImageBytes(response, 10 * 1024 * 1024), true);
    return new Response(new Uint8Array(image), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch { return error("This attachment could not be converted. Open the original to download it.", 422); }
}
