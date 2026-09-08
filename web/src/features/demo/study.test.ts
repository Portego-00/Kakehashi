import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CUSTOM_VOCABULARY_PACKS } from "@/features/custom-srs/catalog";
import { customLessonWords, customReviewWords } from "@/features/custom-srs/model";
import { loadCustomSrsState } from "@/features/custom-srs/storage";
import { createListRepository } from "@/features/subjects/lists";
import { STUDY_MODES } from "@/features/study/catalog";
import { filterStudySubjects, generateQuestions } from "@/features/study/engine";
import { generateCrossword, generateWordSearch, wordleCandidates } from "@/features/study/games";
import { streamAnimeContext } from "@/features/study/immersion";
import { getModeDefaultFilters, isQuizMode } from "@/features/study/mode-config";
import { buildSimilarKanjiBoards } from "@/features/study/similar-kanji";
import { loadModeState, loadStudyConfig, saveModeState } from "@/features/study/storage";
import { DEMO_USERNAME, setDemoMode } from "./runtime";
import { demoListeningDataset, seedDemoStudy } from "./study";
import { getDemoDataset, resetDemoWaniKani } from "./wanikani";

beforeEach(() => { localStorage.clear(); resetDemoWaniKani(); setDemoMode(true); });
afterEach(() => { setDemoMode(false); vi.unstubAllGlobals(); });

describe("demo study coverage", () => {
  it.each(STUDY_MODES.filter((mode) => isQuizMode(mode.id)).map((mode) => mode.id))("starts %s with its default filters", (mode) => {
    if (!isQuizMode(mode)) throw new Error("Expected a quiz mode");
    seedDemoStudy();
    const filters = { ...getModeDefaultFilters(mode, 21), ...loadStudyConfig(DEMO_USERNAME, mode) };
    const dataset = mode === "listening" ? demoListeningDataset(getDemoDataset()) : getDemoDataset();
    const questions = generateQuestions(mode, dataset, filters, () => 0.4);
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every((question) => question.acceptedAnswers.length > 0)).toBe(true);
  }, 15_000);

  it("builds playable matching, crossword, word-search, Wordle, writing and lesson pools", () => {
    const dataset = getDemoDataset();
    const subjects = (mode: Parameters<typeof getModeDefaultFilters>[0]) => filterStudySubjects(dataset, getModeDefaultFilters(mode, 21));
    expect(buildSimilarKanjiBoards(dataset, getModeDefaultFilters("similar-kanji", 21))).not.toHaveLength(0);
    expect(dataset.subjects.some((subject) => subject.data.visually_similar_subject_ids?.length)).toBe(true);
    expect(buildSimilarKanjiBoards(dataset, { ...getModeDefaultFilters("similar-kanji", 21), similarKanjiSource: "wanikani" }).some((round) => round.id !== "meaning-match")).toBe(true);
    expect(generateCrossword(subjects("crossword"))?.entries.length).toBeGreaterThan(1);
    expect(generateWordSearch(subjects("word-search"))?.entries.length).toBeGreaterThan(1);
    expect(wordleCandidates(subjects("kana-wordle"), 5).length).toBeGreaterThan(5);
    expect(subjects("kanji-writing").length).toBeGreaterThan(10);
    expect(subjects("custom-lessons").length).toBeGreaterThan(10);
  });

  it("starts listening from real media fixtures without a lookup request", async () => {
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Demo clip lookup must be local"); }));
    const filters = getModeDefaultFilters("listening", 21);
    const questions = generateQuestions("listening", demoListeningDataset(getDemoDataset()), filters, () => 0.4);
    const stream = streamAnimeContext(questions, filters, { limit: 6 });
    const first = await stream.next();
    expect(first.done).toBe(false);
    expect(first.value?.[0]).toMatchObject({ audioUrl: expect.stringMatching(/^https:\/\//), imageUrl: expect.stringMatching(/^https:\/\//), sourceTitle: expect.any(String) });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("seeds editable lists, text and a usable FSRS pack without replacing visitor edits", () => {
    seedDemoStudy();
    const lists = createListRepository(localStorage, DEMO_USERNAME);
    expect(lists.load()).toHaveLength(2);
    expect(loadModeState(DEMO_USERNAME, "text-analysis", "draft")).toContain("学校");
    const state = loadCustomSrsState(localStorage, DEMO_USERNAME, CUSTOM_VOCABULARY_PACKS);
    expect(customReviewWords(state, CUSTOM_VOCABULARY_PACKS)).toHaveLength(4);
    expect(customLessonWords(state, CUSTOM_VOCABULARY_PACKS).length).toBeGreaterThan(0);
    lists.rename("demo-everyday", "My edited demo list");
    saveModeState(DEMO_USERNAME, "text-analysis", "draft", "私の文章");
    seedDemoStudy();
    expect(lists.load()[0].name).toBe("My edited demo list");
    expect(loadModeState(DEMO_USERNAME, "text-analysis", "draft")).toBe("私の文章");
    expect(createListRepository(localStorage, "real-user").load()).toEqual([]);
  });
});
