import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CROSSWORD_HISTORY_PUZZLE_LIMIT,
  CROSSWORD_WORD_HISTORY_STORAGE_KEY,
  buildCrosswordGenerationPool,
  getCrosswordHardAvoidSubjectIds,
  getRecentCrosswordSubjectIds,
  sanitizeCrosswordWordHistory,
  saveCrosswordWordHistoryEntry,
} from "../crosswordHistory";

interface TestCandidate {
  subjectId: number;
  word: string;
}

function makeCandidates(subjectIds: number[]): TestCandidate[] {
  return subjectIds.map((subjectId) => ({
    subjectId,
    word: `word-${subjectId}`,
  }));
}

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe("crosswordHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sanitizes persisted history entries", () => {
    const history = sanitizeCrosswordWordHistory(
      [
        { generatedAt: 100, subjectIds: [1, 2, 2, Number.NaN, -1] },
        { generatedAt: "bad", subjectIds: [3] },
        { generatedAt: 300, subjectIds: [] },
        null,
        { generatedAt: 400, subjectIds: [4] },
      ],
      2
    );

    expect(history).toEqual([
      { generatedAt: 100, subjectIds: [1, 2] },
      { generatedAt: 0, subjectIds: [3] },
    ]);
  });

  it("returns recent subject ids newest-first without duplicates", () => {
    const recentSubjectIds = getRecentCrosswordSubjectIds([
      { generatedAt: 300, subjectIds: [1, 2, 3] },
      { generatedAt: 200, subjectIds: [3, 4] },
      { generatedAt: 100, subjectIds: [5] },
    ]);

    expect(recentSubjectIds).toEqual([1, 2, 3, 4, 5]);
    expect(
      Array.from(
        getCrosswordHardAvoidSubjectIds([
          { generatedAt: 300, subjectIds: [1, 2, 3] },
          { generatedAt: 200, subjectIds: [4, 5] },
        ])
      )
    ).toEqual([1, 2, 3]);
  });

  it("hard-avoids the newest puzzle words when enough fresh candidates remain", () => {
    const pool = buildCrosswordGenerationPool(makeCandidates([1, 2, 3, 4, 5, 6]), {
      poolSize: 4,
      recentSubjectIds: [1, 2],
      hardAvoidSubjectIds: new Set([1, 2]),
      minFreshCandidates: 4,
      randomFn: () => 0.5,
    });

    expect(pool.map((candidate) => candidate.subjectId)).toEqual([3, 4, 5, 6]);
  });

  it("falls back to recent words when hard avoidance would leave too few candidates", () => {
    const pool = buildCrosswordGenerationPool(makeCandidates([1, 2, 3, 4, 5, 6]), {
      poolSize: 6,
      recentSubjectIds: [1, 2],
      hardAvoidSubjectIds: new Set([1, 2]),
      minFreshCandidates: 5,
      randomFn: () => 0.5,
    });

    expect(pool.map((candidate) => candidate.subjectId)).toEqual([
      3, 4, 5, 6, 1, 2,
    ]);
  });

  it("keeps recent candidates later in the randomized pool", () => {
    const pool = buildCrosswordGenerationPool(makeCandidates([1, 2, 3]), {
      poolSize: 3,
      recentSubjectIds: [1],
      randomFn: () => 0.2,
    });

    expect(pool.map((candidate) => candidate.subjectId)).toEqual([2, 3, 1]);
  });

  it("saves a bounded newest-first history entry", async () => {
    mockedAsyncStorage.getItem.mockResolvedValue(
      JSON.stringify(
        Array.from({ length: CROSSWORD_HISTORY_PUZZLE_LIMIT }, (_, index) => ({
          generatedAt: index + 1,
          subjectIds: [index + 10],
        }))
      )
    );

    await saveCrosswordWordHistoryEntry([1, 2, 2], 999);

    expect(mockedAsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      CROSSWORD_WORD_HISTORY_STORAGE_KEY,
      expect.any(String)
    );

    const savedHistory = JSON.parse(
      mockedAsyncStorage.setItem.mock.calls[0][1]
    );
    expect(savedHistory).toHaveLength(CROSSWORD_HISTORY_PUZZLE_LIMIT);
    expect(savedHistory[0]).toEqual({ generatedAt: 999, subjectIds: [1, 2] });
  });
});
