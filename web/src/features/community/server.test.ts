import { afterEach, describe, expect, it, vi } from "vitest";
import { canManageIssueAuthor, resolveCommunityMode, resolveCommunityModeFromEnvironment } from "./security-model";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const identity = { id: "kakelearner", username: "KakeLearner" };

describe("community server boundary", () => {
  it("does not silently create a local board when durable configuration is absent", () => {
    expect(resolveCommunityMode({ url: "", serviceRoleKey: "", production: false })).toBe("unavailable");
    expect(resolveCommunityMode({ url: "", serviceRoleKey: "", production: true })).toBe("unavailable");
    expect(resolveCommunityMode({ url: "https://example.supabase.co", serviceRoleKey: "server-secret", production: true })).toBe("supabase");
    expect(resolveCommunityMode({ url: "https://example.supabase.co", serviceRoleKey: "", anonKey: "public-key", production: false })).toBe("supabase-native-dev");
    expect(resolveCommunityMode({ url: "https://example.supabase.co", serviceRoleKey: "", anonKey: "public-key", production: true })).toBe("supabase-readonly");
  });

  it("uses the local JSON board only after an explicit development opt-in", () => {
    expect(resolveCommunityMode({ url: "", serviceRoleKey: "", production: false, localStoreEnabled: true })).toBe("local-server");
    expect(resolveCommunityMode({ url: "", serviceRoleKey: "", production: true, localStoreEnabled: true })).toBe("unavailable");
  });

  it("recognizes the author from the stable id or legacy username", () => {
    expect(canManageIssueAuthor({ user_id: "kakelearner" }, identity)).toBe(true);
    expect(canManageIssueAuthor({ user_username: "KAKELEARNER" }, identity)).toBe(true);
    expect(canManageIssueAuthor({ user_id: "another-user", user_username: "AnotherUser" }, identity)).toBe(false);
  });
});

describe("community environment mode", () => {
  it("honors only the exact local-store environment opt-in", () => {
    expect(resolveCommunityModeFromEnvironment({ nodeEnv: "development", localStore: "1" })).toBe("local-server");
    expect(resolveCommunityModeFromEnvironment({ nodeEnv: "development", localStore: "true" })).toBe("unavailable");
    expect(resolveCommunityModeFromEnvironment({ nodeEnv: "production", localStore: "1" })).toBe("unavailable");
  });
});

describe("community supporter usernames", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("queries active supporters only and returns normalized usernames", async () => {
    vi.stubEnv("SUPABASE_URL", "https://community.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-secret");
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([
      { wanikani_username: "  Portego " },
      { wanikani_username: "KAKELEARNER" },
      { wanikani_username: "   " },
      { wanikani_username: null },
    ]), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { communitySupporterUsernames } = await import("./server");
    const usernames = await communitySupporterUsernames();

    expect([...usernames]).toEqual(["portego", "kakelearner"]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://community.example/rest/v1/patreon_supporters?select=wanikani_username&is_active=eq.true",
    );
  });

  it("keeps the community available when supporter enrichment is unavailable", async () => {
    vi.stubEnv("SUPABASE_URL", "https://community.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-secret");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ message: "relation does not exist" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    })));

    const { communitySupporterUsernames } = await import("./server");

    await expect(communitySupporterUsernames()).resolves.toEqual(new Set());
  });
});

describe("community author email refresh", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("refreshes prior issue and comment rows but never replaces a real email with the fallback", async () => {
    vi.stubEnv("SUPABASE_URL", "https://community.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-secret");
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { syncCommunityAuthorEmail } = await import("./server");

    await syncCommunityAuthorEmail({ id: "wk/user 1", username: "Learner", level: 12, email: " MyEmailAddress@example.com " });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://community.example/rest/v1/issues?user_id=eq.wk%2Fuser%201",
      "https://community.example/rest/v1/issue_comments?user_id=eq.wk%2Fuser%201",
    ]);
    fetchMock.mock.calls.forEach(([, init]) => {
      expect(init).toMatchObject({ method: "PATCH", body: JSON.stringify({ user_email: "myemailaddress@example.com" }) });
    });

    fetchMock.mockClear();
    await syncCommunityAuthorEmail({ id: "wk-user-2", username: "Legacy", level: 3, email: "Legacy@users.noreply.local" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("community liker names", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

  it.each(["issue", "comment"] as const)("resolves %s likers using public authors and names of learners who have not posted", async (kind) => {
    vi.stubEnv("SUPABASE_URL", "https://community.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-secret");
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("_likes")) return Response.json([
        { id: "like-1", user_id: "author" }, { id: "like-2", user_id: "reader" },
      ]);
      if (url.pathname.endsWith("/issues")) return Response.json([{ user_id: "author", user_username: "Portego", user_email: "private@example.com" }]);
      if (url.pathname.endsWith("/app_sessions")) return Response.json([{ user_id: "reader", user_name: "Reader", platform: "ios" }]);
      return Response.json([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { communityLikePeople } = await import("./server");
    expect(await communityLikePeople(kind, "target-1", 2)).toEqual({
      items: [{ id: "like-1", username: "Portego" }, { id: "like-2", username: "Reader" }], hasMore: false,
    });
    const query = new URL(String(fetchMock.mock.calls[0][0]));
    expect(query.pathname).toBe(`/rest/v1/${kind === "issue" ? "issue_likes" : "comment_likes"}`);
    expect(query.searchParams.get(kind === "issue" ? "issue_id" : "comment_id")).toBe("eq.target-1");
    expect(query.searchParams.get("offset")).toBe("100");
    expect(query.searchParams.get("limit")).toBe("51");
    const sessionQueries = fetchMock.mock.calls.map(([url]) => new URL(String(url))).filter((url) => url.pathname.endsWith("/app_sessions"));
    expect(sessionQueries).toHaveLength(1);
    expect(sessionQueries[0].searchParams.get("select")).toBe("user_id,user_name");
    expect(sessionQueries[0].searchParams.get("user_id")).toBe('eq."reader"');
  });

  it("returns a bounded page and handles unavailable account names without exposing raw account IDs", async () => {
    vi.stubEnv("SUPABASE_URL", "https://community.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-secret");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/issue_likes")) return Response.json(Array.from({ length: 51 }, (_, index) => ({ id: `like-${index}`, user_id: "private-account-id" })));
      if (url.pathname.endsWith("/app_sessions")) return new Response(null, { status: 403 });
      return Response.json([]);
    }));
    const { communityLikePeople } = await import("./server");
    const result = await communityLikePeople("issue", "target-1", 0);
    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(50);
    expect(result.items[0]).toEqual({ id: "like-0", username: "Unknown learner" });
    expect(JSON.stringify(result)).not.toContain("private-account-id");
  });
});
