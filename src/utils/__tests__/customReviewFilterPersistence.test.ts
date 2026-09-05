import type { WaniKaniItemType } from "../../types/wanikani";
import type { JLPTLevel } from "../jlptClassification";
import {
  type CustomReviewFilterState,
  restoreCustomReviewFilters,
  serializeCustomReviewFilters,
} from "../customReviewFilterPersistence";

const createFallbackFilters = (): CustomReviewFilterState => ({
  minLevel: 1,
  maxLevel: 12,
  types: new Set<WaniKaniItemType>([
    "radical",
    "kanji",
    "vocabulary",
    "kana_vocabulary",
  ]),
  srsStages: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
  jlptLevels: new Set<JLPTLevel>(),
  maxFrequencyRank: null,
});

describe("custom review filter persistence", () => {
  it("round-trips every filter using canonical JSON-safe arrays", () => {
    const filters: CustomReviewFilterState = {
      minLevel: 51,
      maxLevel: 60,
      types: new Set(["vocabulary", "kanji"]),
      srsStages: new Set([9, 1, 6]),
      jlptLevels: new Set(["N1", "N5"]),
      maxFrequencyRank: 3_471,
    };

    const serialized = serializeCustomReviewFilters(filters);

    expect(serialized).toEqual({
      version: 1,
      minLevel: 51,
      maxLevel: 60,
      types: ["kanji", "vocabulary"],
      srsStages: [1, 6, 9],
      jlptLevels: ["N5", "N1"],
      maxFrequencyRank: 3_471,
    });

    const restored = restoreCustomReviewFilters(
      JSON.parse(JSON.stringify(serialized)),
      createFallbackFilters(),
    );

    expect(restored).toEqual(filters);
  });

  it("preserves intentionally empty filter selections", () => {
    const serialized = serializeCustomReviewFilters({
      ...createFallbackFilters(),
      types: new Set(),
      srsStages: new Set(),
      jlptLevels: new Set(),
    });

    const restored = restoreCustomReviewFilters(
      serialized,
      createFallbackFilters(),
    );

    expect(restored?.types).toEqual(new Set());
    expect(restored?.srsStages).toEqual(new Set());
    expect(restored?.jlptLevels).toEqual(new Set());
  });

  it("sanitizes corrupt values without capping valid future levels", () => {
    const restored = restoreCustomReviewFilters(
      {
        version: 1,
        minLevel: 75,
        maxLevel: -4,
        types: ["invalid" as WaniKaniItemType],
        srsStages: [99, 5, 5],
        jlptLevels: ["N0" as JLPTLevel, "N2"],
        maxFrequencyRank: 0,
      },
      createFallbackFilters(),
    );

    expect(restored).toEqual({
      ...createFallbackFilters(),
      minLevel: 1,
      maxLevel: 60,
      srsStages: new Set([5]),
      jlptLevels: new Set(["N2"]),
    });
  });

  it("ignores payloads from unsupported schema versions", () => {
    expect(
      restoreCustomReviewFilters(
        { version: 2 as 1, minLevel: 51, maxLevel: 60 },
        createFallbackFilters(),
      ),
    ).toBeNull();
  });
});
