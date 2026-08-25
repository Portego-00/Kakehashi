import { describe, expect, it } from "vitest";
import { createQuestionQueue, kindsForSubject } from "./queue";
import type { Assignment, Subject } from "@/types/wanikani";

function item(object: Subject["object"]): Subject { return { id: 1, object, url: "", data_updated_at: "", data: { level: 1, created_at: "", slug: "x", document_url: "", hidden_at: null, characters: "字", meanings: [], auxiliary_meanings: [], readings: [{ reading: "じ", primary: true, accepted_answer: true }] } }; }
describe("question requirements", () => { it("uses meaning-only for radicals and kana vocabulary", () => { expect(kindsForSubject(item("radical"))).toEqual(["meaning"]); expect(kindsForSubject(item("kana_vocabulary"))).toEqual(["meaning"]); }); it("uses meaning and reading for kanji and vocabulary", () => expect(kindsForSubject(item("kanji"))).toEqual(["meaning", "reading"])); });

describe("question ordering", () => {
  const assignment: Assignment = { id: 3, object: "assignment", url: "", data_updated_at: "", data: { subject_id: 1, subject_type: "kanji", srs_stage: 1, available_at: "2020-01-01T00:00:00Z", started_at: "2020-01-01T00:00:00Z", unlocked_at: "2020-01-01T00:00:00Z", passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: "" } };
  it("honors reading-first without randomizing the subject", () => {
    expect(createQuestionQueue([assignment], [item("kanji")], { answerOrder: "reading-first", shuffleSubjects: false }).map((question) => question.kind)).toEqual(["reading", "meaning"]);
  });
});
