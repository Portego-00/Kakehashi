import type { Assignment, Subject } from "@/types/wanikani";
import type { QuestionKind } from "./answer-checker";

export interface CoreQuestion { id: string; assignment: Assignment; subject: Subject; kind: QuestionKind }
export type AnswerOrder = "meaning-first" | "reading-first" | "mixed";
export interface QueueOptions { shuffleSubjects?: boolean; answerOrder?: AnswerOrder }

export function kindsForSubject(subject: Subject): QuestionKind[] {
  if (subject.object === "radical" || subject.object === "kana_vocabulary") return ["meaning"];
  return subject.data.readings?.length ? ["meaning", "reading"] : ["meaning"];
}

export function createQuestionQueue(assignments: Assignment[], subjects: Subject[], randomOrOptions: boolean | QueueOptions = true) {
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  const options = typeof randomOrOptions === "boolean" ? { shuffleSubjects: randomOrOptions, answerOrder: "mixed" as AnswerOrder } : { shuffleSubjects: false, answerOrder: "mixed" as AnswerOrder, ...randomOrOptions };
  const orderedAssignments = [...assignments];
  if (options.shuffleSubjects) {
    for (let i = orderedAssignments.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [orderedAssignments[i], orderedAssignments[j]] = [orderedAssignments[j], orderedAssignments[i]];
    }
  }
  const byKind: Record<QuestionKind, CoreQuestion[]> = { meaning: [], reading: [] };
  const mixed: CoreQuestion[] = [];
  orderedAssignments.forEach((assignment) => {
    const subject = byId.get(assignment.data.subject_id);
    if (!subject) return;
    const kinds = kindsForSubject(subject);
    if (options.answerOrder === "reading-first") kinds.reverse();
    kinds.forEach((kind) => {
      const question = { id: `${assignment.id}:${kind}`, assignment, subject, kind };
      mixed.push(question);
      byKind[kind].push(question);
    });
  });
  if (options.answerOrder === "meaning-first") return [...byKind.meaning, ...byKind.reading];
  if (options.answerOrder === "reading-first") return [...byKind.reading, ...byKind.meaning];
  return mixed;
}

export function lessonAssignments(assignments: Assignment[]) { return assignments.filter(({ data }) => data.unlocked_at && !data.started_at && !data.hidden && data.srs_stage === 0); }
export function reviewAssignments(assignments: Assignment[], now = new Date()) { return assignments.filter(({ data }) => data.started_at && !data.hidden && data.srs_stage > 0 && data.srs_stage < 9 && data.available_at && new Date(data.available_at) <= now); }
