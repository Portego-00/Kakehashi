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
  }: {
    permanentAssignments?: any[];
  } = {}) => {
    const getFromCacheMock = jest.fn(async () => null);
    const saveAssignmentsToPermanentStorageMock = jest.fn(
      async () => undefined
    );

    jest.doMock("../cache", () => ({
      CACHE_TTL: 24 * 60 * 60 * 1000,
      getCachedSubject: jest.fn(),
      getDataUpdatedAt: jest.fn(async () => null),
      getETag: jest.fn(async () => null),
      getFromCache: getFromCacheMock,
      getLastModified: jest.fn(async () => null),
      getSubjectById: jest.fn(async () => null),
      saveDataUpdatedAt: jest.fn(async () => undefined),
      saveETag: jest.fn(async () => undefined),
      saveLastModified: jest.fn(async () => undefined),
      saveToCache: jest.fn(async () => undefined),
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
      getFromPermanentStorage: jest.fn(async () => null),
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
        logNetworkCall: jest.fn(async () => undefined),
      },
    }));

    jest.doMock("../performanceLogger", () => ({
      startPerformanceTimer: jest.fn(() => ({
        end: jest.fn(),
      })),
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require("../api");

    return {
      api,
      getFromCacheMock,
      saveAssignmentsToPermanentStorageMock,
    };
  };

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
});
