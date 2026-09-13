import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import {
  ApiError,
  getAssignments,
  getUserData,
  startLesson,
  submitReview,
} from "../utils/api";

const DATABASE_NAME = "offline-study-progress.db";
const TOKEN_FINGERPRINT_VERSION = "wanikani-token-sha256-v1";
const ACCOUNT_FINGERPRINT_VERSION = "wanikani-user-sha256-v1";
const UNVERIFIED_SCOPE_VERSION = "unverified-wanikani-token-v1";
const LEGACY_ASSIGNMENT_BATCH_SIZE = 100;

type ProgressType = "lesson" | "review";

type PendingProgressRow = {
  id: number;
  account_fingerprint: string;
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

type LegacyPendingProgressRow = Omit<
  PendingProgressRow,
  "account_fingerprint"
>;

export type PendingProgressEntry = {
  id: number;
  accountFingerprint: string;
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
  "permission" | "validation" | "network" | "api" | "unknown";

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
let databaseLock: Promise<void> = Promise.resolve();
const deliveryLocks = new Map<string, Promise<void>>();
type PendingProgressSyncState = {
  promise: Promise<PendingProgressSyncResult>;
  rerunRequested: boolean;
  rerunLimit?: number;
  closed: boolean;
};

const pendingProgressSyncs = new Map<string, PendingProgressSyncState>();
const pendingAccountVerifications = new Map<
  string,
  Promise<PendingProgressScope>
>();
const pendingLegacyRecoveries = new Map<string, Promise<void>>();
const completedLegacyRecoverySnapshots = new Map<string, string>();

type PendingProgressScope = {
  accountFingerprint: string;
  tokenFingerprint: string;
  verified: boolean;
};

function mapPendingRow(row: PendingProgressRow): PendingProgressEntry {
  return {
    id: row.id,
    accountFingerprint: row.account_fingerprint,
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

function toFailure(
  error: unknown,
  row: PendingProgressEntry,
): ProgressSendFailure {
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

async function withDatabaseLock<T>(fn: () => Promise<T>): Promise<T> {
  const previousLock = databaseLock;
  let releaseLock!: () => void;
  databaseLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  await previousLock;
  try {
    return await fn();
  } finally {
    releaseLock();
  }
}

async function withDeliveryLock<T>(
  accountFingerprint: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previousLock =
    deliveryLocks.get(accountFingerprint) ?? Promise.resolve();
  let releaseLock!: () => void;
  const currentLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  deliveryLocks.set(accountFingerprint, currentLock);
  await previousLock;
  try {
    return await fn();
  } finally {
    releaseLock();
    if (deliveryLocks.get(accountFingerprint) === currentLock) {
      deliveryLocks.delete(accountFingerprint);
    }
  }
}

async function fingerprintApiToken(apiToken: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `wanikani-api-token:${apiToken}`,
  );
  return `${TOKEN_FINGERPRINT_VERSION}:${digest}`;
}

async function fingerprintAccountId(accountId: string): Promise<string> {
  const normalizedAccountId = String(accountId).trim().toLowerCase();
  if (!normalizedAccountId) {
    throw new Error("WaniKani account ID is required to register progress");
  }

  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `wanikani-user-id:${normalizedAccountId}`,
  );
  return `${ACCOUNT_FINGERPRINT_VERSION}:${digest}`;
}

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        -- Older versions used an unscoped pending_progress table. Treat it as
        -- quarantine: a row moves only after an authenticated assignment lookup
        -- proves its account ownership. All new writes use this scoped table.
        CREATE TABLE IF NOT EXISTS pending_progress_by_account (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_fingerprint TEXT NOT NULL,
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
          UNIQUE (account_fingerprint, assignment_id, progress_type)
        );
        CREATE INDEX IF NOT EXISTS idx_pending_progress_account_inserted
          ON pending_progress_by_account (account_fingerprint, inserted_at, id);
        CREATE INDEX IF NOT EXISTS idx_pending_progress_account_type_assignment
          ON pending_progress_by_account (
            account_fingerprint,
            progress_type,
            assignment_id
          );
        CREATE TABLE IF NOT EXISTS pending_progress_account_bindings (
          token_fingerprint TEXT PRIMARY KEY NOT NULL,
          account_fingerprint TEXT NOT NULL,
          registered_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_pending_progress_binding_account
          ON pending_progress_account_bindings (account_fingerprint);
      `);
      return db;
    })();
  }

  return dbPromise;
}

async function getRegisteredAccountFingerprint(
  tokenFingerprint: string,
  database?: SQLite.SQLiteDatabase,
): Promise<string | null> {
  const db = database ?? (await getDatabase());
  const binding = await db.getFirstAsync<{ account_fingerprint: string }>(
    `SELECT account_fingerprint
     FROM pending_progress_account_bindings
     WHERE token_fingerprint = ?
     LIMIT 1`,
    tokenFingerprint,
  );
  return binding?.account_fingerprint ?? null;
}

function getUnverifiedAccountFingerprint(tokenFingerprint: string): string {
  return `${UNVERIFIED_SCOPE_VERSION}:${tokenFingerprint}`;
}

async function getPendingProgressScope(
  apiToken: string,
): Promise<PendingProgressScope> {
  const tokenFingerprint = await fingerprintApiToken(apiToken);
  const registeredAccountFingerprint =
    await getRegisteredAccountFingerprint(tokenFingerprint);
  return {
    accountFingerprint:
      registeredAccountFingerprint ??
      getUnverifiedAccountFingerprint(tokenFingerprint),
    tokenFingerprint,
    verified: Boolean(registeredAccountFingerprint),
  };
}

async function getLegacyPendingProgressRows(
  db: SQLite.SQLiteDatabase,
): Promise<LegacyPendingProgressRow[]> {
  const legacyTable = await db.getFirstAsync<{ name: string }>(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table' AND name = 'pending_progress'
     LIMIT 1`,
  );
  if (!legacyTable) {
    return [];
  }

  return db.getAllAsync<LegacyPendingProgressRow>(
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
     ORDER BY inserted_at ASC, id ASC`,
  );
}

async function migrateLegacyPendingProgressRows(
  accountFingerprint: string,
  ownedRows: LegacyPendingProgressRow[],
): Promise<void> {
  if (ownedRows.length === 0) {
    return;
  }

  await withDatabaseLock(async () => {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      for (const row of ownedRows) {
        await db.runAsync(
          `INSERT INTO pending_progress_by_account (
            account_fingerprint,
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
          )
          SELECT
            ?,
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
          WHERE id = ?
          ON CONFLICT(account_fingerprint, assignment_id, progress_type)
          DO UPDATE SET
            subject_id = CASE
              WHEN excluded.updated_at > pending_progress_by_account.updated_at
                THEN excluded.subject_id
              ELSE pending_progress_by_account.subject_id
            END,
            meaning_incorrect_count = CASE
              WHEN excluded.updated_at > pending_progress_by_account.updated_at
                THEN excluded.meaning_incorrect_count
              ELSE pending_progress_by_account.meaning_incorrect_count
            END,
            reading_incorrect_count = CASE
              WHEN excluded.updated_at > pending_progress_by_account.updated_at
                THEN excluded.reading_incorrect_count
              ELSE pending_progress_by_account.reading_incorrect_count
            END,
            created_at = CASE
              WHEN excluded.updated_at > pending_progress_by_account.updated_at
                THEN excluded.created_at
              ELSE pending_progress_by_account.created_at
            END,
            available_at = CASE
              WHEN excluded.updated_at > pending_progress_by_account.updated_at
                THEN excluded.available_at
              ELSE pending_progress_by_account.available_at
            END,
            retry_count = CASE
              WHEN excluded.updated_at > pending_progress_by_account.updated_at
                THEN excluded.retry_count
              ELSE pending_progress_by_account.retry_count
            END,
            inserted_at = MIN(
              pending_progress_by_account.inserted_at,
              excluded.inserted_at
            ),
            updated_at = MAX(
              pending_progress_by_account.updated_at + 1,
              excluded.updated_at + 1,
              COALESCE(
                (SELECT MAX(updated_at) + 1 FROM pending_progress_by_account),
                0
              )
            ),
            last_error = CASE
              WHEN excluded.updated_at > pending_progress_by_account.updated_at
                THEN excluded.last_error
              ELSE pending_progress_by_account.last_error
            END`,
          accountFingerprint,
          row.id,
        );
        await db.runAsync("DELETE FROM pending_progress WHERE id = ?", row.id);
      }
    });
  });
}

async function runLegacyPendingProgressRecovery(
  apiToken: string,
  accountFingerprint: string,
): Promise<void> {
  const legacyRows = await withDatabaseLock(async () => {
    const db = await getDatabase();
    return getLegacyPendingProgressRows(db);
  });
  if (legacyRows.length === 0) {
    return;
  }

  const legacySnapshot = legacyRows
    .map(
      (row) =>
        `${row.id}:${row.assignment_id}:${row.subject_id ?? "null"}:${row.updated_at}`,
    )
    .join("|");
  if (
    completedLegacyRecoverySnapshots.get(accountFingerprint) === legacySnapshot
  ) {
    return;
  }

  const assignmentIds = Array.from(
    new Set(legacyRows.map((row) => row.assignment_id)),
  );
  const ownedAssignments = new Map<number, number>();

  // Keep the authenticated ownership checks comfortably below URL and API
  // collection limits. No legacy row is moved unless every check completes.
  for (
    let index = 0;
    index < assignmentIds.length;
    index += LEGACY_ASSIGNMENT_BATCH_SIZE
  ) {
    const batch = assignmentIds.slice(
      index,
      index + LEGACY_ASSIGNMENT_BATCH_SIZE,
    );
    const response = await getAssignments(apiToken, { ids: batch });
    for (const assignment of response.data) {
      if (
        Number.isInteger(assignment.id) &&
        Number.isInteger(assignment.data?.subject_id)
      ) {
        ownedAssignments.set(assignment.id, assignment.data.subject_id);
      }
    }
  }

  const ownedRows = legacyRows.filter((row) => {
    const verifiedSubjectId = ownedAssignments.get(row.assignment_id);
    return (
      verifiedSubjectId !== undefined &&
      (row.subject_id === null || row.subject_id === verifiedSubjectId)
    );
  });
  await migrateLegacyPendingProgressRows(accountFingerprint, ownedRows);
  const ownedRowIds = new Set(ownedRows.map((row) => row.id));
  completedLegacyRecoverySnapshots.set(
    accountFingerprint,
    legacyRows
      .filter((row) => !ownedRowIds.has(row.id))
      .map(
        (row) =>
          `${row.id}:${row.assignment_id}:${row.subject_id ?? "null"}:${row.updated_at}`,
      )
      .join("|"),
  );
}

async function recoverLegacyPendingProgress(
  apiToken: string,
  scope: Pick<PendingProgressScope, "accountFingerprint" | "tokenFingerprint">,
): Promise<void> {
  const recoveryKey = `${scope.accountFingerprint}:${scope.tokenFingerprint}`;
  const pendingRecovery = pendingLegacyRecoveries.get(recoveryKey);
  if (pendingRecovery) {
    return pendingRecovery;
  }

  const recoveryPromise = runLegacyPendingProgressRecovery(
    apiToken,
    scope.accountFingerprint,
  ).finally(() => {
    if (pendingLegacyRecoveries.get(recoveryKey) === recoveryPromise) {
      pendingLegacyRecoveries.delete(recoveryKey);
    }
  });
  pendingLegacyRecoveries.set(recoveryKey, recoveryPromise);
  return recoveryPromise;
}

export async function hasPendingProgressAccountBinding(
  apiToken: string,
): Promise<boolean> {
  if (!apiToken) {
    return false;
  }
  const tokenFingerprint = await fingerprintApiToken(apiToken);
  return Boolean(await getRegisteredAccountFingerprint(tokenFingerprint));
}

/**
 * Binds a token to the stable WaniKani user returned by a successful `/user`
 * request. Only one-way fingerprints are stored. Registering a replacement
 * token for the same user grants it access to that user's existing queue,
 * while a token verified for another user resolves to a different queue.
 */
export async function registerPendingProgressAccount(
  apiToken: string,
  verifiedAccountId: string,
): Promise<void> {
  if (!apiToken) {
    throw new Error("API token is required to register progress");
  }

  const [tokenFingerprint, accountFingerprint] = await Promise.all([
    fingerprintApiToken(apiToken),
    fingerprintAccountId(verifiedAccountId),
  ]);
  const unverifiedAccountFingerprint =
    getUnverifiedAccountFingerprint(tokenFingerprint);

  await withDatabaseLock(async () => {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      const existingBinding = await db.getFirstAsync<{
        account_fingerprint: string;
      }>(
        `SELECT account_fingerprint
         FROM pending_progress_account_bindings
         WHERE token_fingerprint = ?
         LIMIT 1`,
        tokenFingerprint,
      );

      if (
        existingBinding &&
        existingBinding.account_fingerprint !== accountFingerprint
      ) {
        throw new Error(
          "API token is already bound to another WaniKani account",
        );
      }

      await db.runAsync(
        `INSERT INTO pending_progress_account_bindings (
          token_fingerprint,
          account_fingerprint,
          registered_at
        ) VALUES (?, ?, ?)
        ON CONFLICT(token_fingerprint) DO NOTHING`,
        tokenFingerprint,
        accountFingerprint,
        Date.now(),
      );
      // Work completed before this token could be verified lives in a token-
      // specific quarantine. Move it only after this exact token's `/user`
      // response establishes the stable account identity.
      await db.runAsync(
        `INSERT INTO pending_progress_by_account (
          account_fingerprint,
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
        )
        SELECT
          ?,
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
        FROM pending_progress_by_account
        WHERE account_fingerprint = ?
        ON CONFLICT(account_fingerprint, assignment_id, progress_type)
        DO UPDATE SET
          subject_id = CASE
            WHEN excluded.updated_at >= pending_progress_by_account.updated_at
              THEN excluded.subject_id
            ELSE pending_progress_by_account.subject_id
          END,
          meaning_incorrect_count = CASE
            WHEN excluded.updated_at >= pending_progress_by_account.updated_at
              THEN excluded.meaning_incorrect_count
            ELSE pending_progress_by_account.meaning_incorrect_count
          END,
          reading_incorrect_count = CASE
            WHEN excluded.updated_at >= pending_progress_by_account.updated_at
              THEN excluded.reading_incorrect_count
            ELSE pending_progress_by_account.reading_incorrect_count
          END,
          created_at = CASE
            WHEN excluded.updated_at >= pending_progress_by_account.updated_at
              THEN excluded.created_at
            ELSE pending_progress_by_account.created_at
          END,
          available_at = CASE
            WHEN excluded.updated_at >= pending_progress_by_account.updated_at
              THEN excluded.available_at
            ELSE pending_progress_by_account.available_at
          END,
          retry_count = CASE
            WHEN excluded.updated_at >= pending_progress_by_account.updated_at
              THEN excluded.retry_count
            ELSE pending_progress_by_account.retry_count
          END,
          inserted_at = MIN(
            pending_progress_by_account.inserted_at,
            excluded.inserted_at
          ),
          updated_at = MAX(
            pending_progress_by_account.updated_at + 1,
            excluded.updated_at + 1,
            COALESCE(
              (SELECT MAX(updated_at) + 1 FROM pending_progress_by_account),
              0
            )
          ),
          last_error = CASE
            WHEN excluded.updated_at >= pending_progress_by_account.updated_at
              THEN excluded.last_error
            ELSE pending_progress_by_account.last_error
          END`,
        accountFingerprint,
        unverifiedAccountFingerprint,
      );
      await db.runAsync(
        `DELETE FROM pending_progress_by_account
         WHERE account_fingerprint = ?`,
        unverifiedAccountFingerprint,
      );
    });
  });

  // Legacy rows predate account scoping. Recover only rows whose assignment is
  // returned by this verified account; a failed check leaves every row intact
  // for a later retry or for its actual account to claim.
  await recoverLegacyPendingProgress(apiToken, {
    accountFingerprint,
    tokenFingerprint,
  }).catch(() => {});
}

async function verifyPendingProgressAccount(
  apiToken: string,
  initialScope: PendingProgressScope,
): Promise<PendingProgressScope> {
  if (initialScope.verified) {
    return initialScope;
  }

  const pendingVerification = pendingAccountVerifications.get(
    initialScope.tokenFingerprint,
  );
  if (pendingVerification) {
    return pendingVerification;
  }

  const verificationPromise = (async () => {
    try {
      const verifiedUser = await getUserData(apiToken, { forceRefresh: true });
      await registerPendingProgressAccount(apiToken, verifiedUser.data.id);
    } catch {
      // Offline and invalid-token failures must leave token-scoped work in its
      // quarantine. A later ordinary sync can safely retry verification.
    }
    return getPendingProgressScope(apiToken);
  })().finally(() => {
    if (
      pendingAccountVerifications.get(initialScope.tokenFingerprint) ===
      verificationPromise
    ) {
      pendingAccountVerifications.delete(initialScope.tokenFingerprint);
    }
  });
  pendingAccountVerifications.set(
    initialScope.tokenFingerprint,
    verificationPromise,
  );
  return verificationPromise;
}

async function getPendingRowByAssignmentAndType(
  db: SQLite.SQLiteDatabase,
  accountFingerprint: string,
  assignmentId: number,
  progressType: ProgressType,
): Promise<PendingProgressEntry | null> {
  const row = await db.getFirstAsync<PendingProgressRow>(
    `SELECT
      id,
      account_fingerprint,
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
     FROM pending_progress_by_account
     WHERE account_fingerprint = ? AND assignment_id = ? AND progress_type = ?
     LIMIT 1`,
    accountFingerprint,
    assignmentId,
    progressType,
  );

  return row ? mapPendingRow(row) : null;
}

async function upsertPendingProgress(
  db: SQLite.SQLiteDatabase,
  accountFingerprint: string,
  payload: QueueProgressPayload,
): Promise<PendingProgressEntry> {
  const now = Date.now();
  const meaningIncorrectCount = Math.max(
    0,
    Math.trunc(payload.meaningIncorrectCount ?? 0),
  );
  const readingIncorrectCount = Math.max(
    0,
    Math.trunc(payload.readingIncorrectCount ?? 0),
  );

  await db.runAsync(
    `INSERT INTO pending_progress_by_account (
      account_fingerprint,
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
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, 0, ?,
      MAX(
        COALESCE(
          (SELECT MAX(updated_at) + 1 FROM pending_progress_by_account),
          0
        ),
        ?
      ),
      NULL
    )
    ON CONFLICT(account_fingerprint, assignment_id, progress_type) DO UPDATE SET
      subject_id = excluded.subject_id,
      meaning_incorrect_count = excluded.meaning_incorrect_count,
      reading_incorrect_count = excluded.reading_incorrect_count,
      created_at = excluded.created_at,
      available_at = excluded.available_at,
      updated_at = MAX(pending_progress_by_account.updated_at + 1, excluded.updated_at),
      last_error = NULL`,
    accountFingerprint,
    payload.assignmentId,
    payload.subjectId ?? null,
    payload.progressType,
    meaningIncorrectCount,
    readingIncorrectCount,
    payload.createdAt ?? null,
    payload.availableAt ?? null,
    now,
    now,
  );

  const row = await getPendingRowByAssignmentAndType(
    db,
    accountFingerprint,
    payload.assignmentId,
    payload.progressType,
  );
  if (!row) {
    throw new Error(
      `Failed to load queued progress row for assignment ${payload.assignmentId}`,
    );
  }
  return row;
}

async function deletePendingProgressById(
  db: SQLite.SQLiteDatabase,
  accountFingerprint: string,
  id: number,
): Promise<void> {
  await db.runAsync(
    "DELETE FROM pending_progress_by_account WHERE id = ? AND account_fingerprint = ?",
    id,
    accountFingerprint,
  );
}

async function markPendingProgressFailure(
  db: SQLite.SQLiteDatabase,
  accountFingerprint: string,
  id: number,
  failure: ProgressSendFailure,
): Promise<void> {
  await db.runAsync(
    `UPDATE pending_progress_by_account
     SET retry_count = retry_count + 1,
         updated_at = MAX(
           COALESCE(
             (SELECT MAX(updated_at) + 1 FROM pending_progress_by_account),
             0
           ),
           ?
         ),
         last_error = ?
     WHERE id = ? AND account_fingerprint = ?`,
    Date.now(),
    failure.message,
    id,
    accountFingerprint,
  );
}

async function sendPendingProgressRow(
  row: PendingProgressEntry,
  apiToken: string,
): Promise<QueueProgressAttemptResult> {
  try {
    if (row.progressType === "lesson") {
      const response = await startLesson(
        apiToken,
        row.assignmentId,
        row.createdAt ?? undefined,
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
      row.createdAt ?? undefined,
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
  accountFingerprint: string,
  limit?: number,
): Promise<PendingProgressEntry[]> {
  const normalizedLimit =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? Math.trunc(limit)
      : null;

  const query = `SELECT
      id,
      account_fingerprint,
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
    FROM pending_progress_by_account
    WHERE account_fingerprint = ?
    ORDER BY inserted_at ASC, id ASC${
      normalizedLimit !== null ? " LIMIT ?" : ""
    }`;

  const rows =
    normalizedLimit !== null
      ? await db.getAllAsync<PendingProgressRow>(
          query,
          accountFingerprint,
          normalizedLimit,
        )
      : await db.getAllAsync<PendingProgressRow>(query, accountFingerprint);

  return rows.map(mapPendingRow);
}

export async function getPendingProgressCounts(apiToken: string): Promise<{
  lesson: number;
  review: number;
  total: number;
}> {
  if (!apiToken) {
    return { lesson: 0, review: 0, total: 0 };
  }

  const { accountFingerprint } = await getPendingProgressScope(apiToken);
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
    FROM pending_progress_by_account
    WHERE account_fingerprint = ?`,
    accountFingerprint,
  );

  return {
    lesson: row?.lesson_count ?? 0,
    review: row?.review_count ?? 0,
    total: row?.total_count ?? 0,
  };
}

export async function getPendingProgressAssignmentIds(
  apiToken: string,
): Promise<{
  lesson: Set<number>;
  review: Set<number>;
}> {
  if (!apiToken) {
    return { lesson: new Set<number>(), review: new Set<number>() };
  }

  const { accountFingerprint } = await getPendingProgressScope(apiToken);
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    assignment_id: number;
    progress_type: ProgressType;
  }>(
    `SELECT assignment_id, progress_type
     FROM pending_progress_by_account
     WHERE account_fingerprint = ?`,
    accountFingerprint,
  );

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
  payload: QueueProgressPayload,
): Promise<QueueProgressAttemptResult> {
  if (!apiToken) {
    throw new Error("API token is required to queue progress");
  }

  const scope = await queueProgressForToken(apiToken, payload);
  if (!scope.verified) {
    return { response: null, queued: true };
  }
  return attemptPendingProgressSendForAccount(
    apiToken,
    scope.accountFingerprint,
    payload.assignmentId,
    payload.progressType,
  );
}

/**
 * Durably stores study progress without waiting for the network. Callers can
 * safely move on as soon as this resolves and retry delivery later.
 */
async function queueProgressForToken(
  apiToken: string,
  payload: QueueProgressPayload,
): Promise<PendingProgressScope> {
  const tokenFingerprint = await fingerprintApiToken(apiToken);
  return withDatabaseLock(async () => {
    const db = await getDatabase();
    const registeredAccountFingerprint = await getRegisteredAccountFingerprint(
      tokenFingerprint,
      db,
    );
    const scope: PendingProgressScope = {
      accountFingerprint:
        registeredAccountFingerprint ??
        getUnverifiedAccountFingerprint(tokenFingerprint),
      tokenFingerprint,
      verified: Boolean(registeredAccountFingerprint),
    };
    await upsertPendingProgress(db, scope.accountFingerprint, payload);
    return scope;
  });
}

export async function queueProgress(
  apiToken: string,
  payload: QueueProgressPayload,
): Promise<void> {
  if (!apiToken) {
    throw new Error("API token is required to queue progress");
  }

  await queueProgressForToken(apiToken, payload);
}

/**
 * Attempts delivery for one already-queued entry. Network I/O is serialized
 * separately from database writes so a stalled request cannot prevent later
 * review answers from reaching durable storage.
 */
export async function attemptPendingProgressSend(
  apiToken: string,
  assignmentId: number,
  progressType: ProgressType,
): Promise<QueueProgressAttemptResult> {
  if (!apiToken) {
    throw new Error("API token is required to send queued progress");
  }

  const scope = await getPendingProgressScope(apiToken);
  if (!scope.verified) {
    return { response: null, queued: true };
  }
  return attemptPendingProgressSendForAccount(
    apiToken,
    scope.accountFingerprint,
    assignmentId,
    progressType,
  );
}

async function attemptPendingProgressSendForAccount(
  apiToken: string,
  accountFingerprint: string,
  assignmentId: number,
  progressType: ProgressType,
): Promise<QueueProgressAttemptResult> {
  return withDeliveryLock(accountFingerprint, async () => {
    const queuedRow = await withDatabaseLock(async () => {
      const db = await getDatabase();
      return getPendingRowByAssignmentAndType(
        db,
        accountFingerprint,
        assignmentId,
        progressType,
      );
    });

    // Another delivery may have completed while this attempt waited its turn.
    if (!queuedRow) {
      return { response: null, queued: true };
    }

    const attempt = await sendPendingProgressRow(queuedRow, apiToken);
    return withDatabaseLock(async () => {
      const db = await getDatabase();
      const currentRow = await getPendingRowByAssignmentAndType(
        db,
        accountFingerprint,
        assignmentId,
        progressType,
      );
      const rowIsCurrent =
        currentRow?.id === queuedRow.id &&
        currentRow.updatedAt === queuedRow.updatedAt;

      // Do not delete a newer replacement that was queued during the request.
      if (!rowIsCurrent) {
        return {
          ...attempt,
          queued: Boolean(currentRow) || attempt.queued,
        };
      }

      if (attempt.response) {
        await deletePendingProgressById(db, accountFingerprint, queuedRow.id);
        return attempt;
      }

      if (attempt.failure?.isValidationError) {
        await deletePendingProgressById(db, accountFingerprint, queuedRow.id);
        return {
          ...attempt,
          queued: false,
        };
      }

      if (attempt.failure) {
        await markPendingProgressFailure(
          db,
          accountFingerprint,
          queuedRow.id,
          attempt.failure,
        );
      }

      return {
        ...attempt,
        queued: true,
      };
    });
  });
}

async function runPendingProgressSync(
  apiToken: string,
  accountFingerprint: string,
  options: { limit?: number } = {},
): Promise<PendingProgressSyncResult> {
  const rows = await withDatabaseLock(async () => {
    const db = await getDatabase();
    return getPendingRows(db, accountFingerprint, options.limit);
  });

  let processed = 0;
  let sent = 0;
  let droppedValidation = 0;
  let stoppedOnFailure = false;
  let lastFailure: ProgressSendFailure | undefined;

  for (const row of rows) {
    const attempt = await attemptPendingProgressSendForAccount(
      apiToken,
      accountFingerprint,
      row.assignmentId,
      row.progressType,
    );
    processed += 1;

    if (attempt.response) {
      sent += 1;
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      continue;
    }

    if (attempt.failure?.isValidationError) {
      droppedValidation += 1;
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      continue;
    }

    // No response or failure means another queued delivery completed this row.
    if (!attempt.failure) {
      continue;
    }

    lastFailure = attempt.failure;
    stoppedOnFailure = true;
    break;
  }

  const counts = await getPendingProgressCountsForAccount(accountFingerprint);
  return {
    processed,
    sent,
    droppedValidation,
    remaining: counts.total,
    stoppedOnFailure,
    failure: lastFailure,
  };
}

async function getPendingProgressCountsForAccount(
  accountFingerprint: string,
): Promise<{ lesson: number; review: number; total: number }> {
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
    FROM pending_progress_by_account
    WHERE account_fingerprint = ?`,
    accountFingerprint,
  );

  return {
    lesson: row?.lesson_count ?? 0,
    review: row?.review_count ?? 0,
    total: row?.total_count ?? 0,
  };
}

function normalizeSyncLimit(limit: number | undefined): number | undefined {
  return typeof limit === "number" && Number.isFinite(limit) && limit > 0
    ? Math.trunc(limit)
    : undefined;
}

function mergeSyncLimits(
  current: number | undefined,
  requested: number | undefined,
): number | undefined {
  if (current === undefined || requested === undefined) {
    return undefined;
  }
  return Math.max(current, requested);
}

async function drainPendingProgressSyncRequests(
  apiToken: string,
  accountFingerprint: string,
  initialOptions: { limit?: number },
  state: PendingProgressSyncState,
): Promise<PendingProgressSyncResult> {
  let options = initialOptions;
  let aggregate: PendingProgressSyncResult = {
    processed: 0,
    sent: 0,
    droppedValidation: 0,
    remaining: 0,
    stoppedOnFailure: false,
  };

  while (true) {
    state.rerunRequested = false;
    state.rerunLimit = undefined;
    const result = await runPendingProgressSync(
      apiToken,
      accountFingerprint,
      options,
    );
    aggregate = {
      ...result,
      processed: aggregate.processed + result.processed,
      sent: aggregate.sent + result.sent,
      droppedValidation: aggregate.droppedValidation + result.droppedValidation,
    };

    if (!state.rerunRequested) {
      // Close the state before this promise can settle. A sync that arrives in
      // the gap before the finally handler removes the map entry must start a
      // fresh drain instead of attaching a request nobody can service.
      state.closed = true;
      return aggregate;
    }
    options = { limit: state.rerunLimit };
  }
}

export async function syncPendingProgress(
  apiToken: string,
  options: { limit?: number } = {},
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

  let scope = await getPendingProgressScope(apiToken);
  if (!scope.verified) {
    scope = await verifyPendingProgressAccount(apiToken, scope);
  }
  if (!scope.verified) {
    const counts = await getPendingProgressCountsForAccount(
      scope.accountFingerprint,
    );
    return {
      processed: 0,
      sent: 0,
      droppedValidation: 0,
      remaining: counts.total,
      stoppedOnFailure: false,
    };
  }

  // Registration attempts the same recovery, but a prior ownership lookup may
  // have failed while offline. Retry on normal sync without blocking delivery
  // of already-account-scoped work.
  await recoverLegacyPendingProgress(apiToken, scope).catch(() => {});

  const syncScope = `${scope.accountFingerprint}:${scope.tokenFingerprint}`;
  const pendingProgressSyncInFlight = pendingProgressSyncs.get(syncScope);
  if (pendingProgressSyncInFlight && !pendingProgressSyncInFlight.closed) {
    const requestedLimit = normalizeSyncLimit(options.limit);
    pendingProgressSyncInFlight.rerunLimit =
      pendingProgressSyncInFlight.rerunRequested
        ? mergeSyncLimits(
            pendingProgressSyncInFlight.rerunLimit,
            requestedLimit,
          )
        : requestedLimit;
    pendingProgressSyncInFlight.rerunRequested = true;
    return pendingProgressSyncInFlight.promise;
  }

  const state: PendingProgressSyncState = {
    promise: Promise.resolve({
      processed: 0,
      sent: 0,
      droppedValidation: 0,
      remaining: 0,
      stoppedOnFailure: false,
    }),
    rerunRequested: false,
    closed: false,
  };
  const syncPromise = drainPendingProgressSyncRequests(
    apiToken,
    scope.accountFingerprint,
    options,
    state,
  ).finally(() => {
    state.closed = true;
    if (pendingProgressSyncs.get(syncScope) === state) {
      pendingProgressSyncs.delete(syncScope);
    }
  });
  state.promise = syncPromise;
  pendingProgressSyncs.set(syncScope, state);
  return syncPromise;
}
