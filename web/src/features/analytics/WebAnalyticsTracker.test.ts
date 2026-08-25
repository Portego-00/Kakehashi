import { beforeEach, describe, expect, it, vi } from "vitest";
import { maybeRecordWebSession, shouldRecordWebSession } from "./WebAnalyticsTracker";

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
