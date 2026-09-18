import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";
import { clearWkCacheForTests } from "@/lib/server/wk-cache";
import { getWaniKaniSessionUser } from "@/lib/server/wanikani-session";

const mocks = vi.hoisted(() => ({ unsealToken: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/session-crypto", () => ({ unsealToken: mocks.unsealToken }));

import { GET, POST, PUT } from "./route";

const ORIGIN = "https://kakehashi.test";
const USER_URL = "https://api.wanikani.com/v2/user";
const mutations = [
  { method: "POST", path: ["reviews"], body: { review: { assignment_id: 123, incorrect_meaning_answers: 0, incorrect_reading_answers: 0 } }, handler: POST },
  { method: "PUT", path: ["assignments", "123", "start"], body: { assignment: {} }, handler: PUT },
];

function request(method: string, path: string[], body?: unknown, options: { cookie?: string | null; origin?: string; username?: string } = {}) {
  return new NextRequest(`${ORIGIN}/api/wanikani/${path.join("/")}`, {
    method,
    headers: {
      host: "kakehashi.test",
      origin: options.origin ?? ORIGIN,
      ...(options.cookie === null ? {} : { cookie: options.cookie ?? "kakehashi_wk_session=sealed" }),
      ...(options.username ? { "X-WaniKani-Username": options.username } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function context(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

describe("WaniKani proxy core study access", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    clearRateLimitsForTests();
    clearWkCacheForTests();
    mocks.unsealToken.mockReset().mockImplementation((sealed: string) => `token-${sealed}`);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("WANIKANI_API_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe.each(mutations)("$method /$path", ({ method, path, body, handler }) => {
    it.each(["Portego", " PORTEGO ", "pOrTeGo"])("permits the server-verified username %j", async (username) => {
      fetchMock
        .mockResolvedValueOnce(Response.json({ data: { username } }))
        .mockResolvedValueOnce(Response.json({ data: { id: 123 } }));

      const response = await handler(request(method, path, body), context(path));

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe(USER_URL);
      expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer token-sealed" });
      expect(String(fetchMock.mock.calls[1][0])).toBe(`https://api.wanikani.com/v2/${path.join("/")}`);
      expect(fetchMock.mock.calls[1][1]).toMatchObject({ method, body: JSON.stringify(body), headers: { Authorization: "Bearer token-sealed" } });
    });

    it.each(["Learner", "Portego2", "", null, undefined])("blocks %j even with a forged Portego header", async (username) => {
      fetchMock.mockResolvedValueOnce(Response.json({ data: { username } }));
      const response = await handler(request(method, path, body, { username: "Portego" }), context(path));

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: "Lessons and reviews are coming soon for this account." });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(USER_URL);
    });

    it.each(["kakehashi_demo_session=1", "kakehashi_demo_session=1; kakehashi_wk_session=sealed"])("blocks demo cookie %j before any upstream request", async (cookie) => {
      const response = await handler(request(method, path, body, { cookie, username: "Portego" }), context(path));
      expect(response.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mocks.unsealToken).not.toHaveBeenCalled();
    });

    it("rejects missing, invalid, or cross-origin sessions without upstream writes", async () => {
      expect((await handler(request(method, path, body, { cookie: null }), context(path))).status).toBe(401);
      expect((await handler(request(method, path, body, { origin: "https://evil.test" }), context(path))).status).toBe(403);
      mocks.unsealToken.mockImplementationOnce(() => { throw new Error("Invalid cookie"); });
      expect((await handler(request(method, path, body), context(path))).status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([[401, 401], [403, 401], [429, 429], [500, 503]])("fails closed when account verification returns %i", async (upstreamStatus, expectedStatus) => {
      fetchMock.mockResolvedValueOnce(Response.json({ error: "Account lookup failed" }, { status: upstreamStatus, headers: { "Retry-After": "30", "RateLimit-Reset": "12345" } }));
      const response = await handler(request(method, path, body), context(path));
      expect(response.status).toBe(expectedStatus);
      expect(response.headers.get("Retry-After")).toBe("30");
      expect(response.headers.get("RateLimit-Reset")).toBe("12345");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(USER_URL);
    });

    it("fails closed when account verification cannot reach WaniKani", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Offline"));
      const response = await handler(request(method, path, body), context(path));
      expect(response.status).toBe(503);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("reuses a cached verified account without another user lookup", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: { username: "Portego" } }));
    await getWaniKaniSessionUser("token-sealed");
    fetchMock.mockClear().mockResolvedValueOnce(Response.json({ data: { id: 123 } }));
    const { method, path, body, handler } = mutations[0];

    expect((await handler(request(method, path, body), context(path))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
  });

  it("does not grant another account access from Portego's cached session", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: { username: "Portego" } }));
    await getWaniKaniSessionUser("token-portego");
    fetchMock.mockClear().mockResolvedValueOnce(Response.json({ data: { username: "Learner" } }));
    const { method, path, body, handler } = mutations[0];

    expect((await handler(request(method, path, body), context(path))).status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer token-sealed" });
  });

  it.each(["assignments", "reviews", "review_statistics", "summary", "user", "subjects"])("preserves authenticated %s reads", async (root) => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: { username: "Learner" } }));
    const response = await GET(request("GET", [root]), context([root]));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`https://api.wanikani.com/v2/${root}`);
    expect(fetchMock.mock.calls[0][1]?.method).toBe("GET");
  });

  it.each([
    { method: "POST", path: ["study_materials"], body: { study_material: { subject_id: 123, meaning_synonyms: ["example"] } }, handler: POST },
    { method: "PUT", path: ["study_materials", "123"], body: { study_material: { meaning_synonyms: ["example"] } }, handler: PUT },
  ])("preserves $method study materials for other accounts", async ({ method, path, body, handler }) => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: { id: 123 } }));
    const response = await handler(request(method, path, body), context(path));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe(method);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`https://api.wanikani.com/v2/${path.join("/")}`);
  });
});
