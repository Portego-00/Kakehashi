import { act, renderHook } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO_JPDB_KEY } from "@/features/demo/jpdb";
import { setDemoMode } from "@/features/demo/runtime";
import { DEFAULT_WEB_SETTINGS, saveWebSettings, settingsStorageKey } from "./settings";
import { useWebSettings } from "./use-workspace-preferences";

beforeEach(() => { window.localStorage.clear(); setDemoMode(false); });
afterEach(() => setDemoMode(false));

describe("persisted review preferences", () => {
  const reviewSettings = {
    ...DEFAULT_WEB_SETTINGS,
    study: {
      ...DEFAULT_WEB_SETTINGS.study,
      showReviewItemLevelAndSrsStage: true,
      showVocabularyFrequency: true,
      showVocabContextSentencesInReviews: true,
      reviewOrder: "descendingSrsStage" as const,
      reviewTypeOrderEnabled: true,
      reviewTypeOrder: ["vocabulary", "kanji", "radical"] as const,
      reviewQuestionOrderEnabled: true,
      reviewQuestionOrder: "reading-first" as const,
      backToBackQuestions: true,
      backToBackImmediateRetryIncorrect: true,
      reviewBatchSizeEnabled: true,
      reviewBatchSize: 15,
      allowSkippingReviews: true,
    },
  };
  const savedSettings = { ...reviewSettings, study: { ...reviewSettings.study, reviewTypeOrder: [...reviewSettings.study.reviewTypeOrder] } };

  it("loads the normalized account's review display and queue preferences on entry", () => {
    saveWebSettings(window.localStorage, " Portego ", savedSettings);
    const { result } = renderHook(() => useWebSettings("Portego"));
    expect(result.current.study).toMatchObject(savedSettings.study);
  });

  it("applies changes saved in the current tab without mixing accounts", () => {
    const { result, rerender } = renderHook(({ username }) => useWebSettings(username), { initialProps: { username: "Portego" } });
    expect(result.current.study.showReviewItemLevelAndSrsStage).toBe(false);

    act(() => saveWebSettings(window.localStorage, "portego", savedSettings));
    expect(result.current.study).toMatchObject(savedSettings.study);
    rerender({ username: "another-user" });
    expect(result.current.study).toEqual(DEFAULT_WEB_SETTINGS.study);
  });

  it("replaces the server defaults with saved review settings during hydration", async () => {
    function Preferences() {
      const settings = useWebSettings("Portego");
      return <output>{JSON.stringify(settings.study)}</output>;
    }

    saveWebSettings(window.localStorage, "Portego", savedSettings);
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Preferences />);
    expect(JSON.parse(container.textContent ?? "{}")).toEqual(DEFAULT_WEB_SETTINGS.study);
    document.body.appendChild(container);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => { root = hydrateRoot(container, <Preferences />); });
      expect(JSON.parse(container.textContent ?? "{}")).toMatchObject(savedSettings.study);
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
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
