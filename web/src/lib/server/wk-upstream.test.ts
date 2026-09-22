// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { clearWkBudgetsForTests, fetchWaniKani } from "./wk-upstream";

beforeEach(() => { clearWkBudgetsForTests(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("shares a rolling request budget across reads and writes, isolated by token", async () => {
  const fetchMock = vi.fn().mockImplementation(async () => Response.json({}));
  vi.stubGlobal("fetch", fetchMock);
  const responses = await Promise.all(Array.from({ length: 56 }, (_, i) => fetchWaniKani("one", `https://api.wanikani.com/v2/${i % 2 ? "user" : "reviews"}`, { method: i % 2 ? "GET" : "POST" })));
  expect(responses.filter((response) => response.status === 429)).toHaveLength(1);
  expect(fetchMock).toHaveBeenCalledTimes(55);
  expect((await fetchWaniKani("two", "https://api.wanikani.com/v2/user", {})).status).toBe(200);
  await vi.advanceTimersByTimeAsync(60_000);
  expect((await fetchWaniKani("one", "https://api.wanikani.com/v2/user", {})).status).toBe(200);
});

it("honors upstream cooldown across endpoints without sending more requests", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 429, headers: { "Retry-After": "10" } })).mockImplementation(async () => Response.json({}));
  vi.stubGlobal("fetch", fetchMock);
  expect((await fetchWaniKani("one", "https://api.wanikani.com/v2/user", {})).status).toBe(429);
  expect((await fetchWaniKani("one", "https://api.wanikani.com/v2/reviews", { method: "POST" })).status).toBe(429);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(10_000);
  expect((await fetchWaniKani("one", "https://api.wanikani.com/v2/user", {})).status).toBe(200);
});
