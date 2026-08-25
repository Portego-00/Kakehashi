import type { Assignment, Subject } from "@/types/wanikani";
import { DEFAULT_STUDY_FILTERS } from "./engine";
import { buildSimilarKanjiBoards, niaiCharacters } from "./similar-kanji";
import { medianPoint, validateStroke } from "./stroke-data";

function kanji(id: number, characters: string, meaning: string, similar: number[] = []): Subject {
  return { id, object: "kanji", url: "", data_updated_at: "", data: { level: 1, created_at: "", slug: characters, document_url: "", hidden_at: null, characters, meanings: [{ meaning, primary: true, accepted_answer: true }], auxiliary_meanings: [], readings: [{ reading: characters, primary: true, accepted_answer: true }], visually_similar_subject_ids: similar } };
}

function assignment(subjectId: number): Assignment {
  return { id: 100 + subjectId, object: "assignment", url: "", data_updated_at: "", data: { subject_id: subjectId, subject_type: "kanji", srs_stage: 2, available_at: null, started_at: "2026-08-01T00:00:00Z", unlocked_at: "2026-08-01T00:00:00Z", passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: "" } };
}

describe("study enrichment invariants", () => {
  it("validates guided stroke start, end, and direction", () => {
    const median = [[100, 800], [500, 400], [900, 100]];
    expect(medianPoint(median[0])).toEqual({ x: 100, y: 100 });
    expect(validateStroke([{ x: 110, y: 105 }, { x: 510, y: 500 }, { x: 890, y: 805 }], median).correct).toBe(true);
    expect(validateStroke([{ x: 890, y: 805 }, { x: 110, y: 105 }], median).correct).toBe(false);
  });

  it("builds keyboard-operable matching rounds from configured WaniKani groups", () => {
    const subjects = [kanji(1, "未", "Not yet", [2]), kanji(2, "末", "End", [1]), kanji(3, "犬", "Dog")];
    const rounds = buildSimilarKanjiBoards({ subjects, assignments: subjects.map((item) => assignment(item.id)) }, { ...DEFAULT_STUDY_FILTERS, subjectTypes: ["kanji"], similarKanjiSource: "wanikani", similarKanjiGroupSize: 4 }, () => 0.5);
    expect(rounds[0].items.map((item) => item.subjectId)).toEqual(expect.arrayContaining([1, 2]));
    expect(new Set(rounds[0].items.map((item) => item.meaning)).size).toBe(rounds[0].items.length);
  });

  it("ships the in-web Niai dataset", () => {
    expect(niaiCharacters("未").length).toBeGreaterThan(0);
  });
});
