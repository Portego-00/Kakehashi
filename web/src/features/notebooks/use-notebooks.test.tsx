import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyNotebookMutation, createNotebookState, EXAMPLE_NOTEBOOK_CONTENT_VERSION, type NotebookMutation, type NotebookState } from "./model";
import { newerNotebookResponse, useNotebooks, type NotebookResponse } from "./use-notebooks";
import { createExampleNotebook, EXAMPLE_NOTEBOOK_ROOT_ID } from "./example-notebook";

const mocks = vi.hoisted(() => ({ session: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/session", () => ({ useSession: mocks.session }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
function payload(state = createNotebookState(), revision = 0): NotebookResponse { return { available: true, state, revision }; }
function response(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } }); }
function seed(title: string): NotebookState { return { ...applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "page", title } }).state, examples: { version: 1, status: "removed" } }; }
let scope: string;
let server: Record<string, NotebookResponse>;
const clients: QueryClient[] = [];

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  clients.push(client);
  return { client, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  scope = "101";
  server = { "101": payload(seed("Account A")), "202": payload(seed("Account B")) };
  mocks.session.mockImplementation(() => ({ status: "authenticated", user: { data: { id: scope } }, isDemo: false }));
  mocks.fetch.mockImplementation(async (_url: string, options?: RequestInit) => {
    if (options?.method !== "POST") return response(server[scope]);
    const owner = new Headers(options.headers).get("X-Notebook-Account")!;
    if (owner !== scope) return response({ error: "The active account changed." }, 409);
    try {
      const result = applyNotebookMutation(server[owner].state, JSON.parse(String(options.body)) as NotebookMutation);
      server[owner] = { ...server[owner], ...result, revision: server[owner].revision + 1 };
      return response(server[owner]);
    } catch (cause) { return response({ error: cause instanceof Error ? cause.message : "Conflict" }, 409); }
  });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => { cleanup(); for (const client of clients.splice(0)) client.clear(); localStorage.clear(); vi.unstubAllGlobals(); });

describe("notebook account transport", () => {
  it.each(["new", "existing"])("initializes the example through a verified POST for a %s account", async (kind) => {
    const state = kind === "new" ? createNotebookState() : applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "personal", title: "My own work" } }).state;
    server["101"] = payload(state);
    const { wrapper } = setup();
    const { result } = renderHook(() => useNotebooks(), { wrapper });
    await waitFor(() => expect(result.current.state.examples?.status).toBe("installed"));
    expect(result.current.state.pages.some((page) => page.id === EXAMPLE_NOTEBOOK_ROOT_ID)).toBe(true);
    expect(result.current.state.pages).toHaveLength(state.pages.length + 3);
    const initialization = mocks.fetch.mock.calls.find(([, options]) => options?.method === "POST")!;
    expect(new Headers(initialization[1].headers).get("X-Notebook-Account")).toBe("101");
    expect(JSON.parse(initialization[1].body)).toEqual({ action: "initialize_examples" });
    await act(async () => { await result.current.refresh(); });
    expect(mocks.fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  });

  it("shares first-load initialization across concurrent consumers", async () => {
    server["101"] = payload();
    const { wrapper } = setup();
    const { result } = renderHook(() => [useNotebooks(), useNotebooks()], { wrapper });
    await waitFor(() => expect(result.current.every((store) => store.state.examples?.status === "installed")).toBe(true));
    expect(mocks.fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  });

  it.each([false, true])("upgrades an installed legacy tour once on load (demo: %s)", async (isDemo) => {
    const state: NotebookState = { ...createExampleNotebook("2026-09-07T00:00:00.000Z"), examples: { version: 1, status: "installed" } };
    state.pages[0].icon = "";
    if (isDemo) {
      localStorage.setItem("kakehashi:notebooks:demo:v1", JSON.stringify(payload(state, 9)));
      mocks.session.mockImplementation(() => ({ status: "authenticated", user: { data: { id: "demo-level-21" } }, isDemo: true }));
    } else server["101"] = payload(state, 9);
    const { wrapper } = setup();
    const { result } = renderHook(() => [useNotebooks(), useNotebooks()], { wrapper });
    await waitFor(() => expect(result.current[0].state.examples?.contentVersion).toBe(EXAMPLE_NOTEBOOK_CONTENT_VERSION));
    expect(result.current[0].state.pages[0].icon).toBe("🧭");
    expect(result.current[0].revision).toBe(10);
    await act(async () => { await result.current[0].refresh(); });
    expect(result.current[0].revision).toBe(10);
    expect(mocks.fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(isDemo ? 0 : 1);
    if (isDemo) expect(JSON.parse(localStorage.getItem("kakehashi:notebooks:demo:v1")!).state.examples.contentVersion).toBe(EXAMPLE_NOTEBOOK_CONTENT_VERSION);
  });

  it.each(["removed", "skipped"] as const)("does not attempt to upgrade a legacy %s example", async (status) => {
    const state = { ...seed("My notes"), examples: { version: 1 as const, status } };
    server["101"] = payload(state, 9);
    const { wrapper } = setup();
    const { result } = renderHook(() => useNotebooks(), { wrapper });
    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.state).toEqual(state);
    expect(mocks.fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
  });

  it("keeps an existing tour readable after an optional upgrade fails and retries on refresh", async () => {
    const state: NotebookState = { ...createExampleNotebook("2026-09-07T00:00:00.000Z"), examples: { version: 1, status: "installed" } };
    server["101"] = payload(state);
    const originalFetch = mocks.fetch.getMockImplementation()!;
    let failed = false;
    mocks.fetch.mockImplementation((url, options) => {
      if (options?.method === "POST" && !failed) { failed = true; return Promise.resolve(response({ error: "Temporarily unavailable" }, 503)); }
      return originalFetch(url, options);
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useNotebooks(), { wrapper });
    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.state).toEqual(state);
    expect(result.current.error).toBe("");
    await act(async () => { await result.current.refresh(); });
    await waitFor(() => expect(result.current.state.examples?.contentVersion).toBe(EXAMPLE_NOTEBOOK_CONTENT_VERSION));
  });

  it("keeps notebooks readable when optional example initialization fails", async () => {
    const state = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "personal", title: "Still available" } }).state;
    server["101"] = payload(state);
    const originalFetch = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation((url, options) => options?.method === "POST" ? Promise.resolve(response({ error: "Temporarily unavailable" }, 503)) : originalFetch(url, options));
    const { wrapper } = setup();
    const { result } = renderHook(() => useNotebooks(), { wrapper });
    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.state).toEqual(state);
    expect(result.current.error).toBe("");
  });

  it("does not dispatch initialization when the original account load is aborted", async () => {
    server["101"] = payload();
    const originalRead = deferred<Response>();
    mocks.fetch.mockReturnValueOnce(originalRead.promise);
    const { wrapper } = setup();
    const hook = renderHook(() => useNotebooks(), { wrapper });
    scope = "202";
    hook.rerender();
    await waitFor(() => expect(hook.result.current.state.pages[0]?.title).toBe("Account B"));
    await act(async () => { originalRead.resolve(response(payload())); });
    expect(mocks.fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
    expect(hook.result.current.state.pages[0]?.title).toBe("Account B");
  });

  it("initializes browser demo storage once and keeps removal across remounts", async () => {
    mocks.session.mockImplementation(() => ({ status: "authenticated", user: { data: { id: "demo-level-21" } }, isDemo: true }));
    const first = setup();
    const hook = renderHook(() => useNotebooks(), { wrapper: first.wrapper });
    await waitFor(() => expect(hook.result.current.state.examples?.status).toBe("installed"));
    await act(async () => { await hook.result.current.mutate({ action: "remove_examples" }); });
    expect(hook.result.current.state.pages).toHaveLength(0);
    hook.unmount();
    const second = setup();
    const reloaded = renderHook(() => useNotebooks(), { wrapper: second.wrapper });
    await waitFor(() => expect(reloaded.result.current.state.examples?.status).toBe("removed"));
    expect(reloaded.result.current.state.pages).toHaveLength(0);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("kakehashi:notebooks:demo:v1")!).state.examples.status).toBe("removed");
  });

  it("adds examples to an existing demo without overwriting its personal pages", async () => {
    const state = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "demo-personal", title: "Personal demo page" } }).state;
    localStorage.setItem("kakehashi:notebooks:demo:v1", JSON.stringify(payload(state, 9)));
    mocks.session.mockImplementation(() => ({ status: "authenticated", user: { data: { id: "demo-level-21" } }, isDemo: true }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useNotebooks(), { wrapper });
    await waitFor(() => expect(result.current.state.examples?.status).toBe("installed"));
    expect(result.current.state.pages[0]).toEqual(state.pages[0]);
    expect(result.current.revision).toBe(10);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("allows saving after Strict Mode replays the session effect", async () => {
    const { client } = setup();
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode><QueryClientProvider client={client}>{children}</QueryClientProvider></StrictMode>;
    const { result } = renderHook(() => useNotebooks(), { wrapper });
    await waitFor(() => expect(result.current.available).toBe(true));
    await act(async () => { await result.current.mutate({ action: "create_page", page: { id: "strict-mode", title: "Still editable" } }); });
    expect(result.current.state.pages.some((page) => page.id === "strict-mode")).toBe(true);
    expect(result.current.error).toBe("");
  });

  it("keeps a newer saved response when an older load arrives later", async () => {
    const pendingRead = deferred<Response>();
    mocks.fetch.mockReturnValueOnce(pendingRead.promise);
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useNotebooks(), { wrapper });
    const latest = payload(seed("Latest saved content"), 5);
    act(() => client.setQueryData(["notebooks", "101"], latest));
    await act(async () => { pendingRead.resolve(response(payload(seed("Old response"), 1))); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.state.pages[0].title).toBe("Latest saved content");
    expect(newerNotebookResponse(latest, payload(seed("Old"), 1))).toBe(latest);
  });

  it("switches query state without exposing the previous account's pages", async () => {
    const { wrapper } = setup();
    const { result, rerender } = renderHook(() => useNotebooks(), { wrapper });
    await waitFor(() => expect(result.current.state.pages[0]?.title).toBe("Account A"));
    scope = "202";
    rerender();
    expect(result.current.state.pages.some((page) => page.title === "Account A")).toBe(false);
    await waitFor(() => expect(result.current.state.pages[0]?.title).toBe("Account B"));
  });

  it("refreshes only for cross-tab changes to the active account", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useNotebooks(), { wrapper });
    await waitFor(() => expect(result.current.available).toBe(true));
    const reads = mocks.fetch.mock.calls.length;
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "kakehashi:notebooks:revision:202" })));
    expect(mocks.fetch).toHaveBeenCalledTimes(reads);
    server["101"] = payload(seed("Edited in another tab"), 1);
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "kakehashi:notebooks:revision:101" })));
    await waitFor(() => expect(result.current.state.pages[0]?.title).toBe("Edited in another tab"));
  });

  it("reloads current state after a revision conflict instead of overwriting a captured block", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useNotebooks(), { wrapper });
    await waitFor(() => expect(result.current.available).toBe(true));
    server["101"] = payload(applyNotebookMutation(server["101"].state, { action: "append_blocks", pageId: "page", blocks: [{ id: "captured", type: "vocabulary", props: { subjectId: 88, label: "猫" } }] }).state, 1);
    await act(async () => { await expect(result.current.mutate({ action: "update_page", pageId: "page", expectedRevision: 0, patch: { title: "Stale draft", content: [] } })).rejects.toThrow(); });
    await waitFor(() => expect(result.current.state.pages[0].content[0]?.id).toBe("captured"));
    expect(server["101"].state.pages[0].title).toBe("Account A");
  });

  it.each(["switch", "unmount"] as const)("does not dispatch a queued private mutation after %s", async (transition) => {
    const firstWrite = deferred<Response>();
    const originalFetch = mocks.fetch.getMockImplementation()!;
    let writes = 0;
    mocks.fetch.mockImplementation((url: string, options?: RequestInit) => options?.method === "POST" && ++writes === 1 ? firstWrite.promise : originalFetch(url, options));
    const { wrapper, client } = setup();
    const hook = renderHook(() => useNotebooks(), { wrapper });
    await waitFor(() => expect(hook.result.current.available).toBe(true));
    let first!: Promise<NotebookState>;
    let second!: Promise<unknown>;
    act(() => {
      first = hook.result.current.mutate({ action: "create_page", page: { id: "first", title: "Private first page" } });
      second = hook.result.current.mutate({ action: "create_page", page: { id: "queued", title: "Private queued page" } }).catch((cause: unknown) => cause);
    });
    await waitFor(() => expect(writes).toBe(1));
    if (transition === "unmount") hook.unmount();
    else {
      scope = "202";
      hook.rerender();
      await waitFor(() => expect(hook.result.current.state.pages[0]?.title).toBe("Account B"));
      expect(hook.result.current.isSaving).toBe(false);
    }
    client.removeQueries({ queryKey: ["notebooks", "101"] });
    await act(async () => {
      firstWrite.resolve(response(payload(applyNotebookMutation(server["101"].state, { action: "create_page", page: { id: "first", title: "Private first page" } }).state, 1)));
      await first;
      expect(await second).toBeInstanceOf(Error);
    });
    expect(writes).toBe(1);
    expect(client.getQueryData(["notebooks", "101"])).toBeUndefined();
    expect(server["202"].state.pages).toHaveLength(1);
  });
});
