import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";

const server = vi.hoisted(() => ({ communityLikePeople: vi.fn(), communityIdentity: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/community/server", () => ({
  communityConfigured: () => true,
  communityLikePeople: server.communityLikePeople,
  communityIdentity: server.communityIdentity,
}));

const id = "11111111-1111-4111-8111-111111111111";
describe("community liker reads", () => {
  beforeEach(() => {
    clearRateLimitsForTests();
    server.communityLikePeople.mockReset();
    server.communityIdentity.mockReset().mockResolvedValue({ id: "portego-id", username: "Portego" });
  });

  it("rejects unsigned and demo-only sessions", async () => {
    server.communityIdentity.mockRejectedValue(new Error("Sign in to continue."));
    const { GET } = await import("./route");
    const result = await GET(new NextRequest(`http://localhost/community/api?action=likes&kind=issue&id=${id}`));
    expect(result.status).toBe(401);
    expect(server.communityLikePeople).not.toHaveBeenCalled();
  });

  it.each(["Viewer", "PortegoFan"])("rejects verified %s even with a forged Portego claim", async (username) => {
    server.communityIdentity.mockResolvedValue({ id: "viewer-id", username });
    const { GET } = await import("./route");
    const result = await GET(new NextRequest(`http://localhost/community/api?action=likes&kind=issue&id=${id}&username=Portego`, { headers: { "X-WaniKani-Username": "Portego" } }));
    expect(result.status).toBe(403);
    expect(server.communityLikePeople).not.toHaveBeenCalled();
  });

  it.each(["issue", "comment"])("reads a page of %s likers", async (kind) => {
    const payload = { items: [{ id: "like-1", username: "Portego" }], hasMore: false };
    server.communityLikePeople.mockResolvedValue(payload);
    const { GET } = await import("./route");
    const result = await GET(new NextRequest(`http://localhost/community/api?action=likes&kind=${kind}&id=${id}&page=2`));
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await result.json()).toEqual(payload);
    expect(server.communityLikePeople).toHaveBeenCalledWith(kind, id, 2);
  });

  it.each([`kind=other&id=${id}`, "kind=issue&id=invalid", `id=${id}`])("rejects invalid targets (%s)", async (params) => {
    const { GET } = await import("./route");
    const result = await GET(new NextRequest(`http://localhost/community/api?action=likes&${params}`));
    expect(result.status).toBe(400);
    expect(server.communityLikePeople).not.toHaveBeenCalled();
  });
});
