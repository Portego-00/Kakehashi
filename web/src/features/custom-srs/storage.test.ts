import { describe, expect, it, vi } from "vitest";
import { completeCustomLesson, createCustomSrsState, enrollCustomVocabularyPack, nextCustomReviewAt, recordCustomReview } from "./model";
import { CUSTOM_SRS_POLICY } from "./scheduler";
import { customSrsStorageKey, loadCustomSrsState, saveCustomSrsState, subscribeCustomSrs, withCustomSrsStorageLock } from "./storage";
import type { CustomVocabularyPack } from "./types";

const pack: CustomVocabularyPack = {
  id: "pack",
  title: "Pack",
  description: "Pack",
  script: "katakana",
  words: [{ id: "pack:メモ", characters: "メモ", reading: "メモ", meanings: ["note"], partsOfSpeech: ["noun"], meaningMnemonic: "Make a memo.", readingMnemonic: "It is already written in kana.", contextSentences: [] }],
};

describe("custom SRS storage", () => {
  it("round-trips versioned state and isolates normalized accounts", () => {
    const now = new Date("2026-08-31T10:00:00Z");
    const state = enrollCustomVocabularyPack(createCustomSrsState(now), pack, now);
    expect(saveCustomSrsState(window.localStorage, " Test User ", state)).toBe(true);
    expect(loadCustomSrsState(window.localStorage, "test user", [pack], now)).toMatchObject({ enrolledPackIds: ["pack"] });
    expect(loadCustomSrsState(window.localStorage, "someone else", [pack], now)).toMatchObject({ enrolledPackIds: [] });
    expect(customSrsStorageKey(" Test User ")).toContain("test%20user");
  });

  it("repairs malformed data and reconciles newly added words in enrolled packs", () => {
    const key = customSrsStorageKey("tester");
    window.localStorage.setItem(key, "not json");
    expect(loadCustomSrsState(window.localStorage, "tester", [pack])).toMatchObject({ assignments: {}, enrolledPackIds: [] });

    window.localStorage.setItem(key, JSON.stringify({ version: 1, policy: CUSTOM_SRS_POLICY, enrolledPackIds: ["pack"], assignments: {}, reviewLog: [], updatedAt: "2026-08-31" }));
    expect(loadCustomSrsState(window.localStorage, "tester", [pack]).assignments["pack:メモ"]).toMatchObject({ stage: 0 });
  });

  it("resets incompatible policies and repairs malformed active cards as new lessons", () => {
    const now = new Date("2026-08-31T10:00:00Z");
    const learned = completeCustomLesson(enrollCustomVocabularyPack(createCustomSrsState(now), pack, now), pack.words[0].id, now);
    const incompatible = { ...learned, policy: { ...learned.policy, libraryVersion: "future" } };
    window.localStorage.setItem(customSrsStorageKey("policy-test"), JSON.stringify(incompatible));
    expect(loadCustomSrsState(window.localStorage, "policy-test", [pack], now)).toMatchObject({ enrolledPackIds: [], assignments: {} });

    const malformed = structuredClone(learned) as unknown as { assignments: Record<string, { card: { state: string } }> };
    malformed.assignments[pack.words[0].id].card.state = "Broken";
    window.localStorage.setItem(customSrsStorageKey("card-test"), JSON.stringify(malformed));
    expect(loadCustomSrsState(window.localStorage, "card-test", [pack], now).assignments[pack.words[0].id]).toMatchObject({ stage: 0, card: null });
  });

  it("drops catalog orphans from restored state and next-review forecasts", () => {
    const now = new Date("2026-08-31T10:00:00Z");
    const learned = completeCustomLesson(enrollCustomVocabularyPack(createCustomSrsState(now), pack, now), pack.words[0].id, now);
    expect(nextCustomReviewAt(learned, [])).toBeNull();
    saveCustomSrsState(window.localStorage, "orphan-test", learned);
    expect(loadCustomSrsState(window.localStorage, "orphan-test", [], now)).toMatchObject({ enrolledPackIds: [], assignments: {} });
  });

  it("preserves progress when an enrolled catalog pack is split into smaller ranges", () => {
    const startedAt = new Date("2026-08-31T10:00:00Z");
    const oldPack: CustomVocabularyPack = {
      ...pack,
      id: "levels-01-10",
      words: [
        { ...pack.words[0], id: "word:lower" },
        { ...pack.words[0], id: "word:upper", characters: "メモる", reading: "メモる" },
      ],
    };
    const lowerPack = { ...oldPack, id: "levels-01-05", words: [oldPack.words[0]] };
    const upperPack = { ...oldPack, id: "levels-06-10", words: [oldPack.words[1]] };
    const learned = completeCustomLesson(enrollCustomVocabularyPack(createCustomSrsState(startedAt), oldPack, startedAt), oldPack.words[0].id, startedAt);
    const reviewedAt = new Date(learned.assignments[oldPack.words[0].id].availableAt!);
    const reviewed = recordCustomReview(learned, oldPack.words[0].id, 0, reviewedAt, "split-pack-review");
    saveCustomSrsState(window.localStorage, "split-pack", reviewed);

    const restored = loadCustomSrsState(window.localStorage, "split-pack", [lowerPack, upperPack], reviewedAt);
    expect(restored.enrolledPackIds).toEqual(["levels-01-05", "levels-06-10"]);
    expect(restored.assignments["word:lower"]).toMatchObject({ stage: reviewed.assignments["word:lower"].stage, packId: "levels-01-05" });
    expect(restored.assignments["word:upper"]).toMatchObject({ stage: 0, packId: "levels-06-10" });
    expect(restored.reviewLog).toContainEqual(expect.objectContaining({ eventId: "split-pack-review", packId: "levels-01-05" }));
  });

  it("uses an account-scoped exclusive Web Lock for browser writes", async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "locks");
    const request = vi.fn(async (_name: string, _options: LockOptions, operation: LockGrantedCallback<string>) => operation({ name: _name, mode: "exclusive" }));
    Object.defineProperty(navigator, "locks", { configurable: true, value: { request } });
    try {
      await expect(withCustomSrsStorageLock("Tester", () => "saved")).resolves.toBe("saved");
      expect(request).toHaveBeenCalledWith("kakehashi:custom-srs:v1:account:tester:write", { mode: "exclusive" }, expect.any(Function));
    } finally {
      if (original) Object.defineProperty(navigator, "locks", original);
      else Reflect.deleteProperty(navigator, "locks");
    }
  });

  it("notifies same-tab subscribers after a save", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCustomSrs("tester", listener);
    saveCustomSrsState(window.localStorage, "tester", createCustomSrsState());
    unsubscribe();
    expect(listener).toHaveBeenCalledOnce();
  });
});
