import { describe, expect, it } from "vitest";
import { CUSTOM_VOCABULARY_PACKS } from "./catalog";
import { completeCustomLesson, createCustomSrsState, enrollCustomVocabularyPack, recordCustomReview } from "./model";
import { parseCustomSrsStateStrict } from "./storage";
import { customSrsWireResult, expandCustomSrsWireResult } from "./transport";
import { customSrsStatePatch } from "./state-patch";

const now = new Date("2026-09-17T12:00:00Z");
const pack = CUSTOM_VOCABULARY_PACKS[0];
const word = pack.words[0];
const state = completeCustomLesson(enrollCustomVocabularyPack(createCustomSrsState(now), pack, now), word.id, now);

describe("cloud progress preservation", () => {
  it("rejects a damaged learned card rather than recreating it as a lesson", () => {
    const damaged = { ...state, assignments: { ...state.assignments, [word.id]: { ...state.assignments[word.id], card: null } } };
    expect(() => parseCustomSrsStateStrict(damaged, [pack])).toThrow("could not be read safely");
  });
  it("preserves unknown catalog words and enrollments on an older deployment", () => {
    const reviewed = recordCustomReview(state, word.id, 0, new Date("2026-09-18T12:00:00Z"), "event");
    expect(parseCustomSrsStateStrict(reviewed, [])).toEqual(reviewed);
  });
  it("rejects an unsupported policy and malformed review history", () => {
    expect(() => parseCustomSrsStateStrict({ ...state, policy: {} }, [pack])).toThrow("unsupported");
    expect(() => parseCustomSrsStateStrict({ ...state, reviewLog: [{}] }, [pack])).toThrow("history");
  });
});

describe("incremental synchronization", () => {
  it("round-trips a review, sends only its changed card, and falls back when another device has changed progress", () => {
    const next = recordCustomReview(state, word.id, 0, new Date("2026-09-18T12:00:00Z"), "event");
    const previous = { state, revision: 4 };
    const result = { state: next, revision: 5 };
    const wire = customSrsWireResult(result, previous, 4);
    expect(expandCustomSrsWireResult(wire, previous)).toEqual({ available: true, ...result });
    expect(customSrsStatePatch(state, next).p_assignments).toEqual({ [word.id]: next.assignments[word.id] });
    expect(customSrsWireResult(result, previous, 3)).toEqual({ available: true, ...result });
    expect(() => expandCustomSrsWireResult(wire, { ...previous, revision: 3 })).toThrow("invalid update");
  });
  it("keeps a current client's review payload small with all packs enrolled and a full recent history", () => {
    let large = CUSTOM_VOCABULARY_PACKS.reduce((current, entry) => enrollCustomVocabularyPack(current, entry, now), createCustomSrsState(now));
    large = completeCustomLesson(large, word.id, now);
    const reviewed = recordCustomReview(large, word.id, 0, new Date("2026-09-18T12:00:00Z"), "event");
    large = { ...large, reviewLog: Array.from({ length: 2000 }, (_, i) => ({ ...reviewed.reviewLog[0], eventId: `old-${i}` })) };
    const next = recordCustomReview(large, word.id, 0, new Date("2026-09-18T12:00:00Z"), "event");
    const fullBytes = JSON.stringify({ available: true, state: next, revision: 5 }).length;
    const delta = customSrsWireResult({ state: next, revision: 5 }, { state: large, revision: 4 }, 4);
    const deltaBytes = JSON.stringify(delta).length;
    expect(deltaBytes).toBeLessThan(fullBytes * 0.05);
    expect(expandCustomSrsWireResult(delta, { state: large, revision: 4 })).toEqual({ available: true, state: next, revision: 5 });
    console.info(`Custom SRS response: full=${fullBytes} bytes; delta=${deltaBytes} bytes (${(100 * deltaBytes / fullBytes).toFixed(2)}%).`);
  });
});
