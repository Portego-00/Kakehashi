import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";

const server = vi.hoisted(() => ({ identity: vi.fn(), request: vi.fn(), writable: vi.fn(), deleteIssue: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/community/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/community/server")>(),
  communityConfigured: () => true,
  communityWritable: server.writable,
  communityIdentity: server.identity,
  communityIdentityOrNull: server.identity,
  communitySupporterUsernames: async () => new Set(),
  supabaseRequest: server.request,
  deleteCommunityIssue: server.deleteIssue,
}));
import { GET, POST } from "./route";

const issue = { id: "11111111-1111-4111-8111-111111111111", user_id: "author-id", user_username: "Author", title: "Study issue", content: "Study details", status: "open" };
function mutation(action: string, extra: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/community/api", {
    method: "POST", headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
    body: JSON.stringify({ action, issueId: issue.id, status: "closed", ...extra }),
  });
}

describe("community status moderation", () => {
  afterEach(() => vi.unstubAllEnvs());

  beforeEach(() => {
    clearRateLimitsForTests();
    vi.stubEnv("COMMUNITY_ADMIN_USER_IDS", "");
    server.identity.mockReset().mockResolvedValue({ id: "moderator-id", username: "Portego", level: 21, email: "" });
    server.writable.mockReset().mockReturnValue(true);
    server.deleteIssue.mockReset();
    server.request.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return [{ ...issue, ...JSON.parse(String(init.body)) }];
      return path.startsWith("issues?") ? [issue] : [];
    });
  });

  it("exposes status moderation for Portego without granting deletion", async () => {
    const response = await GET(new NextRequest(`http://localhost/community/api?action=issue&id=${issue.id}`));
    expect(await response.json()).toMatchObject({ canUpdateStatus: true, canManage: false });
    expect((await POST(mutation("deleteIssue"))).status).toBe(403);
    expect(server.deleteIssue).not.toHaveBeenCalled();
  });

  it.each(["closed", "open"])("lets verified Portego set another author's issue to %s", async (status) => {
    const response = await POST(mutation("updateStatus", { status }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ item: { status } });
    expect(server.request).toHaveBeenCalledWith(expect.stringContaining(`id=eq.${issue.id}`), expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status }) }));
  });

  it("rejects a different viewer even when the body claims to be Portego", async () => {
    server.identity.mockResolvedValue({ id: "viewer-id", username: "Viewer" });
    const response = await POST(mutation("updateStatus", { username: "Portego", isAdmin: true }));
    expect(response.status).toBe(403);
    expect(server.request.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
    const detail = await GET(new NextRequest(`http://localhost/community/api?action=issue&id=${issue.id}`));
    expect(await detail.json()).toMatchObject({ canUpdateStatus: false, canManage: false });
  });

  it("preserves the author's existing controls", async () => {
    server.identity.mockResolvedValue({ id: "author-id", username: "Author" });
    const detail = await GET(new NextRequest(`http://localhost/community/api?action=issue&id=${issue.id}`));
    expect(await detail.json()).toMatchObject({ canUpdateStatus: true, canManage: true });
    expect((await POST(mutation("updateStatus"))).status).toBe(200);
  });

  it("does not allow moderation in a read-only deployment", async () => {
    server.writable.mockReturnValue(false);
    const detail = await GET(new NextRequest(`http://localhost/community/api?action=issue&id=${issue.id}`));
    expect(await detail.json()).toMatchObject({ canUpdateStatus: false, canManage: false });
    expect((await POST(mutation("updateStatus"))).status).toBe(503);
  });

  it("rejects an unverified session", async () => {
    server.identity.mockRejectedValue(new Error("Sign in to continue."));
    expect((await POST(mutation("updateStatus"))).status).toBe(401);
    expect(server.request).not.toHaveBeenCalled();
  });
});
