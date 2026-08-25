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
});
