import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  RANDOM_TEST_HISTORY_SESSION_LIMIT,
  RANDOM_TEST_SUBJECT_HISTORY_STORAGE_KEY,
  getRecentRandomTestSubjectIds,
  sanitizeRandomTestSubjectHistory,
  saveRandomTestSubjectHistoryEntry,
  selectRandomTestSubjects,
} from "../randomTestHistory";

interface TestSubject {
  id: number;
}

function makeSubjects(ids: number[]): TestSubject[] {
  return ids.map((id) => ({ id }));
}

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe("randomTestHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sanitizes persisted history entries", () => {
    const history = sanitizeRandomTestSubjectHistory(
      [
        { generatedAt: 300, subjectIds: [1, 2, 2, Number.NaN, -1] },
        { generatedAt: "bad", subjectIds: [3] },
        { generatedAt: 100, subjectIds: [] },
        null,
      ],
      2
    );

    expect(history).toEqual([
      { generatedAt: 300, subjectIds: [1, 2] },
      { generatedAt: 0, subjectIds: [3] },
    ]);
  });

  it("returns recent subject ids newest-first without duplicates", () => {
    const recentSubjectIds = getRecentRandomTestSubjectIds([
      { generatedAt: 300, subjectIds: [1, 2, 3] },
      { generatedAt: 200, subjectIds: [3, 4] },
      { generatedAt: 100, subjectIds: [5] },
    ]);

    expect(recentSubjectIds).toEqual([1, 2, 3, 4, 5]);
  });

  it("selects only fresh subjects when enough are available", () => {
    const selected = selectRandomTestSubjects(makeSubjects([1, 2, 3, 4, 5, 6]), 3, {
      avoidSubjectIds: new Set([1, 2, 3]),
      randomFn: () => 0.5,
    });

    expect(selected).toHaveLength(3);
    expect(selected.map((subject) => subject.id).sort()).toEqual([4, 5, 6]);
  });

  it("fills from recent subjects only after using every fresh subject", () => {
    const selected = selectRandomTestSubjects(makeSubjects([1, 2, 3, 4, 5, 6]), 4, {
      avoidSubjectIds: new Set([1, 2, 3, 4]),
      randomFn: () => 0.5,
    });
    const selectedIds = selected.map((subject) => subject.id);

    expect(selected).toHaveLength(4);
    expect(selectedIds).toEqual(expect.arrayContaining([5, 6]));
    expect(selectedIds.filter((id) => id <= 4)).toHaveLength(2);
  });

  it("saves a bounded newest-first history entry", async () => {
    mockedAsyncStorage.getItem.mockResolvedValue(
      JSON.stringify(
        Array.from({ length: RANDOM_TEST_HISTORY_SESSION_LIMIT }, (_, index) => ({
          generatedAt: index + 1,
          subjectIds: [index + 10],
        }))
      )
    );

    await saveRandomTestSubjectHistoryEntry([1, 2, 2], 999);

    expect(mockedAsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      RANDOM_TEST_SUBJECT_HISTORY_STORAGE_KEY,
      expect.any(String)
    );

    const savedHistory = JSON.parse(
      mockedAsyncStorage.setItem.mock.calls[0][1]
    );
    expect(savedHistory).toHaveLength(RANDOM_TEST_HISTORY_SESSION_LIMIT);
    expect(savedHistory[0]).toEqual({ generatedAt: 999, subjectIds: [1, 2] });
  });
});
