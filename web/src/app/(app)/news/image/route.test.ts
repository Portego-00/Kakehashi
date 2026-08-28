import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("NHK news image proxy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns a bounded image with safe response headers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "image/jpeg" } })));
    const response = await GET(new Request(`http://localhost/news/image?url=${encodeURIComponent("https://nhkeasier.com/media/jpg/a.jpg")}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await response.arrayBuffer()).byteLength).toBe(3);
  });

  it("does not fetch untrusted origins or pass through non-image content", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await GET(new Request(`http://localhost/news/image?url=${encodeURIComponent("https://example.com/a.jpg")}`))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(new Response("not an image", { status: 200, headers: { "Content-Type": "text/html" } }));
    expect((await GET(new Request(`http://localhost/news/image?url=${encodeURIComponent("https://nhkeasier.com/media/a.jpg")}`))).status).toBe(415);
  });
});
