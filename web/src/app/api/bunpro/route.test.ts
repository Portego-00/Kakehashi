// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), fetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/analytics-server", () => ({ analyticsIdentityFromSealedSession: mocks.identity }));
import { GET, POST, DELETE } from "./route";
import { sealToken } from "@/lib/server/session-crypto";
import { BUNPRO_COOKIE } from "@/lib/server/bunpro";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";
function request(method = "GET", body?: unknown, query = "action=connection", owner = "1", origin = "https://kakehashiapp.com") {
 return new NextRequest(`https://kakehashiapp.com/api/bunpro?${query}`, { method, headers: { host: "kakehashiapp.com", origin, cookie: `${WANIKANI_SESSION_COOKIE}=verified; ${BUNPRO_COOKIE}=${sealToken(JSON.stringify({ owner, token: "secret-bunpro-key" }))}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => { mocks.identity.mockReset().mockResolvedValue({ id: "1", username: "Portego" }); mocks.fetch.mockReset().mockResolvedValue(Response.json({ user: { data: {} } })); vi.stubGlobal("fetch", mocks.fetch); });
it.each([GET, POST, DELETE])("rejects non-Portego users before reaching Bunpro", async (handler) => { mocks.identity.mockResolvedValue({ id: "2", username: "Other" }); expect((await handler(request(handler === GET ? "GET" : handler === POST ? "POST" : "DELETE"))).status).toBe(403); expect(mocks.fetch).not.toHaveBeenCalled(); });
it("does not expose the key in the connection response", async () => { const response = await GET(request()); expect(await response.json()).toEqual({ connected: true }); expect(response.headers.get("Cache-Control")).toContain("no-store"); });
it("does not reuse another account's key", async () => { expect(await (await GET(request("GET", undefined, "action=connection", "other"))).json()).toEqual({ connected: false }); });
it("validates before saving an encrypted HttpOnly key", async () => { const response = await POST(request("POST", { action: "connect", token: "new-private-key" })); expect(response.status).toBe(200); const cookie = response.headers.get("set-cookie"); expect(cookie).toContain("HttpOnly"); expect(cookie).not.toContain("new-private-key"); expect(mocks.fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer new-private-key" }) })); });
it("rejects cross-origin changes", async () => { expect((await POST(request("POST", { action: "connect", token: "key" }, "", "1", "https://other.test"))).status).toBe(403); expect(mocks.fetch).not.toHaveBeenCalled(); });
it.each([["grammar", "GrammarPoint"], ["vocab", "Vocab"], ["all", null]])("forwards %s queue filter", async (mode, filter) => { await GET(request("GET", undefined, `action=queue&mode=${mode}`)); const url = mocks.fetch.mock.calls[0][0] as URL; expect(url.searchParams.get("only_review")).toBe(filter); expect(url.searchParams.get("dangerously_authenticate_using_api_token")).toBe("true"); });
it("submits the mobile review API contract", async () => { const response = await POST(request("POST", { action: "review", reviewId: "10", sessionId: 3, correct: false, mode: "grammar", reviewableType: "GrammarPoint", loadedIds: [10, 11] })); expect(response.status).toBe(200); expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({ review_session_id: 3, correct: false, fsrs_input: null, loaded_review_ids: [10, 11], loaded_ghost_review_ids: [], loaded_self_study_review_ids: [], deck_id: null, only_review: "GrammarPoint" }); });
it("does not retry or hide rejected submissions", async () => { mocks.fetch.mockResolvedValue(Response.json({}, { status: 503 })); const response = await POST(request("POST", { action: "review", reviewId: "10", sessionId: 3, correct: true, mode: "all", reviewableType: "Vocab", loadedIds: [10] })); expect(response.status).toBe(503); expect(mocks.fetch).toHaveBeenCalledOnce(); });
it("loads current Bunpro due counts without caching", async () => {
  const response = await GET(request("GET", undefined, "action=due"));
  expect(response.status).toBe(200);
  expect((mocks.fetch.mock.calls[0][0] as URL).pathname).toBe("/api/frontend/user/due");
  expect(mocks.fetch.mock.calls[0][1].cache).toBe("no-store");
});
