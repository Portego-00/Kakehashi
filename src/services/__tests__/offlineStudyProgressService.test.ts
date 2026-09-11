import { createHash } from "crypto";

type ProgressType = "lesson" | "review";

type PendingRow = {
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

class FakeSQLiteDatabase {
  private rows: PendingRow[] = [];
  private legacyRows: Omit<PendingRow, "account_fingerprint">[] = [];
  private legacyTableExists = false;
  private accountBindings = new Map<string, string>();
  private nextId = 1;

  private nextRevision(wallClock: number): number {
    const maxRevision = this.rows.reduce(
      (maximum, row) => Math.max(maximum, row.updated_at),
      -1,
    );
    return Math.max(maxRevision + 1, 0, wallClock);
  }

  seedLegacyRow(row: Omit<PendingRow, "account_fingerprint" | "id">): void {
    this.legacyTableExists = true;
    this.legacyRows.push({ ...row, id: this.nextId++ });
  }

  getStoredAccountFingerprints(): string[] {
    return this.rows.map((row) => row.account_fingerprint);
  }

  getLegacyRowCount(): number {
    return this.legacyRows.length;
  }

  async execAsync(_sql: string): Promise<void> {
    // No-op for tests.
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    await task();
  }

  async runAsync(sql: string, ...args: any[]): Promise<void> {
    if (sql.includes("INSERT INTO pending_progress_account_bindings")) {
      const [tokenFingerprint, accountFingerprint] = args as [string, string];
      if (!this.accountBindings.has(tokenFingerprint)) {
        this.accountBindings.set(tokenFingerprint, accountFingerprint);
      }
      return;
    }

    if (
      sql.includes("INSERT INTO pending_progress_by_account") &&
      sql.includes("FROM pending_progress\n")
    ) {
      const [accountFingerprint, legacyRowId] = args as [string, number];
      const legacyRow = this.legacyRows.find((row) => row.id === legacyRowId);
      if (!legacyRow) {
        return;
      }

      const existingIndex = this.rows.findIndex(
        (row) =>
          row.account_fingerprint === accountFingerprint &&
          row.assignment_id === legacyRow.assignment_id &&
          row.progress_type === legacyRow.progress_type,
      );
      if (existingIndex >= 0) {
        const existing = this.rows[existingIndex];
        const newestPayload =
          legacyRow.updated_at > existing.updated_at ? legacyRow : existing;
        this.rows[existingIndex] = {
          ...newestPayload,
          id: existing.id,
          account_fingerprint: accountFingerprint,
          inserted_at: Math.min(existing.inserted_at, legacyRow.inserted_at),
          updated_at: this.nextRevision(
            Math.max(existing.updated_at, legacyRow.updated_at) + 1,
          ),
        };
      } else {
        this.rows.push({
          ...legacyRow,
          id: this.nextId++,
          account_fingerprint: accountFingerprint,
        });
      }
      return;
    }

    if (
      sql.includes("INSERT INTO pending_progress_by_account") &&
      sql.includes("SELECT\n          ?,\n          assignment_id")
    ) {
      const [accountFingerprint, unverifiedAccountFingerprint] = args as [
        string,
        string,
      ];
      const quarantinedRows = this.rows.filter(
        (row) => row.account_fingerprint === unverifiedAccountFingerprint,
      );
      for (const quarantinedRow of quarantinedRows) {
        const existingIndex = this.rows.findIndex(
          (row) =>
            row.account_fingerprint === accountFingerprint &&
            row.assignment_id === quarantinedRow.assignment_id &&
            row.progress_type === quarantinedRow.progress_type,
        );
        if (existingIndex >= 0) {
          const existing = this.rows[existingIndex];
          const newestPayload =
            quarantinedRow.updated_at >= existing.updated_at
              ? quarantinedRow
              : existing;
          this.rows[existingIndex] = {
            ...newestPayload,
            id: existing.id,
            account_fingerprint: accountFingerprint,
            inserted_at: Math.min(
              existing.inserted_at,
              quarantinedRow.inserted_at,
            ),
            updated_at: this.nextRevision(0),
          };
        } else {
          this.rows.push({
            ...quarantinedRow,
            id: this.nextId++,
            account_fingerprint: accountFingerprint,
          });
        }
      }
      return;
    }

    if (sql.includes("DELETE FROM pending_progress WHERE id = ?")) {
      const [id] = args as [number];
      this.legacyRows = this.legacyRows.filter((row) => row.id !== id);
      return;
    }

    if (sql.includes("INSERT INTO pending_progress_by_account")) {
      const [
        accountFingerprint,
        assignmentId,
        subjectId,
        progressType,
        meaningIncorrectCount,
        readingIncorrectCount,
        createdAt,
        availableAt,
        insertedAt,
        updatedAt,
      ] = args as [
        string,
        number,
        number | null,
        ProgressType,
        number,
        number,
        string | null,
        string | null,
        number,
        number,
      ];

      const existingIndex = this.rows.findIndex(
        (row) =>
          row.account_fingerprint === accountFingerprint &&
          row.assignment_id === assignmentId &&
          row.progress_type === progressType,
      );
      const revision = this.nextRevision(updatedAt);

      if (existingIndex >= 0) {
        const existing = this.rows[existingIndex];
        this.rows[existingIndex] = {
          ...existing,
          subject_id: subjectId,
          meaning_incorrect_count: meaningIncorrectCount,
          reading_incorrect_count: readingIncorrectCount,
          created_at: createdAt,
          available_at: availableAt,
          updated_at: revision,
          last_error: null,
        };
        return;
      }

      this.rows.push({
        id: this.nextId++,
        account_fingerprint: accountFingerprint,
        assignment_id: assignmentId,
        subject_id: subjectId,
        progress_type: progressType,
        meaning_incorrect_count: meaningIncorrectCount,
        reading_incorrect_count: readingIncorrectCount,
        created_at: createdAt,
        available_at: availableAt,
        retry_count: 0,
        inserted_at: insertedAt,
        updated_at: revision,
        last_error: null,
      });
      return;
    }

    if (sql.includes("DELETE FROM pending_progress_by_account WHERE id = ?")) {
      const [id, accountFingerprint] = args as [number, string];
      this.rows = this.rows.filter(
        (row) =>
          row.id !== id || row.account_fingerprint !== accountFingerprint,
      );
      return;
    }

    if (
      sql.includes("DELETE FROM pending_progress_by_account") &&
      sql.includes("WHERE account_fingerprint = ?")
    ) {
      const [accountFingerprint] = args as [string];
      this.rows = this.rows.filter(
        (row) => row.account_fingerprint !== accountFingerprint,
      );
      return;
    }

    if (
      sql.includes("UPDATE pending_progress_by_account") &&
      sql.includes("retry_count = retry_count + 1")
    ) {
      const [updatedAt, lastError, id, accountFingerprint] = args as [
        number,
        string,
        number,
        string,
      ];
      const revision = this.nextRevision(updatedAt);
      this.rows = this.rows.map((row) =>
        row.id === id && row.account_fingerprint === accountFingerprint
          ? {
              ...row,
              retry_count: row.retry_count + 1,
              updated_at: revision,
              last_error: lastError,
            }
          : row,
      );
      return;
    }

    throw new Error(`Unhandled runAsync query: ${sql}`);
  }

  async getFirstAsync<T>(sql: string, ...args: any[]): Promise<T | null> {
    if (sql.includes("FROM sqlite_master")) {
      return (this.legacyTableExists
        ? { name: "pending_progress" }
        : null) as T | null;
    }

    if (sql.includes("FROM pending_progress_account_bindings")) {
      const [tokenFingerprint] = args as [string];
      const accountFingerprint = this.accountBindings.get(tokenFingerprint);
      return (
        accountFingerprint ? { account_fingerprint: accountFingerprint } : null
      ) as T | null;
    }

    if (
      sql.includes(
        "WHERE account_fingerprint = ? AND assignment_id = ? AND progress_type = ?",
      )
    ) {
      const [accountFingerprint, assignmentId, progressType] = args as [
        string,
        number,
        ProgressType,
      ];
      const row = this.rows.find(
        (candidate) =>
          candidate.account_fingerprint === accountFingerprint &&
          candidate.assignment_id === assignmentId &&
          candidate.progress_type === progressType,
      );
      return (row ?? null) as T | null;
    }

    if (sql.includes("SUM(CASE WHEN progress_type = 'lesson'")) {
      const [accountFingerprint] = args as [string];
      const accountRows = this.rows.filter(
        (row) => row.account_fingerprint === accountFingerprint,
      );
      const lessonCount = accountRows.filter(
        (row) => row.progress_type === "lesson",
      ).length;
      const reviewCount = accountRows.filter(
        (row) => row.progress_type === "review",
      ).length;

      return {
        lesson_count: lessonCount,
        review_count: reviewCount,
        total_count: accountRows.length,
      } as T;
    }

    throw new Error(`Unhandled getFirstAsync query: ${sql}`);
  }

  async getAllAsync<T>(sql: string, ...args: any[]): Promise<T[]> {
    if (
      sql.includes("FROM pending_progress\n") &&
      !sql.includes("FROM pending_progress_by_account")
    ) {
      return [...this.legacyRows].sort((a, b) => {
        if (a.inserted_at !== b.inserted_at) {
          return a.inserted_at - b.inserted_at;
        }
        return a.id - b.id;
      }) as T[];
    }

    if (
      sql.includes(
        "SELECT assignment_id, progress_type\n     FROM pending_progress_by_account",
      )
    ) {
      const [accountFingerprint] = args as [string];
      return this.rows
        .filter((row) => row.account_fingerprint === accountFingerprint)
        .map((row) => ({
          assignment_id: row.assignment_id,
          progress_type: row.progress_type,
        })) as T[];
    }

    if (
      sql.includes("FROM pending_progress_by_account") &&
      sql.includes("ORDER BY inserted_at ASC")
    ) {
      const [accountFingerprint, limit] = args as [string, number | undefined];
      const sorted = this.rows
        .filter((row) => row.account_fingerprint === accountFingerprint)
        .sort((a, b) => {
          if (a.inserted_at !== b.inserted_at) {
            return a.inserted_at - b.inserted_at;
          }
          return a.id - b.id;
        });

      if (sql.includes("LIMIT ?")) {
        return sorted.slice(0, limit) as T[];
      }

      return sorted as T[];
    }

    throw new Error(`Unhandled getAllAsync query: ${sql}`);
  }
}

class MockApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message?: string) {
    super(message ?? `API error: ${statusCode}`);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

function mockAssignment(id: number, subjectId: number) {
  return {
    id,
    data: { subject_id: subjectId },
  };
}

describe("offlineStudyProgressService", () => {
  const loadModule = () => {
    jest.resetModules();

    const db = new FakeSQLiteDatabase();
    const startLessonMock = jest.fn();
    const submitReviewMock = jest.fn();
    const getAssignmentsMock = jest.fn().mockResolvedValue({ data: [] });
    const getUserDataMock = jest
      .fn()
      .mockRejectedValue(new Error("Network request failed"));

    jest.doMock("expo-sqlite", () => ({
      openDatabaseAsync: jest.fn(async () => db),
    }));

    jest.doMock("expo-crypto", () => ({
      CryptoDigestAlgorithm: { SHA256: "SHA-256" },
      digestStringAsync: jest.fn(async (_algorithm: string, value: string) =>
        createHash("sha256").update(value).digest("hex"),
      ),
    }));

    jest.doMock("../../utils/api", () => ({
      ApiError: MockApiError,
      getAssignments: getAssignmentsMock,
      getUserData: getUserDataMock,
      startLesson: startLessonMock,
      submitReview: submitReviewMock,
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const service = require("../offlineStudyProgressService");

    return {
      service,
      db,
      getAssignmentsMock,
      getUserDataMock,
      startLessonMock,
      submitReviewMock,
    };
  };

  it("sends lesson progress immediately and leaves queue empty on success", async () => {
    const { service, startLessonMock } = loadModule();
    await service.registerPendingProgressAccount("token", "user-1");

    startLessonMock.mockResolvedValue({ ok: true });

    const result = await service.queueProgressAndAttemptSend("token", {
      assignmentId: 42,
      subjectId: 1001,
      progressType: "lesson",
    });

    expect(result.response).toEqual({ ok: true });
    expect(result.queued).toBe(false);
    expect(startLessonMock).toHaveBeenCalledWith("token", 42, undefined);

    const counts = await service.getPendingProgressCounts("token");
    expect(counts).toEqual({ lesson: 0, review: 0, total: 0 });
  });

  it("keeps review progress queued on network failure and sends it during sync", async () => {
    const { service, submitReviewMock } = loadModule();
    await service.registerPendingProgressAccount("token", "user-1");

    submitReviewMock
      .mockRejectedValueOnce(new Error("Network request failed"))
      .mockResolvedValueOnce({ ok: true });

    const queueResult = await service.queueProgressAndAttemptSend("token", {
      assignmentId: 99,
      subjectId: 2001,
      progressType: "review",
      meaningIncorrectCount: 2,
      readingIncorrectCount: 1,
      createdAt: "2026-04-22T12:00:00.000Z",
      availableAt: "2026-04-22T11:00:00.000Z",
    });

    expect(queueResult.response).toBeNull();
    expect(queueResult.queued).toBe(true);
    expect(queueResult.failure?.reason).toBe("network");

    const beforeSyncCounts = await service.getPendingProgressCounts("token");
    expect(beforeSyncCounts.review).toBe(1);

    const syncResult = await service.syncPendingProgress("token");
    expect(syncResult).toMatchObject({
      processed: 1,
      sent: 1,
      droppedValidation: 0,
      remaining: 0,
      stoppedOnFailure: false,
    });

    const afterSyncCounts = await service.getPendingProgressCounts("token");
    expect(afterSyncCounts.total).toBe(0);
  });

  it("persists later progress while an earlier network send is still pending", async () => {
    const { service, submitReviewMock } = loadModule();
    await service.registerPendingProgressAccount("token", "user-1");

    submitReviewMock.mockImplementation(() => new Promise(() => {}));

    void service.queueProgressAndAttemptSend("token", {
      assignmentId: 201,
      progressType: "review",
      meaningIncorrectCount: 1,
      readingIncorrectCount: 0,
    });
    void service.queueProgressAndAttemptSend("token", {
      assignmentId: 202,
      progressType: "review",
      meaningIncorrectCount: 0,
      readingIncorrectCount: 1,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const pendingIds = await service.getPendingProgressAssignmentIds("token");
    expect(Array.from(pendingIds.review).sort()).toEqual([201, 202]);
  });

  it("coalesces concurrent queue syncs into one network submission", async () => {
    const { service, submitReviewMock } = loadModule();
    await service.registerPendingProgressAccount("token", "user-1");
    let resolveSubmission!: (value: { ok: boolean }) => void;
    let markSubmissionStarted!: () => void;
    const submissionStarted = new Promise<void>((resolve) => {
      markSubmissionStarted = resolve;
    });
    const submission = new Promise<{ ok: boolean }>((resolve) => {
      resolveSubmission = resolve;
    });

    submitReviewMock.mockImplementation(() => {
      markSubmissionStarted();
      return submission;
    });
    await service.queueProgress("token", {
      assignmentId: 301,
      progressType: "review",
      meaningIncorrectCount: 1,
      readingIncorrectCount: 0,
    });

    const firstSync = service.syncPendingProgress("token");
    await submissionStarted;
    const secondSync = service.syncPendingProgress("token");

    expect(submitReviewMock).toHaveBeenCalledTimes(1);

    resolveSubmission({ ok: true });
    const [firstResult, secondResult] = await Promise.all([
      firstSync,
      secondSync,
    ]);

    expect(secondResult).toEqual(firstResult);
    expect(firstResult).toMatchObject({
      processed: 1,
      sent: 1,
      remaining: 0,
      stoppedOnFailure: false,
    });
    expect(submitReviewMock).toHaveBeenCalledTimes(1);
  });

  it("drains progress queued after an in-flight sync took its snapshot", async () => {
    const { service, submitReviewMock } = loadModule();
    await service.registerPendingProgressAccount("token", "user-1");
    let resolveFirstSubmission!: (value: { ok: boolean }) => void;
    let markFirstSubmissionStarted!: () => void;
    const firstSubmissionStarted = new Promise<void>((resolve) => {
      markFirstSubmissionStarted = resolve;
    });
    const firstSubmission = new Promise<{ ok: boolean }>((resolve) => {
      resolveFirstSubmission = resolve;
    });

    submitReviewMock
      .mockImplementationOnce(() => {
        markFirstSubmissionStarted();
        return firstSubmission;
      })
      .mockResolvedValueOnce({ ok: true });
    await service.queueProgress("token", {
      assignmentId: 320,
      progressType: "review",
      meaningIncorrectCount: 1,
      readingIncorrectCount: 0,
    });

    const firstSync = service.syncPendingProgress("token");
    await firstSubmissionStarted;
    await service.queueProgress("token", {
      assignmentId: 321,
      progressType: "review",
      meaningIncorrectCount: 0,
      readingIncorrectCount: 1,
    });
    const secondSync = service.syncPendingProgress("token");

    resolveFirstSubmission({ ok: true });
    const [firstResult, secondResult] = await Promise.all([
      firstSync,
      secondSync,
    ]);

    expect(secondResult).toEqual(firstResult);
    expect(firstResult).toMatchObject({
      processed: 2,
      sent: 2,
      remaining: 0,
      stoppedOnFailure: false,
    });
    expect(submitReviewMock).toHaveBeenNthCalledWith(
      2,
      "token",
      321,
      0,
      1,
      undefined,
    );
  });

  it("quarantines offline progress until that exact token is verified", async () => {
    const { service, submitReviewMock } = loadModule();
    submitReviewMock.mockResolvedValue({ ok: true });

    await expect(
      service.queueProgressAndAttemptSend("offline-token", {
        assignmentId: 350,
        progressType: "review",
        meaningIncorrectCount: 1,
        readingIncorrectCount: 2,
      }),
    ).resolves.toMatchObject({ response: null, queued: true });
    await expect(
      service.getPendingProgressCounts("offline-token"),
    ).resolves.toEqual({ lesson: 0, review: 1, total: 1 });
    await expect(
      service.getPendingProgressCounts("different-token"),
    ).resolves.toEqual({ lesson: 0, review: 0, total: 0 });

    await expect(
      service.syncPendingProgress("offline-token"),
    ).resolves.toMatchObject({
      processed: 0,
      sent: 0,
      remaining: 1,
      stoppedOnFailure: false,
    });
    await service.registerPendingProgressAccount("different-token", "user-2");
    await expect(
      service.syncPendingProgress("different-token"),
    ).resolves.toMatchObject({ processed: 0, sent: 0, remaining: 0 });
    expect(submitReviewMock).not.toHaveBeenCalled();

    await service.registerPendingProgressAccount("offline-token", "user-1");
    await expect(
      service.getPendingProgressCounts("offline-token"),
    ).resolves.toEqual({ lesson: 0, review: 1, total: 1 });
    await expect(
      service.syncPendingProgress("offline-token"),
    ).resolves.toMatchObject({ processed: 1, sent: 1, remaining: 0 });
    expect(submitReviewMock).toHaveBeenCalledWith(
      "offline-token",
      350,
      1,
      2,
      undefined,
    );
  });

  it("retries account verification during ordinary sync after connectivity returns", async () => {
    const { service, getUserDataMock, submitReviewMock } = loadModule();
    getUserDataMock
      .mockReset()
      .mockRejectedValueOnce(new Error("Network request failed"))
      .mockResolvedValueOnce({ data: { id: "user-1" } });
    submitReviewMock.mockResolvedValue({ ok: true });

    await service.queueProgress("offline-token", {
      assignmentId: 351,
      subjectId: 1351,
      progressType: "review",
      meaningIncorrectCount: 2,
      readingIncorrectCount: 1,
    });

    await expect(
      service.syncPendingProgress("offline-token"),
    ).resolves.toMatchObject({ processed: 0, sent: 0, remaining: 1 });
    expect(submitReviewMock).not.toHaveBeenCalled();

    await expect(
      service.syncPendingProgress("offline-token"),
    ).resolves.toMatchObject({ processed: 1, sent: 1, remaining: 0 });
    expect(getUserDataMock).toHaveBeenCalledTimes(2);
    expect(getUserDataMock).toHaveBeenNthCalledWith(2, "offline-token", {
      forceRefresh: true,
    });
    expect(submitReviewMock).toHaveBeenCalledWith(
      "offline-token",
      351,
      2,
      1,
      undefined,
    );
  });

  it("coalesces concurrent account verification during ordinary sync", async () => {
    const { service, getUserDataMock, submitReviewMock } = loadModule();
    let resolveUser!: (value: { data: { id: string } }) => void;
    let markVerificationStarted!: () => void;
    const verificationStarted = new Promise<void>((resolve) => {
      markVerificationStarted = resolve;
    });
    const userResponse = new Promise<{ data: { id: string } }>((resolve) => {
      resolveUser = resolve;
    });
    getUserDataMock.mockReset().mockImplementation(() => {
      markVerificationStarted();
      return userResponse;
    });
    submitReviewMock.mockResolvedValue({ ok: true });

    await service.queueProgress("offline-token", {
      assignmentId: 352,
      subjectId: 1352,
      progressType: "review",
    });

    const firstSync = service.syncPendingProgress("offline-token");
    const secondSync = service.syncPendingProgress("offline-token");
    await verificationStarted;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getUserDataMock).toHaveBeenCalledTimes(1);

    resolveUser({ data: { id: "user-1" } });
    const [firstResult, secondResult] = await Promise.all([
      firstSync,
      secondSync,
    ]);
    expect(firstResult).toMatchObject({ sent: 1, remaining: 0 });
    expect(secondResult).toEqual(firstResult);
    expect(submitReviewMock).toHaveBeenCalledTimes(1);
  });

  it("isolates counts and delivery per account while another account is stalled", async () => {
    const { service, db, submitReviewMock } = loadModule();
    await service.registerPendingProgressAccount("token-a", "user-a");
    await service.registerPendingProgressAccount("token-b", "user-b");
    let resolveAccountASubmission!: (value: { ok: boolean }) => void;
    let markAccountASubmissionStarted!: () => void;
    const accountASubmissionStarted = new Promise<void>((resolve) => {
      markAccountASubmissionStarted = resolve;
    });
    const accountASubmission = new Promise<{ ok: boolean }>((resolve) => {
      resolveAccountASubmission = resolve;
    });

    submitReviewMock.mockImplementation((token: string) => {
      if (token === "token-a") {
        markAccountASubmissionStarted();
        return accountASubmission;
      }
      return Promise.resolve({ ok: true });
    });

    await service.queueProgress("token-a", {
      assignmentId: 401,
      progressType: "review",
      meaningIncorrectCount: 1,
      readingIncorrectCount: 0,
    });
    await service.queueProgress("token-b", {
      assignmentId: 401,
      progressType: "review",
      meaningIncorrectCount: 3,
      readingIncorrectCount: 2,
    });

    await expect(service.getPendingProgressCounts("token-a")).resolves.toEqual({
      lesson: 0,
      review: 1,
      total: 1,
    });
    await expect(service.getPendingProgressCounts("token-b")).resolves.toEqual({
      lesson: 0,
      review: 1,
      total: 1,
    });
    const accountBFingerprints = db.getStoredAccountFingerprints();
    expect(new Set(accountBFingerprints)).toHaveProperty("size", 2);
    expect(accountBFingerprints).not.toContain("token-a");
    expect(accountBFingerprints).not.toContain("token-b");

    const accountASync = service.syncPendingProgress("token-a");
    await accountASubmissionStarted;

    await expect(service.syncPendingProgress("token-b")).resolves.toMatchObject(
      {
        processed: 1,
        sent: 1,
        remaining: 0,
        stoppedOnFailure: false,
      },
    );
    expect(submitReviewMock).toHaveBeenCalledWith(
      "token-b",
      401,
      3,
      2,
      undefined,
    );
    await expect(service.getPendingProgressCounts("token-b")).resolves.toEqual({
      lesson: 0,
      review: 0,
      total: 0,
    });
    await expect(service.getPendingProgressCounts("token-a")).resolves.toEqual({
      lesson: 0,
      review: 1,
      total: 1,
    });

    resolveAccountASubmission({ ok: true });
    await expect(accountASync).resolves.toMatchObject({
      sent: 1,
      remaining: 0,
    });
  });

  it("rekeys a queued account to a newly verified token for the same user", async () => {
    const { service, submitReviewMock } = loadModule();
    let rejectOldTokenSubmission!: (reason: Error) => void;
    let markOldTokenSubmissionStarted!: () => void;
    const oldTokenSubmissionStarted = new Promise<void>((resolve) => {
      markOldTokenSubmissionStarted = resolve;
    });
    const oldTokenSubmission = new Promise((_resolve, reject) => {
      rejectOldTokenSubmission = reject;
    });
    submitReviewMock.mockImplementation((token: string) => {
      if (token === "old-token") {
        markOldTokenSubmissionStarted();
        return oldTokenSubmission;
      }
      return Promise.resolve({ ok: true });
    });

    await service.registerPendingProgressAccount("old-token", "user-1");
    await service.queueProgress("old-token", {
      assignmentId: 450,
      progressType: "review",
      meaningIncorrectCount: 2,
      readingIncorrectCount: 1,
    });

    const oldTokenSync = service.syncPendingProgress("old-token");
    await oldTokenSubmissionStarted;
    await service.registerPendingProgressAccount("new-token", "user-1");
    const newTokenSync = service.syncPendingProgress("new-token");

    await expect(
      service.getPendingProgressCounts("old-token"),
    ).resolves.toEqual({
      lesson: 0,
      review: 1,
      total: 1,
    });
    await expect(
      service.getPendingProgressCounts("new-token"),
    ).resolves.toEqual({
      lesson: 0,
      review: 1,
      total: 1,
    });
    rejectOldTokenSubmission(new MockApiError(401, "revoked token"));
    await expect(oldTokenSync).resolves.toMatchObject({
      processed: 1,
      sent: 0,
      remaining: 1,
      stoppedOnFailure: true,
    });
    await expect(newTokenSync).resolves.toMatchObject({
      processed: 1,
      sent: 1,
      remaining: 0,
    });
    expect(submitReviewMock).toHaveBeenCalledWith(
      "new-token",
      450,
      2,
      1,
      undefined,
    );
  });

  it("uses write order when stable and quarantined payload timestamps tie", async () => {
    const { service, submitReviewMock } = loadModule();
    await service.registerPendingProgressAccount("first-token", "user-1");
    const nowSpy = jest.spyOn(Date, "now");

    try {
      nowSpy.mockReturnValue(1_000);
      await service.queueProgress("replacement-token", {
        assignmentId: 460,
        progressType: "review",
        meaningIncorrectCount: 1,
        readingIncorrectCount: 0,
      });

      nowSpy.mockReturnValue(1_000);
      await service.queueProgress("first-token", {
        assignmentId: 460,
        progressType: "review",
        meaningIncorrectCount: 4,
        readingIncorrectCount: 3,
      });
      await service.registerPendingProgressAccount(
        "replacement-token",
        "user-1",
      );

      submitReviewMock.mockResolvedValue({ ok: true });
      await expect(
        service.syncPendingProgress("replacement-token"),
      ).resolves.toMatchObject({ sent: 1, remaining: 0 });
      expect(submitReviewMock).toHaveBeenCalledWith(
        "replacement-token",
        460,
        4,
        3,
        undefined,
      );
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("refuses to bind one token fingerprint to a different verified user", async () => {
    const { service } = loadModule();
    await service.registerPendingProgressAccount("token", "user-a");

    await expect(
      service.registerPendingProgressAccount("token", "user-b"),
    ).rejects.toThrow("already bound to another WaniKani account");
  });

  it("lets each verified account claim only its ownership-proven legacy rows", async () => {
    const {
      service,
      db,
      getAssignmentsMock,
      startLessonMock,
      submitReviewMock,
    } = loadModule();
    db.seedLegacyRow({
      assignment_id: 501,
      subject_id: 1501,
      progress_type: "review",
      meaning_incorrect_count: 1,
      reading_incorrect_count: 0,
      created_at: null,
      available_at: null,
      retry_count: 0,
      inserted_at: 1,
      updated_at: 1,
      last_error: null,
    });
    db.seedLegacyRow({
      assignment_id: 502,
      subject_id: 1502,
      progress_type: "lesson",
      meaning_incorrect_count: 0,
      reading_incorrect_count: 0,
      created_at: null,
      available_at: null,
      retry_count: 0,
      inserted_at: 2,
      updated_at: 2,
      last_error: null,
    });
    getAssignmentsMock.mockImplementation(async (token: string) => ({
      data:
        token === "token-a"
          ? [mockAssignment(501, 1501)]
          : [mockAssignment(502, 1502)],
    }));
    submitReviewMock.mockResolvedValue({ ok: true });
    startLessonMock.mockResolvedValue({ ok: true });

    await service.registerPendingProgressAccount("token-a", "user-a");
    expect(db.getLegacyRowCount()).toBe(1);
    await expect(service.getPendingProgressCounts("token-a")).resolves.toEqual({
      lesson: 0,
      review: 1,
      total: 1,
    });
    await expect(service.syncPendingProgress("token-a")).resolves.toMatchObject({
      sent: 1,
      remaining: 0,
    });
    expect(submitReviewMock).toHaveBeenCalledWith(
      "token-a",
      501,
      1,
      0,
      undefined,
    );

    await service.registerPendingProgressAccount("token-b", "user-b");
    expect(db.getLegacyRowCount()).toBe(0);
    await expect(service.syncPendingProgress("token-b")).resolves.toMatchObject({
      sent: 1,
      remaining: 0,
    });
    expect(startLessonMock).toHaveBeenCalledWith("token-b", 502, undefined);
  });

  it("checks legacy assignment ownership in bounded batches", async () => {
    const { service, db, getAssignmentsMock } = loadModule();
    for (let index = 0; index < 101; index += 1) {
      db.seedLegacyRow({
        assignment_id: 600 + index,
        subject_id: 1600 + index,
        progress_type: "review",
        meaning_incorrect_count: 0,
        reading_incorrect_count: 0,
        created_at: null,
        available_at: null,
        retry_count: 0,
        inserted_at: index,
        updated_at: index,
        last_error: null,
      });
    }
    getAssignmentsMock.mockImplementation(
      async (_token: string, options: { ids: number[] }) => ({
        data: options.ids.map((id) => mockAssignment(id, id + 1000)),
      }),
    );

    await service.registerPendingProgressAccount("token", "user-1");

    expect(getAssignmentsMock).toHaveBeenCalledTimes(2);
    expect(getAssignmentsMock.mock.calls[0][1].ids).toHaveLength(100);
    expect(getAssignmentsMock.mock.calls[1][1].ids).toHaveLength(1);
    expect(db.getLegacyRowCount()).toBe(0);
    await expect(service.getPendingProgressCounts("token")).resolves.toEqual({
      lesson: 0,
      review: 101,
      total: 101,
    });
  });

  it("keeps legacy rows intact across failed and mismatched ownership checks", async () => {
    const { service, db, getAssignmentsMock, submitReviewMock } = loadModule();
    db.seedLegacyRow({
      assignment_id: 510,
      subject_id: 1510,
      progress_type: "review",
      meaning_incorrect_count: 1,
      reading_incorrect_count: 0,
      created_at: null,
      available_at: null,
      retry_count: 0,
      inserted_at: 1,
      updated_at: 1,
      last_error: null,
    });
    db.seedLegacyRow({
      assignment_id: 511,
      subject_id: 1511,
      progress_type: "review",
      meaning_incorrect_count: 0,
      reading_incorrect_count: 1,
      created_at: null,
      available_at: null,
      retry_count: 0,
      inserted_at: 2,
      updated_at: 2,
      last_error: null,
    });
    getAssignmentsMock.mockRejectedValueOnce(new Error("Network request failed"));

    await expect(
      service.registerPendingProgressAccount("token", "user-1"),
    ).resolves.toBeUndefined();
    expect(db.getLegacyRowCount()).toBe(2);

    getAssignmentsMock.mockResolvedValueOnce({
      data: [mockAssignment(510, 9999), mockAssignment(511, 1511)],
    });
    submitReviewMock.mockResolvedValue({ ok: true });
    await expect(service.syncPendingProgress("token")).resolves.toMatchObject({
      processed: 1,
      sent: 1,
      remaining: 0,
    });
    expect(db.getLegacyRowCount()).toBe(1);
    expect(submitReviewMock).toHaveBeenCalledWith(
      "token",
      511,
      0,
      1,
      undefined,
    );

    await expect(service.syncPendingProgress("token")).resolves.toMatchObject({
      processed: 0,
      sent: 0,
      remaining: 0,
    });
    expect(getAssignmentsMock).toHaveBeenCalledTimes(2);
    expect(db.getLegacyRowCount()).toBe(1);
  });

  it("recovers legacy rows idempotently and keeps the newest queued payload", async () => {
    const { service, db, getAssignmentsMock, submitReviewMock } = loadModule();
    await service.registerPendingProgressAccount("token", "user-1");
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(7_000);

    try {
      await service.queueProgress("token", {
        assignmentId: 520,
        subjectId: 1520,
        progressType: "review",
        meaningIncorrectCount: 9,
        readingIncorrectCount: 8,
      });
      await service.queueProgress("token", {
        assignmentId: 521,
        subjectId: 1521,
        progressType: "review",
        meaningIncorrectCount: 2,
        readingIncorrectCount: 1,
      });
      db.seedLegacyRow({
        assignment_id: 520,
        subject_id: 1520,
        progress_type: "review",
        meaning_incorrect_count: 1,
        reading_incorrect_count: 0,
        created_at: null,
        available_at: null,
        retry_count: 0,
        inserted_at: 1,
        updated_at: 7_000,
        last_error: null,
      });
      db.seedLegacyRow({
        assignment_id: 521,
        subject_id: 1521,
        progress_type: "review",
        meaning_incorrect_count: 7,
        reading_incorrect_count: 6,
        created_at: null,
        available_at: null,
        retry_count: 0,
        inserted_at: 2,
        updated_at: 8_000,
        last_error: null,
      });
      getAssignmentsMock.mockResolvedValue({
        data: [mockAssignment(520, 1520), mockAssignment(521, 1521)],
      });
      submitReviewMock.mockResolvedValue({ ok: true });

      await expect(service.syncPendingProgress("token")).resolves.toMatchObject({
        processed: 2,
        sent: 2,
        remaining: 0,
      });
      expect(db.getLegacyRowCount()).toBe(0);
      expect(submitReviewMock).toHaveBeenCalledWith(
        "token",
        520,
        9,
        8,
        undefined,
      );
      expect(submitReviewMock).toHaveBeenCalledWith(
        "token",
        521,
        7,
        6,
        undefined,
      );

      await expect(service.syncPendingProgress("token")).resolves.toMatchObject({
        processed: 0,
        sent: 0,
        remaining: 0,
      });
      expect(submitReviewMock).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("preserves and later sends a same-millisecond replacement queued during delivery", async () => {
    const { service, submitReviewMock } = loadModule();
    await service.registerPendingProgressAccount("token", "user-1");
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_000);
    let resolveFirstSubmission!: (value: { version: string }) => void;
    let markFirstSubmissionStarted!: () => void;
    const firstSubmissionStarted = new Promise<void>((resolve) => {
      markFirstSubmissionStarted = resolve;
    });
    const firstSubmission = new Promise<{ version: string }>((resolve) => {
      resolveFirstSubmission = resolve;
    });

    try {
      submitReviewMock
        .mockImplementationOnce(() => {
          markFirstSubmissionStarted();
          return firstSubmission;
        })
        .mockResolvedValueOnce({ version: "new" });

      const firstAttempt = service.queueProgressAndAttemptSend("token", {
        assignmentId: 302,
        progressType: "review",
        meaningIncorrectCount: 1,
        readingIncorrectCount: 0,
      });
      await firstSubmissionStarted;

      await service.queueProgress("token", {
        assignmentId: 302,
        progressType: "review",
        meaningIncorrectCount: 3,
        readingIncorrectCount: 2,
      });

      resolveFirstSubmission({ version: "old" });
      await expect(firstAttempt).resolves.toMatchObject({ queued: true });
      await expect(
        service.getPendingProgressCounts("token"),
      ).resolves.toMatchObject({
        review: 1,
        total: 1,
      });

      await expect(service.syncPendingProgress("token")).resolves.toMatchObject(
        {
          processed: 1,
          sent: 1,
          remaining: 0,
          stoppedOnFailure: false,
        },
      );
      expect(submitReviewMock).toHaveBeenNthCalledWith(
        2,
        "token",
        302,
        3,
        2,
        undefined,
      );
      await expect(
        service.getPendingProgressCounts("token"),
      ).resolves.toMatchObject({
        total: 0,
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("drops queued review progress on replay when API returns 422", async () => {
    const { service, submitReviewMock } = loadModule();
    await service.registerPendingProgressAccount("token", "user-1");

    submitReviewMock
      .mockRejectedValueOnce(new Error("Network request failed"))
      .mockRejectedValueOnce(new MockApiError(422, "unprocessable"));

    const queueResult = await service.queueProgressAndAttemptSend("token", {
      assignmentId: 123,
      progressType: "review",
      meaningIncorrectCount: 0,
      readingIncorrectCount: 0,
    });

    expect(queueResult.queued).toBe(true);

    const syncResult = await service.syncPendingProgress("token");
    expect(syncResult).toMatchObject({
      processed: 1,
      sent: 0,
      droppedValidation: 1,
      remaining: 0,
      stoppedOnFailure: false,
    });

    const counts = await service.getPendingProgressCounts("token");
    expect(counts.total).toBe(0);
  });

  it("stops sync on the first non-validation error and keeps remaining queue", async () => {
    const { service, submitReviewMock } = loadModule();
    await service.registerPendingProgressAccount("token", "user-1");

    submitReviewMock
      .mockRejectedValueOnce(new Error("Network request failed"))
      .mockRejectedValueOnce(new Error("Network request failed"))
      .mockRejectedValueOnce(new Error("Network request failed"));

    await service.queueProgressAndAttemptSend("token", {
      assignmentId: 201,
      progressType: "review",
      meaningIncorrectCount: 1,
      readingIncorrectCount: 0,
    });

    await service.queueProgressAndAttemptSend("token", {
      assignmentId: 202,
      progressType: "review",
      meaningIncorrectCount: 0,
      readingIncorrectCount: 1,
    });

    const syncResult = await service.syncPendingProgress("token");
    expect(syncResult).toMatchObject({
      processed: 1,
      sent: 0,
      droppedValidation: 0,
      remaining: 2,
      stoppedOnFailure: true,
    });

    const pendingIds = await service.getPendingProgressAssignmentIds("token");
    expect(Array.from(pendingIds.review).sort()).toEqual([201, 202]);
  });
});
