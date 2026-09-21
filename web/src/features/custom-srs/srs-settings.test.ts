import { describe, expect, it } from "vitest";
import { completeCustomLesson, createCustomSrsState, enrollCustomVocabularyPack, recordCustomReview, updateCustomSrsSettings } from "./model";
import { CUSTOM_VOCABULARY_PACKS } from "./catalog";
import { CUSTOM_SRS_POLICY } from "./scheduler";
import { customSrsSettingsError, DEFAULT_CUSTOM_SRS_SETTINGS, LEGACY_CUSTOM_SRS_SETTINGS, settingsForPolicy, settingsRevision, WANIKANI_INTERVALS } from "./srs-settings";
import { loadCustomSrsState, parseCustomSrsStateStrict } from "./storage";
import { customSrsWireResult, expandCustomSrsWireResult } from "./transport";
import type { CustomSrsSettings, CustomSrsState } from "./types";

const now = new Date("2026-09-19T10:30:00Z");
const pack = CUSTOM_VOCABULARY_PACKS[0];
const word = pack.words[0].id;
function learned(settings?: CustomSrsSettings) {
  let state = enrollCustomVocabularyPack(createCustomSrsState(now), pack, now);
  if (settings) state = updateCustomSrsSettings(state, settings, 0, "settings", now);
  return completeCustomLesson(state, word, now);
}

describe("per-account scheduling", () => {
  it("follows the complete standard WaniKani ladder and burns only after the final review", () => {
    let state = learned();
    let reviewedAt = new Date("2026-09-19T10:00:00Z");
    for (let stage = 1; stage <= 8; stage++) {
      const assignment = state.assignments[word];
      expect(assignment.stage).toBe(stage);
      expect(Date.parse(assignment.availableAt!) - reviewedAt.getTime()).toBe(WANIKANI_INTERVALS[stage - 1] * 60_000);
      reviewedAt = new Date(assignment.availableAt!);
      state = recordCustomReview(state, word, 0, reviewedAt, `review-${stage}`);
    }
    expect(state.assignments[word]).toMatchObject({ stage: 9, availableAt: null, burnedAt: reviewedAt.toISOString() });
  });

  it("uses the interval of the penalized stage after mistakes", () => {
    let state = learned();
    for (let index = 0; index < 4; index++) state = recordCustomReview(state, word, 0, new Date(state.assignments[word].availableAt!), `${index}`);
    const due = new Date(state.assignments[word].availableAt!);
    state = recordCustomReview(state, word, 1, due, "mistake");
    expect(state.assignments[word].stage).toBe(3);
    expect(Date.parse(state.assignments[word].availableAt!) - due.getTime()).toBe(23 * 3600_000);
  });

  it("preserves legacy schedules on load instead of silently adopting new defaults", () => {
    let state: CustomSrsState = { ...enrollCustomVocabularyPack(createCustomSrsState(now), pack, now), policy: CUSTOM_SRS_POLICY };
    state = completeCustomLesson(state, word, now);
    state = recordCustomReview(state, word, 0, new Date(state.assignments[word].availableAt!), "first");
    state = recordCustomReview(state, word, 0, new Date(state.assignments[word].availableAt!), "second");
    expect(state.assignments[word].availableAt).toBe("2026-09-21T22:00:00.000Z");
    expect(parseCustomSrsStateStrict(state, [pack]).policy).toEqual(CUSTOM_SRS_POLICY);
    expect(settingsForPolicy(state.policy)).toEqual(LEGACY_CUSTOM_SRS_SETTINGS);
  });

  it("preserves cards and due dates, round-trips policy deltas, and does not change another user's defaults", () => {
    const original = learned();
    const custom = { ...DEFAULT_CUSTOM_SRS_SETTINGS, stageIntervals: [10, 20, 30, 60, 120, 240, 480, 960], roundToHour: false };
    const next = updateCustomSrsSettings(original, custom, 0, "event", now);
    expect(next.assignments).toBe(original.assignments);
    expect(next.reviewLog).toBe(original.reviewLog);
    expect(settingsForPolicy(createCustomSrsState(now).policy)).toEqual(DEFAULT_CUSTOM_SRS_SETTINGS);
    const restored = loadCustomSrsState({ getItem: () => JSON.stringify(next) }, "user", [pack]);
    expect(restored.policy).toEqual(next.policy);
    const previous = { state: original, revision: 4 };
    const wire = customSrsWireResult({ state: next, revision: 5 }, previous, 4);
    expect(expandCustomSrsWireResult(wire, previous)).toEqual({ available: true, state: next, revision: 5 });
    const due = new Date(next.assignments[word].availableAt!);
    const reviewed = recordCustomReview(next, word, 0, due, "review");
    expect(Date.parse(reviewed.assignments[word].availableAt!) - due.getTime()).toBe(20 * 60_000);
  });

  it("deduplicates a lost settings response and rejects stale settings writes", () => {
    const original = learned();
    const next = updateCustomSrsSettings(original, DEFAULT_CUSTOM_SRS_SETTINGS, 0, "event", now);
    expect(updateCustomSrsSettings(next, DEFAULT_CUSTOM_SRS_SETTINGS, 0, "event", now)).toBe(next);
    expect(() => updateCustomSrsSettings(next, DEFAULT_CUSTOM_SRS_SETTINGS, 0, "other", now)).toThrow("settings changed");
    expect(settingsRevision(next.policy)).toBe(1);
  });

  it.each([true, false])("keeps minute learning steps in the future (round=%s)", (roundToHour) => {
    const state = learned({ ...LEGACY_CUSTOM_SRS_SETTINGS, learningSteps: ["10m", "20m"], roundToHour });
    expect(state.assignments[word].availableAt).toBe("2026-09-19T10:40:00.000Z");
    const reviewed = recordCustomReview(state, word, 0, new Date(state.assignments[word].availableAt!), "review");
    expect(reviewed.assignments[word].availableAt).toBe("2026-09-19T11:00:00.000Z");
  });

  it("supports shortening an in-progress learning list and applies the FSRS maximum interval", () => {
    let state = learned({ ...LEGACY_CUSTOM_SRS_SETTINGS, learningSteps: ["1m", "2m", "3m"], roundToHour: false });
    state = recordCustomReview(state, word, 0, new Date(state.assignments[word].availableAt!), "first");
    state = updateCustomSrsSettings(state, { ...LEGACY_CUSTOM_SRS_SETTINGS, learningSteps: ["1m"], maximumInterval: 1, roundToHour: false }, 1, "shorten");
    for (let i = 0; i < 4; i++) {
      const due = new Date(state.assignments[word].availableAt!);
      state = recordCustomReview(state, word, 0, due, `next-${i}`);
      expect(Date.parse(state.assignments[word].availableAt!) - due.getTime()).toBeLessThanOrEqual(86400_000);
      expect(parseCustomSrsStateStrict(state, [pack])).toEqual(state);
    }
  });

  it.each([
    { requestRetention: 1 }, { maximumInterval: 0 }, { learningSteps: ["0m"] }, { learningSteps: ["5d"] },
    { learningSteps: ["1h", "1m"] }, { relearningSteps: [] }, { stageIntervals: [10] },
    { stageIntervals: [10, 5, 30, 60, 120, 240, 480, 960] }, { extra: "unsupported" },
  ])("rejects invalid settings %j in saved cloud state", (patch) => {
    const settings = { ...DEFAULT_CUSTOM_SRS_SETTINGS, ...patch };
    expect(customSrsSettingsError(settings)).not.toBeNull();
    const state = learned();
    expect(() => parseCustomSrsStateStrict({ ...state, policy: { ...state.policy, settings } }, [pack])).toThrow("unsupported");
  });
});
