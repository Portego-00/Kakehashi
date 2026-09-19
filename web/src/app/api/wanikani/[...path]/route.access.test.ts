// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ user: vi.fn(), fetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/session-crypto", () => ({ unsealToken: () => "verified-token" }));
vi.mock("@/lib/server/wanikani-session", () => ({ getWaniKaniSessionUser: mocks.user }));
vi.mock("@/lib/server/request-security", () => ({ clientAddress: () => "test", isTrustedMutationOrigin: () => true }));
vi.mock("@/lib/server/rate-limit", () => ({ opaqueRateLimitKey: () => "test", takeRateLimit: () => ({ allowed: true }) }));
import { POST, PUT } from "./route";

beforeEach(() => {
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
