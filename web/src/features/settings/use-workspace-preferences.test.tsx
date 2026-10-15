import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_JPDB_KEY } from "@/features/demo/jpdb";
import { setDemoMode } from "@/features/demo/runtime";
import { DEFAULT_WEB_SETTINGS, notifyWebSettingsChanged, saveWebSettings, settingsStorageKey } from "./settings";
import { useWebSettings, useWebSettingsState } from "./use-workspace-preferences";

beforeEach(() => { window.localStorage.clear(); setDemoMode(false); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); setDemoMode(false); });

describe("editable settings state", () => {
  it("distinguishes unavailable browser storage from a new account", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    const { result } = renderHook(() => useWebSettingsState("Tester"));
    expect(result.current.status).toBe("error");
  });

  it("recovers from a denied read when the user retries", () => {
    saveWebSettings(localStorage, "Tester", { ...DEFAULT_WEB_SETTINGS, textScale: 1.2 });
    const original = Storage.prototype.getItem;
    let denied = true;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function(this: Storage, key: string) {
      if (denied) throw new DOMException("Denied", "SecurityError");
      return original.call(this, key);
    });
    const { result } = renderHook(() => useWebSettingsState("Tester"));
    expect(result.current.status).toBe("error");
    denied = false;
    act(() => notifyWebSettingsChanged("Tester"));
    expect(result.current).toMatchObject({ status: "ready", settings: { textScale: 1.2 } });
  });

  it("switches accounts without carrying over the previous account's values", () => {
    saveWebSettings(localStorage, "Tester", { ...DEFAULT_WEB_SETTINGS, textScale: 1.2 });
    const { result, rerender } = renderHook(({ username }) => useWebSettingsState(username), { initialProps: { username: "Tester" } });
    expect(result.current).toMatchObject({ status: "ready", settings: { textScale: 1.2 } });
    rerender({ username: "Other" });
    expect(result.current).toMatchObject({ status: "ready", settings: { textScale: 1 } });
    act(() => saveWebSettings(localStorage, "Tester", { ...DEFAULT_WEB_SETTINGS, textScale: 0.9 }));
    expect(result.current).toMatchObject({ status: "ready", settings: { textScale: 1 } });
  });

  it("refreshes after another tab clears storage", () => {
    saveWebSettings(localStorage, "Tester", { ...DEFAULT_WEB_SETTINGS, textScale: 1.2 });
    const { result } = renderHook(() => useWebSettingsState("Tester"));
    act(() => { localStorage.clear(); window.dispatchEvent(new StorageEvent("storage", { key: null })); });
    expect(result.current).toMatchObject({ status: "ready", settings: { textScale: 1 } });
  });
});

describe("demo Japanese tool preferences", () => {
  it("enables demo annotation using a public marker without persisting a credential", () => {
    setDemoMode(true);
    const { result } = renderHook(() => useWebSettings("demo-level-21"));
    expect(result.current.integrations.jpdbApiKey).toBe(DEMO_JPDB_KEY);
    expect(result.current.reader.recognitionMode).toBe("wk-jpdb");
    expect(window.localStorage.length).toBe(0);
  });

  it("restores a real account's own settings immediately on leaving the demo", () => {
    window.localStorage.setItem(settingsStorageKey("real-user"), JSON.stringify({ ...DEFAULT_WEB_SETTINGS, integrations: { ...DEFAULT_WEB_SETTINGS.integrations, jpdbApiKey: "personal-key" } }));
    setDemoMode(true);
    const { result, rerender } = renderHook(({ username }) => useWebSettings(username), { initialProps: { username: "demo-level-21" } });
    expect(result.current.integrations.jpdbApiKey).toBe(DEMO_JPDB_KEY);
    setDemoMode(false);
    rerender({ username: "real-user" });
    expect(result.current.integrations.jpdbApiKey).toBe("personal-key");
    expect(window.localStorage.getItem(settingsStorageKey("real-user"))).not.toContain(DEMO_JPDB_KEY);
  });
});
