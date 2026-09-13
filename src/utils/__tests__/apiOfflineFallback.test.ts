const NOW_ISO = "2026-05-28T12:00:00.000Z";

const makeAssignment = (id: number, overrides: Partial<any> = {}) => ({
  id,
  object: "assignment",
  url: `https://api.wanikani.com/v2/assignments/${id}`,
  data_updated_at: "2026-05-28T08:00:00.000Z",
  data: {
    created_at: "2026-05-28T08:00:00.000Z",
    subject_id: 1000 + id,
    subject_type: "kanji",
    srs_stage: 0,
    unlocked_at: "2026-05-27T08:00:00.000Z",
    started_at: null,
    passed_at: null,
    burned_at: null,
    available_at: null,
    resurrected_at: null,
    hidden: false,
    ...overrides,
  },
});

const makeAssignmentsCollection = (assignments: any[]) => ({
  object: "collection",
  url: "https://api.wanikani.com/v2/assignments",
  pages: {
    per_page: 500,
    next_url: null,
    previous_url: null,
  },
  total_count: assignments.length,
  data_updated_at: "2026-05-28T08:00:00.000Z",
  data: assignments,
});

const makeStudyMaterialsCollection = (materials: any[]) => ({
  object: "collection",
  url: "https://api.wanikani.com/v2/study_materials",
  pages: {
    per_page: 500,
    next_url: null,
    previous_url: null,
  },
  total_count: materials.length,
  data_updated_at: "2026-05-28T08:00:00.000Z",
  data: materials,
});

const mockResponse = (data: any) => {
  const body = JSON.stringify(data);

  return Promise.resolve({
    status: 200,
    ok: true,
    headers: {
      get: jest.fn(() => null),
    },
    json: jest.fn(() => Promise.resolve(data)),
    text: jest.fn(() => Promise.resolve(body)),
  });
};

describe("api offline assignment fallbacks", () => {
  let dateNowSpy: jest.SpyInstance<number, []>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    dateNowSpy = jest
      .spyOn(Date, "now")
      .mockReturnValue(new Date(NOW_ISO).getTime());
    consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    consoleWarnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  const loadApi = ({
    permanentAssignments = [],
    cachedAssignments = null,
    statefulCanonicalAssignmentCache = false,
    logNetworkCall = async () => undefined,
    saveETagImplementation = async () => undefined,
  }: {
    permanentAssignments?: any[];
    cachedAssignments?: ReturnType<typeof makeAssignmentsCollection> | null;
    statefulCanonicalAssignmentCache?: boolean;
    logNetworkCall?: (info: any) => Promise<unknown>;
    saveETagImplementation?: (url: string, etag: string) => Promise<void>;
  } = {}) => {
    let canonicalAssignmentCollection = statefulCanonicalAssignmentCache
      ? cachedAssignments
      : null;
    let permanentAssignmentData = permanentAssignments;
    let permanentAssignmentDataUpdatedAt =
      cachedAssignments?.data_updated_at ?? NOW_ISO;
    const getFromCacheMock = jest.fn(async (key: string) => {
      if (
        statefulCanonicalAssignmentCache &&
        key === "assignments_all" &&
        canonicalAssignmentCollection
      ) {
        return {
          data: canonicalAssignmentCollection,
          dataUpdatedAt: canonicalAssignmentCollection.data_updated_at,
        };
      }
      return cachedAssignments && key.startsWith("assignments_full_")
        ? {
            data: cachedAssignments,
            dataUpdatedAt: cachedAssignments.data_updated_at,
          }
        : null;
    });
    const getStudyMaterialsFromPermanentCacheMock = jest.fn<
      Promise<any[] | null>,
      [number[]]
    >(async () => null);
    const saveAssignmentsToPermanentStorageMock = jest.fn(
      async (assignments, dataUpdatedAt) => {
        if (statefulCanonicalAssignmentCache) {
          permanentAssignmentData = assignments;
          permanentAssignmentDataUpdatedAt = dataUpdatedAt;
        }
      }
    );
    const saveToCacheMock = jest.fn(async (key: string, data: any) => {
      if (statefulCanonicalAssignmentCache && key === "assignments_all") {
        canonicalAssignmentCollection = data;
      }
    });

    jest.doMock("../cache", () => ({
      CACHE_TTL: 24 * 60 * 60 * 1000,
      clearStudyMaterialsCache: jest.fn(async () => undefined),
      getCachedSubject: jest.fn(),
      getDataUpdatedAt: jest.fn(async () => null),
      getETag: jest.fn(async () => null),
      getFromCache: getFromCacheMock,
      getLastModified: jest.fn(async () => null),
      getStudyMaterialsFromPermanentCache:
        getStudyMaterialsFromPermanentCacheMock,
      getSubjectById: jest.fn(async () => null),
      saveDataUpdatedAt: jest.fn(async () => undefined),
      saveETag: jest.fn(saveETagImplementation),
      saveLastModified: jest.fn(async () => undefined),
      saveStudyMaterialsToPermanentCache: jest.fn(async () => undefined),
      saveToCache: saveToCacheMock,
    }));

    jest.doMock("../permanentStorage", () => ({
      PERMANENT_KEYS: {
        ALL_ASSIGNMENTS: "assignments_all",
        ALL_SUBJECTS: "subjects_all",
        SUBJECTS_METADATA: "subjects_metadata",
      },
      getAssignmentsFromPermanentStorage: jest.fn(
        async () => permanentAssignments
      ),
      getFromPermanentStorage: jest.fn(async (key: string) =>
        statefulCanonicalAssignmentCache &&
        key === "assignments_all" &&
        permanentAssignmentData.length > 0
          ? {
              data: permanentAssignmentData,
              dataUpdatedAt: permanentAssignmentDataUpdatedAt,
              timestamp: Date.now(),
            }
          : null,
      ),
      permanentStorage: {
        contains: jest.fn(() => false),
        getString: jest.fn(() => null),
      },
      removeFromPermanentStorage: jest.fn(async () => undefined),
      saveAssignmentsToPermanentStorage:
        saveAssignmentsToPermanentStorageMock,
      saveSubjectsMetadata: jest.fn(async () => undefined),
      saveToPermanentStorage: jest.fn(async () => undefined),
    }));

    jest.doMock("../apiDebugger", () => ({
      apiDebugger: {
        logCall: jest.fn(),
        logNetworkCall: jest.fn(logNetworkCall),
      },
    }));

    jest.doMock("../performanceLogger", () => ({
      startPerformanceTimer: jest.fn(() => ({
        end: jest.fn(),
      })),
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require("../api");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const assignmentCacheService = require(
      "../../services/studyProgressAssignmentCacheService"
    );

    return {
      api,
      assignmentCacheService,
      getFromCacheMock,
      getStudyMaterialsFromPermanentCacheMock,
      saveAssignmentsToPermanentStorageMock,
      getCanonicalAssignmentCollection: () => canonicalAssignmentCollection,
      getPermanentAssignmentData: () => permanentAssignmentData,
    };
  };

  it("can force-refresh all assignments while retaining cached fallback support", async () => {
    const cachedAssignment = makeAssignment(1, { srs_stage: 8 });
    const currentAssignment = makeAssignment(1, { srs_stage: 9 });
    const cachedAssignments = makeAssignmentsCollection([cachedAssignment]);
    const currentAssignments = makeAssignmentsCollection([currentAssignment]);
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      mockResponse(currentAssignments),
    );

    const { api } = loadApi({ cachedAssignments });
    const result = await api.getAllAssignmentsCached(
      "test-token",
      {},
      { forceRefresh: true },
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.data[0].data.srs_stage).toBe(9);
  });

  it("does not let an older full refresh restore a locally submitted review", async () => {
    const reviewedAssignment = makeAssignment(1, {
      srs_stage: 1,
      started_at: "2026-05-28T04:00:00.000Z",
      available_at: "2026-05-28T08:00:00.000Z",
    });
    const unrelatedAssignment = makeAssignment(2, {
      srs_stage: 1,
      started_at: "2026-05-28T04:00:00.000Z",
      available_at: "2026-05-28T08:00:00.000Z",
    });
    const cachedAssignments = makeAssignmentsCollection([
      reviewedAssignment,
      unrelatedAssignment,
    ]);
    const staleFetchedAssignments = {
      ...makeAssignmentsCollection([
        reviewedAssignment,
        {
          ...unrelatedAssignment,
          data_updated_at: "2026-05-28T09:00:00.000Z",
          data: {
            ...unrelatedAssignment.data,
            srs_stage: 2,
            available_at: "2026-05-28T16:00:00.000Z",
          },
        },
      ]),
      data_updated_at: "2026-05-28T09:00:00.000Z",
    };
    const staleResponse = await mockResponse(staleFetchedAssignments);
    let releaseFetch!: (response: any) => void;
    let markFetchStarted!: () => void;
    const fetchStarted = new Promise<void>((resolve) => {
      markFetchStarted = resolve;
    });
    (global.fetch as jest.Mock).mockImplementationOnce(() => {
      markFetchStarted();
      return new Promise((resolve) => {
        releaseFetch = resolve;
      });
    });

    const {
      api,
      assignmentCacheService,
      getCanonicalAssignmentCollection,
      getPermanentAssignmentData,
    } = loadApi({
      cachedAssignments,
      permanentAssignments: cachedAssignments.data,
      statefulCanonicalAssignmentCache: true,
    });
    const staleRefresh = api.getAssignmentsOptimized(
      "test-token",
      {},
      { forceFullRefresh: true }
    );
    await fetchStarted;

    await assignmentCacheService.markReviewSubmittedInAssignmentCaches({
      assignmentId: reviewedAssignment.id,
      meaningIncorrectCount: 0,
      readingIncorrectCount: 0,
      completedAt: "2026-05-28T08:05:00.000Z",
      currentSrsStage: 1,
    });
    releaseFetch(staleResponse);
    const result = await staleRefresh;

    const resultReviewedAssignment = result.data.find(
      (assignment: any) => assignment.id === reviewedAssignment.id
    );
    const cachedReviewedAssignment =
      getCanonicalAssignmentCollection().data.find(
        (assignment: any) => assignment.id === reviewedAssignment.id
      );
    const permanentReviewedAssignment = getPermanentAssignmentData().find(
      (assignment: any) => assignment.id === reviewedAssignment.id
    );
    expect(resultReviewedAssignment.data.srs_stage).toBe(2);
    expect(cachedReviewedAssignment.data.srs_stage).toBe(2);
    expect(permanentReviewedAssignment.data.srs_stage).toBe(2);
    expect(
      result.data.find((assignment: any) => assignment.id === 2).data.srs_stage
    ).toBe(2);
    expect(result.data_updated_at).toBe("2026-05-28T09:00:00.000Z");
  });

  it("falls back to cached assignments when a forced refresh is offline", async () => {
    const cachedAssignment = makeAssignment(1, { srs_stage: 9 });
    const cachedAssignments = makeAssignmentsCollection([cachedAssignment]);
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("offline"));

    const { api } = loadApi({ cachedAssignments });
    const result = await api.getAllAssignmentsCached(
      "test-token",
      {},
      { forceRefresh: true },
    );

    expect(result.data[0].data.srs_stage).toBe(9);
  });

  it("keeps live review reconciliation distinguishable from a cached fallback", async () => {
    const staleAssignment = makeAssignment(1, {
      srs_stage: 3,
      started_at: "2026-05-27T08:00:00.000Z",
      available_at: "2026-05-28T08:00:00.000Z",
    });
    const cachedAssignments = makeAssignmentsCollection([staleAssignment]);
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("offline"));

    const { api, getFromCacheMock } = loadApi({ cachedAssignments });

    await expect(
      api.getLiveAvailableReviews("test-token")
    ).rejects.toThrow("offline");
    expect(getFromCacheMock).not.toHaveBeenCalled();
  });

  it("keeps an unavailable review count distinguishable from zero", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    try {
      const { api } = loadApi();
      await expect(api.getReviewCountIfAvailable("test-token")).resolves.toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("uses one live attempt before reading cached available reviews", async () => {
    const availableReview = makeAssignment(1, {
      srs_stage: 3,
      started_at: "2026-05-27T08:00:00.000Z",
      available_at: "2026-05-28T08:00:00.000Z",
    });
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    const { api } = loadApi({ permanentAssignments: [availableReview] });
    const result = await api.getAvailableReviews("test-token");

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual([availableReview]);
  });

  it("falls back after the first failed later review page", async () => {
    const cachedReview = makeAssignment(9, {
      srs_stage: 3,
      started_at: "2026-05-27T08:00:00.000Z",
      available_at: "2026-05-28T08:00:00.000Z",
    });
    const firstPage = makeAssignmentsCollection([
      makeAssignment(1, {
        srs_stage: 3,
        started_at: "2026-05-27T08:00:00.000Z",
        available_at: "2026-05-28T08:00:00.000Z",
      }),
    ]);
    firstPage.pages.per_page = 1;
    firstPage.pages.next_url =
      "https://api.wanikani.com/v2/assignments?page_after_id=1";
    firstPage.total_count = 2;

    (global.fetch as jest.Mock)
      .mockImplementationOnce(() => mockResponse(firstPage))
      .mockRejectedValueOnce(new Error("offline on page 2"));

    const { api } = loadApi({ permanentAssignments: [cachedReview] });
    const result = await api.getAvailableReviews("test-token");

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual([cachedReview]);
  });

  it("reads the cached review count without making a network request", async () => {
    const availableReview = makeAssignment(1, {
      srs_stage: 3,
      started_at: "2026-05-27T08:00:00.000Z",
      available_at: "2026-05-28T08:00:00.000Z",
    });

    const { api } = loadApi({ permanentAssignments: [availableReview] });

    await expect(api.getCachedReviewCountIfAvailable()).resolves.toBe(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("reads cached available reviews without starting a network request", async () => {
    const availableReview = makeAssignment(1, {
      srs_stage: 3,
      started_at: "2026-05-27T08:00:00.000Z",
      available_at: "2026-05-28T08:00:00.000Z",
    });

    const { api } = loadApi({ permanentAssignments: [availableReview] });

    await expect(api.getCachedAvailableReviews()).resolves.toEqual(
      expect.objectContaining({
        data: [availableReview],
        total_count: 1,
      }),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("aborts a WaniKani request that never receives a response", async () => {
    jest.useFakeTimers();
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    (global.fetch as jest.Mock).mockImplementation(
      (_input: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    );

    try {
      const { api } = loadApi();
      const request = api.submitReview("test-token", 42, 0, 0);
      const rejection = expect(request).rejects.toThrow(/timed out/i);
      const fetchMock = global.fetch as jest.Mock;

      for (let index = 0; index < 10 && !fetchMock.mock.calls.length; index += 1) {
        await Promise.resolve();
      }
      expect(global.fetch).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(15_000);

      await rejection;
    } finally {
      consoleErrorSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it("keeps the deadline active when response headers arrive before a stalled body", async () => {
    jest.useFakeTimers();
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const cloneTextMock = jest.fn();
    const jsonMock = jest.fn();

    (global.fetch as jest.Mock).mockImplementation(
      (_input: string, init?: RequestInit) => {
        const waitForAbort = () =>
          new Promise<never>((_resolve, reject) => {
            if (init?.signal?.aborted) {
              reject(new Error("aborted"));
              return;
            }
            init?.signal?.addEventListener(
              "abort",
              () => reject(new Error("aborted")),
              { once: true },
            );
          });

        cloneTextMock.mockImplementation(waitForAbort);
        jsonMock.mockImplementation(waitForAbort);

        return Promise.resolve({
          status: 200,
          ok: true,
          headers: {
            get: jest.fn(() => null),
          },
          clone: jest.fn(() => ({
            text: cloneTextMock,
          })),
          json: jsonMock,
        });
      },
    );

    try {
      const { api } = loadApi({
        logNetworkCall: async ({ response }) => {
          try {
            await response.clone().text();
          } catch {
            // The real debugger records an uncaptured body and lets the request continue.
          }
        },
      });
      const request = api.submitReview("test-token", 42, 0, 0);
      const rejection = expect(request).rejects.toThrow(/timed out/i);
      const fetchMock = global.fetch as jest.Mock;

      for (let index = 0; index < 10 && !fetchMock.mock.calls.length; index += 1) {
        await Promise.resolve();
      }
      expect(global.fetch).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(15_000);

      await rejection;
      expect(cloneTextMock).toHaveBeenCalledTimes(1);
      expect(jsonMock).toHaveBeenCalledTimes(1);
    } finally {
      consoleErrorSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it("does not let a completed diagnostics clone disable the primary body deadline", async () => {
    jest.useFakeTimers();
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const cloneTextMock = jest.fn(async () => "{}");
    const jsonMock = jest.fn();

    (global.fetch as jest.Mock).mockImplementation(
      (_input: string, init?: RequestInit) => {
        jsonMock.mockImplementation(
          () =>
            new Promise<never>((_resolve, reject) => {
              if (init?.signal?.aborted) {
                reject(new Error("aborted"));
                return;
              }
              init?.signal?.addEventListener(
                "abort",
                () => reject(new Error("aborted")),
                { once: true },
              );
            }),
        );

        return Promise.resolve({
          status: 200,
          ok: true,
          headers: {
            get: jest.fn(() => null),
          },
          clone: jest.fn(() => ({
            text: cloneTextMock,
          })),
          json: jsonMock,
        });
      },
    );

    try {
      const { api } = loadApi({
        logNetworkCall: async ({ response }) => {
          await response.clone().text();
        },
      });
      const request = api.submitReview("test-token", 42, 0, 0);
      const rejection = expect(request).rejects.toThrow(/timed out/i);
      const fetchMock = global.fetch as jest.Mock;

      for (let index = 0; index < 10 && !fetchMock.mock.calls.length; index += 1) {
        await Promise.resolve();
      }
      expect(global.fetch).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(15_000);

      await rejection;
      expect(cloneTextMock).toHaveBeenCalledTimes(1);
      expect(jsonMock).toHaveBeenCalledTimes(1);
    } finally {
      consoleErrorSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it("finishes the deadline immediately for a 304 cache response", async () => {
    jest.useFakeTimers();
    const cachedAssignments = makeAssignmentsCollection([makeAssignment(1)]);
    let requestSignal: AbortSignal | undefined;
    (global.fetch as jest.Mock).mockImplementation(
      (_input: string, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return Promise.resolve({
          status: 304,
          ok: false,
          headers: { get: jest.fn(() => null) },
        });
      }
    );

    try {
      const { api } = loadApi({ cachedAssignments });
      await api.getAllAssignmentsCached(
        "test-token",
        {},
        { forceRefresh: true }
      );

      expect(requestSignal?.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(15_000);
      expect(requestSignal?.aborted).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it("finishes the deadline when a status-only user request fails", async () => {
    jest.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    (global.fetch as jest.Mock).mockImplementation(
      (_input: string, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return Promise.resolve({
          status: 500,
          ok: false,
          headers: { get: jest.fn(() => null) },
        });
      }
    );

    try {
      const { api } = loadApi();
      await expect(
        api.getUserData("test-token", { forceRefresh: true })
      ).rejects.toThrow("API error: 500");

      expect(requestSignal?.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(15_000);
      expect(requestSignal?.aborted).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it("reads a successful body before persisting its response validator", async () => {
    jest.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    const userData = {
      object: "user",
      url: "https://api.wanikani.com/v2/user",
      data_updated_at: NOW_ISO,
      data: { level: 12 },
    };
    const json = jest.fn(async () => userData);
    (global.fetch as jest.Mock).mockImplementation(
      (_input: string, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: {
            get: jest.fn((name: string) =>
              name.toLowerCase() === "etag" ? '"user-v2"' : null
            ),
          },
          json,
        });
      }
    );

    try {
      const { api } = loadApi({
        saveETagImplementation: async () => {
          throw new Error("cache write failed");
        },
      });
      await expect(
        api.getUserData("test-token", { forceRefresh: true })
      ).rejects.toThrow("cache write failed");

      expect(json).toHaveBeenCalledTimes(1);
      expect(requestSignal?.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(15_000);
      expect(requestSignal?.aborted).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it("uses permanent assignments for available lessons when offline cache is missing", async () => {
    const availableLesson = makeAssignment(1);
    const startedLesson = makeAssignment(2, {
      started_at: "2026-05-28T09:00:00.000Z",
      srs_stage: 1,
    });
    const futureLesson = makeAssignment(3, {
      unlocked_at: "2026-05-29T09:00:00.000Z",
    });

    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    const { api, getFromCacheMock } = loadApi({
      permanentAssignments: [availableLesson, startedLesson, futureLesson],
    });

    const result = await api.getAvailableLessons("test-token");

    expect(getFromCacheMock).toHaveBeenCalled();
    expect(result.data.map((assignment: any) => assignment.id)).toEqual([1]);
    expect(result.total_count).toBe(1);
    expect(result.pages.next_url).toBeNull();
  });

  it("uses the permanent assignment snapshot for subject details while offline", async () => {
    const subjectAssignment = makeAssignment(1, {
      srs_stage: 3,
      started_at: "2026-05-28T09:00:00.000Z",
    });
    const otherAssignment = makeAssignment(2);

    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    const { api } = loadApi({
      permanentAssignments: [subjectAssignment, otherAssignment],
    });

    const result = await api.getAssignmentsForSubjectsCached(
      "test-token",
      [1001]
    );

    expect(result.data).toEqual([subjectAssignment]);
    expect(result.total_count).toBe(1);
  });

  it("returns a definitive empty subject assignment result from an offline snapshot", async () => {
    const otherAssignment = makeAssignment(2);

    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    const { api } = loadApi({
      permanentAssignments: [otherAssignment],
    });

    const result = await api.getAssignmentsForSubjectsCached(
      "test-token",
      [1001]
    );

    expect(result.data).toEqual([]);
    expect(result.total_count).toBe(0);
  });

  it("reconciles an empty live lesson response against assignment data", async () => {
    const availableLesson = makeAssignment(4);
    const startedLesson = makeAssignment(5, {
      started_at: "2026-05-28T09:00:00.000Z",
      srs_stage: 1,
    });

    (global.fetch as jest.Mock)
      .mockImplementationOnce(() => mockResponse(makeAssignmentsCollection([])))
      .mockImplementationOnce(() =>
        mockResponse(makeAssignmentsCollection([availableLesson, startedLesson]))
      );

    const { api, saveAssignmentsToPermanentStorageMock } = loadApi();

    const result = await api.getAvailableLessons("test-token");

    expect(result.data.map((assignment: any) => assignment.id)).toEqual([4]);
    expect(result.total_count).toBe(1);
    expect(saveAssignmentsToPermanentStorageMock).toHaveBeenCalledWith(
      [availableLesson, startedLesson],
      "2026-05-28T08:00:00.000Z"
    );
  });

  it("uses subject-keyed study materials when the request is offline", async () => {
    const cachedMaterial = {
      id: 77,
      object: "study_material",
      data: {
        subject_id: 1001,
        meaning_synonyms: ["grown-up"],
      },
    };
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    const {
      api,
      getStudyMaterialsFromPermanentCacheMock,
    } = loadApi();
    getStudyMaterialsFromPermanentCacheMock.mockResolvedValue([
      cachedMaterial,
    ]);

    const result = await api.getStudyMaterials(
      "test-token",
      { subject_ids: [1001] },
      { skipCache: true }
    );

    expect(result.data).toEqual([cachedMaterial]);
    expect(result.pages.next_url).toBeNull();
    expect(getStudyMaterialsFromPermanentCacheMock).toHaveBeenCalledWith([
      1001,
    ]);
  });

  it("fails instead of returning incomplete accepted answers offline", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    const {
      api,
      getStudyMaterialsFromPermanentCacheMock,
    } = loadApi();
    getStudyMaterialsFromPermanentCacheMock.mockResolvedValue(null);

    await expect(
      api.getStudyMaterials(
        "test-token",
        { subject_ids: [1001] },
        { skipCache: true }
      )
    ).rejects.toThrow("offline");
  });

  it("uses a complete study-material snapshot for unfiltered offline reads", async () => {
    const cachedMaterial = {
      id: 88,
      object: "study_material",
      data: {
        subject_id: 1002,
        meaning_synonyms: ["adult"],
      },
    };
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    const {
      api,
      getStudyMaterialsFromPermanentCacheMock,
    } = loadApi();
    getStudyMaterialsFromPermanentCacheMock.mockResolvedValue([
      cachedMaterial,
    ]);

    const result = await api.getStudyMaterials(
      "test-token",
      {},
      { skipCache: true }
    );

    expect(result.data).toEqual([cachedMaterial]);
    expect(getStudyMaterialsFromPermanentCacheMock).toHaveBeenCalledWith([]);
  });

  it("batches large subject filters and merges study materials", async () => {
    const subjectIds = Array.from({ length: 101 }, (_, index) => 1001 + index);

    (global.fetch as jest.Mock).mockImplementation((input: string) => {
      const requestUrl = new URL(String(input));
      const batchSubjectIds = requestUrl.searchParams
        .get("subject_ids")!
        .split(",")
        .map(Number);
      const firstSubjectId = batchSubjectIds[0];

      expect(batchSubjectIds.length).toBeLessThanOrEqual(100);

      return mockResponse(
        makeStudyMaterialsCollection([
          {
            id: firstSubjectId,
            object: "study_material",
            data: {
              subject_id: firstSubjectId,
              meaning_synonyms: [`synonym-${firstSubjectId}`],
            },
          },
        ])
      );
    });

    const { api } = loadApi();
    const result = await api.getStudyMaterials(
      "test-token",
      { subject_ids: subjectIds },
      { skipCache: true }
    );

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(
      result.data.map((material: any) => material.data.subject_id)
    ).toEqual([1001, 1101]);
    expect(result.pages.next_url).toBeNull();
  });
});
