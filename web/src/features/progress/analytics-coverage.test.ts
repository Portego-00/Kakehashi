import { describe, expect, it } from "vitest";
import type { Assignment, Subject } from "@/types/wanikani";
import { analyzeReading, buildCoverageGroups } from "./analytics-coverage";

function subject(id: number, characters: string, level = 1, object: Subject["object"] = "kanji"): Subject {
  return { id, object, url: "", data_updated_at: "2026-09-10T00:00:00Z", data: { level, characters, slug: characters, created_at: "2026-01-01T00:00:00Z", document_url: "", hidden_at: null, meanings: [{ meaning: "Example", primary: true, accepted_answer: true }], auxiliary_meanings: [] } };
}
function assignment(subjectId: number, stage: number, hidden = false): Assignment {
  return { id: subjectId, object: "assignment", url: "", data_updated_at: "2026-09-10T00:00:00Z", data: { subject_id: subjectId, subject_type: "kanji", srs_stage: stage, available_at: null, started_at: null, unlocked_at: null, passed_at: null, burned_at: null, resurrected_at: null, hidden, created_at: "2026-01-01T00:00:00Z" } };
}

describe("analytics coverage", () => {
  it("separates repeated occurrences from unique-character coverage", () => {
    const result = analyzeReading("日日日月。", [assignment(1, 5)], [subject(1, "日"), subject(2, "月")]);
    expect(result.occurrencePercent).toBe(75);
    expect(result.uniquePercent).toBe(50);
    expect(result.unknown.map((entry) => entry.character)).toEqual(["月"]);
  });

  it("does not treat kana-only text as 100% kanji comprehension", () => {
    const result = analyzeReading("こんにちは。", [], []);
    expect(result.total).toBe(0);
    expect(result.uniquePercent).toBeNull();
    expect(result.occurrencePercent).toBeNull();
  });

  it("counts supplementary kanji once and honors outside-WaniKani knowledge", () => {
    const result = analyzeReading("𠮷𠮷日", [], [], 5, null, "𠮷");
    expect(result.total).toBe(3);
    expect(result.known).toBe(2);
    expect(result.uniqueTotal).toBe(2);
  });

  it("ignores hidden records and distinguishes Guru from Burned", () => {
    const subjects = [subject(1, "日"), subject(2, "月"), { ...subject(3, "火"), data: { ...subject(3, "火").data, hidden_at: "2026-01-02" } }];
    const assignments = [assignment(1, 9, true), assignment(2, 5), assignment(3, 9)];
    expect(analyzeReading("日月火", assignments, subjects).known).toBe(1);
    expect(analyzeReading("日月火", assignments, subjects, 9).known).toBe(0);
  });

  it("previews only catalog subjects through the requested level", () => {
    const result = analyzeReading("日月𠮷", [], [subject(1, "日", 1), subject(2, "月", 2)], 5, 1);
    expect(result.known).toBe(1);
    expect(result.unknown.map((entry) => entry.character)).toEqual(["月", "𠮷"]);
  });

  it("includes unknown catalog kanji in coverage denominators", () => {
    const groups = buildCoverageGroups("jlpt", [assignment(1, 5)], [subject(1, "日")]);
    const n5 = groups.find((group) => group.key === "N5")!;
    expect(n5.known).toBe(1);
    expect(n5.total).toBeGreaterThan(50);
    expect(n5.entries.some((entry) => !entry.subject)).toBe(true);
  });

  it("includes kana-only vocabulary and unstarted later levels", () => {
    const groups = buildCoverageGroups("vocabulary", [assignment(1, 5)], [subject(1, "こんにちは", 1, "kana_vocabulary"), subject(2, "日本", 10, "vocabulary")]);
    expect(groups.map(({ known, total }) => ({ known, total }))).toEqual([{ known: 1, total: 1 }, { known: 0, total: 1 }]);
    const preview = buildCoverageGroups("vocabulary", [], [subject(1, "こんにちは", 1, "kana_vocabulary"), subject(2, "日本", 10, "vocabulary")], 5, 10);
    expect(preview.map((group) => group.known)).toEqual([1, 1]);
  });

  it("matches complete segmented vocabulary instead of overlapping substrings", () => {
    const result = analyzeReading("日本の日本語", [assignment(3, 5)], [subject(1, "日", 1, "vocabulary"), subject(2, "日本", 1, "vocabulary"), subject(3, "日本語", 1, "vocabulary")]);
    expect(result.words.map((entry) => entry.word)).toEqual(["日本", "日本語"]);
    expect(result.words.find((entry) => entry.word === "日本語")?.known).toBe(true);
  });
});
