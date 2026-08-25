import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("web analytics backend", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_URL", "https://supabase.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 201 })));
  });

  it("writes web app sessions with the authenticated identity", async () => {
    const { recordWebAppSession } = await import("./analytics-server");
    await expect(recordWebAppSession({ id: "123", username: "Tester", level: 21 })).resolves.toBe(true);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://supabase.test/rest/v1/app_sessions");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      user_id: "123",
      user_name: "Tester",
      user_level: 21,
      app_version: "0.1.0",
      platform: "web",
    });
  });

  it("maps browser categories to the shared mobile study-time schema", async () => {
    const { syncWebStudyTime } = await import("./analytics-server");
    await expect(syncWebStudyTime({ id: "123", username: "Tester", level: 21 }, "browser-device-123", [{
      day: "2026-08-25",
      appTotalSeconds: 600,
      byCategory: { reviews: 120, "extra-study": 90, reading: 30 },
    }])).resolves.toBe(true);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    const payload = JSON.parse(String(init?.body));
    expect(url).toBe("https://supabase.test/rest/v1/rpc/upsert_study_time_days");
    expect(payload.rows[0]).toMatchObject({
      user_id: "123",
      device_id: "browser-device-123",
      day: "2026-08-25",
      activity_ms: { reviews: 120_000, extra_study: 90_000, epub: 30_000 },
      study_total_ms: 240_000,
      app_total_ms: 600_000,
      platform: "web",
    });
  });

  it("reads app-session timestamps for the authenticated WaniKani identity", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { session_started_at: "2026-08-25T10:00:00Z" },
      { session_started_at: "2026-08-24T10:00:00Z" },
    ]), { status: 200, headers: { "Content-Type": "application/json" } })));
    const { readAppSessionStartedAt } = await import("./analytics-server");

    await expect(readAppSessionStartedAt("123")).resolves.toEqual([
      "2026-08-25T10:00:00Z",
      "2026-08-24T10:00:00Z",
    ]);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("app_sessions?select=session_started_at");
    expect(String(url)).toContain("user_id=eq.123");
    expect(init?.method).toBeUndefined();
  });

  it("pages app-session history the same way as the mobile streak implementation", async () => {
    const firstPage = Array.from({ length: 1_000 }, (_, index) => ({ session_started_at: `2026-01-01T00:${String(index % 60).padStart(2, "0")}:00Z` }));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ session_started_at: "2025-12-31T10:00:00Z" }]), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { readAppSessionStartedAt } = await import("./analytics-server");

    await expect(readAppSessionStartedAt("123", 1_001)).resolves.toHaveLength(1_001);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("offset=1000");
  });
});
