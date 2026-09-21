// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), fetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/analytics-server", () => ({ analyticsIdentityFromSealedSession: mocks.identity }));
import { bunproAnalyticsFixture } from '@/features/bunpro/analytics-fixture';
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
it("hides cards for a revoked key", async () => {
  mocks.fetch.mockResolvedValue(Response.json({}, { status: 401 }));
  expect(await (await GET(request())).json()).toEqual({ connected: false });
});
it("loads the mobile lesson queue and deck", async () => {
  await GET(request("GET", undefined, "action=lesson-queue"));
  expect(mocks.fetch.mock.calls[0][0].pathname).toBe("/api/frontend/user/queue");
  await GET(request("GET", undefined, "action=learn&deck=1"));
  expect(mocks.fetch.mock.calls[1][0].searchParams.get("deck_id")).toBe("1");
});
it("starts the quiz with typed lesson tuples", async () => {
  expect((await POST(request("POST", { action: "lesson-quiz", deckId: 1, reviewables: [["GrammarPoint", 20], ["Vocab", 21]] }))).status).toBe(200);
  expect(mocks.fetch.mock.calls[0][0].pathname).toBe("/api/frontend/learn/quiz");
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({ deck_id: 1, reviewables: [["GrammarPoint", 20], ["Vocab", 21]] });
});
it.each([[], [["Other", 1]], [["Vocab", -1]]].map(reviewables => ({ reviewables })))("rejects invalid lesson tuples %j", async ({ reviewables }) => {
  expect((await POST(request("POST", { action: "lesson-quiz", deckId: 1, reviewables }))).status).toBe(400);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("submits lesson answers without requesting unrelated due reviews", async () => {
  await POST(request("POST", { action: "review", context: "learn", reviewId: "10", sessionId: 3, correct: true, mode: "all", reviewableType: "GrammarPoint", loadedIds: [10] }));
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toMatchObject({ only_review: null, loaded_review_ids: null, loaded_ghost_review_ids: null, loaded_self_study_review_ids: null });
});
it("does not request more quiz items until the loaded batch gets low", async () => {
  await POST(request("POST", { action: "review", requestMore: false, reviewId: "10", sessionId: 3, correct: true, mode: "grammar", reviewableType: "GrammarPoint", loadedIds: [10, 11] }));
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toMatchObject({ loaded_review_ids: null, loaded_ghost_review_ids: null, loaded_self_study_review_ids: null, only_review: "GrammarPoint" });
});
it("hydrates only the requested vocabulary coverage with deduplicated IDs", async () => {
  const response = await POST(request("POST", { action: "coverage", ids: [1, 2, 1] }));
  expect(response.status).toBe(200);
  expect(mocks.fetch.mock.calls[0][0].pathname).toBe("/api/frontend/reviews/hydrate_reviewables");
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({ reviewables: [["Vocab", 1], ["Vocab", 2]] });
});
it.each([0, 4, 10, 12])("saves the knowledge check stage %s with the Bunpro PATCH contract", async streak => {
  expect((await POST(request("POST", { action: "coverage-save", ids: [2], streak }))).status).toBe(200);
  expect(mocks.fetch.mock.calls[0][1].method).toBe("PATCH");
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({ action_type: streak === 12 ? "mark_known" : "set_streak", ...(streak === 12 ? { deck_id: null } : { new_streak: streak }), reviewables: [["Vocab", 2]] });
});
it.each([{ action: "coverage", ids: [] }, { action: "coverage", ids: [-1] }, { action: "coverage-save", ids: [1], streak: 99 }])("rejects invalid coverage requests %j", async body => {
  expect((await POST(request("POST", body))).status).toBe(400);
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it('loads and validates current analytics endpoints independently', async () => {
  mocks.fetch.mockImplementation(async (url: URL) => url.pathname.endsWith('/base_stats')
    ? Response.json({ facts: { streak: 2, days_studied: 5, grammar_studied: 10, vocab_studied: 20, last_session: 1, total_badges: 0, weekly_streak: [] } })
    : url.pathname.endsWith('/due') ? Response.json({ total_due_grammar: 2, total_due_vocab: 3 })
    : Response.json({}, { status: 503 }));
  const response = await GET(request('GET', undefined, 'action=analytics'));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ facts: { streak: 2 }, due: { total_due_grammar: 2 }, srs: null, unavailable: ['activity', 'forecast', 'srs', 'jlpt', 'reviewTotals', 'heatmap', 'cram'] });
  expect(mocks.fetch).toHaveBeenCalledTimes(9);
  expect(response.headers.get('Cache-Control')).toContain('no-store');
});
it('rejects malformed analytics rather than inventing zero counts', async () => {
  const response = await GET(request('GET', undefined, 'action=analytics'));
  expect(response.status).toBe(502);
});
it('propagates revoked keys even if other analytics endpoints succeed', async () => {
  mocks.fetch.mockImplementation(async (url: URL) => url.pathname.endsWith('/due') ? Response.json({ total_due_grammar: 2, total_due_vocab: 3 }) : Response.json({}, { status: 401 }));
  expect((await GET(request('GET', undefined, 'action=analytics'))).status).toBe(401);
});
it('does not request analytics using a key belonging to another account', async () => {
  expect((await GET(request('GET', undefined, 'action=analytics', 'other'))).status).toBe(401);
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it('uses the verified daily-history endpoint and validates the extended statistics', async () => {
  const fixture = bunproAnalyticsFixture;
  const payloads: Record<string, unknown> = {
    base_stats: { facts: fixture.facts }, activity_daily: fixture.activity, forecast_daily: fixture.forecast,
    srs_level_overview: fixture.srs, jlpt_progress_mixed: fixture.jlpt, total_review_stats: fixture.reviewTotals,
    review_heatmap: fixture.heatmap, total_cram_stats: fixture.cram, due: fixture.due,
  };
  mocks.fetch.mockImplementation(async (url: URL) => Response.json(payloads[url.pathname.split('/').at(-1)!] ?? {}));
  const response = await GET(request('GET', undefined, 'action=analytics'));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ unavailable: [], activity: fixture.activity, reviewTotals: fixture.reviewTotals, heatmap: fixture.heatmap });
  expect(mocks.fetch.mock.calls.some(([url]) => url.pathname.endsWith('/activity_daily'))).toBe(true);
  expect(mocks.fetch.mock.calls.some(([url]) => url.pathname.endsWith('/review_activity'))).toBe(false);
});
