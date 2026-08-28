import { afterEach, describe, expect, it, vi } from "vitest";
import { createMangaCoverThumbnail } from "./manga-cover-thumbnail";

afterEach(() => vi.unstubAllGlobals());

describe("createMangaCoverThumbnail", () => {
  it("skips the optional cover cache when browser image primitives are unavailable", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    vi.stubGlobal("OffscreenCanvas", undefined);

    await expect(createMangaCoverThumbnail(new Blob(["cover"]))).resolves.toBeNull();
  });

  it("scales a cover into a compact WebP cache", async () => {
    const close = vi.fn();
    const drawImage = vi.fn();
    const thumbnail = new Blob(["thumbnail"], { type: "image/webp" });
    const convertToBlob = vi.fn(async () => thumbnail);
    const canvas = vi.fn(function MockCanvas(this: { width: number; height: number }, width: number, height: number) {
      this.width = width;
      this.height = height;
      return { convertToBlob, getContext: vi.fn(() => ({ drawImage })), height, width };
    });
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ close, height: 1800, width: 1200 })));
    vi.stubGlobal("OffscreenCanvas", canvas);

    await expect(createMangaCoverThumbnail(new Blob(["cover"]))).resolves.toBe(thumbnail);
    expect(canvas).toHaveBeenCalledWith(480, 720);
    expect(drawImage).toHaveBeenCalledWith(expect.objectContaining({ height: 1800, width: 1200 }), 0, 0, 480, 720);
    expect(convertToBlob).toHaveBeenCalledWith({ type: "image/webp", quality: 0.82 });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
