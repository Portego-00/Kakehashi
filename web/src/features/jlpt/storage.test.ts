import { beforeEach, describe, expect, it, vi } from "vitest";
import { createJlptSession } from "./engine";
import { N5_QUESTIONS } from "./questions/n5";
import {
  clearJlptSession,
  jlptQuestionHistoryKey,
  jlptSessionKey,
  loadJlptQuestionHistory,
  loadJlptSemanticHistory,
  loadJlptSession,
  rememberJlptQuestionSelection,
  rememberJlptQuestions,
  saveJlptSession,
  subscribeJlptSession,
} from "./storage";

describe("JLPT resume storage", () => {
  beforeEach(() => window.localStorage.clear());

  it("isolates sessions by WaniKani account and restores listening state", () => {
    const session = {
      ...createJlptSession({
        level: "N5",
        mode: "quick",
        questions: N5_QUESTIONS,
      }),
      listeningPlays: { "n5-listening-cafe": 1 },
    };
    expect(saveJlptSession("user-a", session)).toBe(true);
    expect(loadJlptSession("user-a")).toEqual(session);
    expect(loadJlptSession("user-b")).toBeNull();
    clearJlptSession("user-a");
    expect(loadJlptSession("user-a")).toBeNull();
  });

  it("ignores corrupt or incompatible saved data", () => {
    window.localStorage.setItem(jlptSessionKey("user-a"), "not json");
    expect(loadJlptSession("user-a")).toBeNull();
    window.localStorage.setItem(
      jlptSessionKey("user-a"),
      JSON.stringify({ version: 99 }),
    );
    expect(loadJlptSession("user-a")).toBeNull();
    window.localStorage.setItem(
      jlptSessionKey("user-a"),
      JSON.stringify({
        ...createJlptSession({
          level: "N5",
          mode: "quick",
          questions: N5_QUESTIONS,
        }),
        bankVersion: 3,
      }),
    );
    expect(loadJlptSession("user-a")).toBeNull();
  });

  it("notifies same-window subscribers after save and clear", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeJlptSession("user-a", listener);
    const session = createJlptSession({
      level: "N5",
      mode: "quick",
      questions: N5_QUESTIONS,
    });
    saveJlptSession("user-a", session);
    clearJlptSession("user-a");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("keeps deduplicated question history separate by account and level", () => {
    expect(rememberJlptQuestions("user-a", "N5", ["one", "two", "one"])).toBe(
      true,
    );
    expect(rememberJlptQuestions("user-a", "N5", ["two", "three"])).toBe(true);
    expect(rememberJlptQuestions("user-a", "N4", ["n4-one"])).toBe(true);

    expect([...loadJlptQuestionHistory("user-a", "N5")]).toEqual([
      "one",
      "two",
      "three",
    ]);
    expect([...loadJlptQuestionHistory("user-a", "N4")]).toEqual(["n4-one"]);
    expect(loadJlptQuestionHistory("user-b", "N5")).toEqual(new Set());
  });

  it("ignores corrupt question history", () => {
    window.localStorage.setItem(jlptQuestionHistoryKey("user-a"), "not json");
    expect(loadJlptQuestionHistory("user-a", "N5")).toEqual(new Set());
    window.localStorage.setItem(
      jlptQuestionHistoryKey("user-a"),
      JSON.stringify({
        version: 1,
        bankVersion: 1,
        seenByLevel: { N5: ["stale-question"] },
      }),
    );
    expect(loadJlptQuestionHistory("user-a", "N5")).toEqual(new Set());
  });

  it("tracks underlying semantic items separately from rendered question IDs", () => {
    const source = N5_QUESTIONS[0];
    const variants = [0, 1].map((variantIndex) => ({
      ...source,
      id: `semantic-variant-${variantIndex}`,
      provenance: {
        semanticKey: "n5:kanji-reading:weekly",
        variantIndex,
        authorship: "controlled-variant" as const,
        editorialStatus: "machine-validated" as const,
        contentVersion: 1,
      },
    }));

    expect(rememberJlptQuestionSelection("user-a", "N5", variants)).toBe(true);
    expect(loadJlptQuestionHistory("user-a", "N5")).toEqual(
      new Set(["semantic-variant-0", "semantic-variant-1"]),
    );
    expect(loadJlptSemanticHistory("user-a", "N5")).toEqual(
      new Set(["n5:kanji-reading:weekly"]),
    );
    expect(loadJlptSemanticHistory("user-b", "N5")).toEqual(new Set());
  });
});
