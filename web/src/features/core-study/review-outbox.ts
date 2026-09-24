import type { Assignment } from "@/types/wanikani";

export interface ReviewOutboxEntry {
  assignmentId: number;
  operation?: "lesson";
  incorrectMeaningAnswers: number;
  incorrectReadingAnswers: number;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

type OutboxStorage = Pick<Storage, "getItem" | "setItem">;
export type StudySubmissionKind = "review" | "lesson";
export function reviewOutboxKey(username: string, kind: StudySubmissionKind = "review") { return `kakehashi-${kind}-outbox:${encodeURIComponent(username.toLocaleLowerCase())}:v1`; }

export function loadReviewOutbox(storage: Pick<Storage, "getItem">, username: string, kind: StudySubmissionKind = "review"): ReviewOutboxEntry[] {
  try {
    const parsed = JSON.parse(storage.getItem(reviewOutboxKey(username, kind)) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is ReviewOutboxEntry => Boolean(
      row && typeof row === "object" && Number.isInteger((row as ReviewOutboxEntry).assignmentId)
      && ((row as ReviewOutboxEntry).operation === undefined || (row as ReviewOutboxEntry).operation === "lesson")
      && typeof (row as ReviewOutboxEntry).createdAt === "string"
      && Number.isInteger((row as ReviewOutboxEntry).incorrectMeaningAnswers)
      && Number.isInteger((row as ReviewOutboxEntry).incorrectReadingAnswers)
    ));
  } catch { return []; }
}

function save(storage: OutboxStorage, username: string, entries: ReviewOutboxEntry[], kind: StudySubmissionKind) {
  storage.setItem(reviewOutboxKey(username, kind), JSON.stringify(entries));
}

export function enqueueReview(storage: OutboxStorage, username: string, input: Omit<ReviewOutboxEntry, "attempts" | "lastError">, kind: StudySubmissionKind = "review") {
  const rows = loadReviewOutbox(storage, username, kind);
  const existing = rows.find((row) => row.assignmentId === input.assignmentId);
  const entry = existing || { ...input, attempts: 0 };
  if (!existing) save(storage, username, [...rows, entry], kind);
  return entry;
}

export function removeReview(storage: OutboxStorage, username: string, assignmentId: number, kind: StudySubmissionKind = "review") {
  save(storage, username, loadReviewOutbox(storage, username, kind).filter((row) => row.assignmentId !== assignmentId), kind);
}

export function noteReviewFailure(storage: OutboxStorage, username: string, assignmentId: number, message: string, kind: StudySubmissionKind = "review") {
  save(storage, username, loadReviewOutbox(storage, username, kind).map((row) => row.assignmentId === assignmentId ? { ...row, attempts: row.attempts + 1, lastError: message } : row), kind);
}

export function assignmentStillReviewable(assignment: Assignment, now = new Date()) {
  const { available_at, hidden, srs_stage, started_at } = assignment.data;
  return Boolean(started_at && !hidden && srs_stage > 0 && srs_stage < 9 && available_at && new Date(available_at) <= now);
}

export async function deliverReview(entry: ReviewOutboxEntry, api: {
  readAssignment: (assignmentId: number) => Promise<Assignment>;
  submitReview: (entry: ReviewOutboxEntry) => Promise<void>;
}) {
  const before = await api.readAssignment(entry.assignmentId);
  if (!assignmentStillReviewable(before)) return "already-applied" as const;
  try {
    await api.submitReview(entry);
    return "submitted" as const;
  } catch (cause) {
    try {
      const after = await api.readAssignment(entry.assignmentId);
      if (!assignmentStillReviewable(after)) return "already-applied" as const;
    } catch { /* Preserve the original submission error and queued entry. */ }
    throw cause;
  }
}

/** Reconcile a lost start response before retrying, preserving the original completion time. */
export async function deliverLesson(entry: ReviewOutboxEntry, api: {
  readAssignment: (assignmentId: number) => Promise<Assignment>;
  startLesson: (entry: ReviewOutboxEntry) => Promise<void>;
}) {
  const before = await api.readAssignment(entry.assignmentId);
  if (before.data.started_at) return;
  try {
    await api.startLesson(entry);
  } catch (cause) {
    try {
      if ((await api.readAssignment(entry.assignmentId)).data.started_at) return;
    } catch { /* Preserve the original error and durable entry. */ }
    throw cause;
  }
}
