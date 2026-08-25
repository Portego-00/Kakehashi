import {
  getReadySelectedSubjectIds,
  matchesMaximumFrequencyRank,
} from "../customReviewFrequencyFilter";

describe("custom review maximum frequency rank", () => {
  it("uses an inclusive user-provided maximum", () => {
    expect(matchesMaximumFrequencyRank(3_471, 3_471)).toBe(true);
    expect(matchesMaximumFrequencyRank(3_472, 3_471)).toBe(false);
  });

  it("excludes missing and invalid ranks while active", () => {
    expect(matchesMaximumFrequencyRank(null, 2_000)).toBe(false);
    expect(matchesMaximumFrequencyRank(undefined, 2_000)).toBe(false);
    expect(matchesMaximumFrequencyRank(0, 2_000)).toBe(false);
    expect(matchesMaximumFrequencyRank(10.5, 2_000)).toBe(false);
  });

  it("does not filter ranks when no maximum is set", () => {
    expect(matchesMaximumFrequencyRank(undefined, null)).toBe(true);
    expect(matchesMaximumFrequencyRank(50_000, null)).toBe(true);
  });

  it("keeps only confirmed matching selections while a maximum is active", () => {
    const ranks = new Map<number, number | null>([
      [1, 1_500],
      [2, 2_500],
      [4, null],
    ]);

    expect(getReadySelectedSubjectIds([1, 2, 3, 4], ranks, 2_000)).toEqual([
      1,
    ]);
    expect(getReadySelectedSubjectIds([1, 2, 3, 4], ranks, null)).toEqual([
      1, 2, 3, 4,
    ]);
  });
});
