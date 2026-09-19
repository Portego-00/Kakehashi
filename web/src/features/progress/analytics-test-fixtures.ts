import type { Assignment, Review, ReviewStatistic, SpacedRepetitionSystem, Subject, SubjectType } from "@/types/wanikani";

export const analyticsTestNow = new Date("2026-09-10T12:00:00Z");
function resource<T, O extends string>(id: number, object: O, data: T) { return { id, object, data, url: "", data_updated_at: analyticsTestNow.toISOString() }; }
export function testSubject(id: number, type: SubjectType = "kanji", extra: Partial<Subject["data"]> = {}): Subject {
  return resource(id, type, { level: 3, created_at: analyticsTestNow.toISOString(), slug: `subject-${id}`, document_url: "", hidden_at: null, characters: "日", meanings: [{ meaning: "Sun", primary: true, accepted_answer: true }], auxiliary_meanings: [], spaced_repetition_system_id: 1, ...extra });
}
export function testAssignment(id: number, extra: Partial<Assignment["data"]> = {}): Assignment {
  return resource(id + 100, "assignment", { subject_id: id, subject_type: "kanji", srs_stage: 4, available_at: analyticsTestNow.toISOString(), started_at: "2026-09-01T12:00:00Z", unlocked_at: "2026-09-01T12:00:00Z", passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: "2026-09-01T12:00:00Z", ...extra });
}
export function testStatistic(id: number, extra: Partial<ReviewStatistic["data"]> = {}): ReviewStatistic {
  return resource(id + 200, "review_statistic", { subject_id: id, subject_type: "kanji", meaning_correct: 10, meaning_incorrect: 0, meaning_max_streak: 10, meaning_current_streak: 10, reading_correct: 10, reading_incorrect: 0, reading_max_streak: 10, reading_current_streak: 10, percentage_correct: 100, hidden: false, created_at: analyticsTestNow.toISOString(), ...extra });
}
export function testReview(id: number, subjectId: number, extra: Partial<Review["data"]> = {}): Review {
  return resource(id, "review", { subject_id: subjectId, assignment_id: subjectId + 100, starting_srs_stage: 4, ending_srs_stage: 5, incorrect_meaning_answers: 0, incorrect_reading_answers: 0, created_at: analyticsTestNow.toISOString(), ...extra });
}
export const analyticsTestSystems: SpacedRepetitionSystem[] = [resource(1, "spaced_repetition_system", { name: "Standard", description: "", unlocking_stage_position: 0, starting_stage_position: 1, passing_stage_position: 5, burning_stage_position: 9, stages: [null, 4, 8, 23, 47, 167, 335, 719, 2879, null].map((interval, position) => ({ position, interval, interval_unit: interval === null ? null : "hours" as const })) })];
