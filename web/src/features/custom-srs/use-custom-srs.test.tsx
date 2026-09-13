import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CUSTOM_SRS_POLICY } from "./scheduler";
import { completeCustomLesson, createCustomSrsState, enrollCustomVocabularyPack, recordCustomReview } from "./model";
import { customSrsOutboxKey, parseCustomSrsOutbox } from "./outbox";
import { customSrsStorageKey } from "./storage";
import type { CustomSrsState, CustomVocabularyPack } from "./types";
import { useCustomSrs } from "./use-custom-srs";
import { createTestWebLocks } from "@/test/web-locks";

const pack: CustomVocabularyPack = {
  id: "pack",
  title: "Pack",
  description: "Pack",
  script: "hiragana",
  words: [{ id: "pack:ことば", characters: "ことば", reading: "ことば", meanings: ["word"], partsOfSpeech: ["noun"], meaningMnemonic: "A word.", readingMnemonic: "Kana.", contextSentences: [{ ja: "ことばを学ぶ。", en: "I learn a word." }] }],
};

function cloudState(updatedAt: string, enrolledPackIds: string[] = []): CustomSrsState {
  return { version: 1, policy: CUSTOM_SRS_POLICY, enrolledPackIds, assignments: {}, reviewLog: [], updatedAt };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

const cloudRevisionKey = `${customSrsStorageKey("Tester")}:cloud-revision`;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useCustomSrs", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("navigator", { locks: createTestWebLocks() });
    vi.stubGlobal("crypto", { ...crypto, randomUUID: vi.fn(() => "11111111-1111-4111-8111-111111111111") });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("durably completes a lesson and resolves while its cloud request is still pending", async () => {
    const request = deferred<Response>();
    const initial = enrollCustomVocabularyPack(createCustomSrsState(), pack);
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => init?.method === "POST"
      ? request.promise
      : Promise.resolve(jsonResponse({ available: true, state: initial, revision: 1 })));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCustomSrs("Tester", [pack]), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let resolved = false;
    act(() => { void result.current.completeLesson(pack.words[0].id).then(() => { resolved = true; }); });
    await waitFor(() => expect(resolved).toBe(true), { timeout: 150 });
    expect(result.current.state.assignments[pack.words[0].id].stage).toBe(1);
    expect(result.current.isSaving).toBe(false);
    const persisted = Object.keys(window.localStorage).map((key) => window.localStorage.getItem(key)).join("");
    expect(persisted).toContain("complete_lesson");
    await act(async () => { request.resolve(jsonResponse({ available: true, state: completeCustomLesson(initial, pack.words[0].id), revision: 2 })); });
    await waitFor(() => expect(result.current.pendingCount).toBe(0));
  });

  it("falls back to account-scoped browser persistence when the private backend is not configured", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ available: false, state: null, revision: -1 }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const { result } = renderHook(() => useCustomSrs("Tester", [pack]), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.enrollPack(pack); });
    expect(result.current.storageMode).toBe("browser");
    expect(result.current.state.enrolledPackIds).toEqual(["pack"]);
  });

  it("keeps a failed backend probe distinct from an explicit browser fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network unavailable")));
    const { result } = renderHook(() => useCustomSrs("Tester", [pack]), { wrapper });

    await waitFor(() => expect(result.current.isUnavailable).toBe(true));
    expect(result.current.storageMode).toBe("cloud");
    expect(result.current.error).toBe("Network unavailable");
  });

  it("uses server-returned progress and never sends client-owned stage or due fields", async () => {
    const state = enrollCustomVocabularyPack(createCustomSrsState(), pack);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ available: true, state, revision: 0 }))
      .mockResolvedValueOnce(jsonResponse({ available: true, state, revision: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCustomSrs("Tester", [pack]), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.completeLesson("pack:ことば", "11111111-1111-4111-8111-111111111111"); });
    const body = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(body).toEqual({ action: "complete_lesson", wordId: "pack:ことば", eventId: "11111111-1111-4111-8111-111111111111", accountId: "Tester" });
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(cloudRevisionKey) || "null")).toMatchObject({ revision: 1 }));
  });

  it("does not let an older GET revision replace newer cached progress", async () => {
    const newest = cloudState("newest", ["pack"]);
    const older = cloudState("older");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ available: true, state: newest, revision: 5 }))
      .mockResolvedValueOnce(jsonResponse({ available: true, state: older, revision: 4 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCustomSrs("Tester", [pack]), { wrapper });
    await waitFor(() => expect(result.current.state.updatedAt).toBe("newest"));

    await act(async () => { await result.current.refresh(); });

    expect(result.current.state.updatedAt).toBe("newest");
    expect(result.current.state.enrolledPackIds).toEqual(["pack"]);
  });

  it("cancels an in-flight GET before a cloud mutation", async () => {
    const initial = cloudState("initial");
    const saved = cloudState("saved", ["pack"]);
    const staleRefresh = deferred<Response>();
    let getCount = 0;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve(jsonResponse({ available: true, state: saved, revision: 2 }));
      getCount += 1;
      return getCount === 1
        ? Promise.resolve(jsonResponse({ available: true, state: initial, revision: 1 }))
        : staleRefresh.promise;
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCustomSrs("Tester", [pack]), { wrapper });
    await waitFor(() => expect(result.current.state.updatedAt).toBe("initial"));

    let refreshPromise!: ReturnType<typeof result.current.refresh>;
    act(() => { refreshPromise = result.current.refresh(); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const refreshSignal = (fetchMock.mock.calls[1][1] as RequestInit).signal as AbortSignal;

    await act(async () => { await result.current.enrollPack(pack, "22222222-2222-4222-8222-222222222222"); });

    expect(refreshSignal.aborted).toBe(true);
    await waitFor(() => expect(result.current.state.updatedAt).toBe("saved"));
    staleRefresh.resolve(jsonResponse({ available: true, state: initial, revision: 1 }));
    await act(async () => { await refreshPromise; });
    expect(result.current.state.updatedAt).toBe("saved");
  });

  it("serializes cloud requests without making a second local answer wait for the first ACK", async () => {
    const firstMutation = deferred<Response>();
    const secondMutation = deferred<Response>();
    let postCount = 0;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(jsonResponse({ available: true, state: cloudState("initial"), revision: 0 }));
      postCount += 1;
      return postCount === 1 ? firstMutation.promise : secondMutation.promise;
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCustomSrs("Tester", [pack]), { wrapper });
    await waitFor(() => expect(result.current.state.updatedAt).toBe("initial"));

    await act(async () => { await result.current.enrollPack(pack, "33333333-3333-4333-8333-333333333333"); });
    await act(async () => { await result.current.completeLesson(pack.words[0].id, "44444444-4444-4444-8444-444444444444"); });
    expect(result.current.state.assignments[pack.words[0].id].stage).toBe(1);
    expect(result.current.pendingCount).toBe(2);
    expect(postCount).toBe(1);
    const enrolled = enrollCustomVocabularyPack(createCustomSrsState(), pack);
    await act(async () => { firstMutation.resolve(jsonResponse({ available: true, state: enrolled, revision: 1 })); });
    await waitFor(() => expect(postCount).toBe(2));
    expect(result.current.state.assignments[pack.words[0].id].stage).toBe(1);
    expect(result.current.pendingCount).toBe(1);
    await act(async () => { secondMutation.resolve(jsonResponse({ available: true, state: completeCustomLesson(enrolled, pack.words[0].id), revision: 2 })); });
    await waitFor(() => expect(result.current.pendingCount).toBe(0));
    expect(result.current.state.assignments[pack.words[0].id].stage).toBe(1);
  });

  it("preserves a queued answer across remount and retries the exact event after a failed response", async () => {
    const initial = enrollCustomVocabularyPack(createCustomSrsState(), pack);
    const request = deferred<Response>();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(jsonResponse({ available: true, state: initial, revision: 1 }));
      return request.promise;
    });
    vi.stubGlobal("fetch", fetchMock);
    const first = renderHook(() => useCustomSrs("Tester", [pack]), { wrapper });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    await act(async () => { await first.result.current.completeLesson(pack.words[0].id); });
    await act(async () => { request.resolve(new Response(JSON.stringify({ error: "Offline" }), { status: 503 })); });
    await waitFor(() => expect(first.result.current.syncError).toBe("Offline"));
    const originalBody = String((fetchMock.mock.calls.find(([, init]) => init?.method === "POST")![1] as RequestInit).body);
    first.unmount();
    const retry = deferred<Response>();
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => init?.method === "POST"
      ? retry.promise : Promise.resolve(jsonResponse({ available: true, state: initial, revision: 1 })));
    const second = renderHook(() => useCustomSrs("Tester", [pack]), { wrapper });
    expect(second.result.current.state.assignments[pack.words[0].id].stage).toBe(1);
    expect(second.result.current.pendingCount).toBe(1);
    await act(async () => { await second.result.current.retrySync(); });
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(2));
    expect(String((fetchMock.mock.calls.at(-1)![1] as RequestInit).body)).toBe(originalBody);
    await act(async () => { retry.resolve(jsonResponse({ available: true, state: completeCustomLesson(initial, pack.words[0].id), revision: 2 })); });
    await waitFor(() => expect(second.result.current.pendingCount).toBe(0));
    expect(second.result.current.syncError).toBe("");
  });

  it("does not accept a local answer or start a POST when durable storage is full", async () => {
    const initial = enrollCustomVocabularyPack(createCustomSrsState(), pack);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ available: true, state: initial, revision: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCustomSrs("Tester", [pack]), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Storage full", "QuotaExceededError"); });
    await act(async () => { await expect(result.current.completeLesson(pack.words[0].id)).rejects.toThrow("Browser storage is full or unavailable."); });
    expect(result.current.state.assignments[pack.words[0].id].stage).toBe(0);
    expect(result.current.pendingCount).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not accept an answer without the cross-tab lock required for durable cloud saving", async () => {
    vi.stubGlobal("navigator", {});
    const initial = enrollCustomVocabularyPack(createCustomSrsState(), pack);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ available: true, state: initial, revision: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCustomSrs("Tester", [pack]), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await expect(result.current.completeLesson(pack.words[0].id)).rejects.toThrow("Web Locks"); });
    expect(result.current.state.assignments[pack.words[0].id].stage).toBe(0);
    expect(result.current.pendingCount).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps optimistic review progress through stale GETs and persists the review occurrence guard", async () => {
    const started = new Date(Date.now() - 86_400_000);
    const initial = completeCustomLesson(enrollCustomVocabularyPack(createCustomSrsState(started), pack, started), pack.words[0].id, started);
    const response = deferred<Response>();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => init?.method === "POST"
      ? response.promise : Promise.resolve(jsonResponse({ available: true, state: initial, revision: 1 })));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCustomSrs("Tester", [pack]), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.submitReview(pack.words[0].id, 0); });
    await act(async () => { await result.current.refresh(); });
    expect(result.current.state.assignments[pack.words[0].id].stage).toBe(2);
    const saved = parseCustomSrsOutbox(window.localStorage.getItem(customSrsOutboxKey("Tester"))!, "Tester")!;
    expect(saved.pending[0].payload).toMatchObject({ accountId: "Tester", expectedAssignmentUpdatedAt: started.toISOString() });
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]?.body))).not.toHaveProperty("stage");
    await act(async () => { response.resolve(jsonResponse({ available: true, state: recordCustomReview(initial, pack.words[0].id, 0, new Date(), saved.pending[0].payload.eventId), revision: 2 })); });
    await waitFor(() => expect(result.current.pendingCount).toBe(0));
    expect(result.current.state.reviewLog).toHaveLength(1);
  });

  it("does not send the previous account's queued answers after changing accounts", async () => {
    const initial = enrollCustomVocabularyPack(createCustomSrsState(), pack);
    const response = deferred<Response>();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => init?.method === "POST"
      ? response.promise : Promise.resolve(jsonResponse({ available: true, state: initial, revision: 1 })));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(({ scope }) => useCustomSrs(scope, [pack]), { wrapper, initialProps: { scope: "Tester" } });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.enrollPack(pack, "33333333-3333-4333-8333-333333333333"); });
    await act(async () => { await result.current.completeLesson(pack.words[0].id, "44444444-4444-4444-8444-444444444444"); });
    rerender({ scope: "Other" });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { response.resolve(jsonResponse({ available: true, state: initial, revision: 2 })); });
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.state.assignments[pack.words[0].id].stage).toBe(0);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method !== "POST").map(([url]) => url)).toEqual(["/api/custom-srs?accountId=Tester", "/api/custom-srs?accountId=Other"]);
    expect(parseCustomSrsOutbox(window.localStorage.getItem(customSrsOutboxKey("Tester"))!, "Tester")!.pending).toHaveLength(1);
  });

  it("refetches once for a newer cloud revision announced by another tab", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ available: true, state: cloudState("initial"), revision: 0 }))
      .mockResolvedValueOnce(jsonResponse({ available: true, state: cloudState("other-tab", ["pack"]), revision: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCustomSrs("Tester", [pack]), { wrapper });
    await waitFor(() => expect(result.current.state.updatedAt).toBe("initial"));

    act(() => window.dispatchEvent(new StorageEvent("storage", {
      key: cloudRevisionKey,
      newValue: JSON.stringify({ revision: 1, nonce: "other-tab" }),
    })));
    await waitFor(() => expect(result.current.state.updatedAt).toBe("other-tab"));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    act(() => window.dispatchEvent(new StorageEvent("storage", {
      key: cloudRevisionKey,
      newValue: JSON.stringify({ revision: 1, nonce: "repeat" }),
    })));
    await act(async () => { await Promise.resolve(); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
