import {
  filterLessonsByFrequency,
  matchesLessonFrequencyFilter,
} from "../lessonFrequencyFilter";

const lessons = [
  { subjectId: 1, subject: { object: "vocabulary" } },
  { subjectId: 2, subject: { object: "kana_vocabulary" } },
  { subjectId: 3, subject: { object: "vocabulary" } },
  { subjectId: 4, subject: { object: "kanji" } },
];

describe("lesson frequency filters", () => {
  it("uses inclusive upper bounds for top-frequency filters", () => {
    expect(matchesLessonFrequencyFilter(1_000, "top-1000")).toBe(true);
    expect(matchesLessonFrequencyFilter(1_001, "top-1000")).toBe(false);
    expect(matchesLessonFrequencyFilter(10_000, "top-10000")).toBe(true);
    expect(matchesLessonFrequencyFilter(10_001, "over-10000")).toBe(true);
  });

  it("keeps all lesson types when no frequency filter is active", () => {
    expect(filterLessonsByFrequency(lessons, new Map(), "all")).toEqual(lessons);
  });

  it("filters to ranked vocabulary and omits unavailable ranks", () => {
    const ranks = new Map<number, number | null>([
      [1, 750],
      [2, 2_000],
      [3, null],
      [4, 10],
    ]);

    expect(filterLessonsByFrequency(lessons, ranks, "top-1000")).toEqual([
      lessons[0],
    ]);
    expect(filterLessonsByFrequency(lessons, ranks, "top-2500")).toEqual([
      lessons[0],
      lessons[1],
    ]);
  });
});
