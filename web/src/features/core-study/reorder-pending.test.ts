import { describe, expect, it } from "vitest";
import type { Assignment, Subject } from "@/types/wanikani";
import { DEFAULT_WEB_SETTINGS } from "@/features/settings/settings";
import { createQuestionQueue } from "./queue";
import { reorderPendingCoreQuestions, reorderPendingStudyQuestions } from "./reorder-pending";
import type { StudySession } from "@/features/study/types";

function item(object: Subject["object"], id = 1): Subject { return { id, object, url: "", data_updated_at: "", data: { level: 1, created_at: "", slug: "x", document_url: "", hidden_at: null, characters: "字", meanings: [], auxiliary_meanings: [], readings: [{ reading: "じ", primary: true, accepted_answer: true }] } }; }
function assignment(id: number): Assignment { return { id, object: "assignment", url: "", data_updated_at: "", data: { subject_id: id, subject_type: "kanji", srs_stage: 1, available_at: "2020-01-01T00:00:00Z", started_at: "2020-01-01T00:00:00Z", unlocked_at: "2020-01-01T00:00:00Z", passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: "" } }; }

describe("changing review order during a session", () => {
  it("keeps the current question and never recreates completed answers or dropped subjects", () => {
    const assignments = [1, 2, 3].map(assignment);
    const subjects = [1, 2, 3].map((id) => ({ ...item("kanji", id), data: { ...item("kanji", id).data, level: id } }));
    const questions = createQuestionQueue(assignments, subjects, { mode: "reviews", reviewQuestionOrderEnabled: true, answerOrder: "meaning-first", backToBackQuestions: true }).slice(1, 4);
    const next = reorderPendingCoreQuestions(questions, { ...DEFAULT_WEB_SETTINGS.study, reviewOrder: "currentLevelFirst", reviewQuestionOrderEnabled: true, reviewQuestionOrder: "reading-first", backToBackQuestions: true }, "reviews");
    expect(next[0]).toBe(questions[0]);
    expect(next.map((q) => q.id)).toEqual(["1:reading", "2:reading", "2:meaning"]);
    expect(new Set(next.map((q) => q.id))).toEqual(new Set(questions.map((q) => q.id)));
  });
  it("preserves extra-study history, the current answer, and listening retry media", () => {
    const questions = [1, 2, 3].map((id) => ({ id: String(id), subjectId: id, subjectType: "kanji" as const, kind: "listening-meaning" as const, prompt: "Listen", promptLabel: "Meaning", acceptedAnswers: ["word"], displayAnswer: "word", audioUrl: `clip-${id}.mp3` }));
    const session: StudySession = { version: 1, id: "test", mode: "listening", createdAt: "", updatedAt: "", currentIndex: 1, complete: false, questions: [...questions, { ...questions[0], id: "retry", originalQuestionId: "1" }], answers: [{ questionId: "1", value: "wrong", correct: false, answeredAt: "" }, { questionId: "2", value: "word", correct: true, answeredAt: "" }] };
    const next = reorderPendingStudyQuestions(session, [1, 2, 3].map((id) => item("kanji", id)), [1, 2, 3].map(assignment), { ...DEFAULT_WEB_SETTINGS.study, customReviewOrder: "lowestLevelFirst" });
    expect(next.answers).toBe(session.answers);
    expect(next.currentIndex).toBe(1);
    expect(next.questions.slice(0, 2)).toEqual(session.questions.slice(0, 2));
    expect(new Set(next.questions)).toEqual(new Set(session.questions));
    expect(next.questions.find((q) => q.id === "retry")?.audioUrl).toBe("clip-1.mp3");
  });
});
