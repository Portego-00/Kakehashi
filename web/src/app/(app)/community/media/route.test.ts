// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
vi.mock("@/features/community/server", () => ({
  communityIdentity: vi.fn(async () => ({ id: "123" })),
  communityMediaStorage: () => ({ url: "https://storage.example.com", key: "test-secret", buckets: ["issue-media", "issues"] }),
}));
import sharp from "sharp";
import { communityIdentity } from "@/features/community/server";
import { allowedCommunityHeicUrl } from "@/features/community/media-server";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";
import { GET, POST } from "./route";

function request(body: Uint8Array, type = "image/png", origin = "https://app.example.com") {
  return new NextRequest("https://app.example.com/community/media", { method: "POST", headers: { origin, host: "app.example.com", "content-type": type }, body: new Uint8Array(body) });
}
beforeEach(() => { clearRateLimitsForTests(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("community media", () => {
  it("requires a matching origin and verified identity", async () => {
    expect((await POST(request(new Uint8Array([1]), "image/png", "https://other.example.com"))).status).toBe(403);
    vi.mocked(communityIdentity).mockRejectedValueOnce(new Error("Unauthenticated"));
    expect((await POST(request(new Uint8Array([1])))).status).toBe(401);
  });
  it("rejects spoofed image bytes, unsupported content and oversized uploads", async () => {
    expect((await POST(request(new TextEncoder().encode("<script>bad</script>")))).status).toBe(422);
    expect((await POST(request(new Uint8Array([1]), "image/svg+xml"))).status).toBe(415);
    expect((await POST(request(new Uint8Array(4_000_001)))).status).toBe(413);
  });
  it("stores a normalized image and returns a durable public URL", async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request(png));
    expect(response.status).toBe(201);
    expect((await response.json()).url).toMatch(/^https:\/\/storage.example.com\/storage\/v1\/object\/public\/issue-media\/issues\/image\/123\/.+\.webp$/);
    const init = (fetchMock.mock.calls as unknown as [string, RequestInit][])[0][1];
    expect((await sharp(Buffer.from(init.body as Uint8Array)).metadata()).format).toBe("webp");
    expect(init.headers).toMatchObject({ "Content-Type": "image/webp" });
  });
  it("only converts attachments from this project's public issue buckets", async () => {
    const valid = "https://storage.example.com/storage/v1/object/public/issue-media/issues/image/photo.heic";
    expect(allowedCommunityHeicUrl(valid)).toBe(valid);
    for (const url of ["http://127.0.0.1/photo.heic", valid.replace("storage.example.com", "evil.example.com"), valid.replace("issue-media", "private"), valid + "?redirect=evil", valid.replace("photo.heic", "%2e%2e/private.heic")]) {
      expect(allowedCommunityHeicUrl(url)).toBeNull();
    }
    expect((await GET(new NextRequest("https://app.example.com/community/media?url=http://127.0.0.1/a.heic"))).status).toBe(400);
  });
});
