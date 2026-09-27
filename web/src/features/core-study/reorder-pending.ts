import type { WebStudyPreferences } from "@/features/settings/settings";
import type { Assignment, Subject } from "@/types/wanikani";
import { createQuestionQueue, type CoreQuestion } from "./queue";
import { orderCoreAssignments } from "./session-planning";
import type { StudyQuestion, StudySession } from "@/features/study/types";

export function reviewOrderingChanged(next: WebStudyPreferences, previous: WebStudyPreferences) {
  return (["reviewOrder", "customReviewOrder", "reviewTypeOrderEnabled", "reviewTypeOrder", "prioritizeCriticalItems", "reviewQuestionOrderEnabled", "reviewQuestionOrder", "lessonQuestionOrder", "backToBackQuestions"] as const)
    .some((key) => JSON.stringify(next[key]) !== JSON.stringify(previous[key]));
}

/** Keep the active question and the exact set of outstanding questions. */
export function reorderPendingCoreQuestions(questions: CoreQuestion[], preferences: WebStudyPreferences, mode: "reviews" | "lessons", userLevel = 1) {
  if (questions.length < 2) return questions;
  const assignments = [...new Map(questions.map((question) => [question.assignment.id, question.assignment])).values()];
  const subjects = questions.map((question) => question.subject);
  const ordered = orderCoreAssignments(assignments, subjects, mode, preferences, { userLevel });
  const pending = new Map(questions.slice(1).map((question) => [question.id, question]));
  const queue = createQuestionQueue(ordered, subjects, {
    mode, answerOrder: mode === "lessons" ? preferences.lessonQuestionOrder : preferences.reviewQuestionOrder,
    reviewQuestionOrderEnabled: preferences.reviewQuestionOrderEnabled,
    backToBackQuestions: preferences.backToBackQuestions,
  });
  return [questions[0], ...queue.flatMap((question) => pending.has(question.id) ? [pending.get(question.id)!] : [])];
}

export function reorderPendingStudyQuestions(session: StudySession, subjects: Subject[], assignments: Assignment[], preferences: WebStudyPreferences) {
  const order = orderCoreAssignments(assignments, subjects, "reviews", { ...preferences, reviewOrder: preferences.customReviewOrder });
  const rank = new Map(order.map((assignment, index) => [assignment.data.subject_id, index]));
  const remaining = session.questions.slice(session.currentIndex + 1);
  // Keep each mode's generated questions (including listening media and retries).
  const groups = new Map<number, StudyQuestion[]>();
  for (const question of remaining) groups.set(question.subjectId, [...(groups.get(question.subjectId) ?? []), question]);
  const ordered = [...groups].sort(([a], [b]) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity));
  if (preferences.reviewQuestionOrderEnabled) {
    const first = preferences.reviewQuestionOrder === "reading-first" ? "reading" : "meaning";
    for (const [, questions] of ordered) questions.sort((a, b) => Number(b.kind === first) - Number(a.kind === first));
  }
  const tail: StudyQuestion[] = [];
  if (preferences.backToBackQuestions) tail.push(...ordered.flatMap(([, questions]) => questions));
  else {
    // Match the review queue's maximum gap without adding already answered sides.
    for (let index = 0; index < ordered.length; index += 10) {
      const batch = ordered.slice(index, index + 10).map(([, questions]) => [...questions]);
      while (batch.some((questions) => questions.length)) for (const questions of batch) { const question = questions.shift(); if (question) tail.push(question); }
    }
  }
  return { ...session, questions: [...session.questions.slice(0, session.currentIndex + 1), ...tail] };
}
