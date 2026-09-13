import { NotebookApiError, type NotebookResponse } from "../api";
import { createNotebookClient, notebookCacheKey } from "../client";
import { applyNotebookMutation, createExampleNotebook, createNotebookState, DEFAULT_NOTEBOOK_LIMITS, EXAMPLE_NOTEBOOK_CONTENT_VERSION, NotebookError, type NotebookMutation } from "../model";

const account = { id: "account-one", token: "private-wanikani-token-one" };
const otherAccount = { id: "account-two", token: "private-wanikani-token-two" };
const now = new Date("2026-09-07T12:00:00Z");
const initial = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "page", title: "Saved page" } }, now).state;
initial.examples = { version: 1, status: "skipped" };
const update = (title: string, revision = 0): NotebookMutation => ({ action: "update_page", pageId: "page", expectedRevision: revision, patch: { title } });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = async () => { for (let index = 0; index < 30; index++) await Promise.resolve(); };

function harness(disk = new Map<string, string>()) {
  let remote: NotebookResponse = { accountId: account.id, available: true, state: JSON.parse(JSON.stringify(initial)), revision: 1, limits: DEFAULT_NOTEBOOK_LIMITS };
  const cache = {
    getItem: jest.fn(async (key: string) => disk.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { disk.set(key, value); }),
  };
  const apply = (mutation?: NotebookMutation, accountId = account.id): NotebookResponse => {
    if (mutation) {
      try {
        const result = applyNotebookMutation(remote.state, mutation, now);
        remote = { ...remote, ...result, revision: remote.revision + 1 };
      } catch (cause) {
        if (cause instanceof NotebookError) throw new NotebookApiError(cause.message, cause.status, cause.code);
        throw cause;
      }
    }
    return { ...remote, accountId };
  };
  const request = jest.fn(async (_token: string, accountId: string, mutation?: NotebookMutation, _signal?: AbortSignal) => apply(mutation, accountId));
  const client = createNotebookClient({ cache, request, debounceMs: 800 });
  return { client, cache, request, disk, apply, getRemote: () => remote, setRemote: (value: NotebookResponse) => { remote = value; } };
}

describe("native notebook draft client", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it("upgrades a legacy installed example once through the shared account API", async () => {
    const h = harness();
    const state = createExampleNotebook(now);
    state.examples = { version: 1, status: "installed" };
    state.pages[0].icon = "";
    h.setRemote({ ...h.getRemote(), state });
    h.client.setAccount(account);
    await h.client.refresh();
    expect(h.client.getSnapshot().state?.examples?.contentVersion).toBe(EXAMPLE_NOTEBOOK_CONTENT_VERSION);
    expect(h.client.getSnapshot().state?.pages[0].icon).toBe("🧭");
    await h.client.refresh();
    expect(h.request.mock.calls.filter(([, , mutation]) => mutation?.action === "initialize_examples")).toHaveLength(1);
  });

  it("keeps a draft across navigation, failed saving, refresh, and a restored client", async () => {
    const h = harness(); h.client.setAccount(account); await h.client.refresh();
    const unsubscribe = h.client.subscribe(jest.fn());
    h.client.updatePageDraft("page", { title: "Unsaved Japanese 日本語" }); unsubscribe();
    h.request.mockRejectedValueOnce(new NotebookApiError("Offline", 0));
    await expect(h.client.flushDrafts()).rejects.toMatchObject({ status: 0 });
    await h.client.refresh(); await h.client.persistDrafts();
    expect(h.client.getSnapshot().state?.pages[0].title).toBe("Unsaved Japanese 日本語");
    expect(h.client.getSnapshot().drafts.page.baseRevision).toBe(0);
    const restored = createNotebookClient({ request: h.request, cache: h.cache });
    restored.setAccount(account); await restored.refresh();
    expect(restored.getSnapshot().state?.pages[0].title).toBe("Unsaved Japanese 日本語");
    await restored.flushDrafts();
    expect(restored.getSnapshot().drafts).toEqual({});
    expect(h.getRemote().state.pages[0].title).toBe("Unsaved Japanese 日本語");
  });

  it("saves typing that arrives while the previous edit is in flight with the newly confirmed revision", async () => {
    const h = harness(); h.client.setAccount(account); await h.client.refresh();
    const gate = deferred<NotebookResponse>();
    h.request.mockImplementationOnce(async (_token, _id, mutation) => { const result = h.apply(mutation); await gate.promise; return result; });
    h.client.updatePageDraft("page", { title: "First edit" });
    const firstSave = h.client.flushDrafts(); await settle();
    h.client.updatePageDraft("page", { title: "More typing" });
    gate.resolve(h.getRemote()); await firstSave;
    expect(h.client.getSnapshot().drafts.page).toMatchObject({ baseRevision: 1, patch: { title: "More typing" } });
    await h.client.flushDrafts();
    expect(h.getRemote().state.pages[0]).toMatchObject({ title: "More typing", revision: 2 });
    expect(h.client.getSnapshot().drafts).toEqual({});
  });

  it("rebases a metadata action queued behind its own autosave without a false conflict", async () => {
    const h = harness(); h.client.setAccount(account); await h.client.refresh();
    const gate = deferred<NotebookResponse>();
    h.request.mockImplementationOnce(async (_token, _id, mutation) => { const result = h.apply(mutation); await gate.promise; return result; });
    h.client.updatePageDraft("page", { title: "Local title" });
    const save = h.client.flushDrafts(); await settle();
    const favorite = h.client.mutate({ action: "update_page", pageId: "page", expectedRevision: 0, patch: { favorite: true } });
    gate.resolve(h.getRemote()); await save; await favorite;
    expect(h.getRemote().state.pages[0]).toMatchObject({ title: "Local title", favorite: true, revision: 2 });
  });

  it("keeps typing during an in-flight local metadata update on the right base revision", async () => {
    const h = harness(); h.client.setAccount(account); await h.client.refresh();
    const gate = deferred<NotebookResponse>();
    h.request.mockImplementationOnce(async (_token, _id, mutation) => { const result = h.apply(mutation); await gate.promise; return result; });
    const favorite = h.client.mutate({ action: "update_page", pageId: "page", expectedRevision: 0, patch: { favorite: true } }); await settle();
    h.client.updatePageDraft("page", { title: "Typed during favorite" });
    gate.resolve(h.getRemote()); await favorite; await h.client.flushDrafts();
    expect(h.getRemote().state.pages[0]).toMatchObject({ title: "Typed during favorite", favorite: true, revision: 2 });
  });

  it("never rebases a queued mutation over a newer remote edit discovered by refresh", async () => {
    const h = harness(); h.client.setAccount(account); await h.client.refresh();
    const gate = deferred<NotebookResponse>(); h.request.mockImplementationOnce(() => gate.promise);
    const refresh = h.client.refresh(); await settle();
    const stale = h.client.mutate({ action: "update_page", pageId: "page", expectedRevision: 0, patch: { favorite: true } });
    const rejected = expect(stale).rejects.toMatchObject({ status: 409 });
    h.apply(update("Changed in web")); gate.resolve(h.getRemote()); await refresh; await rejected;
    expect(h.getRemote().state.pages[0]).toMatchObject({ title: "Changed in web", favorite: false });
  });

  it("preserves both versions after a real same-page conflict and recovers the draft as a new page", async () => {
    const h = harness(); h.client.setAccount(account); await h.client.refresh();
    h.client.updatePageDraft("page", { title: "Mobile draft" }); h.apply(update("Newer web title"));
    await expect(h.client.flushDrafts()).rejects.toMatchObject({ code: "conflict" });
    expect(h.client.getSnapshot().drafts.page.conflict).toBe(true);
    expect(h.client.getSnapshot().state?.pages[0].title).toBe("Mobile draft");
    const recovered = await h.client.duplicateDraft("page");
    expect(recovered.title).toBe("Mobile draft (recovered)");
    expect(h.getRemote().state.pages.find((page) => page.id === "page")?.title).toBe("Newer web title");
    expect(h.client.getSnapshot().drafts).toEqual({});
  });

  it("requires a successful fresh read before discarding recovery data", async () => {
    const h = harness(); h.client.setAccount(account); await h.client.refresh();
    h.client.updatePageDraft("page", { title: "Draft to retain" });
    h.request.mockRejectedValueOnce(new NotebookApiError("Offline", 0));
    await expect(h.client.discardDraft("page")).rejects.toMatchObject({ status: 0 });
    expect(h.client.getSnapshot().drafts.page.patch.title).toBe("Draft to retain");
    h.apply(update("Latest saved version")); await h.client.discardDraft("page");
    expect(h.client.getSnapshot().state?.pages[0].title).toBe("Latest saved version");
    expect(h.client.getSnapshot().drafts).toEqual({});
  });

  it("does not discard edits typed while the saved version is loading", async () => {
    const h = harness(); h.client.setAccount(account); await h.client.refresh();
    h.client.updatePageDraft("page", { title: "Original draft" });
    const gate = deferred<NotebookResponse>(); h.request.mockImplementationOnce(() => gate.promise);
    const discard = h.client.discardDraft("page"); await settle();
    h.client.updatePageDraft("page", { title: "New typing during recovery" });
    gate.resolve(h.getRemote()); await discard;
    expect(h.client.getSnapshot().drafts.page.patch.title).toBe("New typing during recovery");
  });

  it("does not autosave the discarded draft while waiting to load the saved version", async () => {
    const h = harness(); h.client.setAccount(account); await h.client.refresh();
    h.client.updatePageDraft("page", { title: "Discard this edit" });
    const gate = deferred<NotebookResponse>(); h.request.mockImplementationOnce(() => gate.promise);
    const discard = h.client.discardDraft("page"); await settle();
    await jest.advanceTimersByTimeAsync(1_000);
    gate.resolve(h.getRemote()); await discard; await settle();
    expect(h.getRemote().state.pages[0].title).toBe("Saved page");
    expect(h.client.getSnapshot().drafts).toEqual({});
    expect(h.request.mock.calls.filter(([, , mutation]) => mutation)).toHaveLength(0);
  });

  it("saves another page even while a previous page has an unresolved conflict", async () => {
    const h = harness(); h.client.setAccount(account); await h.client.refresh();
    await h.client.mutate({ action: "create_page", page: { id: "second", title: "Second page" } });
    h.client.updatePageDraft("page", { title: "Conflicted draft" }); h.apply(update("Remote version"));
    await h.client.refresh();
    h.client.updatePageDraft("second", { title: "Clean edit" });
    await expect(h.client.flushDrafts()).rejects.toMatchObject({ code: "conflict" });
    expect(h.getRemote().state.pages.find((page) => page.id === "second")?.title).toBe("Clean edit");
    expect(h.client.getSnapshot().drafts.page.conflict).toBe(true);
    expect(h.client.getSnapshot().drafts.second).toBeUndefined();
  });

  it("ignores stale cloud reads and preserves account-scoped credentials-free cache", async () => {
    const h = harness(); h.client.setAccount(account); await h.client.refresh();
    const old = h.getRemote(); await h.client.mutate(update("Newest"));
    h.request.mockResolvedValueOnce(old); await h.client.refresh();
    expect(h.client.getSnapshot().state?.pages[0].title).toBe("Newest");
    await h.client.persistDrafts();
    const persisted = h.disk.get(notebookCacheKey(account.id))!;
    expect(persisted).toContain("Newest");
    expect(persisted).not.toContain(account.token);
    expect(persisted).not.toContain('"token"');
    expect([...h.disk.keys()]).toEqual([notebookCacheKey(account.id)]);
  });

  it("cancels pending reads and queued writes on logout without accepting their late results", async () => {
    const h = harness(); h.client.setAccount(account); await h.client.refresh();
    h.client.updatePageDraft("page", { title: "Saved locally on logout" });
    const gate = deferred<NotebookResponse>(); h.request.mockImplementationOnce(() => gate.promise);
    const refresh = h.client.refresh(); const refreshRejected = expect(refresh).rejects.toMatchObject({ code: "account_changed" }); await settle();
    const signal = h.request.mock.calls.at(-1)?.[3];
    const queued = h.client.flushDrafts(); const writeRejected = expect(queued).rejects.toMatchObject({ code: "account_changed" });
    h.client.setAccount(null); expect(signal?.aborted).toBe(true);
    gate.resolve(h.getRemote()); await refreshRejected; await writeRejected; await h.client.persistDrafts();
    expect(h.client.getSnapshot()).toMatchObject({ accountId: null, state: null, drafts: {}, saveStatus: "saved" });
    expect(h.request.mock.calls.filter(([, , mutation]) => mutation)).toHaveLength(0);
    expect(h.disk.get(notebookCacheKey(account.id))).toContain("Saved locally on logout");
  });

  it("cancels an in-flight write on logout while retaining its original-account draft", async () => {
    const h = harness(); h.client.setAccount(account); await h.client.refresh();
    h.client.updatePageDraft("page", { title: "Uncertain write" });
    const gate = deferred<NotebookResponse>(); h.request.mockImplementationOnce(() => gate.promise);
    const saving = h.client.flushDrafts(); const rejected = expect(saving).rejects.toMatchObject({ code: "account_changed" }); await settle();
    const signal = h.request.mock.calls.at(-1)?.[3]; h.client.setAccount(null);
    expect(signal?.aborted).toBe(true); gate.resolve(h.getRemote()); await rejected; await h.client.persistDrafts();
    expect(h.disk.get(notebookCacheKey(account.id))).toContain("Uncertain write");
    expect(h.client.getSnapshot().drafts).toEqual({});
  });

  it("does not hydrate a previous account after switching while disk reads are pending", async () => {
    const h = harness(); h.client.setAccount(account); await h.client.refresh();
    h.client.updatePageDraft("page", { title: "Account one private draft" }); await h.client.persistDrafts();
    const oldCache = h.disk.get(notebookCacheKey(account.id))!;
    const gate = deferred<string | null>(); h.cache.getItem.mockImplementationOnce(() => gate.promise);
    const restored = createNotebookClient({ request: h.request, cache: h.cache }); restored.setAccount(account); await settle();
    restored.setAccount(otherAccount); await restored.refresh(); gate.resolve(oldCache); await settle();
    expect(restored.getSnapshot()).toMatchObject({ accountId: otherAccount.id, drafts: {}, error: null });
    expect(restored.getSnapshot().state?.pages[0].title).toBe("Saved page");
  });

  it("serializes disk writes so a slow older draft never overwrites a newer draft", async () => {
    const h = harness(); h.client.setAccount(account); await h.client.refresh();
    const gate = deferred<void>();
    h.cache.setItem.mockImplementationOnce(async (key, value) => { await gate.promise; h.disk.set(key, value); });
    h.client.updatePageDraft("page", { title: "Older draft" }); await settle();
    h.client.updatePageDraft("page", { title: "Newest draft" }); await settle();
    expect(h.disk.get(notebookCacheKey(account.id))).not.toContain("Newest draft");
    gate.resolve(); await h.client.persistDrafts();
    expect(JSON.parse(h.disk.get(notebookCacheKey(account.id))!).drafts.page.patch.title).toBe("Newest draft");
  });
});
