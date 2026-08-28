import type { Assignment } from "@/types/wanikani";

export interface ReviewOutboxEntry {
  assignmentId: number;
  incorrectMeaningAnswers: number;
  incorrectReadingAnswers: number;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

type OutboxStorage = Pick<Storage, "getItem" | "setItem">;
const PREFIX = "kakehashi-review-outbox";
export function reviewOutboxKey(username: string) { return `${PREFIX}:${encodeURIComponent(username.toLocaleLowerCase())}:v1`; }

export function loadReviewOutbox(storage: Pick<Storage, "getItem">, username: string): ReviewOutboxEntry[] {
  try {
    const parsed = JSON.parse(storage.getItem(reviewOutboxKey(username)) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is ReviewOutboxEntry => Boolean(
      row && typeof row === "object" && Number.isInteger((row as ReviewOutboxEntry).assignmentId)
      && typeof (row as ReviewOutboxEntry).createdAt === "string"
      && Number.isInteger((row as ReviewOutboxEntry).incorrectMeaningAnswers)
      && Number.isInteger((row as ReviewOutboxEntry).incorrectReadingAnswers)
    )).slice(-200);
  } catch { return []; }
}

function save(storage: OutboxStorage, username: string, entries: ReviewOutboxEntry[]) {
  storage.setItem(reviewOutboxKey(username), JSON.stringify(entries.slice(-200)));
}

export function enqueueReview(storage: OutboxStorage, username: string, input: Omit<ReviewOutboxEntry, "attempts" | "lastError">) {
  const rows = loadReviewOutbox(storage, username);
  const existing = rows.find((row) => row.assignmentId === input.assignmentId);
  const entry = existing || { ...input, attempts: 0 };
  if (!existing) save(storage, username, [...rows, entry]);
  return entry;
}

export function removeReview(storage: OutboxStorage, username: string, assignmentId: number) {
  save(storage, username, loadReviewOutbox(storage, username).filter((row) => row.assignmentId !== assignmentId));
}

export function noteReviewFailure(storage: OutboxStorage, username: string, assignmentId: number, message: string) {
  save(storage, username, loadReviewOutbox(storage, username).map((row) => row.assignmentId === assignmentId ? { ...row, attempts: row.attempts + 1, lastError: message } : row));
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
