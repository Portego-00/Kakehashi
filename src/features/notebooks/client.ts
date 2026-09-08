import { NotebookApiError, parseNotebookResponse, type NotebookResponse } from "./api";
import { DEFAULT_NOTEBOOK_LIMITS, notebookExamplesNeedInitialization, parseNotebookMutation, type NotebookBlock, type NotebookLimits, type NotebookMutation, type NotebookPage, type NotebookState } from "./model";

type Account = { id: string; token: string };
type PagePatch = Partial<Pick<NotebookPage, "title" | "icon" | "content">>;
export interface NotebookDraft {
  page: NotebookPage;
  patch: PagePatch;
  baseRevision: number;
  sequence: number;
  conflict: boolean;
  error?: string;
}
export interface NotebookSnapshot {
  accountId: string | null;
  state: NotebookState | null;
  revision: number;
  limits: NotebookLimits;
  available: boolean;
  loading: boolean;
  saveStatus: "saved" | "saving" | "offline" | "error";
  error: string | null;
  drafts: Record<string, NotebookDraft>;
}
interface Dependencies {
  request: (token: string, accountId: string, mutation?: NotebookMutation, signal?: AbortSignal) => Promise<NotebookResponse>;
  cache: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
  debounceMs?: number;
}
export const notebookCacheKey = (accountId: string) => `kakehashi:notebooks:native:v1:${encodeURIComponent(accountId)}`;
export function notebookId() { return `nb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; }
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : "Your notebook could not be saved. Your draft stays on this device.";

/** Owns drafts outside a screen's lifecycle, including requests finishing after navigation. */
export function createNotebookClient({ request, cache, debounceMs = 800 }: Dependencies) {
  let account: Account | null = null;
  let generation = 0;
  let cloud: NotebookResponse | null = null;
  let drafts: Record<string, NotebookDraft> = {};
  let loading = false;
  let pending = 0;
  let error: string | null = null;
  let offline = false;
  let queue: Promise<unknown> = Promise.resolve();
  let diskQueue: Promise<void> = Promise.resolve();
  let cacheReady: Promise<void> = Promise.resolve();
  let refreshPromise: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const localPageAdvances = new Map<string, number>();
  const controllers = new Set<AbortController>();
  const listeners = new Set<() => void>();
  let snapshot: NotebookSnapshot;

  function emit() {
    const state = cloud ? { ...cloud.state, pages: cloud.state.pages.map((page) => drafts[page.id] ? { ...page, ...drafts[page.id].patch } : page) } : null;
    if (state) for (const draft of Object.values(drafts)) {
      if (!state.pages.some((page) => page.id === draft.page.id)) state.pages.push({ ...draft.page, ...draft.patch });
    }
    snapshot = {
      accountId: account?.id ?? null, state, revision: cloud?.revision ?? -1,
      limits: cloud?.limits ?? DEFAULT_NOTEBOOK_LIMITS, available: cloud?.available ?? false,
      loading, drafts,
      saveStatus: pending ? "saving" : offline ? "offline" : error || Object.values(drafts).some((draft) => draft.error || draft.conflict) ? "error" : Object.keys(drafts).length ? "saving" : "saved",
      error,
    };
    listeners.forEach((listener) => listener());
  }
  emit();

  function current(epoch: number) {
    if (epoch !== generation || !account) throw new NotebookApiError("Your account changed. The draft stays with the original account.", 409, "account_changed");
    return account;
  }
  function persist(): Promise<void> {
    if (!account || !cloud) return Promise.resolve();
    const key = notebookCacheKey(account.id);
    const value = JSON.stringify({ version: 1, cloud, drafts });
    const epoch = generation;
    const operation = diskQueue.catch(() => undefined).then(() => cache.setItem(key, value));
    diskQueue = operation;
    void operation.catch(() => {
      if (generation === epoch) { error = "Your device could not retain this draft. Keep this page open and retry saving."; emit(); }
    });
    return operation;
  }
  function accept(incoming: NotebookResponse) {
    if (incoming.accountId !== account?.id) throw new NotebookApiError("Your account changed. Reopen notebooks to continue.", 409, "account_changed");
    if (!cloud || incoming.revision >= cloud.revision) cloud = incoming;
  }
  async function perform(mutation: NotebookMutation | undefined, epoch: number) {
    const session = current(epoch);
    const controller = new AbortController();
    controllers.add(controller);
    try {
      const result = await request(session.token, session.id, mutation, controller.signal);
      current(epoch);
      if (!result.available && mutation) throw new NotebookApiError("Notebook saving is unavailable. Your draft stays on this device.", 503);
      accept(result);
      if (mutation?.action === "update_page") {
        const saved = result.state.pages.find((page) => page.id === mutation.pageId);
        if (saved && saved.revision === mutation.expectedRevision + 1) {
          localPageAdvances.set(saved.id, (localPageAdvances.get(saved.id) ?? 0) + 1);
          // Typing can begin while a local favorite/title update is awaiting confirmation.
          const draft = drafts[saved.id];
          if (draft && !draft.conflict && draft.baseRevision === mutation.expectedRevision) {
            drafts = { ...drafts, [saved.id]: { ...draft, page: saved, baseRevision: saved.revision } };
          }
        }
      }
      offline = false;
      return result;
    } finally { controllers.delete(controller); }
  }
  function enqueue<T>(work: (epoch: number) => Promise<T>): Promise<T> {
    const epoch = generation;
    current(epoch);
    pending += 1; emit();
    const operation = queue.catch(() => undefined).then(async () => {
      current(epoch);
      await cacheReady;
      return work(epoch);
    });
    queue = operation;
    return operation.finally(() => {
      if (epoch === generation) { pending -= 1; emit(); }
    });
  }
  function report(cause: unknown) {
    error = errorMessage(cause);
    offline = cause instanceof NotebookApiError && cause.status === 0;
    emit();
  }
  function markConflicts() {
    if (!cloud) return;
    const next = { ...drafts };
    for (const [id, draft] of Object.entries(next)) {
      const saved = cloud.state.pages.find((page) => page.id === id);
      if (!saved || saved.revision !== draft.baseRevision) next[id] = { ...draft, conflict: true, error: "This page changed on another device. Keep your draft as a new page or load the saved version." };
    }
    drafts = next;
  }
  async function saveDraft(id: string, epoch: number) {
    const draft = drafts[id];
    if (!draft) return;
    if (draft.conflict) throw new NotebookApiError(draft.error || "This page changed on another device.", 409, "conflict");
    await persist();
    current(epoch);
    try {
      const result = await perform({ action: "update_page", pageId: id, expectedRevision: draft.baseRevision, patch: draft.patch }, epoch);
      const saved = result.state.pages.find((page) => page.id === id);
      if (!saved) throw new NotebookApiError("The server did not confirm this page. Your draft is retained.", 502);
      const latest = drafts[id];
      const next = { ...drafts };
      if (latest?.sequence === draft.sequence) delete next[id];
      else if (latest) next[id] = { ...latest, page: saved, baseRevision: saved.revision, error: undefined, conflict: false };
      drafts = next;
      error = null;
      emit();
      await persist();
    } catch (cause) {
      current(epoch);
      const latest = drafts[id];
      if (latest) drafts = { ...drafts, [id]: { ...latest, error: errorMessage(cause), conflict: cause instanceof NotebookApiError && cause.status === 409 } };
      report(cause);
      void persist().catch(() => undefined);
      // Fetch the saved version without replacing the local draft for conflict recovery.
      if (cause instanceof NotebookApiError && cause.status === 409) {
        try { await perform(undefined, epoch); markConflicts(); emit(); await persist(); } catch { /* Keep the known cloud version and draft. */ }
      }
      throw cause;
    }
  }
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void flushDrafts().catch(() => undefined); }, debounceMs);
  }
  function updatePageDraft(pageId: string, input: { title?: string; icon?: string; blocks?: NotebookBlock[] }) {
    current(generation);
    const page = cloud?.state.pages.find((item) => item.id === pageId) ?? drafts[pageId]?.page;
    if (!page) throw new NotebookApiError("This page could not be found.", 404, "not_found");
    const patch: PagePatch = { ...(input.title !== undefined ? { title: input.title } : {}), ...(input.icon !== undefined ? { icon: input.icon } : {}), ...(input.blocks !== undefined ? { content: input.blocks } : {}) };
    // Run the shared validator before accepting editor output. Unknown blocks cannot be erased silently.
    const validated = parseNotebookMutation({ action: "update_page", pageId, expectedRevision: page.revision, patch });
    if (validated.action !== "update_page") return;
    const prior = drafts[pageId];
    const combined = { ...prior?.patch, ...validated.patch };
    if (JSON.stringify(combined) === JSON.stringify(prior?.patch)) return;
    drafts = { ...drafts, [pageId]: { page: prior?.page ?? page, baseRevision: prior?.baseRevision ?? page.revision, patch: combined, sequence: (prior?.sequence ?? 0) + 1, conflict: prior?.conflict ?? false, ...(prior?.conflict ? { error: prior.error } : {}) } };
    error = null; emit();
    void persist().catch(() => undefined);
    if (!prior?.conflict) schedule();
  }
  function flushDrafts(): Promise<void> {
    if (timer) { clearTimeout(timer); timer = null; }
    return enqueue(async (epoch) => {
      // Each save captures a sequence. New typing during an in-flight save remains dirty.
      let conflict: unknown;
      for (const id of Object.keys(drafts)) {
        try { await saveDraft(id, epoch); }
        catch (cause) {
          if (!(cause instanceof NotebookApiError) || cause.code !== "conflict") throw cause;
          conflict ??= cause;
        }
      }
      if (Object.values(drafts).some((draft) => !draft.conflict && !draft.error)) schedule();
      if (conflict) throw conflict;
    });
  }
  async function refresh() {
    if (!account) return;
    if (refreshPromise) return refreshPromise;
    const epoch = generation;
    loading = !cloud; emit();
    const operation = enqueue(async () => {
      try {
        await perform(undefined, epoch);
        markConflicts();
        error = null;
        // Share the web's one-time example initializer, without blocking reading if it fails.
        if (cloud?.available && notebookExamplesNeedInitialization(cloud.state)) {
          try { await perform({ action: "initialize_examples" }, epoch); } catch { current(epoch); }
        }
        emit(); await persist();
      } catch (cause) { if (epoch === generation) report(cause); throw cause; }
      finally { if (epoch === generation) { loading = false; emit(); } }
    });
    refreshPromise = operation;
    try { await operation; } finally { if (refreshPromise === operation) refreshPromise = null; }
  }
  function mutate(mutation: NotebookMutation): Promise<NotebookResponse> {
    mutation = parseNotebookMutation(mutation);
    const pageId = "pageId" in mutation ? mutation.pageId : null;
    const observedPage = cloud?.state.pages.find((page) => page.id === pageId);
    const mayAdvance = "expectedRevision" in mutation && mutation.expectedRevision === observedPage?.revision;
    const previousAdvances = pageId ? localPageAdvances.get(pageId) ?? 0 : 0;
    return enqueue(async (epoch) => {
      try {
        let effective = mutation;
        if ("pageId" in mutation && "expectedRevision" in mutation && drafts[mutation.pageId]) {
          await saveDraft(mutation.pageId, epoch);
        }
        if (mayAdvance && pageId && "expectedRevision" in mutation) {
          const saved = cloud?.state.pages.find((page) => page.id === pageId);
          const advance = (localPageAdvances.get(pageId) ?? 0) - previousAdvances;
          // Rebase only revisions accounted for by this client's successful local writes.
          // An intervening remote revision still reaches the server as a genuine conflict.
          if (saved && saved.revision === mutation.expectedRevision + advance) effective = { ...mutation, expectedRevision: saved.revision };
        }
        const result = await perform(effective, epoch);
        error = null; emit(); await persist();
        return result;
      } catch (cause) { if (epoch === generation) report(cause); throw cause; }
    });
  }
  async function discardDraft(pageId: string) {
    const epoch = generation;
    const sequence = drafts[pageId]?.sequence;
    if (timer) { clearTimeout(timer); timer = null; }
    // A successful fresh read is required before throwing away recovery data.
    await refresh();
    current(epoch);
    if (drafts[pageId]?.sequence === sequence) {
      const next = { ...drafts }; delete next[pageId]; drafts = next;
      error = null; emit(); await persist();
    }
    if (Object.values(drafts).some((draft) => !draft.conflict && !draft.error)) schedule();
  }
  function duplicateDraft(pageId: string): Promise<NotebookPage> {
    const draft = drafts[pageId];
    const page = snapshot.state?.pages.find((item) => item.id === pageId);
    if (!draft || !page) return Promise.reject(new NotebookApiError("This draft could not be found.", 404));
    return enqueue(async (epoch) => {
      const id = notebookId();
      const result = await perform({ action: "create_page", page: { id, title: `${page.title || "Untitled"} (recovered)`.slice(0, 240), icon: page.icon, parentId: null, content: page.content } }, epoch);
      const created = result.state.pages.find((item) => item.id === id);
      if (!created) throw new NotebookApiError("Your recovered page could not be confirmed.", 502);
      if (drafts[pageId]?.sequence === draft.sequence) { const next = { ...drafts }; delete next[pageId]; drafts = next; }
      error = null; emit(); await persist();
      return created;
    });
  }
  function setAccount(next: Account | null) {
    if (account?.id === next?.id && account?.token === next?.token) return;
    if (timer) { clearTimeout(timer); timer = null; }
    // Pending disk writes captured their original account key and contain no credentials.
    void persist().catch(() => undefined);
    controllers.forEach((controller) => controller.abort()); controllers.clear();
    generation += 1;
    localPageAdvances.clear();
    account = next; cloud = null; drafts = {}; pending = 0; error = null; offline = false;
    loading = Boolean(next); queue = Promise.resolve(); refreshPromise = null;
    const epoch = generation; emit();
    cacheReady = next ? (async () => {
      try {
        await diskQueue.catch(() => undefined);
        const raw = await cache.getItem(notebookCacheKey(next.id));
        current(epoch);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed.version !== 1) throw new Error("Unsupported cached notebook format.");
        const cached = parseNotebookResponse(parsed.cloud);
        if (cached.accountId !== next.id) throw new Error("Cached account mismatch.");
        accept(cached);
        const recovered: Record<string, NotebookDraft> = {};
        for (const [id, value] of Object.entries(parsed.drafts ?? {})) {
          const draft = value as NotebookDraft;
          const checked = parseNotebookMutation({ action: "update_page", pageId: id, expectedRevision: draft.baseRevision, patch: draft.patch });
          if (checked.action !== "update_page" || draft.page?.id !== id || !Number.isSafeInteger(draft.sequence)) throw new Error("Invalid cached draft.");
          recovered[id] = { ...draft, patch: checked.patch };
        }
        drafts = recovered; markConflicts(); emit();
      } catch { if (epoch === generation) { error = "Some saved notebook data could not be restored. Refresh to load your cloud pages."; emit(); } }
    })() : Promise.resolve();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setAccount, refresh, mutate, updatePageDraft, flushDrafts, discardDraft, duplicateDraft,
    persistDrafts: () => diskQueue,
  };
}
