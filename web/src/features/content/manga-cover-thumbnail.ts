const MAX_COVER_WIDTH = 480;
const MAX_COVER_HEIGHT = 720;

export async function createMangaCoverThumbnail(source: Blob): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") return null;

  const bitmap = await createImageBitmap(source);
  try {
    if (!bitmap.width || !bitmap.height) return null;
    const scale = Math.min(1, MAX_COVER_WIDTH / bitmap.width, MAX_COVER_HEIGHT / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);
    try {
      return await canvas.convertToBlob({ type: "image/webp", quality: 0.82 });
    } catch {
      return await canvas.convertToBlob({ type: "image/png" });
    }
  } finally {
    bitmap.close();
  }
}
