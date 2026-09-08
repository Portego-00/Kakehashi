import React, { useEffect } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import { AppState, Pressable, Text, View, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { completeCustomLesson, createCustomSrsState, enrollCustomVocabularyPack } from "../../../../web/src/features/custom-srs/model";
import { customVocabularyPacks } from "../catalog";
import type { useCustomSrs as UseCustomSrs } from "../data";
import type { CustomSrsState } from "../types";

type Auth = { apiToken: string | null; userData: { id: number; username: string; level?: number } | null };
let mockAuth: Auth = { apiToken: null, userData: null };
const mockAuthListeners = new Set<() => void>();
const mockFetch = jest.fn();
const mockSnapshots = new Map<string, ReturnType<typeof useCustomSrs>>();

jest.mock("../../../utils/store", () => {
  const { useSyncExternalStore } = jest.requireActual("react");
  const subscribe = (listener: () => void) => {
    mockAuthListeners.add(listener);
    return () => mockAuthListeners.delete(listener);
  };
  return {
    useAuthStore: Object.assign(
      (selector: (state: Auth) => unknown) => useSyncExternalStore(subscribe, () => selector(mockAuth), () => selector(mockAuth)),
      { getState: () => mockAuth, subscribe },
    ),
  };
});
jest.mock("../client", () => {
  const actual = jest.requireActual("../client");
  return {
    ...actual,
    requestCustomSrsCloud: (token: string, action: unknown) => actual.requestCustomSrsCloud(token, action, {
      url: "https://cloud.example",
      anonKey: "fixture-public-key",
      fetcher: (...args: unknown[]) => mockFetch(...args),
      timeoutMs: 1_000,
    }),
  };
});

// data.ts owns a module-level client and immediately subscribes to restored auth.
// Load it only after the test store has been initialized, just as the app does.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useCustomSrs } = require("../data") as { useCustomSrs: typeof UseCustomSrs };

const pack = customVocabularyPacks[0];
const initial = enrollCustomVocabularyPack(createCustomSrsState(), pack);
const learned = completeCustomLesson(initial, pack.words[0].id);
const foregroundListeners = new Set<(state: AppStateStatus) => void>();

function setAuth(value: Auth) {
  mockAuth = value;
  mockAuthListeners.forEach((listener) => listener());
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function response(state: CustomSrsState = initial, revision = 1) {
  return { ok: true, status: 200, json: async () => ({ available: true, state, revision }) };
}
function Consumer({ name, session = false }: { name: string; session?: boolean }) {
  const srs = useCustomSrs();
  const { refresh } = srs;
  mockSnapshots.set(name, srs);
  // Sessions explicitly confirm fresh queues in addition to subscribing to the shared store.
  useEffect(() => { if (session) void refresh().catch(() => undefined); }, [session, refresh]);
  return <View>
    <Text testID={`${name}-status`}>{srs.loading ? "loading" : srs.syncing ? "syncing" : "ready"}</Text>
    <Text testID={`${name}-error`}>{srs.error}</Text>
    <Pressable testID={`${name}-retry`} onPress={() => { void srs.refresh().catch(() => undefined); }}><Text>Retry</Text></Pressable>
    <Pressable testID={`${name}-lesson`} disabled={srs.loading || srs.lessonWords.length === 0} onPress={() => { void srs.completeLesson(pack.words[0].id, "fixture-event").catch(() => undefined); }}><Text>Lesson</Text></Pressable>
  </View>;
}
async function flush() { await act(async () => { for (let turn = 0; turn < 8; turn++) await Promise.resolve(); }); }

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockFetch.mockReset();
  mockSnapshots.clear();
  foregroundListeners.clear();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
    foregroundListeners.add(listener);
    return { remove: () => foregroundListeners.delete(listener) };
  });
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" });
  setAuth({ apiToken: "fixture-token", userData: { id: 21, username: "Portego" } });
});
afterEach(async () => {
  cleanup();
  setAuth({ apiToken: null, userData: null });
  await flush();
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it("deduplicates simultaneous dashboard, hub, and explicit session refreshes and stops every spinner", async () => {
  const pending = deferred<ReturnType<typeof response>>();
  mockFetch.mockReturnValue(pending.promise);
  const screen = render(<><Consumer name="dashboard" /><Consumer name="hub" /><Consumer name="session" session /></>);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(foregroundListeners.size).toBe(1);
  await act(async () => pending.resolve(response()));
  await flush();
  for (const name of ["dashboard", "hub", "session"]) {
    expect(screen.getByTestId(`${name}-status`).props.children).toBe("ready");
    expect(mockSnapshots.get(name)?.lessonWords).toHaveLength(pack.words.length);
  }
  expect(mockFetch).toHaveBeenCalledTimes(1);
  screen.unmount();
  expect(foregroundListeners.size).toBe(0);
});

it("does not loop requests when moving from dashboard to hub to session or changing unrelated auth fields", async () => {
  mockFetch.mockResolvedValue(response());
  const screen = render(<Consumer name="dashboard" />);
  await flush();
  expect(mockFetch).toHaveBeenCalledTimes(1);
  screen.rerender(<><Consumer name="dashboard" /><Consumer name="hub" /></>);
  await flush();
  expect(mockFetch).toHaveBeenCalledTimes(2);
  screen.rerender(<><Consumer name="dashboard" /><Consumer name="hub" /><Consumer name="session" session /></>);
  await flush();
  expect(mockFetch).toHaveBeenCalledTimes(3);
  await act(async () => setAuth({ ...mockAuth, userData: { id: 21, username: "Portego", level: 22 } }));
  await flush();
  expect(mockFetch).toHaveBeenCalledTimes(3);
  expect(mockSnapshots.get("session")?.loading).toBe(false);
});

it("clears both loading flags after a real transport timeout and recovers on manual retry", async () => {
  mockFetch.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error("Aborted")));
  })).mockResolvedValue(response());
  const screen = render(<Consumer name="hub" />);
  expect(mockSnapshots.get("hub")).toMatchObject({ loading: true, syncing: true });
  await act(async () => jest.advanceTimersByTime(1_001));
  await flush();
  expect(mockSnapshots.get("hub")).toMatchObject({ loading: false, syncing: false });
  expect(screen.getByTestId("hub-error").props.children).toContain("Cloud sync timed out");
  expect(mockFetch).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByTestId("hub-retry"));
  await flush();
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(mockSnapshots.get("hub")).toMatchObject({ loading: false, syncing: false, error: null });
  mockFetch.mockResolvedValueOnce(response(learned, 2));
  fireEvent.press(screen.getByTestId("hub-lesson"));
  await flush();
  expect(JSON.parse(mockFetch.mock.calls[2][1].body)).toMatchObject({ action: "complete_lesson", wordId: pack.words[0].id });
  expect(mockSnapshots.get("hub")?.state.assignments[pack.words[0].id].stage).toBe(1);
});

it("retries a failed read once on foreground and cleans up the periodic refresh on unmount", async () => {
  mockFetch.mockRejectedValueOnce(new Error("Offline")).mockResolvedValue(response());
  const screen = render(<Consumer name="dashboard" />);
  await flush();
  expect(mockSnapshots.get("dashboard")?.error).toContain("could not be reached");
  await act(async () => foregroundListeners.forEach((listener) => listener("active")));
  await flush();
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(mockSnapshots.get("dashboard")).toMatchObject({ loading: false, syncing: false, error: null });
  screen.unmount();
  await act(async () => jest.advanceTimersByTime(120_000));
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it("ignores a late old-account request and rehydrates only the newly authorized identity", async () => {
  const old = deferred<ReturnType<typeof response>>();
  mockFetch.mockReturnValueOnce(old.promise).mockResolvedValue(response(createCustomSrsState(), 0));
  const screen = render(<Consumer name="hub" />);
  await act(async () => setAuth({ apiToken: "fixture-other-token", userData: { id: 22, username: "SomeoneElse" } }));
  await flush();
  expect(mockSnapshots.get("hub")).toMatchObject({ accountId: null, loading: false, syncing: false });
  await act(async () => old.resolve(response(learned, 3)));
  await flush();
  expect(mockSnapshots.get("hub")?.state.enrolledPackIds).toEqual([]);
  await act(async () => setAuth({ apiToken: "fixture-refreshed-token", userData: { id: 21, username: "Portego" } }));
  await flush();
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(mockSnapshots.get("hub")).toMatchObject({ accountId: "21", loading: false, syncing: false });
  expect(screen.getByTestId("hub-status").props.children).toBe("ready");
});

it("releases study loading when an older remote revision cannot replace newer restored cache", async () => {
  const pending = deferred<ReturnType<typeof response>>();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({ available: true, state: learned, revision: 3 }));
  await act(async () => {
    setAuth({ apiToken: null, userData: null });
    setAuth({ apiToken: "fixture-token", userData: { id: 21, username: "Portego" } });
  });
  mockFetch.mockReturnValue(pending.promise);
  const screen = render(<Consumer name="hub" />);
  await flush();
  expect(mockSnapshots.get("hub")?.revision).toBe(3);
  await act(async () => pending.resolve(response(initial, 2)));
  await flush();
  expect(mockSnapshots.get("hub")?.state).toEqual(learned);
  expect(mockSnapshots.get("hub")?.loading).toBe(false);
  expect(screen.getByTestId("hub-status").props.children).toBe("ready");
});

it("clears a prior read error after a successful lower-revision retry without rolling back cached progress", async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({ available: true, state: learned, revision: 3 }));
  await act(async () => {
    setAuth({ apiToken: null, userData: null });
    setAuth({ apiToken: "fixture-token", userData: { id: 21, username: "Portego" } });
  });
  mockFetch.mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(response(initial, 2));
  const screen = render(<Consumer name="hub" />);
  await flush();
  expect(mockSnapshots.get("hub")?.revision).toBe(3);
  expect(mockSnapshots.get("hub")?.error).toContain("could not be reached");
  fireEvent.press(screen.getByTestId("hub-retry"));
  await flush();
  expect(mockSnapshots.get("hub")?.state).toEqual(learned);
  expect(mockSnapshots.get("hub")).toMatchObject({ loading: false, syncing: false, error: null, revision: 3 });
});

it("opens a real-hook session after an initial timeout without restarting an unbounded refresh loop", async () => {
  const pendingSession = deferred<ReturnType<typeof response>>();
  mockFetch.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error("Aborted")));
  })).mockReturnValueOnce(pendingSession.promise);
  const screen = render(<View><Consumer name="hub" /></View>);
  await act(async () => jest.advanceTimersByTime(1_001));
  await flush();
  expect(mockSnapshots.get("hub")?.error).toContain("timed out");
  screen.rerender(<View><Consumer name="hub" /><Consumer name="session" session /></View>);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  await act(async () => pendingSession.resolve(response()));
  await flush();
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(mockSnapshots.get("session")).toMatchObject({ loading: false, syncing: false, error: null });
  expect(mockSnapshots.get("session")?.lessonWords).toHaveLength(pack.words.length);
  expect(screen.getByTestId("session-status").props.children).toBe("ready");
});
