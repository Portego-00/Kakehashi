// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";
import { clearWkCacheForTests } from "@/lib/server/wk-cache";
import { applyNotebookMutation, createNotebookState } from "@/features/notebooks/model";
import { NOTEBOOK_HANDWRITING_FEATURES } from "@/features/notebooks/handwriting";
import { encodeInlineInk } from "@/features/notebooks/inline-ink";

vi.mock("server-only", () => ({}));
const analytics = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/analytics-server", () => ({ analyticsIdentityFromSealedSession: analytics }));
const userId = "00a00000-0000-4000-8000-000000000001";
const foreignId = "00a00000-0000-4000-8000-000000000002";
const token = "private-wanikani-token-test-12345";
const payload = { inkBase64: Buffer.from("native ink bytes").toString("base64"), previewBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", width: 1, height: 1 };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
function request(method: "GET" | "POST", extra: Record<string, string> = {}, body: unknown = payload, path = "/api/notebooks/native/drawings") {
  return new NextRequest(`https://kakehashi.test${path}`, { method, headers: { Authorization: `Bearer ${token}`, "X-Notebook-Account": userId, "X-Notebook-Features": "handwriting-v1", "Content-Type": "application/json", ...extra }, ...(method === "POST" ? { body: JSON.stringify(body) } : {}) });
}

describe("handwriting API ownership and round trip", () => {
  let username: string;
  let quota: boolean;
  let stored: { state: ReturnType<typeof createNotebookState>; revision: number };
  let fetchMock: ReturnType<typeof vi.fn>;
  let metadata: Record<string, unknown>[];
  let objects: Map<string, Uint8Array>;
  beforeEach(() => {
    vi.resetModules(); clearRateLimitsForTests(); clearWkCacheForTests();
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("SUPABASE_URL", "https://supabase.test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "private-service-key"); vi.stubEnv("SUPABASE_SECRET_KEY", "");
    analytics.mockReset().mockResolvedValue({ id: userId, username: "Portego" });
    username = "Portego"; quota = true; metadata = []; objects = new Map(); stored = { state: createNotebookState(), revision: 0 };
    fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.href === "https://api.wanikani.com/v2/user") return json({ data: { id: userId, username, level: 21 } });
      if (["/rest/v1/rpc/reserve_notebook_drawing", "/rest/v1/rpc/reserve_notebook_drawing_v2", "/rest/v1/rpc/reserve_notebook_drawing_v3"].includes(url.pathname)) {
        const p = JSON.parse(String(init?.body));
        if (!quota) return json(false);
        metadata.push({ id: p.p_id, user_id: p.p_user_id, width: p.p_width, height: p.p_height, ink_bytes: p.p_ink_bytes, preview_bytes: p.p_preview_bytes, status: "pending", ink_format: p.p_ink_format ?? "pencilkit-v1", dark_preview_bytes: p.p_dark_preview_bytes ?? 0, preview_format: p.p_preview_format ?? null });
        return json(true);
      }
      if (url.pathname === "/rest/v1/rpc/complete_notebook_drawing") {
        const p = JSON.parse(String(init?.body)); const row = metadata.find((row) => row.id === p.p_id && row.user_id === p.p_user_id);
        if (row) row.status = "ready"; return json(Boolean(row));
      }
      if (url.pathname === "/rest/v1/notebook_drawings") {
        const ids = (url.searchParams.get("id") || "").slice(4, -1).split(",");
        return json(metadata.filter((row) => `eq.${row.user_id}` === url.searchParams.get("user_id") && row.status === "ready" && ids.includes(String(row.id))));
      }
      if (url.pathname === "/rest/v1/notebook_states") return json([stored]);
      if (url.pathname === "/rest/v1/rpc/compare_and_set_notebook_state") {
        const p = JSON.parse(String(init?.body));
        if (p.p_expected_revision !== stored.revision) return json(null);
        stored = { state: p.p_state, revision: stored.revision + 1 }; return json({ revision: stored.revision });
      }
      if (url.pathname.startsWith("/storage/v1/object/")) {
        const key = url.pathname.replace("/authenticated/", "/");
        if (init?.method === "POST") { objects.set(key, new Uint8Array(init.body as Uint8Array)); return json({}); }
        const value = objects.get(key); return value ? new Response(new Uint8Array(value)) : json({}, 404);
      }
      throw new Error("Unexpected upstream test request.");
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("round-trips both private native preview variants and prevents legacy clients from erasing their metadata", async () => {
    const themed = { ...payload, inkFormat: "pencilkit-v1", previewFormat: "themed-v1", previewBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBoAAAAhQCBmpSThwAAAABJRU5ErkJggg==", darkPreviewBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4//9/AwAJfAN+TrsbXQAAAABJRU5ErkJggg==" };
    const features = { "X-Notebook-Features": NOTEBOOK_HANDWRITING_FEATURES };
    const { POST } = await import("./route");
    expect((await POST(request("POST", { "X-Notebook-Features": "handwriting-v1,handwriting-strokes-v1" }, themed))).status).toBe(426);
    expect(metadata).toHaveLength(0); expect(objects.size).toBe(0);
    const response = await POST(request("POST", features, themed)); expect(response.status).toBe(200);
    const reference = await response.json();
    expect(reference.previewFormat).toBe("themed-v1"); expect(objects.size).toBe(3);
    const { GET } = await import("./[drawingId]/route"); const context = { params: Promise.resolve({ drawingId: reference.drawingId }) };
    const readsBefore = fetchMock.mock.calls.filter(([url]) => String(url).includes("/storage/")).length;
    expect((await GET(request("GET"), context)).status).toBe(426);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/storage/"))).toHaveLength(readsBefore);
    expect(await (await GET(request("GET", features), context)).json()).toEqual({ accountId: userId, drawingId: reference.drawingId, ...themed });
    const { GET: preview } = await import("../../drawings/[drawingId]/preview/route");
    for (const appearance of ["light", "dark"] as const) {
      const url = `/api/notebooks/drawings/${reference.drawingId}/preview?appearance=${appearance}`;
      expect((await preview(request("GET", {}, undefined, url), context)).status).toBe(401);
      const image = await preview(request("GET", { Cookie: "kakehashi_wk_session=sealed" }, undefined, url), context);
      expect(image.status).toBe(200); expect(image.headers.get("Cache-Control")).toContain("no-store");
      expect(Buffer.from(await image.arrayBuffer()).toString("base64")).toBe(appearance === "dark" ? themed.darkPreviewBase64 : themed.previewBase64);
    }
    const { POST: mutate, GET: readState } = await import("../route");
    const create = { action: "create_page", page: { id: "page", content: [{ id: "area", type: "handwriting", props: { drawingId: reference.drawingId, width: 1, height: 1, paperColor: "auto" } }] } };
    expect((await mutate(request("POST", features, create))).status).toBe(400);
    create.page.content[0].props = { ...create.page.content[0].props, previewFormat: "themed-v1" } as typeof create.page.content[0]["props"];
    expect((await mutate(request("POST", features, create))).status).toBe(200);
    stored.state.pages[0].trashedAt = new Date().toISOString(); const before = structuredClone(stored);
    const oldFeatures = { "X-Notebook-Features": "handwriting-v1,handwriting-strokes-v1" };
    expect((await readState(request("GET", oldFeatures))).status).toBe(426);
    expect((await mutate(request("POST", oldFeatures, { action: "update_page", pageId: "page", expectedRevision: 0, patch: { content: [] } }))).status).toBe(426);
    expect(stored).toEqual(before);
  });

  it("saves editable ink and preview, binds native reads to the owner, and serves a private web PNG", async () => {
    const { POST } = await import("./route");
    const uploaded = await POST(request("POST"));
    expect(uploaded.status).toBe(200);
    const reference = await uploaded.json();
    expect(reference).toEqual({ accountId: userId, drawingId: expect.any(String), width: 1, height: 1, inkFormat: "pencilkit-v1" });
    const { GET } = await import("./[drawingId]/route");
    const downloaded = await GET(request("GET"), { params: Promise.resolve({ drawingId: reference.drawingId }) });
    expect(await downloaded.json()).toEqual({ accountId: userId, drawingId: reference.drawingId, ...payload, inkFormat: "pencilkit-v1" });
    const { GET: preview } = await import("../../drawings/[drawingId]/preview/route");
    const image = await preview(request("GET", { Cookie: "kakehashi_wk_session=sealed" }), { params: Promise.resolve({ drawingId: reference.drawingId }) });
    expect(image.status).toBe(200); expect(image.headers.get("Content-Type")).toBe("image/png");
    expect(Buffer.from(await image.arrayBuffer()).toString("base64")).toBe(payload.previewBase64);
    for (const response of [uploaded, downloaded, image]) { expect(response.headers.get("Cache-Control")).toContain("no-store"); expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff"); }
  });
  it("requires verified Portego bearer authorization and account scope before uploads", async () => {
    const { POST } = await import("./route");
    expect((await POST(request("POST", { Authorization: "", Cookie: "kakehashi_wk_session=sealed" }))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    username = "Other user";
    expect((await POST(request("POST", { "X-WaniKani-Username": "Portego" }))).status).toBe(403);
    clearWkCacheForTests(); username = "Portego";
    expect((await POST(request("POST", { "X-Notebook-Account": foreignId }))).status).toBe(409);
    expect(metadata).toHaveLength(0); expect(objects.size).toBe(0);
  });
  it("hides foreign drawing existence and checks native read account scope", async () => {
    metadata.push({ id: foreignId, user_id: "another-owner", width: 1, height: 1, ink_bytes: 8, preview_bytes: 8, status: "ready" });
    const { GET } = await import("./[drawingId]/route");
    const result = await GET(request("GET"), { params: Promise.resolve({ drawingId: foreignId }) });
    expect(result.status).toBe(404);
    expect(await result.json()).toMatchObject({ code: "not_found" });
    expect((await GET(request("GET", { "X-Notebook-Account": "" }), { params: Promise.resolve({ drawingId: foreignId }) })).status).toBe(409);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/storage/"))).toBe(false);
  });
  it("protects web previews with the sealed session and Portego gate", async () => {
    const { GET } = await import("../../drawings/[drawingId]/preview/route");
    const context = { params: Promise.resolve({ drawingId: foreignId }) };
    expect((await GET(request("GET"), context)).status).toBe(401);
    expect((await GET(request("GET", { Cookie: "kakehashi_demo_session=1; kakehashi_wk_session=sealed" }), context)).status).toBe(403);
    analytics.mockResolvedValue({ id: userId, username: "Other" });
    expect((await GET(request("GET", { Cookie: "kakehashi_wk_session=sealed" }), context)).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("bounds uploads and returns quota failure without storing objects", async () => {
    const { POST } = await import("./route");
    expect((await POST(request("POST", { "Content-Length": "99999999" }))).status).toBe(400);
    expect((await POST(request("POST", { "Content-Type": "text/plain" }))).status).toBe(415);
    expect((await POST(request("POST", {}, { ...payload, width: 2 }))).status).toBe(400);
    quota = false;
    const full = await POST(request("POST")); expect(full.status).toBe(413); expect(await full.json()).toMatchObject({ code: "limit" });
    expect(objects.size).toBe(0); expect(metadata).toHaveLength(0);
  });
  it("returns explicit 426 to old notebook readers and writers without changing stored ink", async () => {
    const { POST: upload } = await import("./route");
    const { drawingId } = await (await upload(request("POST"))).json();
    stored.state = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "page", content: [{ id: "ink", type: "handwriting", props: { drawingId, width: 1, height: 1 } }] } }).state;
    const before = structuredClone(stored);
    const { GET, POST } = await import("../route");
    const mutation = { action: "update_page", pageId: "page", expectedRevision: 0, patch: { content: [] } };
    for (const response of [await GET(request("GET", { "X-Notebook-Features": "" })), await POST(request("POST", { "X-Notebook-Features": "" }, mutation))]) {
      expect(response.status).toBe(426); expect(await response.json()).toMatchObject({ code: "update_required" });
    }
    expect(stored).toEqual(before);
    expect((await GET(request("GET"))).status).toBe(200);
    expect((await POST(request("POST", {}, { ...mutation, patch: { title: "Safe change" } }))).status).toBe(200);
    expect(stored.state.pages[0].content).toEqual(before.state.pages[0].content);
  });
  it("sanitizes storage failures without revealing keys or private upstream messages", async () => {
    const { POST } = await import("./route");
    fetchMock.mockResolvedValueOnce(json({ data: { id: userId, username: "Portego" } })).mockResolvedValueOnce(json({ error: "private database token" }, 500));
    const response = await POST(request("POST")); expect(response.status).toBe(503);
    const body = await response.text(); expect(body).not.toContain("private database token"); expect(body).not.toContain(token); expect(body).not.toContain("private-service-key");
  });
  it("negotiates portable ink before storage or reads and retains a private PNG for web viewing", async () => {
    const portable = { ...payload, inkFormat: "strokes-v1", inkBase64: encodeInlineInk({ version: 1, width: 1, height: 1, strokes: [{ id: "s1", tool: "pen", color: "#000000", width: 1, points: [[0, 0, 0.5], [1, 1, 1]] }] }) };
    const features = { "X-Notebook-Features": NOTEBOOK_HANDWRITING_FEATURES };
    const { POST } = await import("./route");
    expect((await POST(request("POST", {}, portable))).status).toBe(426);
    expect(metadata).toHaveLength(0); expect(objects.size).toBe(0);
    const uploaded = await POST(request("POST", features, portable));
    expect(uploaded.status).toBe(200);
    const reference = await uploaded.json();
    expect(reference.inkFormat).toBe("strokes-v1"); expect(metadata[0].ink_format).toBe("strokes-v1");
    const { GET } = await import("./[drawingId]/route");
    const context = { params: Promise.resolve({ drawingId: reference.drawingId }) };
    const storageBefore = fetchMock.mock.calls.filter(([url]) => String(url).includes("/storage/")).length;
    const unsupported = await GET(request("GET"), context);
    expect(unsupported.status).toBe(426);
    expect(await unsupported.json()).toMatchObject({ code: "update_required" });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/storage/"))).toHaveLength(storageBefore);
    expect(await (await GET(request("GET", features), context)).json()).toEqual({ accountId: userId, drawingId: reference.drawingId, ...portable });
    const { GET: preview } = await import("../../drawings/[drawingId]/preview/route");
    const image = await preview(request("GET", { Cookie: "kakehashi_wk_session=sealed" }), context);
    expect(image.status).toBe(200);
    expect(Buffer.from(await image.arrayBuffer()).toString("base64")).toBe(portable.previewBase64);
  });
  it("saves blank inline blocks without assets, but rejects older notebook reads and writes including trash", async () => {
    const { GET, POST } = await import("../route");
    const features = { "X-Notebook-Features": NOTEBOOK_HANDWRITING_FEATURES };
    const blank = { id: "area", type: "handwriting", props: { drawingId: "", width: 768, height: 384, inkFormat: "strokes-v1" } };
    const create = { action: "create_page", page: { id: "page", content: [{ id: "nest", type: "paragraph", children: [blank] }] } };
    expect((await POST(request("POST", {}, create))).status).toBe(426);
    expect((await POST(request("POST", features, create))).status).toBe(200);
    stored.state.pages[0].trashedAt = new Date().toISOString();
    const before = structuredClone(stored);
    expect((await GET(request("GET"))).status).toBe(426);
    expect((await POST(request("POST", {}, { action: "update_page", pageId: "page", expectedRevision: 0, patch: { content: [] } }))).status).toBe(426);
    expect(stored).toEqual(before);
    expect((await GET(request("GET", features))).status).toBe(200);
    expect(metadata).toHaveLength(0); expect(objects.size).toBe(0);
  });
  it("rejects a portable asset disguised as PencilKit before committing notebook state", async () => {
    const features = { "X-Notebook-Features": NOTEBOOK_HANDWRITING_FEATURES };
    const portable = { ...payload, inkFormat: "strokes-v1", inkBase64: encodeInlineInk({ version: 1, width: 1, height: 1, strokes: [] }) };
    const { POST: upload } = await import("./route");
    const reference = await (await upload(request("POST", features, portable))).json();
    const { POST } = await import("../route");
    const create = { action: "create_page", page: { id: "page", content: [{ id: "area", type: "handwriting", props: { drawingId: reference.drawingId, width: 1, height: 1 } }] } };
    expect((await POST(request("POST", features, create))).status).toBe(400);
    expect(stored.state.pages).toHaveLength(0);
    const correct = { ...create, page: { ...create.page, content: [{ ...create.page.content[0], props: { ...create.page.content[0].props, inkFormat: "strokes-v1" } }] } };
    expect((await POST(request("POST", features, correct))).status).toBe(200);
  });
});
