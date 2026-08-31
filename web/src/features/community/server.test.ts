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
