import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CUSTOM_SRS_POLICY } from "./scheduler";
import { customSrsStorageKey } from "./storage";
import type { CustomSrsState, CustomVocabularyPack } from "./types";
import { useCustomSrs } from "./use-custom-srs";

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
    vi.stubGlobal("crypto", { ...crypto, randomUUID: vi.fn(() => "11111111-1111-4111-8111-111111111111") });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
    const state = cloudState("2026-08-31T10:00:00Z", ["pack"]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ available: true, state, revision: 0 }))
      .mockResolvedValueOnce(jsonResponse({ available: true, state, revision: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCustomSrs("Tester", [pack]), { wrapper });
    await waitFor(() => expect(result.current.storageMode).toBe("cloud"));
    await act(async () => { await result.current.completeLesson("pack:ことば", "11111111-1111-4111-8111-111111111111"); });
    const body = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(body).toEqual({ action: "complete_lesson", wordId: "pack:ことば", eventId: "11111111-1111-4111-8111-111111111111" });
    expect(JSON.parse(window.localStorage.getItem(cloudRevisionKey) || "null")).toMatchObject({ revision: 1 });
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

  it("does not let a late mutation response regress a newer mutation revision", async () => {
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

    const olderPromise = result.current.enrollPack(pack, "33333333-3333-4333-8333-333333333333");
    const newerPromise = result.current.enrollPack(pack, "44444444-4444-4444-8444-444444444444");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    secondMutation.resolve(jsonResponse({ available: true, state: cloudState("newer", ["pack"]), revision: 2 }));
    await act(async () => { await newerPromise; });
    await waitFor(() => expect(result.current.state.updatedAt).toBe("newer"));
    firstMutation.resolve(jsonResponse({ available: true, state: cloudState("older"), revision: 1 }));
    await act(async () => { await olderPromise; });

    expect(result.current.state.updatedAt).toBe("newer");
    expect(result.current.state.enrolledPackIds).toEqual(["pack"]);
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
