type ProgressType = "lesson" | "review";

type PendingRow = {
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

class FakeSQLiteDatabase {
  private rows: PendingRow[] = [];
  private nextId = 1;

  async execAsync(_sql: string): Promise<void> {
    // No-op for tests.
  }

  async runAsync(sql: string, ...args: any[]): Promise<void> {
    if (sql.includes("INSERT INTO pending_progress")) {
      const [
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
        number,
        number | null,
        ProgressType,
        number,
        number,
        string | null,
        string | null,
        number,
        number
      ];

      const existingIndex = this.rows.findIndex(
        (row) =>
          row.assignment_id === assignmentId && row.progress_type === progressType
      );

      if (existingIndex >= 0) {
        const existing = this.rows[existingIndex];
        this.rows[existingIndex] = {
          ...existing,
          subject_id: subjectId,
          meaning_incorrect_count: meaningIncorrectCount,
          reading_incorrect_count: readingIncorrectCount,
          created_at: createdAt,
          available_at: availableAt,
          updated_at: updatedAt,
          last_error: null,
        };
        return;
      }

      this.rows.push({
        id: this.nextId++,
        assignment_id: assignmentId,
        subject_id: subjectId,
        progress_type: progressType,
        meaning_incorrect_count: meaningIncorrectCount,
        reading_incorrect_count: readingIncorrectCount,
        created_at: createdAt,
        available_at: availableAt,
        retry_count: 0,
        inserted_at: insertedAt,
        updated_at: updatedAt,
        last_error: null,
      });
      return;
    }

    if (sql.includes("DELETE FROM pending_progress WHERE id = ?")) {
      const [id] = args as [number];
      this.rows = this.rows.filter((row) => row.id !== id);
      return;
    }

    if (
      sql.includes("UPDATE pending_progress") &&
      sql.includes("retry_count = retry_count + 1")
    ) {
      const [updatedAt, lastError, id] = args as [number, string, number];
      this.rows = this.rows.map((row) =>
        row.id === id
          ? {
              ...row,
              retry_count: row.retry_count + 1,
              updated_at: updatedAt,
              last_error: lastError,
            }
          : row
      );
      return;
    }

    throw new Error(`Unhandled runAsync query: ${sql}`);
  }

  async getFirstAsync<T>(sql: string, ...args: any[]): Promise<T | null> {
    if (sql.includes("WHERE assignment_id = ? AND progress_type = ?")) {
      const [assignmentId, progressType] = args as [number, ProgressType];
      const row = this.rows.find(
        (candidate) =>
          candidate.assignment_id === assignmentId &&
          candidate.progress_type === progressType
      );
      return (row ?? null) as T | null;
    }

    if (sql.includes("SUM(CASE WHEN progress_type = 'lesson'")) {
      const lessonCount = this.rows.filter(
        (row) => row.progress_type === "lesson"
      ).length;
      const reviewCount = this.rows.filter(
        (row) => row.progress_type === "review"
      ).length;

      return {
        lesson_count: lessonCount,
        review_count: reviewCount,
        total_count: this.rows.length,
      } as T;
    }

    throw new Error(`Unhandled getFirstAsync query: ${sql}`);
  }

  async getAllAsync<T>(sql: string, ...args: any[]): Promise<T[]> {
    if (sql.includes("SELECT assignment_id, progress_type FROM pending_progress")) {
      return this.rows.map((row) => ({
        assignment_id: row.assignment_id,
        progress_type: row.progress_type,
      })) as T[];
    }

    if (sql.includes("FROM pending_progress") && sql.includes("ORDER BY inserted_at ASC")) {
      const sorted = [...this.rows].sort((a, b) => {
        if (a.inserted_at !== b.inserted_at) {
          return a.inserted_at - b.inserted_at;
        }
        return a.id - b.id;
      });

      if (sql.includes("LIMIT ?")) {
        const [limit] = args as [number];
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

describe("offlineStudyProgressService", () => {
  const loadModule = () => {
    jest.resetModules();

    const db = new FakeSQLiteDatabase();
    const startLessonMock = jest.fn();
    const submitReviewMock = jest.fn();

    jest.doMock("expo-sqlite", () => ({
      openDatabaseAsync: jest.fn(async () => db),
    }));

    jest.doMock("../../utils/api", () => ({
      ApiError: MockApiError,
      startLesson: startLessonMock,
      submitReview: submitReviewMock,
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const service = require("../offlineStudyProgressService");

    return {
      service,
      startLessonMock,
      submitReviewMock,
    };
  };

  it("sends lesson progress immediately and leaves queue empty on success", async () => {
    const { service, startLessonMock } = loadModule();

    startLessonMock.mockResolvedValue({ ok: true });

    const result = await service.queueProgressAndAttemptSend("token", {
      assignmentId: 42,
      subjectId: 1001,
      progressType: "lesson",
    });

    expect(result.response).toEqual({ ok: true });
    expect(result.queued).toBe(false);
    expect(startLessonMock).toHaveBeenCalledWith("token", 42, undefined);

    const counts = await service.getPendingProgressCounts();
    expect(counts).toEqual({ lesson: 0, review: 0, total: 0 });
  });

  it("keeps review progress queued on network failure and sends it during sync", async () => {
    const { service, submitReviewMock } = loadModule();

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

    const beforeSyncCounts = await service.getPendingProgressCounts();
    expect(beforeSyncCounts.review).toBe(1);

    const syncResult = await service.syncPendingProgress("token");
    expect(syncResult).toMatchObject({
      processed: 1,
      sent: 1,
      droppedValidation: 0,
      remaining: 0,
      stoppedOnFailure: false,
    });

    const afterSyncCounts = await service.getPendingProgressCounts();
    expect(afterSyncCounts.total).toBe(0);
  });

  it("drops queued review progress on replay when API returns 422", async () => {
    const { service, submitReviewMock } = loadModule();

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

    const counts = await service.getPendingProgressCounts();
    expect(counts.total).toBe(0);
  });

  it("stops sync on the first non-validation error and keeps remaining queue", async () => {
    const { service, submitReviewMock } = loadModule();

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

    const pendingIds = await service.getPendingProgressAssignmentIds();
    expect(Array.from(pendingIds.review).sort()).toEqual([201, 202]);
  });
});
