import { clearCustomSrsAuthCacheForTests, handleCustomSrsRequest, validateCustomSrsRequest } from "./index.ts";
import catalog from "../../../web/src/features/custom-srs/catalog.generated.json" with { type: "json" };
import { completeCustomLesson, createCustomSrsState, enrollCustomVocabularyPack } from "../../../web/src/features/custom-srs/model.ts";
import type { CustomSrsState, CustomVocabularyPack } from "../../../web/src/features/custom-srs/types.ts";

function assert(condition: unknown, message = "Assertion failed"): asserts condition { if (!condition) throw new Error(message); }
function equal(actual: unknown, expected: unknown) { assert(JSON.stringify(actual) === JSON.stringify(expected), `Actual: ${JSON.stringify(actual)}; expected: ${JSON.stringify(expected)}`); }
const pack = catalog[0] as CustomVocabularyPack;
const eventId = "be08feb7-989f-456c-925d-dc3f313a0dcf";
const now = new Date("2026-09-07T15:00:00Z");
const env = (name: string) => ({ SUPABASE_URL: "https://cloud.example", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test" })[name];
const request = (body: unknown, token = "test-token") => new Request("https://edge.example", {
  method: "POST", headers: { "x-wanikani-token": token, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

function backend(options: { username?: string; state?: CustomSrsState; revision?: number; conflict?: boolean; failSave?: boolean } = {}) {
  let stored = options.state;
  let revision = options.revision ?? (stored ? 0 : -1);
  let conflicts = options.conflict ? 1 : 0;
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === "https://api.wanikani.com/v2/user") return Promise.resolve(Response.json({ object: "user", data: { id: "wk-account-uuid", username: options.username ?? " Portego ", level: 21 } }));
    if (url.includes("/rest/v1/custom_srs_states")) return Promise.resolve(Response.json(stored ? [{ state: stored, revision }] : []));
    if (url.endsWith("compare_and_set_custom_srs_state")) {
      const body = JSON.parse(String(init?.body));
      equal(body.p_user_id, "wk-account-uuid");
      if (options.failSave) return Promise.resolve(Response.json({ error: "private failure" }, { status: 500 }));
      if (conflicts) { conflicts -= 1; revision += 1; return Promise.resolve(Response.json(null)); }
      equal(body.p_expected_revision, revision);
      stored = body.p_state; revision += 1;
      return Promise.resolve(Response.json({ revision }));
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  return { calls, fetcher, state: () => stored, revision: () => revision };
}

Deno.test("validates only actions, UUIDs, and bounded incorrect counts", () => {
  equal(validateCustomSrsRequest({ action: "read" }), { action: "read" });
  equal(validateCustomSrsRequest({ action: "read", userId: "Portego" }), null);
  equal(validateCustomSrsRequest({ action: "enroll_pack", packId: pack.id, eventId: "bad" }), null);
  equal(validateCustomSrsRequest({ action: "submit_review", wordId: "x", incorrectAnswers: 101, eventId }), null);
  equal(validateCustomSrsRequest({ action: "complete_lesson", wordId: "x", state: {}, eventId }), null);
});

Deno.test("rejects non-Portego from verified identity before any database access", async () => {
  clearCustomSrsAuthCacheForTests();
  const server = backend({ username: "SomeoneElse" });
  const result = await handleCustomSrsRequest(request({ action: "read" }), { env, fetch: server.fetcher, now: () => now });
  equal(result.status, 403); equal(server.calls.length, 1);
});

Deno.test("no token and unavailable backend never claim saved or access storage", async () => {
  const result = await handleCustomSrsRequest(request({ action: "read" }, ""), { env });
  equal(result.status, 401);
  const unavailable = await handleCustomSrsRequest(request({ action: "read" }), { env: () => undefined });
  equal(unavailable.status, 503);
});

Deno.test("enrolls against the same cloud row and returns confirmed revision", async () => {
  clearCustomSrsAuthCacheForTests();
  const server = backend();
  const result = await handleCustomSrsRequest(request({ action: "enroll_pack", packId: pack.id, eventId }), { env, fetch: server.fetcher, now: () => now });
  equal(result.status, 200);
  const value = await result.json();
  equal(value.available, true); equal(value.revision, 0);
  equal(value.state.enrolledPackIds, [pack.id]);
  equal(Object.keys(value.state.assignments).length, pack.words.length);
  assert(server.calls[1].url.includes("user_id=eq.wk-account-uuid"));
});

Deno.test("reads JSONB policy keys in any order without resetting existing learned progress", async () => {
  clearCustomSrsAuthCacheForTests();
  const original = completeCustomLesson(enrollCustomVocabularyPack(createCustomSrsState(now), pack, now), pack.words[0].id, now);
  const state = { ...original, policy: Object.fromEntries(Object.entries(original.policy).reverse()) } as CustomSrsState;
  const server = backend({ state, revision: 5 });
  const result = await handleCustomSrsRequest(request({ action: "read" }), { env, fetch: server.fetcher, now: () => now });
  equal(result.status, 200);
  const value = await result.json();
  equal(value.revision, 5); equal(value.state.assignments[pack.words[0].id].stage, 1);
  equal(server.calls.length, 2);
});

Deno.test("lesson retry is idempotent and FSRS card exactly matches the web model", async () => {
  clearCustomSrsAuthCacheForTests();
  const initial = enrollCustomVocabularyPack(createCustomSrsState(now), pack, now);
  const server = backend({ state: initial });
  const action = { action: "complete_lesson", wordId: pack.words[0].id, eventId };
  const result = await handleCustomSrsRequest(request(action), { env, fetch: server.fetcher, now: () => now });
  equal(result.status, 200);
  equal(server.state(), completeCustomLesson(initial, pack.words[0].id, now));
  const revision = server.revision();
  const retry = await handleCustomSrsRequest(request(action), { env, fetch: server.fetcher, now: () => now });
  equal(retry.status, 200); equal(server.revision(), revision);
});

Deno.test("review retries keep one log and one advancement", async () => {
  clearCustomSrsAuthCacheForTests();
  const earlier = new Date(now.getTime() - 8 * 3_600_000);
  const initial = completeCustomLesson(enrollCustomVocabularyPack(createCustomSrsState(earlier), pack, earlier), pack.words[0].id, earlier);
  const server = backend({ state: initial });
  const action = { action: "submit_review", wordId: pack.words[0].id, incorrectAnswers: 0, eventId };
  for (let index = 0; index < 2; index += 1) {
    const result = await handleCustomSrsRequest(request(action), { env, fetch: server.fetcher, now: () => now });
    equal(result.status, 200);
  }
  equal(server.state()?.reviewLog.length, 1); equal(server.state()?.assignments[pack.words[0].id].stage, 2);
});

Deno.test("retries compare-and-set conflicts without overwriting cloud revisions", async () => {
  clearCustomSrsAuthCacheForTests();
  const server = backend({ state: enrollCustomVocabularyPack(createCustomSrsState(now), pack, now), conflict: true });
  const result = await handleCustomSrsRequest(request({ action: "complete_lesson", wordId: pack.words[0].id, eventId }), { env, fetch: server.fetcher, now: () => now });
  equal(result.status, 200); equal(server.revision(), 2);
  equal(server.calls.filter((call) => call.url.endsWith("compare_and_set_custom_srs_state")).length, 2);
});

Deno.test("failed saves and unsupported cloud policies cannot be silently replaced", async () => {
  clearCustomSrsAuthCacheForTests();
  const initial = enrollCustomVocabularyPack(createCustomSrsState(now), pack, now);
  const server = backend({ state: initial, failSave: true });
  const result = await handleCustomSrsRequest(request({ action: "complete_lesson", wordId: pack.words[0].id, eventId }), { env, fetch: server.fetcher, now: () => now });
  equal(result.status, 503); equal(server.state(), initial);
  const badState = { ...initial, policy: { ...initial.policy, version: 2 } } as unknown as CustomSrsState;
  const unsupported = backend({ state: badState });
  const rejected = await handleCustomSrsRequest(request({ action: "complete_lesson", wordId: pack.words[0].id, eventId }), { env, fetch: unsupported.fetcher, now: () => now });
  equal(rejected.status, 503);
  equal(unsupported.calls.filter((call) => call.url.includes("/rpc/")).length, 0);
});

Deno.test("no custom action is submitted to WaniKani mutation endpoints", async () => {
  clearCustomSrsAuthCacheForTests();
  const server = backend();
  await handleCustomSrsRequest(request({ action: "enroll_pack", packId: pack.id, eventId }), { env, fetch: server.fetcher, now: () => now });
  const wkCalls = server.calls.filter((call) => call.url.includes("wanikani.com"));
  equal(wkCalls.length, 1); equal(wkCalls[0].url, "https://api.wanikani.com/v2/user");
  assert(!wkCalls[0].init?.method || wkCalls[0].init?.method === "GET");
});

Deno.test("damaged learned cards fail safely without resetting progress", async () => {
  clearCustomSrsAuthCacheForTests();
  const initial = completeCustomLesson(enrollCustomVocabularyPack(createCustomSrsState(now), pack, now), pack.words[0].id, now);
  initial.assignments[pack.words[0].id].card = null;
  const server = backend({ state: initial });
  const result = await handleCustomSrsRequest(request({ action: "enroll_pack", packId: pack.id, eventId }), { env, fetch: server.fetcher, now: () => now });
  equal(result.status, 503);
  equal(server.calls.filter((call) => call.url.includes("/rpc/")).length, 0);
});
