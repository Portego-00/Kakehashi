import { matchesMaximumFrequencyRank } from "../customReviewFrequencyFilter";

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
});
