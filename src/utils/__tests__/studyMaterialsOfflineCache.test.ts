import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  getStudyMaterialsFromPermanentCache,
  saveStudyMaterialsToPermanentCache,
} from "../cache";
import {
  getFromPermanentStorage,
  PERMANENT_KEYS,
  saveToPermanentStorage,
} from "../permanentStorage";

jest.mock("../performanceLogger", () => ({
  startPerformanceTimer: jest.fn(() => ({ end: jest.fn() })),
}));

jest.mock("../permanentStorage", () => ({
  getFromPermanentStorage: jest.fn(),
  getSubjectsMetadata: jest.fn(() => null),
  PERMANENT_KEYS: {
    ALL_ASSIGNMENTS: "assignments_all",
    ALL_SUBJECTS: "subjects_all",
    STUDY_MATERIALS: "study_materials",
    SUBJECTS_METADATA: "subjects_metadata",
  },
  permanentStorage: {
    contains: jest.fn(() => false),
    getString: jest.fn(() => undefined),
  },
  removeFromPermanentStorage: jest.fn(async () => undefined),
  saveSubjectsMetadata: jest.fn(async () => undefined),
  saveToPermanentStorage: jest.fn(async () => undefined),
}));

const getFromPermanentStorageMock =
  getFromPermanentStorage as jest.MockedFunction<typeof getFromPermanentStorage>;
const saveToPermanentStorageMock =
  saveToPermanentStorage as jest.MockedFunction<typeof saveToPermanentStorage>;

const material = {
  id: 77,
  object: "study_material",
  data: {
    subject_id: 1001,
    meaning_synonyms: ["grown-up"],
  },
};

describe("study materials permanent cache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getFromPermanentStorageMock.mockResolvedValue(null);
    saveToPermanentStorageMock.mockResolvedValue(undefined);
  });

  it("records both returned materials and known missing subjects", async () => {
    await saveStudyMaterialsToPermanentCache(
      [1001, 1002],
      [material],
      { completeResponse: true }
    );

    expect(saveToPermanentStorageMock).toHaveBeenCalledWith(
      PERMANENT_KEYS.STUDY_MATERIALS,
      {
        version: 1,
        isCompleteCollection: false,
        bySubjectId: {
          "1001": material,
          "1002": null,
        },
      },
      expect.any(String)
    );
  });

  it("returns a fully covered subset for offline grading", async () => {
    getFromPermanentStorageMock.mockResolvedValue({
      timestamp: Date.now(),
      dataUpdatedAt: new Date().toISOString(),
      data: {
        version: 1,
        isCompleteCollection: false,
        bySubjectId: {
          "1001": material,
          "1002": null,
        },
      },
    });

    await expect(
      getStudyMaterialsFromPermanentCache([1001, 1002])
    ).resolves.toEqual([material]);
  });

  it("rejects partial coverage instead of silently omitting synonyms", async () => {
    getFromPermanentStorageMock.mockResolvedValue({
      timestamp: Date.now(),
      dataUpdatedAt: new Date().toISOString(),
      data: {
        version: 1,
        isCompleteCollection: false,
        bySubjectId: {
          "1001": material,
        },
      },
    });

    await expect(
      getStudyMaterialsFromPermanentCache([1001, 1002])
    ).resolves.toBeNull();
  });

  it("knows an absent subject has no material after a complete snapshot", async () => {
    getFromPermanentStorageMock.mockResolvedValue({
      timestamp: Date.now(),
      dataUpdatedAt: new Date().toISOString(),
      data: {
        version: 1,
        isCompleteCollection: true,
        bySubjectId: {
          "1001": material,
        },
      },
    });

    await expect(
      getStudyMaterialsFromPermanentCache([1002])
    ).resolves.toEqual([]);
  });

  it("returns all materials only when the complete collection is cached", async () => {
    getFromPermanentStorageMock.mockResolvedValue({
      timestamp: Date.now(),
      dataUpdatedAt: new Date().toISOString(),
      data: {
        version: 1,
        isCompleteCollection: true,
        bySubjectId: {
          "1001": material,
          "1002": null,
        },
      },
    });

    await expect(
      getStudyMaterialsFromPermanentCache([])
    ).resolves.toEqual([material]);

    getFromPermanentStorageMock.mockResolvedValue({
      timestamp: Date.now(),
      dataUpdatedAt: new Date().toISOString(),
      data: {
        version: 1,
        isCompleteCollection: false,
        bySubjectId: {
          "1001": material,
        },
      },
    });

    await expect(
      getStudyMaterialsFromPermanentCache([])
    ).resolves.toBeNull();
  });

  it("serializes concurrent writes for disjoint subjects", async () => {
    let persisted = {
      version: 1 as const,
      isCompleteCollection: false,
      bySubjectId: {},
    };
    getFromPermanentStorageMock.mockImplementation(async () => ({
      timestamp: Date.now(),
      dataUpdatedAt: new Date().toISOString(),
      data: persisted,
    }));

    let releaseFirstWrite!: () => void;
    let markFirstWriteStarted!: () => void;
    const firstWriteStarted = new Promise<void>((resolve) => {
      markFirstWriteStarted = resolve;
    });
    const firstWriteGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    saveToPermanentStorageMock
      .mockImplementationOnce(async (_key, data) => {
        markFirstWriteStarted();
        await firstWriteGate;
        persisted = data as typeof persisted;
      })
      .mockImplementation(async (_key, data) => {
        persisted = data as typeof persisted;
      });

    const firstWrite = saveStudyMaterialsToPermanentCache(
      [1001],
      [material],
      { completeResponse: true }
    );
    await firstWriteStarted;
    const secondMaterial = {
      ...material,
      id: 78,
      data: {
        ...material.data,
        subject_id: 1002,
        meaning_synonyms: ["mature"],
      },
    };
    const secondWrite = saveStudyMaterialsToPermanentCache(
      [1002],
      [secondMaterial],
      { completeResponse: true }
    );

    expect(saveToPermanentStorageMock).toHaveBeenCalledTimes(1);
    releaseFirstWrite();
    await Promise.all([firstWrite, secondWrite]);

    expect(persisted.bySubjectId).toEqual({
      "1001": material,
      "1002": secondMaterial,
    });
  });

  it("does not let an older refresh replace a newer saved synonym", async () => {
    const newerMaterial = {
      ...material,
      data_updated_at: "2026-09-11T11:00:00.000Z",
      data: {
        ...material.data,
        meaning_synonyms: ["new synonym"],
      },
    };
    const olderMaterial = {
      ...material,
      data_updated_at: "2026-09-11T10:00:00.000Z",
      data: {
        ...material.data,
        meaning_synonyms: ["old synonym"],
      },
    };
    let persisted = {
      version: 1 as const,
      isCompleteCollection: true,
      bySubjectId: { "1001": newerMaterial },
    };
    getFromPermanentStorageMock.mockImplementation(async () => ({
      timestamp: Date.now(),
      dataUpdatedAt: newerMaterial.data_updated_at,
      data: persisted,
    }));
    saveToPermanentStorageMock.mockImplementation(async (_key, data) => {
      persisted = data as typeof persisted;
    });

    await saveStudyMaterialsToPermanentCache(
      [1001],
      [olderMaterial],
      {
        completeResponse: true,
        dataUpdatedAt: olderMaterial.data_updated_at,
      }
    );

    expect(persisted.bySubjectId["1001"]).toEqual(newerMaterial);
    expect(persisted.isCompleteCollection).toBe(true);
  });

});
