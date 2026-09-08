import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO_JPDB_KEY } from "@/features/demo/jpdb";
import { setDemoMode } from "@/features/demo/runtime";
import { DEFAULT_WEB_SETTINGS, settingsStorageKey } from "./settings";
import { useWebSettings } from "./use-workspace-preferences";

beforeEach(() => { window.localStorage.clear(); setDemoMode(false); });
afterEach(() => setDemoMode(false));

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
