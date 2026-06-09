import * as SQLite from "expo-sqlite";
import {
  ApiError,
  startLesson,
  submitReview,
} from "../utils/api";

const DATABASE_NAME = "offline-study-progress.db";

type ProgressType = "lesson" | "review";

type PendingProgressRow = {
  id: number;
  assignment_id: number;
  subject_id: number | null;
  progress_type: ProgressType;
  meaning_incorrect_count: number;
  reading_incorrect_count: number;
  created_at: string | null;
  available_at: string | null;
  retry_count: number;
  inserted_at: number;
  updated_at: number;
  last_error: string | null;
};

export type PendingProgressEntry = {
  id: number;
  assignmentId: number;
  subjectId: number | null;
  progressType: ProgressType;
  meaningIncorrectCount: number;
  readingIncorrectCount: number;
  createdAt: string | null;
  availableAt: string | null;
  retryCount: number;
  insertedAt: number;
  updatedAt: number;
  lastError: string | null;
};

export type QueueProgressPayload = {
  assignmentId: number;
  subjectId?: number | null;
  progressType: ProgressType;
  meaningIncorrectCount?: number;
  readingIncorrectCount?: number;
  createdAt?: string | null;
  availableAt?: string | null;
};

export type ProgressSendFailureReason =
  | "permission"
  | "validation"
  | "network"
  | "api"
  | "unknown";

export type ProgressSendFailure = {
  assignmentId: number;
  progressType: ProgressType;
  statusCode: number | null;
  isPermissionError: boolean;
  isValidationError: boolean;
  reason: ProgressSendFailureReason;
  message: string;
};

export type QueueProgressAttemptResult = {
  response: any | null;
  failure?: ProgressSendFailure;
  queued: boolean;
};

export type PendingProgressSyncResult = {
  processed: number;
  sent: number;
  droppedValidation: number;
  remaining: number;
  stoppedOnFailure: boolean;
  failure?: ProgressSendFailure;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let syncLock: Promise<void> = Promise.resolve();

function mapPendingRow(row: PendingProgressRow): PendingProgressEntry {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    subjectId: row.subject_id,
    progressType: row.progress_type,
    meaningIncorrectCount: row.meaning_incorrect_count,
    readingIncorrectCount: row.reading_incorrect_count,
    createdAt: row.created_at,
    availableAt: row.available_at,
    retryCount: row.retry_count,
    insertedAt: row.inserted_at,
    updatedAt: row.updated_at,
    lastError: row.last_error,
  };
}

function isLikelyNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("timed out") ||
    message.includes("network")
  );
}

function toFailure(error: unknown, row: PendingProgressEntry): ProgressSendFailure {
  const statusCode = error instanceof ApiError ? error.statusCode : null;
  const isPermissionError = statusCode === 401 || statusCode === 403;
  const isValidationError = statusCode === 422;

  let reason: ProgressSendFailureReason = "unknown";
  if (isPermissionError) {
    reason = "permission";
  } else if (isValidationError) {
    reason = "validation";
  } else if (statusCode !== null) {
    reason = "api";
  } else if (isLikelyNetworkError(error)) {
    reason = "network";
  }

  return {
    assignmentId: row.assignmentId,
    progressType: row.progressType,
    statusCode,
    isPermissionError,
    isValidationError,
    reason,
    message: error instanceof Error ? error.message : String(error),
  };
}

async function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  const previousLock = syncLock;
  let releaseLock!: () => void;
  syncLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  await previousLock;
  try {
    return await fn();
  } finally {
    releaseLock();
  }
}

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS pending_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          assignment_id INTEGER NOT NULL,
          subject_id INTEGER,
          progress_type TEXT NOT NULL CHECK(progress_type IN ('lesson', 'review')),
          meaning_incorrect_count INTEGER NOT NULL DEFAULT 0,
          reading_incorrect_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT,
          available_at TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          inserted_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          last_error TEXT,
          UNIQUE (assignment_id, progress_type)
        );
        CREATE INDEX IF NOT EXISTS idx_pending_progress_inserted_at
          ON pending_progress (inserted_at);
        CREATE INDEX IF NOT EXISTS idx_pending_progress_type_assignment
          ON pending_progress (progress_type, assignment_id);
      `);
      return db;
    })();
  }

  return dbPromise;
}

async function getPendingRowByAssignmentAndType(
  db: SQLite.SQLiteDatabase,
  assignmentId: number,
  progressType: ProgressType
): Promise<PendingProgressEntry | null> {
  const row = await db.getFirstAsync<PendingProgressRow>(
    `SELECT
      id,
      assignment_id,
      subject_id,
      progress_type,
      meaning_incorrect_count,
      reading_incorrect_count,
      created_at,
      available_at,
      retry_count,
      inserted_at,
      updated_at,
      last_error
     FROM pending_progress
     WHERE assignment_id = ? AND progress_type = ?
     LIMIT 1`,
    assignmentId,
    progressType
  );

  return row ? mapPendingRow(row) : null;
}

async function upsertPendingProgress(
  db: SQLite.SQLiteDatabase,
  payload: QueueProgressPayload
): Promise<PendingProgressEntry> {
  const now = Date.now();
  const meaningIncorrectCount = Math.max(
    0,
    Math.trunc(payload.meaningIncorrectCount ?? 0)
  );
  const readingIncorrectCount = Math.max(
    0,
    Math.trunc(payload.readingIncorrectCount ?? 0)
  );

  await db.runAsync(
    `INSERT INTO pending_progress (
      assignment_id,
      subject_id,
      progress_type,
      meaning_incorrect_count,
      reading_incorrect_count,
      created_at,
      available_at,
      retry_count,
      inserted_at,
      updated_at,
      last_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)
    ON CONFLICT(assignment_id, progress_type) DO UPDATE SET
      subject_id = excluded.subject_id,
      meaning_incorrect_count = excluded.meaning_incorrect_count,
      reading_incorrect_count = excluded.reading_incorrect_count,
      created_at = excluded.created_at,
      available_at = excluded.available_at,
      updated_at = excluded.updated_at,
      last_error = NULL`,
    payload.assignmentId,
    payload.subjectId ?? null,
    payload.progressType,
    meaningIncorrectCount,
    readingIncorrectCount,
    payload.createdAt ?? null,
    payload.availableAt ?? null,
    now,
    now
  );

  const row = await getPendingRowByAssignmentAndType(
    db,
    payload.assignmentId,
    payload.progressType
  );
  if (!row) {
    throw new Error(
      `Failed to load queued progress row for assignment ${payload.assignmentId}`
    );
  }
  return row;
}

async function deletePendingProgressById(
  db: SQLite.SQLiteDatabase,
  id: number
): Promise<void> {
  await db.runAsync("DELETE FROM pending_progress WHERE id = ?", id);
}

async function markPendingProgressFailure(
  db: SQLite.SQLiteDatabase,
  id: number,
  failure: ProgressSendFailure
): Promise<void> {
  await db.runAsync(
    `UPDATE pending_progress
     SET retry_count = retry_count + 1,
         updated_at = ?,
         last_error = ?
     WHERE id = ?`,
    Date.now(),
    failure.message,
    id
  );
}

async function sendPendingProgressRow(
  row: PendingProgressEntry,
  apiToken: string
): Promise<QueueProgressAttemptResult> {
  try {
    if (row.progressType === "lesson") {
      const response = await startLesson(
        apiToken,
        row.assignmentId,
        row.createdAt ?? undefined
      );
      return {
        response,
        queued: false,
      };
    }

    const response = await submitReview(
      apiToken,
      row.assignmentId,
      row.meaningIncorrectCount,
      row.readingIncorrectCount,
      row.createdAt ?? undefined
    );
    return {
      response,
      queued: false,
    };
  } catch (error) {
    const failure = toFailure(error, row);
    return {
      response: null,
      failure,
      queued: !failure.isValidationError,
    };
  }
}

async function getPendingRows(
  db: SQLite.SQLiteDatabase,
  limit?: number
): Promise<PendingProgressEntry[]> {
  const normalizedLimit =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? Math.trunc(limit)
      : null;

  const query = `SELECT
      id,
      assignment_id,
      subject_id,
      progress_type,
      meaning_incorrect_count,
      reading_incorrect_count,
      created_at,
      available_at,
      retry_count,
      inserted_at,
      updated_at,
      last_error
    FROM pending_progress
    ORDER BY inserted_at ASC, id ASC${
      normalizedLimit !== null ? " LIMIT ?" : ""
    }`;

  const rows =
    normalizedLimit !== null
      ? await db.getAllAsync<PendingProgressRow>(query, normalizedLimit)
      : await db.getAllAsync<PendingProgressRow>(query);

  return rows.map(mapPendingRow);
}

export async function getPendingProgressCounts(): Promise<{
  lesson: number;
  review: number;
  total: number;
}> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    lesson_count: number;
    review_count: number;
    total_count: number;
  }>(
    `SELECT
      SUM(CASE WHEN progress_type = 'lesson' THEN 1 ELSE 0 END) AS lesson_count,
      SUM(CASE WHEN progress_type = 'review' THEN 1 ELSE 0 END) AS review_count,
      COUNT(*) AS total_count
    FROM pending_progress`
  );

  return {
    lesson: row?.lesson_count ?? 0,
    review: row?.review_count ?? 0,
    total: row?.total_count ?? 0,
  };
}

export async function getPendingProgressAssignmentIds(): Promise<{
  lesson: Set<number>;
  review: Set<number>;
}> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    assignment_id: number;
    progress_type: ProgressType;
  }>(`SELECT assignment_id, progress_type FROM pending_progress`);

  const lesson = new Set<number>();
  const review = new Set<number>();

  for (const row of rows) {
    if (row.progress_type === "lesson") {
      lesson.add(row.assignment_id);
    } else {
      review.add(row.assignment_id);
    }
  }

  return { lesson, review };
}

export async function queueProgressAndAttemptSend(
  apiToken: string,
  payload: QueueProgressPayload
): Promise<QueueProgressAttemptResult> {
  if (!apiToken) {
    throw new Error("API token is required to queue progress");
  }

  return withSyncLock(async () => {
    const db = await getDatabase();
    const queuedRow = await upsertPendingProgress(db, payload);
    const attempt = await sendPendingProgressRow(queuedRow, apiToken);

    if (attempt.response) {
      await deletePendingProgressById(db, queuedRow.id);
      return attempt;
    }

    if (attempt.failure?.isValidationError) {
      await deletePendingProgressById(db, queuedRow.id);
      return {
        ...attempt,
        queued: false,
      };
    }

    if (attempt.failure) {
      await markPendingProgressFailure(db, queuedRow.id, attempt.failure);
    }

    return {
      ...attempt,
      queued: true,
    };
  });
}

export async function syncPendingProgress(
  apiToken: string,
  options: { limit?: number } = {}
): Promise<PendingProgressSyncResult> {
  if (!apiToken) {
    return {
      processed: 0,
      sent: 0,
      droppedValidation: 0,
      remaining: 0,
      stoppedOnFailure: false,
    };
  }

  return withSyncLock(async () => {
    const db = await getDatabase();
    const rows = await getPendingRows(db, options.limit);

    let processed = 0;
    let sent = 0;
    let droppedValidation = 0;
    let stoppedOnFailure = false;
    let lastFailure: ProgressSendFailure | undefined;

    for (const row of rows) {
      const attempt = await sendPendingProgressRow(row, apiToken);
      processed += 1;

      if (attempt.response) {
        sent += 1;
        await deletePendingProgressById(db, row.id);
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        continue;
      }

      if (attempt.failure?.isValidationError) {
        droppedValidation += 1;
        await deletePendingProgressById(db, row.id);
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        continue;
      }

      if (attempt.failure) {
        await markPendingProgressFailure(db, row.id, attempt.failure);
        lastFailure = attempt.failure;
      }

      stoppedOnFailure = true;
      break;
    }

    const counts = await getPendingProgressCounts();
    return {
      processed,
      sent,
      droppedValidation,
      remaining: counts.total,
      stoppedOnFailure,
      failure: lastFailure,
    };
  });
}
