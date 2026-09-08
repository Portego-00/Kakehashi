// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyNotebookMutation, createNotebookState, DEFAULT_NOTEBOOK_LIMITS, type NotebookState } from "@/features/notebooks/model";
import { clearRateLimitsForTests, opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { clearWkCacheForTests } from "@/lib/server/wk-cache";

vi.mock("server-only", () => ({}));

const accountId = "1c2f2a60-7be3-4adc-a9ea-0d3b189748d0";
const token = "11111111-2222-3333-4444-555555555555";
const now = new Date("2026-09-07T10:00:00Z");
const existingState = applyNotebookMutation(createNotebookState(), {
  action: "create_page",
  page: { id: "page", title: "Web notebook", content: [{ id: "paragraph", type: "paragraph", content: [{ type: "text", text: "日本語のノート" }] }] },
}, now).state;
const update = { action: "update_page", pageId: "page", expectedRevision: 0, patch: { title: "Edited on mobile" } };
const response = (value: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", ...headers } });

function request(method: "GET" | "POST", options: { authorization?: string; account?: string; payload?: unknown; headers?: Record<string, string>; signal?: AbortSignal; body?: ReadableStream<Uint8Array> } = {}) {
  const headers = new Headers({ Authorization: options.authorization ?? `Bearer ${token}`, "Content-Type": "application/json", ...options.headers });
  if (options.account !== "") headers.set("X-Notebook-Account", options.account ?? accountId);
  return new NextRequest("https://kakehashi.test/api/notebooks/native", {
    method,
    headers,
    signal: options.signal,
    ...(method === "POST" ? { body: options.body ?? JSON.stringify(options.payload ?? update), ...(options.body ? { duplex: "half" } : {}) } : {}),
  });
}

describe("native notebook API", () => {
  let stored: { state: NotebookState; revision: number };
  let user: unknown;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    clearRateLimitsForTests();
    clearWkCacheForTests();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_URL", "https://supabase.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-private-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("NOTEBOOK_MAX_BYTES", "");
    stored = { state: structuredClone(existingState), revision: 7 };
    user = { object: "user", data: { id: accountId, username: "Portego", level: 21 } };
    fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://api.wanikani.com/v2/user") return response(user);
      if (url.startsWith("https://supabase.test/rest/v1/notebook_states?")) return response([stored]);
      if (url === "https://supabase.test/rest/v1/rpc/compare_and_set_notebook_state") {
        const mutation = JSON.parse(String(init?.body));
        expect(mutation.p_user_id).toBe(accountId);
        if (mutation.p_expected_revision !== stored.revision) return response(null);
        stored = { state: mutation.p_state, revision: stored.revision + 1 };
        return response({ revision: stored.revision });
      }
      throw new Error(`Unexpected test request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("verifies the bearer token and reads the same opaque storage owner as the web", async () => {
    const { GET } = await import("./route");
    const result = await GET(request("GET"));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ available: true, accountId, ...stored, limits: DEFAULT_NOTEBOOK_LIMITS });
    const [verification, read] = fetchMock.mock.calls;
    expect(verification).toMatchObject(["https://api.wanikani.com/v2/user", { headers: { Authorization: `Bearer ${token}`, "Wanikani-Revision": "20170710" }, cache: "no-store", signal: expect.any(AbortSignal) }]);
    expect(new URL(String(read[0])).searchParams.get("user_id")).toBe(`eq.${accountId}`);
    expect(read[1]).toMatchObject({ headers: { apikey: "server-private-key" }, cache: "no-store", signal: expect.any(AbortSignal) });
    expect(result.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(result.headers.get("Vary")).toBe("Authorization");
    expect(result.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(result.headers.has("Set-Cookie")).toBe(false);
    expect(result.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("reads and saves web notebooks with versioned example metadata without losing it", async () => {
    stored.state.examples = { version: 1, status: "installed", contentVersion: 2 };
    const originalPages = structuredClone(stored.state.pages);
    const originalSentences = structuredClone(stored.state.sentences);
    const { GET, POST } = await import("./route");

    const read = await GET(request("GET"));
    expect(read.status).toBe(200);
    const loaded = await read.json();
    expect(loaded.state.examples).toEqual({ version: 1, status: "installed", contentVersion: 2 });
    expect(loaded.state.pages).toEqual(originalPages);
    expect(loaded.state.sentences).toEqual(originalSentences);

    const save = await POST(request("POST"));
    expect(save.status).toBe(200);
    const saved = await save.json();
    expect(saved.state.examples).toEqual(loaded.state.examples);
    expect(saved.state.pages[0].title).toBe("Edited on mobile");
    expect(saved.state.pages[0].content).toEqual(originalPages[0].content);
    expect(saved.state.sentences).toEqual(originalSentences);
  });

  it("accepts a verified Portego username regardless of case and surrounding whitespace", async () => {
    user = { data: { id: accountId, username: "  pOrTeGo  " } };
    const { GET } = await import("./route");
    expect((await GET(request("GET"))).status).toBe(200);
  });

  it("rejects missing/malformed credentials and never treats browser or demo cookies as native authentication", async () => {
    const { GET, POST } = await import("./route");
    for (const authorization of ["", "Basic credentials", "Bearer short", `Bearer ${token},another`]) {
      const result = await GET(request("GET", { authorization, headers: { Cookie: "kakehashi_wk_session=sealed; kakehashi_demo=1" } }));
      expect(result.status).toBe(401);
      expect(result.headers.get("WWW-Authenticate")).toBe('Bearer realm="notebooks"');
      expect(await result.json()).toMatchObject({ code: "unauthorized" });
    }
    expect((await POST(request("POST", { authorization: "" }))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses other accounts even when the caller supplies Portego's name and account ID", async () => {
    user = { data: { id: "other-account", username: "Another user" } };
    const { GET, POST } = await import("./route");
    for (const method of [GET, POST]) {
      const result = await method(request(method === GET ? "GET" : "POST", { headers: { "X-WaniKani-Username": "Portego" } }));
      expect(result.status).toBe(403);
      expect(await result.json()).toMatchObject({ code: "forbidden" });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sanitizes upstream credential rejection and service failures", async () => {
    const { GET } = await import("./route");
    for (const [upstream, expected, code] of [[401, 401, "unauthorized"], [403, 401, "unauthorized"], [500, 503, "unavailable"], [429, 429, "rate_limited"]] as const) {
      fetchMock.mockResolvedValueOnce(response({ error: "private upstream details" }, upstream, { "Retry-After": "120" }));
      const result = await GET(request("GET"));
      expect(result.status).toBe(expected);
      const body = await result.json();
      expect(body.code).toBe(code);
      expect(JSON.stringify(body)).not.toContain("private upstream details");
      if (upstream === 429) expect(result.headers.get("Retry-After")).toBe("120");
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("fails closed for malformed or demo identities returned upstream", async () => {
    const { GET } = await import("./route");
    for (const id of ["", "demo-level-21", "bad,id", "x".repeat(129)]) {
      clearWkCacheForTests();
      user = { data: { id, username: "Portego" } };
      const result = await GET(request("GET"));
      expect(result.status).toBe(503);
      expect(await result.json()).toMatchObject({ code: "unavailable" });
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("requires the verified account header before parsing a write", async () => {
    const { POST } = await import("./route");
    for (const account of ["", "previous-account"]) {
      const result = await POST(request("POST", { account }));
      expect(result.status).toBe(409);
      expect(await result.json()).toMatchObject({ code: "account_changed" });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("saves a native mutation with existing optimistic revisions and exposes it on the next read", async () => {
    const { GET, POST } = await import("./route");
    const result = await POST(request("POST"));
    expect(result.status).toBe(200);
    const saved = await result.json();
    expect(saved).toMatchObject({ available: true, accountId, revision: 8, limits: DEFAULT_NOTEBOOK_LIMITS });
    expect(saved.state.pages[0]).toMatchObject({ title: "Edited on mobile", revision: 1, content: existingState.pages[0].content });
    expect(await (await GET(request("GET"))).json()).toEqual(saved);
    expect(JSON.stringify(saved)).not.toContain("server-private-key");
    expect(JSON.stringify(saved)).not.toContain(token);
  });

  it("returns a stale-page conflict without overwriting the web edit", async () => {
    stored = { state: applyNotebookMutation(stored.state, { ...update, action: "update_page", patch: { title: "Newer web edit" } }, now).state, revision: 8 };
    const { POST } = await import("./route");
    const result = await POST(request("POST"));
    expect(result.status).toBe(409);
    expect(await result.json()).toMatchObject({ code: "conflict" });
    expect(stored.state.pages[0].title).toBe("Newer web edit");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("refuses invalid, oversized, or non-JSON mutations before touching storage", async () => {
    const { POST } = await import("./route");
    const invalid = await POST(request("POST", { payload: { ...update, userId: "attacker-chosen-owner" } }));
    expect(invalid.status).toBe(400);
    const oversized = await POST(request("POST", { headers: { "Content-Length": "999999999" } }));
    expect(oversized.status).toBe(400);
    const wrongType = await POST(request("POST", { headers: { "Content-Type": "text/plain" } }));
    expect(wrongType.status).toBe(415);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cancels an interrupted request body without committing a partial update", async () => {
    const controller = new AbortController();
    const cancelled = vi.fn();
    let reading = false;
    const body = new ReadableStream<Uint8Array>({ pull() { reading = true; }, cancel: cancelled }, { highWaterMark: 0 });
    const { POST } = await import("./route");
    const pending = POST(request("POST", { signal: controller.signal, body }));
    await vi.waitFor(() => expect(reading).toBe(true));
    controller.abort();
    const result = await pending;
    expect(result.status).toBe(400);
    expect(cancelled).toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("https://supabase.test"))).toBe(false);
  });

  it("stops aborted authentication before any upstream request", async () => {
    const controller = new AbortController();
    controller.abort();
    const { GET } = await import("./route");
    expect((await GET(request("GET", { signal: controller.signal }))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rate-limits bearer traffic before contacting WaniKani or storage", async () => {
    const key = opaqueRateLimitKey("notebooks-native-read", token);
    for (let index = 0; index < 240; index++) takeRateLimit(key, 240, 10 * 60_000);
    const { GET } = await import("./route");
    const result = await GET(request("GET"));
    expect(result.status).toBe(429);
    expect(Number(result.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await result.json()).toMatchObject({ code: "rate_limited" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports unavailable storage without claiming a write succeeded", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { GET, POST } = await import("./route");
    expect(await (await GET(request("GET"))).json()).toEqual({ available: false, accountId, state: null, revision: -1, limits: DEFAULT_NOTEBOOK_LIMITS });
    const failedWrite = await POST(request("POST"));
    expect(failedWrite.status).toBe(503);
    expect(await failedWrite.json()).toMatchObject({ available: false, accountId });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sanitizes storage errors and retains the private response policy", async () => {
    fetchMock.mockResolvedValueOnce(response(user)).mockResolvedValueOnce(response({ message: "private database details" }, 500));
    const { GET } = await import("./route");
    const result = await GET(request("GET"));
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: "Your notebooks could not be loaded. Please try again.", code: "unavailable" });
    expect(result.headers.get("Cache-Control")).toContain("no-store");
  });
});
