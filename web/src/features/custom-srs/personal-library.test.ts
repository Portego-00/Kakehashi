import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_PERSONAL_LIBRARY, personalLibraryPacks, type PersonalEntry, type PersonalLibrary } from "./personal-vocabulary";
import { syncPersonalLibrary } from "./use-personal-library";
import { completeCustomLesson, createCustomSrsState, customLessonWords, customReviewWords, enrollCustomVocabularyPack, recordCustomReview } from "./model";
import { parseCustomSrsStateStrict } from "./storage";
import { customSrsOutboxKey, parseCustomSrsOutbox, saveCustomSrsOutbox, type CustomSrsOutbox } from "./outbox";
import { customReviewForecastEntries } from "@/features/dashboard/review-forecast";

const deckId = "personal:11111111-1111-4111-8111-111111111111";
const wordId = "personal:22222222-2222-4222-8222-222222222222";
const deck: PersonalEntry = { id: deckId, kind: "deck", deckId: null, revision: 1, data: { title: "Reading" } };
const word: PersonalEntry = { id: wordId, kind: "word", deckId, revision: 2, data: { archived: false, word: { characters: "木漏れ日", reading: "こもれび", meanings: ["sunlight"], partsOfSpeech: [], meaningMnemonic: "", contextSentences: [] } } };
afterEach(() => { vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("private vocabulary library synchronization", () => {
  it("pages changes into an account's existing cache and then requests only changes", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ revision: 2, entries: [deck], cursor: { revision: 1, id: deckId } })).mockResolvedValueOnce(Response.json({ revision: 2, entries: [word], cursor: null })).mockResolvedValueOnce(Response.json({ revision: 2, entries: [], cursor: null }));
    vi.stubGlobal("fetch", fetcher);
    const result = await syncPersonalLibrary("user-one", EMPTY_PERSONAL_LIBRARY);
    expect(Object.keys(result.entries)).toHaveLength(2);
    expect(fetcher.mock.calls[1][0]).toContain("until=2");
    expect(fetcher.mock.calls[0][0]).toContain("accountId=user-one");
    expect(await syncPersonalLibrary("user-one", result)).toEqual(result);
    expect(fetcher.mock.calls[2][0]).toContain("after=2");
  });
  it("does not mutate the cache after a failed or malformed page", async () => {
    const base: PersonalLibrary = { revision: 1, entries: { [deckId]: deck } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ revision: 3, entries: [word], cursor: { revision: 1, id: "" } })));
    await expect(syncPersonalLibrary("one", base)).rejects.toThrow("repeated page");
    expect(base).toEqual({ revision: 1, entries: { [deckId]: deck } });
  });
  it("private words enter lessons and reviews, while archiving preserves but suppresses progress", () => {
    const packs = personalLibraryPacks({ revision: 2, entries: { [deckId]: deck, [wordId]: word } });
    const now = new Date("2026-09-20T10:00:00Z");
    let state = enrollCustomVocabularyPack(createCustomSrsState(now), packs[0], now);
    expect(customLessonWords(state, packs)[0].id).toBe(wordId);
    state = completeCustomLesson(state, wordId, now);
    const due = new Date(state.assignments[wordId].availableAt!);
    expect(customReviewWords(state, packs, due)[0].id).toBe(wordId);
    state = { ...state, personalLibraryRevision: 3, assignments: { ...state.assignments, [wordId]: { ...state.assignments[wordId], archivedAt: now.toISOString() } } };
    expect(customReviewWords(state, packs, due)).toEqual([]);
    expect(customReviewForecastEntries(state, packs)).toEqual([]);
    expect(() => recordCustomReview(state, wordId, 0, due)).toThrow("not active");
    expect(parseCustomSrsStateStrict(state, []).assignments[wordId]).toEqual(state.assignments[wordId]);
    expect(parseCustomSrsStateStrict(state, []).personalLibraryRevision).toBe(3);
    expect(personalLibraryPacks({ revision: 3, entries: { [deckId]: deck, [wordId]: { ...word, data: { ...word.data, archived: true } } } })[0].words).toEqual([]);
  });
  it("compresses a 10,000-card durable queue and round-trips it without losing pending answers", () => {
    const now = new Date("2026-09-20T10:00:00Z");
    const packs = personalLibraryPacks({ revision: 2, entries: { [deckId]: deck, [wordId]: word } });
    const learned = completeCustomLesson(enrollCustomVocabularyPack(createCustomSrsState(now), packs[0], now), wordId, now);
    const state = { ...learned, assignments: Object.fromEntries(Array.from({ length: 10_000 }, (_, i) => { const id = `personal:00000000-0000-4000-8000-${String(i).padStart(12, "0")}`; return [id, { ...learned.assignments[wordId], wordId: id }]; })) };
    const outbox: CustomSrsOutbox = { version: 1, confirmed: { state, revision: 4 }, pending: [], syncError: "", attempts: 0, retryAt: 0 };
    saveCustomSrsOutbox("large", outbox);
    const raw = window.localStorage.getItem(customSrsOutboxKey("large"))!;
    expect(raw.startsWith("z1:")).toBe(true);
    expect(raw.length).toBeLessThan(1_000_000);
    expect(parseCustomSrsOutbox(raw, "large")).toEqual(outbox);
    expect(() => parseCustomSrsOutbox("z1:broken", "large")).toThrow("could not be read");
  });
});
