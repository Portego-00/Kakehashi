import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyNotebookMutation, createNotebookState, EXAMPLE_NOTEBOOK_CONTENT_VERSION, type NotebookMutation } from "@/features/notebooks/model";
import { createExampleNotebook, EXAMPLE_NOTEBOOK_ROOT_ID } from "@/features/notebooks/example-notebook";

vi.mock("server-only", () => ({}));
const now = new Date("2026-09-07T10:00:00Z");
const page = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "page", title: "Original" } }, now).state;
const change: NotebookMutation = { action: "update_page", pageId: "page", expectedRevision: 0, patch: { title: "Changed" } };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

describe("private notebook server store", () => {
  beforeEach(() => {
    vi.resetModules(); vi.unstubAllGlobals();
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("SUPABASE_URL", "https://supabase.test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key"); vi.stubEnv("SUPABASE_SECRET_KEY", ""); vi.stubEnv("NOTEBOOK_MAX_BYTES", "");
  });
  it("reads only the verified account and returns empty state for a first notebook", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([])); vi.stubGlobal("fetch", fetchMock);
    const { readRemoteNotebookState } = await import("./notebooks-server");
    expect(await readRemoteNotebookState("123")).toEqual({ state: createNotebookState(), revision: -1 });
    const url = new URL(String(fetchMock.mock.calls[0][0])); expect(url.searchParams.get("user_id")).toBe("eq.123"); expect(url.pathname).toBe("/rest/v1/notebook_states");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store", headers: { apikey: "service-key" } });
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
  });
  it("accepts the opaque UUID returned by a verified WaniKani identity", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([])); vi.stubGlobal("fetch", fetchMock);
    const { readRemoteNotebookState } = await import("./notebooks-server");
    const userId = "1c2f2a60-7be3-4adc-a9ea-0d3b189748d0";
    expect(await readRemoteNotebookState(userId)).toMatchObject({ revision: -1 });
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("user_id")).toBe(`eq.${userId}`);
  });
  it("retries an unrelated account write while preserving both changes", async () => {
    const concurrent = applyNotebookMutation(page, { action: "create_page", page: { id: "other", title: "Another device" } }, now).state;
    const fetchMock = vi.fn().mockResolvedValueOnce(response([{ state: page, revision: 1 }])).mockResolvedValueOnce(response(null)).mockResolvedValueOnce(response([{ state: concurrent, revision: 2 }])).mockResolvedValueOnce(response({ revision: 3 })); vi.stubGlobal("fetch", fetchMock);
    const { mutateRemoteNotebookState } = await import("./notebooks-server");
    const result = await mutateRemoteNotebookState("123", change, () => now);
    expect(result.revision).toBe(3); expect(result.state.pages.map((item) => item.title)).toEqual(["Changed", "Another device"]);
    const body = JSON.parse(fetchMock.mock.calls[3][1].body); expect(body).toMatchObject({ p_user_id: "123", p_expected_revision: 2 }); expect(body.p_state.pages).toHaveLength(2);
  });
  it("refuses a same-page conflict after retry instead of overwriting it", async () => {
    const concurrent = applyNotebookMutation(page, { ...change, patch: { title: "Concurrent edit" } }, now).state;
    const fetchMock = vi.fn().mockResolvedValueOnce(response([{ state: page, revision: 1 }])).mockResolvedValueOnce(response(null)).mockResolvedValueOnce(response([{ state: concurrent, revision: 2 }])); vi.stubGlobal("fetch", fetchMock);
    const { mutateRemoteNotebookState } = await import("./notebooks-server");
    await expect(mutateRemoteNotebookState("123", change, () => now)).rejects.toMatchObject({ code: "conflict", status: 409 }); expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("caps optimistic retries and reports a conflict instead of success", async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init) => Promise.resolve(init?.method === "POST" ? response(null) : response([{ state: page, revision: 1 }]))); vi.stubGlobal("fetch", fetchMock);
    const { mutateRemoteNotebookState } = await import("./notebooks-server");
    await expect(mutateRemoteNotebookState("123", change)).rejects.toMatchObject({ code: "conflict" }); expect(fetchMock).toHaveBeenCalledTimes(8);
  });
  it("skips writes for idempotent creation replays", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([{ state: page, revision: 2 }])); vi.stubGlobal("fetch", fetchMock);
    const { mutateRemoteNotebookState } = await import("./notebooks-server");
    expect(await mutateRemoteNotebookState("123", { action: "create_page", page: { id: "page", title: "Original" } })).toMatchObject({ revision: 2 }); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("fails closed on malformed stored content instead of replacing it with an empty notebook", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([{ state: { version: 99, pages: [], sentences: [] }, revision: 0 }])));
    const { readRemoteNotebookState } = await import("./notebooks-server"); await expect(readRemoteNotebookState("123")).rejects.toThrow();
  });
  it("rejects demo and unverified account IDs before any remote request", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); const { readRemoteNotebookState, mutateRemoteNotebookState } = await import("./notebooks-server");
    for (const id of ["demo-level-21", "", "123,other", "?invalid"]) { await expect(readRemoteNotebookState(id)).rejects.toMatchObject({ status: 403 }); await expect(mutateRemoteNotebookState(id, change)).rejects.toMatchObject({ status: 403 }); } expect(fetchMock).not.toHaveBeenCalled();
  });
  it("never uses a public Supabase credential for private notebooks", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", ""); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-key"); const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const { notebooksBackendConfigured, readRemoteNotebookState, mutateRemoteNotebookState } = await import("./notebooks-server"); expect(notebooksBackendConfigured()).toBe(false);
    expect(await readRemoteNotebookState("123")).toMatchObject({ revision: -1 }); await expect(mutateRemoteNotebookState("123", change)).rejects.toThrow(/not configured/); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("bounds the configurable account budget", async () => {
    const { notebookServerLimits } = await import("./notebooks-server");
    expect(notebookServerLimits().maxBytes).toBe(1_048_576); vi.stubEnv("NOTEBOOK_MAX_BYTES", "999999999999"); expect(notebookServerLimits().maxBytes).toBe(4_194_304); vi.stubEnv("NOTEBOOK_MAX_BYTES", "bad"); expect(notebookServerLimits().maxBytes).toBe(1_048_576); vi.stubEnv("NOTEBOOK_MAX_BYTES", "1"); expect(notebookServerLimits().maxBytes).toBe(65_536);
  });
  it("initializes concurrently across devices only once without replacing personal data", async () => {
    let stored = { state: page, revision: 7 };
    const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
      if (init?.method !== "POST") return response([{ ...stored }]);
      const body = JSON.parse(init.body);
      if (body.p_expected_revision !== stored.revision) return response(null);
      stored = { state: body.p_state, revision: stored.revision + 1 };
      return response({ revision: stored.revision });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { mutateRemoteNotebookState } = await import("./notebooks-server");
    const results = await Promise.all([mutateRemoteNotebookState("123", { action: "initialize_examples" }, () => now), mutateRemoteNotebookState("123", { action: "initialize_examples" }, () => now)]);
    for (const result of results) {
      expect(result.revision).toBe(8);
      expect(result.state.examples?.status).toBe("installed");
      expect(result.state.pages).toHaveLength(4);
      expect(result.state.pages[0]).toEqual(page.pages[0]);
    }
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(2);
    expect(stored.revision).toBe(8);
  });
  it("does not reinstall after another device removed the example during initialization", async () => {
    const removed = applyNotebookMutation(page, { action: "remove_examples" }, now).state;
    const fetchMock = vi.fn().mockResolvedValueOnce(response([{ state: page, revision: 1 }])).mockResolvedValueOnce(response(null)).mockResolvedValueOnce(response([{ state: removed, revision: 2 }]));
    vi.stubGlobal("fetch", fetchMock);
    const { mutateRemoteNotebookState } = await import("./notebooks-server");
    const result = await mutateRemoteNotebookState("123", { action: "initialize_examples" }, () => now);
    expect(result).toEqual({ state: removed, revision: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("upgrades concurrent legacy examples once and keeps a same-page edit made during the first CAS", async () => {
    const state = createExampleNotebook(now);
    state.examples = { version: 1, status: "installed" };
    state.pages[0].icon = "";
    const edited = applyNotebookMutation(state, { action: "update_page", pageId: EXAMPLE_NOTEBOOK_ROOT_ID, expectedRevision: 0, patch: { title: "My own start", icon: "⭐" } }, now).state;
    let stored = { state, revision: 7 };
    let intervened = false;
    const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
      if (init?.method !== "POST") return response([{ ...stored }]);
      const body = JSON.parse(init.body);
      if (!intervened) { stored = { state: edited, revision: 8 }; intervened = true; }
      if (body.p_expected_revision !== stored.revision) return response(null);
      stored = { state: body.p_state, revision: stored.revision + 1 };
      return response({ revision: stored.revision });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { mutateRemoteNotebookState } = await import("./notebooks-server");
    const results = await Promise.all([mutateRemoteNotebookState("123", { action: "initialize_examples" }, () => now), mutateRemoteNotebookState("123", { action: "initialize_examples" }, () => now)]);
    for (const result of results) {
      expect(result.revision).toBe(9);
      expect(result.state.examples?.contentVersion).toBe(EXAMPLE_NOTEBOOK_CONTENT_VERSION);
      expect(result.state.pages[0]).toMatchObject({ title: "My own start", icon: "⭐", revision: 1 });
    }
    expect(stored.revision).toBe(9);
    expect(stored.state.pages).toHaveLength(3);
  });

  it("abandons a pending upgrade when another device removes the legacy tour", async () => {
    const state = createExampleNotebook(now);
    state.examples = { version: 1, status: "installed" };
    const removed = applyNotebookMutation(state, { action: "remove_examples" }, now).state;
    const fetchMock = vi.fn().mockResolvedValueOnce(response([{ state, revision: 1 }])).mockResolvedValueOnce(response(null)).mockResolvedValueOnce(response([{ state: removed, revision: 2 }]));
    vi.stubGlobal("fetch", fetchMock);
    const { mutateRemoteNotebookState } = await import("./notebooks-server");
    expect(await mutateRemoteNotebookState("123", { action: "initialize_examples" }, () => now)).toEqual({ state: removed, revision: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
