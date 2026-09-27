import "server-only";
import sharp from "sharp";
import decodeHeic from "heic-decode";
import { communityMediaStorage } from "./server";

export async function boundedImageBytes(source: Pick<Response, "body" | "headers">, limit: number) {
  if (Number(source.headers.get("content-length")) > limit) throw new Error("Image is too large.");
  if (!source.body) throw new Error("Image is empty.");
  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("Image is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!size) throw new Error("Image is empty.");
  return Buffer.concat(chunks, size);
}

export function allowedCommunityHeicUrl(value: string) {
  try {
    if (/%2f|%5c|%2e/i.test(value)) return null;
    const config = communityMediaStorage();
    const url = new URL(value);
    if (!config.url || url.origin !== new URL(config.url).origin || url.username || url.password || url.search || url.hash) return null;
    const allowed = config.buckets.some((bucket) => url.pathname.startsWith(`/storage/v1/object/public/${bucket}/issues/`));
    if (!allowed || !/\.hei[cf]$/i.test(url.pathname) || /%2f|%5c|%2e/i.test(url.pathname)) return null;
    return url.toString();
  } catch { return null; }
}

// heic-decode's runtime exposes dimensions and disposal, which its published types omit.
type HeicImages = Array<{ width: number; height: number; decode: () => Promise<{ width: number; height: number; data: Uint8ClampedArray }> }> & { dispose: () => void };

export async function browserImage(bytes: Buffer, heic: boolean) {
  if (heic) {
    const images = await decodeHeic.all({ buffer: bytes }) as HeicImages;
    try {
      const primary = images[0];
      if (!primary || primary.width * primary.height > 40_000_000) throw new Error("Image dimensions are too large.");
      const image = await primary.decode();
      return await sharp(Buffer.from(image.data), { raw: { width: image.width, height: image.height, channels: 4 }, limitInputPixels: 40_000_000 }).webp({ quality: 90 }).toBuffer();
    } finally { images.dispose(); }
  }
  // Decode and re-encode rather than trusting an uploaded MIME type or serving active content.
  return sharp(bytes, { limitInputPixels: 40_000_000, animated: true }).rotate().webp({ quality: 90 }).toBuffer();
}
