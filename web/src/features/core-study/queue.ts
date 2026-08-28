import type { Assignment, Subject } from "@/types/wanikani";
import type { QuestionKind } from "./answer-checker";

export interface CoreQuestion { id: string; assignment: Assignment; subject: Subject; kind: QuestionKind }
interface ReviewQuestionPair { first: CoreQuestion; second: CoreQuestion | null }
export type AnswerOrder = "meaning-first" | "reading-first" | "mixed";
export interface QueueOptions {
  mode?: "lessons" | "reviews";
  shuffleSubjects?: boolean;
  answerOrder?: AnswerOrder;
  reviewQuestionOrderEnabled?: boolean;
  backToBackQuestions?: boolean;
  maxQuestionGap?: number;
  randomFn?: () => number;
}

export function kindsForSubject(subject: Subject): QuestionKind[] {
  if (subject.object === "radical" || subject.object === "kana_vocabulary") return ["meaning"];
  return subject.data.readings?.length ? ["meaning", "reading"] : ["meaning"];
}

export function createQuestionQueue(assignments: Assignment[], subjects: Subject[], randomOrOptions: boolean | QueueOptions = true) {
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  const options: Required<Pick<QueueOptions, "mode" | "shuffleSubjects" | "answerOrder" | "reviewQuestionOrderEnabled" | "backToBackQuestions" | "maxQuestionGap" | "randomFn">> = typeof randomOrOptions === "boolean"
    ? { mode: "lessons", shuffleSubjects: randomOrOptions, answerOrder: "mixed", reviewQuestionOrderEnabled: false, backToBackQuestions: false, maxQuestionGap: 10, randomFn: Math.random }
    : { mode: "lessons", shuffleSubjects: false, answerOrder: "mixed", reviewQuestionOrderEnabled: false, backToBackQuestions: false, maxQuestionGap: 10, randomFn: Math.random, ...randomOrOptions };
  const orderedAssignments = [...assignments];
  if (options.shuffleSubjects) {
    for (let i = orderedAssignments.length - 1; i > 0; i -= 1) {
      const j = Math.floor(options.randomFn() * (i + 1));
      [orderedAssignments[i], orderedAssignments[j]] = [orderedAssignments[j], orderedAssignments[i]];
    }
  }

  if (options.mode === "reviews") return createReviewQuestionQueue(orderedAssignments, byId, options);

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

function createReviewQuestionQueue(assignments: Assignment[], byId: Map<number, Subject>, options: Required<Pick<QueueOptions, "answerOrder" | "reviewQuestionOrderEnabled" | "backToBackQuestions" | "maxQuestionGap" | "randomFn">>) {
  const entries = assignments.flatMap<ReviewQuestionPair>((assignment) => {
    const subject = byId.get(assignment.data.subject_id);
    if (!subject) return [];
    const kinds = kindsForSubject(subject);
    if (kinds.length === 1) return [{ first: question(assignment, subject, kinds[0]), second: null }];
    const preferredKind: QuestionKind = options.reviewQuestionOrderEnabled
      ? options.answerOrder === "reading-first" ? "reading" : "meaning"
      : options.backToBackQuestions || options.randomFn() < 0.5 ? "meaning" : "reading";
    const counterpartKind: QuestionKind = preferredKind === "meaning" ? "reading" : "meaning";
    return [{ first: question(assignment, subject, preferredKind), second: question(assignment, subject, counterpartKind) }];
  });

  if (options.backToBackQuestions) return entries.flatMap(({ first, second }) => second ? [first, second] : [first]);

  const maximumGap = Math.max(2, Math.trunc(options.maxQuestionGap) || 10);
  const queue: CoreQuestion[] = [];
  for (let index = 0; index < entries.length;) {
    const remaining = entries.length - index;
    let batchSize = Math.min(maximumGap, remaining);
    if (remaining - batchSize === 1 && batchSize > 2) batchSize -= 1;
    const batch = entries.slice(index, index + batchSize);
    queue.push(...batch.map(({ first }) => first));
    queue.push(...batch.flatMap(({ second }) => second ? [second] : []));
    index += batchSize;
  }
  return queue;
}

function question(assignment: Assignment, subject: Subject, kind: QuestionKind): CoreQuestion {
  return { id: `${assignment.id}:${kind}`, assignment, subject, kind };
}

export function moveCoreQuestionPairToEnd(questions: CoreQuestion[]) {
  const current = questions[0];
  if (!current) return questions;
  const rest = questions.slice(1);
  const counterpartQuestions = rest.filter((candidate) => candidate.assignment.id === current.assignment.id);
  const remainingQuestions = rest.filter((candidate) => candidate.assignment.id !== current.assignment.id);
  return [...remainingQuestions, current, ...counterpartQuestions];
}

export function lessonAssignments(assignments: Assignment[]) { return assignments.filter(({ data }) => data.unlocked_at && !data.started_at && !data.hidden && data.srs_stage === 0); }
export function reviewAssignments(assignments: Assignment[], now = new Date()) { return assignments.filter(({ data }) => data.started_at && !data.hidden && data.srs_stage > 0 && data.srs_stage < 9 && data.available_at && new Date(data.available_at) <= now); }
