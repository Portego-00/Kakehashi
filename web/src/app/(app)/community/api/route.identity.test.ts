import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";

const server = vi.hoisted(() => ({
  addCommunityComment: vi.fn(),
  communityIdentity: vi.fn(),
  supabaseRequest: vi.fn(),
  syncCommunityAuthorEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/community/server", () => ({
  addCommunityComment: server.addCommunityComment,
  canManageCommunityIssue: vi.fn(() => false),
  communityConfigured: vi.fn(() => true),
  communityIdentity: server.communityIdentity,
  communityIdentityOrNull: vi.fn(async () => null),
  communityIssueCounts: vi.fn(async () => ({ open: 0, closed: 0 })),
  communitySupporterUsernames: vi.fn(async () => new Set(["portego"])),
  communityWritable: vi.fn(() => true),
  deleteCommunityIssue: vi.fn(),
  encodeFilter: vi.fn((value: string) => encodeURIComponent(value)),
  supabaseRequest: server.supabaseRequest,
  syncCommunityAuthorEmail: server.syncCommunityAuthorEmail,
  toggleCommunityLike: vi.fn(),
}));

function mutation(body: unknown, address: string) {
  return new NextRequest("http://localhost/community/api", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost",
      origin: "http://localhost",
      "x-forwarded-for": address,
    },
    body: JSON.stringify(body),
  });
}

const identity = {
  id: "wk-user-1",
  username: "Portego",
  level: 60,
  email: "myemailaddress@example.com",
};

describe("community Gravatar identity mutations", () => {
  beforeEach(() => {
    clearRateLimitsForTests();
    server.addCommunityComment.mockReset();
    server.communityIdentity.mockReset();
    server.supabaseRequest.mockReset();
    server.syncCommunityAuthorEmail.mockReset().mockResolvedValue(undefined);
    server.communityIdentity.mockImplementation(async (email?: string) => ({ ...identity, email: email || "Portego@users.noreply.local" }));
  });

  it("uses the saved Gravatar email when creating an issue without returning the raw email", async () => {
    const savedEmail = "a@b.c";
    server.supabaseRequest.mockImplementation(async (_path: string, init?: RequestInit) => {
      const row = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return [{
        id: "11111111-1111-4111-8111-111111111111",
        ...row,
        created_at: "2026-08-31T08:00:00.000Z",
        updated_at: "2026-08-31T08:00:00.000Z",
        likes_count: 0,
        reply_count: 0,
      }];
    });
    const { POST } = await import("./route");

    const response = await POST(mutation({
      action: "createIssue",
      title: "Gravatar identity",
      content: "Keep the same avatar on mobile and web.",
      gravatarEmail: savedEmail,
    }, "192.0.2.21"));

    expect(response.status).toBe(201);
    expect(server.communityIdentity).toHaveBeenCalledWith(savedEmail);
    const write = server.supabaseRequest.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({ user_email: savedEmail });
    expect(server.syncCommunityAuthorEmail).toHaveBeenCalledWith(expect.objectContaining({ email: savedEmail }));
    const payload = await response.json();
    expect(payload.item).not.toHaveProperty("user_email");
    expect(payload.item).toMatchObject({ user_gravatar_hash: expect.stringMatching(/^[a-f0-9]{32}$/), is_patreon_supporter: true });
  });

  it("uses the saved Gravatar email when creating a comment and sanitizes the response", async () => {
    server.addCommunityComment.mockImplementation(async (_input, author) => ({
      id: "22222222-2222-4222-8222-222222222222",
      issue_id: "11111111-1111-4111-8111-111111111111",
      user_id: author.id,
      user_email: author.email,
      user_username: author.username,
      user_level: author.level,
      content: "The reply keeps its avatar.",
      created_at: "2026-08-31T08:05:00.000Z",
      likes_count: 0,
    }));
    const { POST } = await import("./route");

    const response = await POST(mutation({
      action: "addComment",
      issueId: "11111111-1111-4111-8111-111111111111",
      content: "The reply keeps its avatar.",
      requestId: "33333333-3333-4333-8333-333333333333",
      gravatarEmail: identity.email,
    }, "192.0.2.22"));

    expect(response.status).toBe(201);
    expect(server.communityIdentity).toHaveBeenCalledWith(identity.email);
    expect(server.addCommunityComment).toHaveBeenCalledWith(expect.objectContaining({ action: "addComment", gravatarEmail: identity.email }), expect.objectContaining({ email: identity.email }));
    expect(server.syncCommunityAuthorEmail).toHaveBeenCalledWith(expect.objectContaining({ email: identity.email }));
    const payload = await response.json();
    expect(payload.item).not.toHaveProperty("user_email");
    expect(payload.item).toMatchObject({ user_gravatar_hash: expect.stringMatching(/^[a-f0-9]{32}$/), is_patreon_supporter: true });
  });
});
