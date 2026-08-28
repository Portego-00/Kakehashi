import { describe, expect, it } from "vitest";
import { createQuestionQueue, kindsForSubject, moveCoreQuestionPairToEnd } from "./queue";
import type { Assignment, Subject } from "@/types/wanikani";

function item(object: Subject["object"], id = 1): Subject { return { id, object, url: "", data_updated_at: "", data: { level: 1, created_at: "", slug: "x", document_url: "", hidden_at: null, characters: "字", meanings: [], auxiliary_meanings: [], readings: [{ reading: "じ", primary: true, accepted_answer: true }] } }; }
function assignment(id: number): Assignment { return { id, object: "assignment", url: "", data_updated_at: "", data: { subject_id: id, subject_type: "kanji", srs_stage: 1, available_at: "2020-01-01T00:00:00Z", started_at: "2020-01-01T00:00:00Z", unlocked_at: "2020-01-01T00:00:00Z", passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: "" } }; }
describe("question requirements", () => { it("uses meaning-only for radicals and kana vocabulary", () => { expect(kindsForSubject(item("radical"))).toEqual(["meaning"]); expect(kindsForSubject(item("kana_vocabulary"))).toEqual(["meaning"]); }); it("uses meaning and reading for kanji and vocabulary", () => expect(kindsForSubject(item("kanji"))).toEqual(["meaning", "reading"])); });

describe("question ordering", () => {
  it("preserves the lesson question behavior", () => {
    expect(createQuestionQueue([assignment(1), assignment(2)], [item("kanji", 1), item("kanji", 2)], { mode: "lessons", answerOrder: "reading-first", shuffleSubjects: false }).map((question) => `${question.assignment.id}:${question.kind}`)).toEqual(["1:reading", "2:reading", "1:meaning", "2:meaning"]);
  });

  it("keeps review counterparts adjacent when back-to-back questions are enabled", () => {
    const queue = createQuestionQueue([assignment(1), assignment(2)], [item("kanji", 1), item("kanji", 2)], {
      mode: "reviews",
      answerOrder: "reading-first",
      reviewQuestionOrderEnabled: true,
      backToBackQuestions: true,
    });

    expect(queue.map((question) => `${question.assignment.id}:${question.kind}`)).toEqual(["1:reading", "1:meaning", "2:reading", "2:meaning"]);
  });

  it("uses meaning first in back-to-back reviews when preferred-side ordering is disabled", () => {
    const queue = createQuestionQueue([assignment(1)], [item("kanji", 1)], {
      mode: "reviews",
      answerOrder: "reading-first",
      reviewQuestionOrderEnabled: false,
      backToBackQuestions: true,
    });

    expect(queue.map((question) => question.kind)).toEqual(["meaning", "reading"]);
  });

  it("spreads review counterparts while keeping the preferred side first and within the maximum gap", () => {
    const assignments = [1, 2, 3, 4].map(assignment);
    const subjects = [1, 2, 3, 4].map((id) => item("kanji", id));
    const queue = createQuestionQueue(assignments, subjects, {
      mode: "reviews",
      answerOrder: "reading-first",
      reviewQuestionOrderEnabled: true,
      backToBackQuestions: false,
      maxQuestionGap: 3,
      randomFn: () => 0,
    });

    for (const id of [1, 2, 3, 4]) {
      const readingIndex = queue.findIndex((question) => question.assignment.id === id && question.kind === "reading");
      const meaningIndex = queue.findIndex((question) => question.assignment.id === id && question.kind === "meaning");
      expect(readingIndex).toBeLessThan(meaningIndex);
      expect(meaningIndex - readingIndex).toBeLessThanOrEqual(3);
    }
    expect(queue.findIndex((question) => question.assignment.id === 1 && question.kind === "meaning")).toBeGreaterThan(1);
  });

  it("randomizes the first side per review subject when preferred-side ordering is disabled", () => {
    const queue = createQuestionQueue([assignment(1)], [item("kanji", 1)], {
      mode: "reviews",
      answerOrder: "meaning-first",
      reviewQuestionOrderEnabled: false,
      backToBackQuestions: false,
      randomFn: () => 0.9,
    });

    expect(queue.map((question) => question.kind)).toEqual(["reading", "meaning"]);
  });

  it("does not leave a back-to-back pair at the end of an eleven-item spread queue", () => {
    const ids = Array.from({ length: 11 }, (_, index) => index + 1);
    const queue = createQuestionQueue(ids.map(assignment), ids.map((id) => item("kanji", id)), {
      mode: "reviews",
      reviewQuestionOrderEnabled: true,
      answerOrder: "meaning-first",
      backToBackQuestions: false,
      maxQuestionGap: 10,
    });

    for (const id of ids) {
      const meaningIndex = queue.findIndex((question) => question.assignment.id === id && question.kind === "meaning");
      const readingIndex = queue.findIndex((question) => question.assignment.id === id && question.kind === "reading");
      expect(readingIndex - meaningIndex).toBeGreaterThan(1);
      expect(readingIndex - meaningIndex).toBeLessThanOrEqual(10);
    }
  });

  it("moves both sides of a skipped review item to the end", () => {
    const queue = createQuestionQueue([assignment(1), assignment(2)], [item("kanji", 1), item("kanji", 2)], {
      mode: "reviews",
      answerOrder: "meaning-first",
      reviewQuestionOrderEnabled: true,
      backToBackQuestions: true,
    });

    expect(moveCoreQuestionPairToEnd(queue).map((question) => `${question.assignment.id}:${question.kind}`)).toEqual([
      "2:meaning",
      "2:reading",
      "1:meaning",
      "1:reading",
    ]);
  });
});
