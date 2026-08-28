import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  getWaniKaniSessionUser: vi.fn(),
  unsealToken: vi.fn(() => "plain-token"),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/session-crypto", () => ({ unsealToken: sessionMocks.unsealToken }));
vi.mock("@/lib/server/wanikani-session", () => ({ getWaniKaniSessionUser: sessionMocks.getWaniKaniSessionUser }));

const LEGACY_SERVICE_ROLE_JWT = "header.payload.signature";

describe("web analytics backend", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_URL", "https://supabase.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", LEGACY_SERVICE_ROLE_JWT);
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 201 })));
    sessionMocks.getWaniKaniSessionUser.mockReset();
    sessionMocks.unsealToken.mockClear();
  });

  it("uses the WaniKani user id from the real nested user payload", async () => {
    sessionMocks.getWaniKaniSessionUser.mockResolvedValue({
      object: "user",
      data: { id: "wk-user-123", username: "Tester", level: 21 },
    });
    const { analyticsIdentityFromSealedSession } = await import("./analytics-server");

    await expect(analyticsIdentityFromSealedSession("sealed-session")).resolves.toEqual({
      id: "wk-user-123",
      username: "Tester",
      level: 21,
    });
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
    expect(url).toBe("https://supabase.test/rest/v1/rpc/upsert_verified_study_time_days");
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

  it("reads verified other-device rows and maps every mobile activity into web categories", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        day: "2026-08-25",
        app_total_ms: 24_000,
        activity_ms: {
          reviews: 1_000,
          bunpro_reviews: 1_000,
          lessons: 1_000,
          bunpro_lessons: 1_000,
          recent_lessons_review: 1_000,
          custom_review: 1_000,
          custom_lesson: 1_000,
          test_session: 1_000,
          meaning_reading: 1_000,
          similar_kanji: 1_000,
          kana_kanji: 1_000,
          writing_practice: 1_000,
          writing_freehand: 1_000,
          context_sentence: 1_000,
          listening_practice: 1_000,
          crossword: 1_000,
          wordle: 1_000,
          extra_study: 1_000,
          "extra-study": 1_000,
          news: 1_000,
          songs: 1_000,
          epub: 1_000,
          reading: 1_000,
          video: 1_000,
        },
      },
      { day: "2026-08-25", app_total_ms: "3000", activity_ms: { reviews: 2_000, unknown_future_key: 9_000 } },
    ]), { status: 200, headers: { "Content-Type": "application/json" } })));
    const { readVerifiedStudyTimeDays } = await import("./analytics-server");

    await expect(readVerifiedStudyTimeDays("123", "browser-device-123", 430, new Date("2026-08-26T12:00:00Z"))).resolves.toEqual([{
      day: "2026-08-25",
      appTotalSeconds: 27,
      byCategory: {
        reviews: 4,
        lessons: 2,
        "extra-study": 15,
        news: 1,
        songs: 1,
        reading: 2,
        video: 1,
      },
    }]);
    const [input, init] = vi.mocked(fetch).mock.calls[0];
    const url = new URL(String(input));
    expect(url.pathname).toBe("/rest/v1/study_time_days");
    expect(url.searchParams.get("user_id")).toBe("eq.123");
    expect(url.searchParams.get("device_id")).toBe("neq.browser-device-123");
    expect(url.searchParams.get("verified")).toBe("eq.true");
    expect(url.searchParams.get("verified_at")).toBe("not.is.null");
    expect(url.searchParams.getAll("day")).toEqual([
      "gte.2025-06-24",
      "lte.2026-08-27",
    ]);
    expect(url.searchParams.get("order")).toBe("day.desc,device_id.asc");
    expect(init?.headers).toMatchObject({
      apikey: LEGACY_SERVICE_ROLE_JWT,
      Authorization: `Bearer ${LEGACY_SERVICE_ROLE_JWT}`,
    });
  });

  it("uses opaque Supabase secret keys only as apikey headers for private reads and writes", async () => {
    const opaqueKey = "sb_secret_private-test";
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", opaqueKey);
    vi.resetModules();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const { readVerifiedStudyTimeDays, syncWebStudyTime } = await import("./analytics-server");

    await expect(syncWebStudyTime({ id: "123", username: "Tester", level: 21 }, "browser-device-123", [{
      day: "2026-08-25",
      appTotalSeconds: 60,
      byCategory: { reviews: 60 },
    }])).resolves.toBe(true);
    await expect(readVerifiedStudyTimeDays("123", "browser-device-123")).resolves.toEqual([]);

    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.headers).toMatchObject({ apikey: opaqueKey });
      expect(init?.headers).not.toHaveProperty("Authorization");
    }
  });

  it("paginates the bounded study-time window", async () => {
    const firstPage = Array.from({ length: 1_000 }, () => ({
      day: "2026-08-25",
      app_total_ms: 1_000,
      activity_ms: { reviews: 1_000 },
    }));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ day: "2026-08-24", app_total_ms: 2_000, activity_ms: { lessons: 2_000 } }]), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { readVerifiedStudyTimeDays } = await import("./analytics-server");

    const days = await readVerifiedStudyTimeDays("123", "browser-device-123", 430, new Date("2026-08-26T12:00:00Z"));

    expect(days).toHaveLength(2);
    expect(days[0]).toMatchObject({ day: "2026-08-25", appTotalSeconds: 1_000, byCategory: { reviews: 1_000 } });
    expect(String(fetchMock.mock.calls[1][0])).toContain("offset=1000");
  });

  it("fails closed instead of returning a partial result past the row cap", async () => {
    const fullPage = Array.from({ length: 1_000 }, () => ({
      day: "2026-08-25",
      app_total_ms: 1_000,
      activity_ms: { reviews: 1_000 },
    }));
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify(fullPage), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
    const { readVerifiedStudyTimeDays } = await import("./analytics-server");

    await expect(readVerifiedStudyTimeDays("123", "browser-device-123")).rejects.toThrow("too many");
    expect(fetch).toHaveBeenCalledTimes(31);
  });

  it("does not use the anonymous key for verified study-time reads or writes", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_ANON_KEY", "public-anon-key");
    vi.resetModules();
    const { analyticsPrivateBackendConfigured, readVerifiedStudyTimeDays, syncWebStudyTime } = await import("./analytics-server");

    expect(analyticsPrivateBackendConfigured()).toBe(false);
    await expect(readVerifiedStudyTimeDays("123", "browser-device-123")).resolves.toEqual([]);
    await expect(syncWebStudyTime({ id: "123", username: "Tester", level: 21 }, "browser-device-123", [{
      day: "2026-08-25",
      appTotalSeconds: 60,
      byCategory: { reviews: 60 },
    }])).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
