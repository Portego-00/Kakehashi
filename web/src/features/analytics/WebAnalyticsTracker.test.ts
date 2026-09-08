import { beforeEach, describe, expect, it, vi } from "vitest";
import { cachedUsageStreak, fetchUsageStreak } from "@/features/dashboard/usage-streak";
import { readCombinedStudyTimeRange } from "@/features/dashboard/study-time";
import { maybeRecordWebSession, refreshRemoteStudyTime, shouldRecordWebSession } from "./WebAnalyticsTracker";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

describe("web app sessions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("records once per 30-minute window and records again after the cooldown", async () => {
    const storage = memoryStorage();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ recorded: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const startedAt = new Date("2026-08-25T10:00:00").getTime();

    await maybeRecordWebSession(storage, "Tester", startedAt);
    await maybeRecordWebSession(storage, "Tester", startedAt + 10 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(shouldRecordWebSession(storage, "Tester", startedAt + 31 * 60_000)).toBe(true);

    await maybeRecordWebSession(storage, "Tester", startedAt + 31 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("updates the correct account cache only after a timestamp-confirmed insert", async () => {
    const storage = memoryStorage();
    const now = new Date("2026-08-25T18:00:00Z");
    const options = { storage, userId: "123", username: "Tester", timezone: "UTC", now };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ activeDays: ["2026-08-24"], available: true, userId: "123" }))));
    await fetchUsageStreak(options);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ recorded: true, userId: "123", sessionStartedAt: "2026-08-25T18:00:01Z" })));
    await maybeRecordWebSession(storage, "Tester", now.getTime(), "123");
    expect(cachedUsageStreak({ ...options, now: new Date("2026-08-26T10:00:00Z") })?.current).toBe(3);
  });

  it("does not credit a failed insert or a response for another signed-in account", async () => {
    const storage = memoryStorage();
    const now = new Date("2026-08-25T18:00:00Z");
    const options = { storage, userId: "123", username: "Tester", timezone: "UTC", now };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ activeDays: ["2026-08-24"], available: true, userId: "123" }))));
    await fetchUsageStreak(options);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ recorded: false })));
    await maybeRecordWebSession(storage, "Tester", now.getTime(), "123");
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ recorded: true, userId: "456", sessionStartedAt: "2026-08-25T18:00:01Z" })));
    await maybeRecordWebSession(storage, "Tester", now.getTime() + 6 * 60_000, "123");
    expect(cachedUsageStreak({ ...options, now: new Date("2026-08-26T10:00:00Z") })?.current).toBe(1);
  });

  it("allows a new local day to start a session inside the normal cooldown", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ recorded: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
    const beforeMidnight = new Date(2026, 7, 25, 23, 59).getTime();
    const afterMidnight = new Date(2026, 7, 26, 0, 1).getTime();

    await maybeRecordWebSession(storage, "Tester", beforeMidnight);
    expect(shouldRecordWebSession(storage, "Tester", afterMidnight)).toBe(true);
  });

  it("backs off after an unavailable analytics response", async () => {
    const storage = memoryStorage();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ recorded: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const startedAt = new Date("2026-08-25T10:00:00").getTime();

    await maybeRecordWebSession(storage, "Tester", startedAt);
    expect(shouldRecordWebSession(storage, "Tester", startedAt + 4 * 60_000)).toBe(false);
    expect(shouldRecordWebSession(storage, "Tester", startedAt + 6 * 60_000)).toBe(true);
  });
});

describe("combined study-time refresh", () => {
  const userId = "wk-user-123";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("caches normalized other-device days for offline combined totals", async () => {
    const storage = memoryStorage();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      available: true,
      days: [{ day: "2026-08-25", appTotalSeconds: 180, byCategory: { reviews: 120, lessons: 60 } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(refreshRemoteStudyTime(storage, userId, "browser-device-123", controller.signal)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith("/api/analytics/study-time?deviceId=browser-device-123", {
      cache: "no-store",
      signal: controller.signal,
    });
    expect(readCombinedStudyTimeRange(storage, userId, "browser-device-123", "today", new Date("2026-08-25T12:00:00")).summary).toMatchObject({
      totalSeconds: 180,
      appTotalSeconds: 180,
      byCategory: { reviews: 120, lessons: 60 },
    });
  });

  it("keeps the cached remote days when refresh is offline or unavailable", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      available: true,
      days: [{ day: "2026-08-25", appTotalSeconds: 60, byCategory: { news: 60 } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    await refreshRemoteStudyTime(storage, userId, "browser-device-123");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    await expect(refreshRemoteStudyTime(storage, userId, "browser-device-123")).resolves.toBe(false);

    expect(readCombinedStudyTimeRange(storage, userId, "browser-device-123", "today", new Date("2026-08-25T12:00:00")).summary.totalSeconds).toBe(60);
  });
});
