const makeAssignment = (overrides: Partial<any> = {}) => ({
  id: 42,
  object: "assignment",
  url: "https://api.wanikani.com/v2/assignments/42",
  data_updated_at: "2026-05-28T08:00:00.000Z",
  data: {
    created_at: "2026-05-28T08:00:00.000Z",
    subject_id: 1001,
    subject_type: "kanji",
    srs_stage: 0,
    unlocked_at: "2026-05-28T08:00:00.000Z",
    started_at: null,
    passed_at: null,
    burned_at: null,
    available_at: null,
    resurrected_at: null,
    hidden: false,
    ...overrides,
  },
});

describe("studyProgressAssignmentCacheService", () => {
  const loadModule = (initialAssignment = makeAssignment()) => {
    jest.resetModules();

    let asyncCollection: any = {
      object: "collection",
      url: "https://api.wanikani.com/v2/assignments",
      pages: {
        per_page: 500,
        next_url: null,
        previous_url: null,
      },
      total_count: 1,
      data_updated_at: "2026-05-28T08:00:00.000Z",
      data: [initialAssignment],
    };
    let permanentAssignments: any[] = [initialAssignment];

    const saveToCacheMock = jest.fn(async (_key, data) => {
      asyncCollection = data;
    });
    const saveAssignmentsToPermanentStorageMock = jest.fn(
      async (assignments) => {
        permanentAssignments = assignments;
      }
    );

    jest.doMock("../../utils/cache", () => ({
      getFromCache: jest.fn(async () => ({
        data: asyncCollection,
        timestamp: Date.now(),
        dataUpdatedAt: asyncCollection.data_updated_at,
      })),
      saveToCache: saveToCacheMock,
    }));

    jest.doMock("../../utils/permanentStorage", () => ({
      PERMANENT_KEYS: {
        ALL_ASSIGNMENTS: "assignments_all",
      },
      getFromPermanentStorage: jest.fn(async () => ({
        data: permanentAssignments,
        timestamp: Date.now(),
        dataUpdatedAt: "2026-05-28T08:00:00.000Z",
      })),
      saveAssignmentsToPermanentStorage:
        saveAssignmentsToPermanentStorageMock,
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const service = require("../studyProgressAssignmentCacheService");

    return {
      service,
      getAsyncAssignment: () => asyncCollection.data[0],
      getPermanentAssignment: () => permanentAssignments[0],
      saveToCacheMock,
      saveAssignmentsToPermanentStorageMock,
    };
  };

  it("marks an offline lesson as started and schedules the first review", async () => {
    const { service, getAsyncAssignment, getPermanentAssignment } = loadModule();

    await service.markLessonStartedInAssignmentCaches({
      assignmentId: 42,
      startedAt: "2026-05-28T10:00:00.000Z",
    });

    expect(getAsyncAssignment().data.started_at).toBe(
      "2026-05-28T10:00:00.000Z"
    );
    expect(getAsyncAssignment().data.srs_stage).toBe(1);
    expect(getAsyncAssignment().data.available_at).toBe(
      "2026-05-28T14:00:00.000Z"
    );
    expect(getPermanentAssignment().data.available_at).toBe(
      "2026-05-28T14:00:00.000Z"
    );
  });

  it("moves an offline review forward to the next SRS interval", async () => {
    const { service, getAsyncAssignment } = loadModule(
      makeAssignment({
        srs_stage: 1,
        started_at: "2026-05-28T10:00:00.000Z",
        available_at: "2026-05-28T14:00:00.000Z",
      })
    );

    await service.markReviewSubmittedInAssignmentCaches({
      assignmentId: 42,
      meaningIncorrectCount: 0,
      readingIncorrectCount: 0,
      completedAt: "2026-05-28T14:05:00.000Z",
      currentSrsStage: 1,
    });

    expect(getAsyncAssignment().data.srs_stage).toBe(2);
    expect(getAsyncAssignment().data.available_at).toBe(
      "2026-05-28T22:05:00.000Z"
    );
  });

  it("uses exact API review timing when a live response is available", async () => {
    const { service, getAsyncAssignment } = loadModule(
      makeAssignment({
        srs_stage: 4,
        started_at: "2026-05-28T10:00:00.000Z",
        available_at: "2026-05-30T09:00:00.000Z",
      })
    );

    await service.markReviewSubmittedInAssignmentCaches({
      assignmentId: 42,
      meaningIncorrectCount: 0,
      readingIncorrectCount: 0,
      completedAt: "2026-05-30T09:01:00.000Z",
      endingSrsStage: 5,
      nextReviewAt: "2026-06-06T09:01:00.000Z",
    });

    expect(getAsyncAssignment().data.srs_stage).toBe(5);
    expect(getAsyncAssignment().data.available_at).toBe(
      "2026-06-06T09:01:00.000Z"
    );
    expect(getAsyncAssignment().data.passed_at).toBe(
      "2026-05-30T09:01:00.000Z"
    );
  });
});
