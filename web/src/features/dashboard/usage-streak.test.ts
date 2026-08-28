import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchUsageStreak, usageStreakSnapshot } from "./usage-streak";

function dayKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

describe("app usage streak", () => {
  afterEach(() => vi.restoreAllMocks());

  it("preserves a long app-session streak instead of collapsing it to assignment updates", () => {
    const now = new Date("2026-08-25T18:00:00.000Z");
    const activeDays = Array.from({ length: 210 }, (_, index) => {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - (209 - index));
      return dayKey(date);
    });

    expect(usageStreakSnapshot(activeDays, "2026-08-25")).toMatchObject({
      current: 210,
      longest: 210,
      activeToday: true,
    });
  });

  it("uses the same seven-active-days freeze rule as the mobile app", () => {
    const activeDays = [
      "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20",
      "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-25",
    ];

    expect(usageStreakSnapshot(activeDays, "2026-08-25")).toMatchObject({
      current: 8,
      longest: 8,
      freezeAvailable: false,
    });
  });

  it("falls back to the mobile Supabase session history when the web route is unavailable", async () => {
    const now = new Date("2026-08-25T18:00:00.000Z");
    const sessions = Array.from({ length: 210 }, (_, index) => {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - (209 - index));
      return { session_started_at: date.toISOString() };
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Unavailable", publicBackend: { url: "https://example.supabase.co", anonKey: "public-anon-key" } }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(sessions), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await fetchUsageStreak({
      userId: "wk-user-1",
      username: "Tester",
      timezone: "UTC",
      now,
    });

    expect(snapshot).toMatchObject({ current: 210, longest: 210 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("app_sessions");
  });
});
