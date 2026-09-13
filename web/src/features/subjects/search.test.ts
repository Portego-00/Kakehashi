import { describe, expect, it } from "vitest";
import type { Assignment, Subject } from "@/types/wanikani";
import { DEFAULT_SEARCH_FILTERS, fuzzyFieldScore, searchSubjects } from "./search";

function subject(id: number, object: Subject["object"], characters: string, meaning: string, reading: string, level = 1): Subject {
  return { id, object, url: "", data_updated_at: "", data: { level, created_at: "", slug: characters, document_url: "", hidden_at: null, characters, meanings: [{ meaning, primary: true, accepted_answer: true }], auxiliary_meanings: [], readings: [{ reading, primary: true, accepted_answer: true }] } };
}

describe("subject fuzzy search", () => {
  const subjects = [subject(1, "kanji", "日", "Sun", "にち"), subject(2, "vocabulary", "日本", "Japan", "にほん", 2), subject(3, "kanji", "本", "Book", "ほん", 2)];

  it("ranks exact meanings above subsequence matches", () => {
    const results = searchSubjects(subjects, [], { ...DEFAULT_SEARCH_FILTERS, query: "sun" });
    expect(results[0].subject.id).toBe(1);
    expect(results[0].matchedOn).toBe("meaning");
  });

  it("matches romanized Japanese readings", () => {
    expect(searchSubjects(subjects, [], { ...DEFAULT_SEARCH_FILTERS, query: "nihon" })[0].subject.id).toBe(2);
  });

  it("excludes subjects that have no fuzzy field match", () => {
    expect(searchSubjects(subjects, [], { ...DEFAULT_SEARCH_FILTERS, query: "nihon" }).map((result) => result.subject.id)).toEqual([2]);
  });

  it("applies type, level and SRS filters together", () => {
    const assignments = [{ id: 1, object: "assignment", url: "", data_updated_at: "", data: { subject_id: 3, srs_stage: 9 } }] as Assignment[];
    const results = searchSubjects(subjects, assignments, { ...DEFAULT_SEARCH_FILTERS, types: ["kanji"], minLevel: 2, srs: ["burned"] });
    expect(results.map((result) => result.subject.id)).toEqual([3]);
  });

  it("does not fuzzy-match unrelated fields", () => {
    expect(fuzzyFieldScore("elephant", "sun")).toBe(0);
    expect(fuzzyFieldScore("nihon", "English Conversation")).toBe(0);
  });

  it("matches exact vocabulary types with OR semantics and intersects the existing filters", () => {
    const japan = subject(10, "vocabulary", "日本", "Japan", "にほん", 2);
    japan.data.parts_of_speech = ["proper noun"];
    const study = subject(11, "vocabulary", "勉強", "Study", "べんきょう", 2);
    study.data.parts_of_speech = ["noun", "verbal noun", "suru verb"];
    const memo = subject(12, "kana_vocabulary", "メモ", "Memo", "メモ", 2);
    memo.data.parts_of_speech = ["noun", "verbal noun"];
    const catalog = [...subjects, japan, study, memo];

    expect(searchSubjects(catalog, [], { ...DEFAULT_SEARCH_FILTERS, vocabularyTypes: ["proper noun", "verbal noun"] }).map(({ subject }) => subject.id)).toEqual([10, 11, 12]);
    expect(searchSubjects(catalog, [], { ...DEFAULT_SEARCH_FILTERS, vocabularyTypes: ["noun"] }).map(({ subject }) => subject.id)).toEqual([11, 12]);
    expect(searchSubjects(catalog, [], { ...DEFAULT_SEARCH_FILTERS, vocabularyTypes: ["proper noun"], query: "nihon", minLevel: 2 }).map(({ subject }) => subject.id)).toEqual([10]);
    expect(searchSubjects(catalog, [], { ...DEFAULT_SEARCH_FILTERS, vocabularyTypes: ["proper noun"], types: ["kanji"] })).toEqual([]);
    expect(searchSubjects(catalog, [], { ...DEFAULT_SEARCH_FILTERS, vocabularyTypes: [] })).toHaveLength(catalog.length);
  });
});
