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

});
