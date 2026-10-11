import { getAllSubjects, getSubjectById, clearCache } from "../cache";
import { getFromPermanentStorage } from "../permanentStorage";

// A full catalog with real JSON decoding at the storage boundary.
const mockPayload = JSON.stringify({
  timestamp: Date.now(), dataUpdatedAt: "2026-10-09T00:00:00Z",
  data: Array.from({ length: 9100 }, (_, index) => ({
    id: index + 1, object: "vocabulary",
    data: { level: Math.min(60, 1 + Math.floor(index / 152)), characters: "先日",
      meaning_mnemonic: "A vocabulary mnemonic ".repeat(40),
      readings: [{ reading: "せんじつ", primary: true }] },
  })),
});
jest.mock("../permanentStorage", () => ({
  PERMANENT_KEYS: { ALL_SUBJECTS: "subjects_all", SUBJECTS_METADATA: "subjects_metadata" },
  permanentStorage: { contains: () => true },
  getFromPermanentStorage: jest.fn(async () => JSON.parse(mockPayload)),
  removeFromPermanentStorage: jest.fn(async () => {}),
}));
jest.mock("../performanceLogger", () => ({ startPerformanceTimer: () => ({ end: () => {} }) }));
jest.mock("../cacheIntegrity", () => ({}));

it("decodes the catalog once across concurrent detail and review consumers (#110)", async () => {
  await clearCache();
  jest.mocked(getFromPermanentStorage).mockClear();
  const [first, second, subject] = await Promise.all([
    getAllSubjects(), getAllSubjects(), getSubjectById(42),
  ]);
  const third = await getAllSubjects();
  expect(first).toHaveLength(9100);
  expect(subject?.id).toBe(42);
  expect(getFromPermanentStorage).toHaveBeenCalledTimes(1);
  expect(second).toBe(first);
  expect(third).toBe(first);
});

it("reloads the catalog and ID index after clearing memory (#110)", async () => {
  await clearCache();
  const first = await getAllSubjects();
  await clearCache();
  const second = await getAllSubjects();
  expect(second).not.toBe(first);
  expect(await getSubjectById(42)).toBe(second[41]);
});
