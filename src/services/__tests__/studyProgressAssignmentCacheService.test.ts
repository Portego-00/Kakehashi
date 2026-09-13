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
  const loadModule = (
    initialAssignment: ReturnType<typeof makeAssignment> | ReturnType<typeof makeAssignment>[] =
      makeAssignment()
  ) => {
    jest.resetModules();

    const initialAssignments = Array.isArray(initialAssignment)
      ? initialAssignment
      : [initialAssignment];

    let asyncCollection: any = {
      object: "collection",
      url: "https://api.wanikani.com/v2/assignments",
      pages: {
        per_page: 500,
        next_url: null,
        previous_url: null,
      },
      total_count: initialAssignments.length,
      data_updated_at: "2026-05-28T08:00:00.000Z",
      data: initialAssignments,
    };
    let permanentAssignments: any[] = initialAssignments;
    let permanentDataUpdatedAt = "2026-05-28T08:00:00.000Z";

    const saveToCacheMock = jest.fn(async (_key, data) => {
      asyncCollection = data;
    });
    const saveAssignmentsToPermanentStorageMock = jest.fn(
      async (assignments, dataUpdatedAt) => {
        permanentAssignments = assignments;
        permanentDataUpdatedAt = dataUpdatedAt;
      }
    );

    jest.doMock("../../utils/cache", () => ({
      getDataUpdatedAt: jest.fn(async () => asyncCollection.data_updated_at),
      getFromCache: jest.fn(async () => ({
        data: asyncCollection,
        timestamp: Date.now(),
        dataUpdatedAt: asyncCollection.data_updated_at,
      })),
      saveDataUpdatedAt: jest.fn(async () => undefined),
      saveToCache: saveToCacheMock,
    }));

    jest.doMock("../../utils/permanentStorage", () => ({
      PERMANENT_KEYS: {
        ALL_ASSIGNMENTS: "assignments_all",
      },
      getFromPermanentStorage: jest.fn(async () => ({
        data: permanentAssignments,
        timestamp: Date.now(),
        dataUpdatedAt: permanentDataUpdatedAt,
      })),
      saveAssignmentsToPermanentStorage:
        saveAssignmentsToPermanentStorageMock,
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const service = require("../studyProgressAssignmentCacheService");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const coordinator = require("../assignmentCacheCoordinator");

    return {
      service,
      coordinator,
      getAsyncAssignment: () => asyncCollection.data[0],
      getAsyncCollection: () => asyncCollection,
      getPermanentAssignment: () => permanentAssignments[0],
      getAsyncAssignments: () => asyncCollection.data,
      getPermanentAssignments: () => permanentAssignments,
      getPermanentDataUpdatedAt: () => permanentDataUpdatedAt,
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

  it("serializes concurrent assignment cache mutations", async () => {
    const firstAssignment = makeAssignment({
      subject_id: 1001,
      srs_stage: 1,
      started_at: "2026-05-28T10:00:00.000Z",
      available_at: "2026-05-28T14:00:00.000Z",
    });
    const secondAssignment = {
      ...makeAssignment({
        subject_id: 1002,
        srs_stage: 1,
        started_at: "2026-05-28T10:00:00.000Z",
        available_at: "2026-05-28T14:00:00.000Z",
      }),
      id: 43,
    };
    const {
      service,
      getAsyncAssignments,
      saveToCacheMock,
    } = loadModule([firstAssignment, secondAssignment]);
    let releaseFirstWrite!: () => void;
    let markFirstWriteStarted!: () => void;
    const firstWriteStarted = new Promise<void>((resolve) => {
      markFirstWriteStarted = resolve;
    });
    const firstWriteGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const originalSaveImplementation = saveToCacheMock.getMockImplementation();
    saveToCacheMock.mockImplementationOnce(async (key, data) => {
      markFirstWriteStarted();
      await firstWriteGate;
      await originalSaveImplementation?.(key, data);
    });

    const firstMutation = service.markReviewSubmittedInAssignmentCaches({
      assignmentId: 42,
      meaningIncorrectCount: 0,
      readingIncorrectCount: 0,
      completedAt: "2026-05-28T14:05:00.000Z",
      currentSrsStage: 1,
    });
    await firstWriteStarted;
    const secondMutation = service.markReviewSubmittedInAssignmentCaches({
      assignmentId: 43,
      meaningIncorrectCount: 0,
      readingIncorrectCount: 0,
      completedAt: "2026-05-28T14:06:00.000Z",
      currentSrsStage: 1,
    });

    releaseFirstWrite();
    await Promise.all([firstMutation, secondMutation]);

    const assignments = getAsyncAssignments();
    expect(assignments.find((assignment: any) => assignment.id === 42).data.srs_stage).toBe(2);
    expect(assignments.find((assignment: any) => assignment.id === 43).data.srs_stage).toBe(2);
  });

  it("rebases an older fetched snapshot over a later local review mutation", async () => {
    const locallyReviewedAssignment = makeAssignment({
      subject_id: 1001,
      srs_stage: 1,
      started_at: "2026-05-28T10:00:00.000Z",
      available_at: "2026-05-28T14:00:00.000Z",
    });
    const unrelatedAssignment = {
      ...makeAssignment({
        subject_id: 1002,
        srs_stage: 1,
        started_at: "2026-05-28T10:00:00.000Z",
        available_at: "2026-05-28T14:00:00.000Z",
      }),
      id: 43,
    };
    const {
      service,
      coordinator,
      getAsyncCollection,
      getPermanentAssignments,
      getPermanentDataUpdatedAt,
      saveToCacheMock,
    } = loadModule([locallyReviewedAssignment, unrelatedAssignment]);
    const fetchStartRevision =
      coordinator.captureAssignmentCacheMutationRevision();
    const staleFetchedCollection = {
      ...getAsyncCollection(),
      data_updated_at: "2026-05-28T09:00:00.000Z",
      data: [
        locallyReviewedAssignment,
        {
          ...unrelatedAssignment,
          data_updated_at: "2026-05-28T09:00:00.000Z",
          data: {
            ...unrelatedAssignment.data,
            srs_stage: 2,
            available_at: "2026-05-28T22:00:00.000Z",
          },
        },
      ],
    };

    let releaseLocalWrite!: () => void;
    let markLocalWriteStarted!: () => void;
    const localWriteStarted = new Promise<void>((resolve) => {
      markLocalWriteStarted = resolve;
    });
    const localWriteGate = new Promise<void>((resolve) => {
      releaseLocalWrite = resolve;
    });
    const originalSaveImplementation = saveToCacheMock.getMockImplementation();
    saveToCacheMock.mockImplementationOnce(async (key, data) => {
      markLocalWriteStarted();
      await localWriteGate;
      await originalSaveImplementation?.(key, data);
    });

    const localMutation = service.markReviewSubmittedInAssignmentCaches({
      assignmentId: 42,
      meaningIncorrectCount: 0,
      readingIncorrectCount: 0,
      completedAt: "2026-05-28T14:05:00.000Z",
      currentSrsStage: 1,
    });
    await localWriteStarted;
    const staleCommit = coordinator.persistAssignmentCollectionInCaches(
      staleFetchedCollection,
      fetchStartRevision
    );

    releaseLocalWrite();
    const [, persistedCollection] = await Promise.all([
      localMutation,
      staleCommit,
    ]);

    expect(
      persistedCollection.data.find((assignment: any) => assignment.id === 42)
        .data.srs_stage
    ).toBe(2);
    expect(
      persistedCollection.data.find((assignment: any) => assignment.id === 43)
        .data.srs_stage
    ).toBe(2);
    expect(
      getAsyncCollection().data.find((assignment: any) => assignment.id === 42)
        .data.srs_stage
    ).toBe(2);
    expect(
      getPermanentAssignments().find((assignment: any) => assignment.id === 42)
        .data.srs_stage
    ).toBe(2);
    expect(getAsyncCollection().data_updated_at).toBe(
      "2026-05-28T09:00:00.000Z"
    );
    expect(getPermanentDataUpdatedAt()).toBe(
      "2026-05-28T09:00:00.000Z"
    );
  });

  it("does not persist a fetched snapshot invalidated by logout", async () => {
    const {
      coordinator,
      getAsyncCollection,
      saveToCacheMock,
      saveAssignmentsToPermanentStorageMock,
    } = loadModule();
    const fetchStartRevision =
      coordinator.captureAssignmentCacheMutationRevision();
    const fetchedCollection = {
      ...getAsyncCollection(),
      data: [makeAssignment({ srs_stage: 2 })],
    };
    coordinator.invalidateAssignmentCacheWrites();

    await coordinator.persistAssignmentCollectionInCaches(
      fetchedCollection,
      fetchStartRevision
    );

    expect(saveToCacheMock).not.toHaveBeenCalled();
    expect(saveAssignmentsToPermanentStorageMock).not.toHaveBeenCalled();
  });

  it("does not let an older server response move records or the cursor backward", async () => {
    const newerAssignment = {
      ...makeAssignment({ srs_stage: 3 }),
      data_updated_at: "2026-05-28T10:00:00.000Z",
    };
    const {
      coordinator,
      getAsyncCollection,
      getPermanentAssignment,
      getPermanentDataUpdatedAt,
    } = loadModule(newerAssignment);
    getAsyncCollection().data_updated_at = "2026-05-28T10:00:00.000Z";
    const olderCollection = {
      ...getAsyncCollection(),
      data_updated_at: "2026-05-28T09:00:00.000Z",
      data: [
        {
          ...newerAssignment,
          data_updated_at: "2026-05-28T09:00:00.000Z",
          data: { ...newerAssignment.data, srs_stage: 2 },
        },
      ],
    };
    const fetchStartRevision =
      coordinator.captureAssignmentCacheMutationRevision();

    const persistedCollection =
      await coordinator.persistAssignmentCollectionInCaches(
        olderCollection,
        fetchStartRevision
      );

    expect(persistedCollection.data[0].data.srs_stage).toBe(3);
    expect(persistedCollection.data_updated_at).toBe(
      "2026-05-28T10:00:00.000Z"
    );
    expect(getPermanentAssignment().data.srs_stage).toBe(3);
    expect(getPermanentDataUpdatedAt()).toBe(
      "2026-05-28T10:00:00.000Z"
    );
  });
});
