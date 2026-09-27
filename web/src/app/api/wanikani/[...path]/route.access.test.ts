// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ user: vi.fn(), fetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/session-crypto", () => ({ unsealToken: () => "verified-token" }));
vi.mock("@/lib/server/wanikani-session", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/server/wanikani-session")>(), getWaniKaniSessionUser: mocks.user }));
vi.mock("@/lib/server/request-security", () => ({ clientAddress: () => "test", isTrustedMutationOrigin: () => true }));
vi.mock("@/lib/server/rate-limit", () => ({ opaqueRateLimitKey: () => "test", takeRateLimit: () => ({ allowed: true }) }));
import { clearWkBudgetsForTests } from "@/lib/server/wk-upstream";
import { clearWkCacheForTests, readWkCache, wkCacheKey, writeWkCache } from "@/lib/server/wk-cache";
import { POST, PUT } from "./route";
import { SessionUpstreamError } from "@/lib/server/wanikani-session";

beforeEach(() => {
  clearWkCacheForTests();
  clearWkBudgetsForTests();
  mocks.user.mockReset().mockResolvedValue({ data: { username: "Portego" } });
  mocks.fetch.mockReset().mockImplementation(async () => Response.json({ data: {} }));
  vi.stubGlobal("fetch", mocks.fetch);
});

const mutations = [
  { method: "POST", path: ["reviews"], handler: POST, body: { review: { assignment_id: 1, incorrect_meaning_answers: 0, incorrect_reading_answers: 0 } } },
  { method: "PUT", path: ["assignments", "1", "start"], handler: PUT, body: { assignment: {} } },
];

it.each(mutations)("allows Portego's $method $path mutation", async ({ method, path, handler, body }) => {
  mocks.user.mockResolvedValue({ data: { username: " PORTEGO " } });
  const request = new NextRequest(`https://kakehashiapp.com/api/wanikani/${path.join("/")}`, { method, headers: { cookie: "kakehashi_wk_session=sealed" }, body: JSON.stringify(body) });
  expect((await handler(request, { params: Promise.resolve({ path }) })).status).toBe(200);
  expect(mocks.user).toHaveBeenCalledWith("verified-token");
  expect(mocks.fetch).toHaveBeenCalledOnce();
});

it.each(mutations)("allows another verified account's $method $path mutation", async ({ method, path, handler, body }) => {
  mocks.user.mockResolvedValue({ data: { username: "Learner" } });
  const request = new NextRequest(`https://kakehashiapp.com/api/wanikani/${path.join("/")}`, { method, headers: { cookie: "kakehashi_wk_session=sealed", "X-WaniKani-Username": "Portego" }, body: JSON.stringify(body) });
  expect((await handler(request, { params: Promise.resolve({ path }) })).status).toBe(200);
  expect(mocks.user).toHaveBeenCalledWith("verified-token");
  expect(mocks.fetch).toHaveBeenCalledOnce();
});

it.each(mutations)("fails closed when verification fails for $method $path", async ({ method, path, handler, body }) => {
  mocks.user.mockRejectedValue(new Error("Unavailable"));
  const request = new NextRequest(`https://kakehashiapp.com/api/wanikani/${path.join("/")}`, { method, headers: { cookie: "kakehashi_wk_session=sealed" }, body: JSON.stringify(body) });
  expect((await handler(request, { params: Promise.resolve({ path }) })).status).toBe(503);
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("preserves session verification and the subject catalog after a review", async () => {
  const sessionKey = wkCacheKey("verified-token", "session:user");
  const subjectsKey = wkCacheKey("verified-token", "https://api.wanikani.com/v2/subjects");
  const assignmentsKey = wkCacheKey("verified-token", "https://api.wanikani.com/v2/assignments");
  for (const key of [sessionKey, subjectsKey, assignmentsKey]) writeWkCache(key, { cached: true }, 60_000);
  const request = new NextRequest("https://kakehashiapp.com/api/wanikani/reviews", { method: "POST", headers: { cookie: "kakehashi_wk_session=sealed" }, body: JSON.stringify(mutations[0].body) });
  expect((await POST(request, { params: Promise.resolve({ path: ["reviews"] }) })).status).toBe(200);
  expect(readWkCache(sessionKey)).toEqual({ cached: true });
  expect(readWkCache(subjectsKey)).toEqual({ cached: true });
  expect(readWkCache(assignmentsKey)).toBeUndefined();
});

it("preserves a rate-limited account check and its retry timing before a review", async () => {
  mocks.user.mockRejectedValue(new SessionUpstreamError("Rate limit exceeded", 429, "7", "2000000000"));
  const request = new NextRequest("https://kakehashiapp.com/api/wanikani/reviews", { method: "POST", headers: { cookie: "kakehashi_wk_session=sealed" }, body: JSON.stringify(mutations[0].body) });
  const response = await POST(request, { params: Promise.resolve({ path: ["reviews"] }) });
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("7");
  expect(response.headers.get("RateLimit-Reset")).toBe("2000000000");
  expect(mocks.fetch).not.toHaveBeenCalled();
});
