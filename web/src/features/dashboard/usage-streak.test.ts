import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activeDayKeysForSessions, cachedUsageStreak, fetchUsageStreak, recordConfirmedUsageSession, usageStreakSnapshot } from "./usage-streak";

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value); }, items };
}
const now = new Date("2026-08-25T18:00:00Z");
const options = { userId: "123", username: "Tester", timezone: "UTC", now };
function activeDays(count: number) {
  return Array.from({ length: count }, (_, index) => new Date(now.getTime() - (count - 1 - index) * 86_400_000).toISOString().slice(0, 10));
}
function response(days: string[], userId = "123") {
  return new Response(JSON.stringify({ activeDays: days, available: true, userId }));
}

describe("app usage streak", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("preserves long history and the seven-active-day freeze rules", () => {
    expect(usageStreakSnapshot(activeDays(210), "2026-08-25")).toMatchObject({ current: 210, longest: 210, activeToday: true });
    expect(usageStreakSnapshot(["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-25"], "2026-08-25")).toMatchObject({ current: 8, longest: 8, freezeAvailable: false });
    expect(usageStreakSnapshot(["2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22"], "2026-08-25")).toMatchObject({ current: 1, longest: 7, freezeAvailable: false });
  });

  it("keeps local calendar days across DST and travel", () => {
    const timestamps = ["2026-03-29T00:30:00Z", "2026-03-29T01:30:00Z", "2026-03-29T22:30:00Z"];
    expect(activeDayKeysForSessions(timestamps, "Europe/Madrid")).toEqual(["2026-03-29", "2026-03-30"]);
    expect(activeDayKeysForSessions(timestamps, "America/Los_Angeles")).toEqual(["2026-03-28", "2026-03-29"]);
  });

  it("shows persisted history immediately and avoids a duplicate fresh read", async () => {
    const storage = memoryStorage();
    vi.mocked(fetch).mockResolvedValueOnce(response(activeDays(210)));
    await fetchUsageStreak({ ...options, storage });
    expect(cachedUsageStreak({ ...options, storage })).toMatchObject({ current: 210, longest: 210 });
    expect(await fetchUsageStreak({ ...options, storage })).toMatchObject({ current: 210 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retains the last successful history offline without saving optimistic today", async () => {
    const storage = memoryStorage();
    vi.mocked(fetch).mockResolvedValueOnce(response(["2026-08-24"]));
    expect(await fetchUsageStreak({ ...options, storage })).toMatchObject({ current: 2 });
    expect(JSON.parse([...storage.items.values()][0]).activeDays).toEqual(["2026-08-24"]);
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Offline"));
    expect(await fetchUsageStreak({ ...options, storage, now: new Date("2026-08-26T00:01:00Z") })).toMatchObject({ current: 1, longest: 1 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("merges only confirmed session timestamps without extending cache freshness", async () => {
    const storage = memoryStorage();
    vi.mocked(fetch).mockResolvedValueOnce(response(["2026-08-24"]));
    await fetchUsageStreak({ ...options, storage });
    recordConfirmedUsageSession(storage, "123", "2026-08-25T18:01:00Z");
    const saved = JSON.parse([...storage.items.values()][0]);
    expect(saved.activeDays).toEqual(["2026-08-24", "2026-08-25"]);
    expect(saved.fetchedAt).toBe(now.getTime());
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Offline"));
    expect(await fetchUsageStreak({ ...options, storage, now: new Date("2026-08-26T00:01:00Z") })).toMatchObject({ current: 3 });
  });

  it("keeps an insert confirmed during a read when the older response arrives", async () => {
    const storage = memoryStorage();
    let finish!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const reading = fetchUsageStreak({ ...options, storage });
    recordConfirmedUsageSession(storage, "123", "2026-08-25T18:01:00Z");
    expect(cachedUsageStreak({ ...options, storage })).toBeUndefined();
    finish(response(["2026-08-24"]));
    await reading;
    expect(JSON.parse([...storage.items.values()][0]).activeDays).toEqual(["2026-08-24", "2026-08-25"]);
  });

  it("updates each cached timezone using the server timestamp and never creates a full history from one insert", async () => {
    const storage = memoryStorage();
    recordConfirmedUsageSession(storage, "123", "2026-08-25T18:01:00Z");
    expect(storage.items.size).toBe(0);
    vi.mocked(fetch).mockResolvedValueOnce(response(["2026-08-24"]));
    await fetchUsageStreak({ ...options, storage });
    vi.mocked(fetch).mockResolvedValueOnce(response(["2026-08-24"]));
    await fetchUsageStreak({ ...options, timezone: "Asia/Tokyo", storage });
    recordConfirmedUsageSession(storage, "123", "2026-08-25T18:01:00Z");
    const records = [...storage.items.values()].map((item) => JSON.parse(item)).filter((item) => item.version === 2);
    expect(records.find((item) => item.timezone === "UTC").activeDays).toContain("2026-08-25");
    expect(records.find((item) => item.timezone === "Asia/Tokyo").activeDays).toContain("2026-08-26");
  });

  it("isolates cache by stable account and timezone, including username changes", async () => {
    const storage = memoryStorage();
    vi.mocked(fetch).mockResolvedValueOnce(response(activeDays(210)));
    await fetchUsageStreak({ ...options, storage });
    expect(cachedUsageStreak({ ...options, username: "Renamed", storage })?.current).toBe(210);
    expect(cachedUsageStreak({ ...options, userId: "456", storage })).toBeUndefined();
    expect(cachedUsageStreak({ ...options, timezone: "Asia/Tokyo", storage })).toBeUndefined();
  });

  it("does not persist a result for another account or an aborted request", async () => {
    const storage = memoryStorage();
    vi.mocked(fetch).mockResolvedValueOnce(response(activeDays(210), "456"));
    await expect(fetchUsageStreak({ ...options, storage })).rejects.toThrow();
    expect(storage.items.size).toBe(0);
    const controller = new AbortController();
    vi.mocked(fetch).mockImplementationOnce(async () => { controller.abort(); return response(activeDays(210)); });
    await expect(fetchUsageStreak({ ...options, storage, signal: controller.signal })).rejects.toThrow();
    expect(storage.items.size).toBe(0);
  });

  it("falls back to compact public data only when the host lacks its backend", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ available: false, publicBackend: { url: "https://example.supabase.co", anonKey: "public-key" } })));
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ activeDays: activeDays(210) })));
    expect(await fetchUsageStreak({ ...options, storage: null })).toMatchObject({ current: 210 });
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain("rpc/get_app_session_active_days");
  });

  it.each([401, 429, 503])("does not multiply requests or replace uncached history on HTTP %s", async (status) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status }));
    await expect(fetchUsageStreak({ ...options, storage: null })).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed results and tolerates unavailable local storage", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(["2026-02-31"]));
    await expect(fetchUsageStreak({ ...options, storage: null })).rejects.toThrow();
    const storage = { getItem() { throw new Error("Denied"); }, setItem() { throw new Error("Full"); } };
    vi.mocked(fetch).mockResolvedValueOnce(response(activeDays(210)));
    expect(await fetchUsageStreak({ ...options, storage })).toMatchObject({ current: 210 });
  });
});
