import {
  MAX_LEARNING_PAGES,
  applyLearningPageToDashboardData,
  createLearningPageSubjectMatcher,
  describeLearningPageFilter,
  isLearningPageFilterEmpty,
  normalizeLearningPageFilter,
  normalizeLearningPages,
  type LearningPageFilter,
} from "../learningPages";
import type { DayForecast } from "../../types/wanikani";

const radical = { id: 1, object: "radical", data: { level: 1, characters: "一" } };
const kanji = { id: 2, object: "kanji", data: { level: 1, characters: "日" } };
const vocabulary = { id: 3, object: "vocabulary", data: { level: 5, characters: "日本", readings: [{ reading: "にほん" }] } };
const kanaVocabulary = { id: 4, object: "kana_vocabulary", data: { level: 9, characters: "ある" } };
const subjects = [radical, kanji, vocabulary, kanaVocabulary];

const filter = (value: Partial<LearningPageFilter>) => normalizeLearningPageFilter(value);
const page = (value: Partial<LearningPageFilter>) => ({ id: "page", name: "Page", filter: filter(value) });
const matchingIds = (value: Partial<LearningPageFilter>, statistics = []) =>
  subjects.filter((subject) => createLearningPageSubjectMatcher(filter(value), statistics)(subject)).map(({ id }) => id);

describe("normalizeLearningPages", () => {
  it("drops invalid pages and filter values", () => {
    expect(normalizeLearningPages([
      { id: "a", name: "  Kanji   only ", filter: { subjectTypes: ["kanji", "bogus"], minLevel: 10, maxLevel: 3, jlptLevels: ["N9", "N5"], srsGroups: ["guru", "apprentice"] } },
      { id: "a", name: "Duplicate" },
      { id: "b", name: "" },
      null,
    ])).toEqual([{
      id: "a",
      name: "Kanji only",
      filter: { subjectTypes: ["kanji"], minLevel: 3, maxLevel: 10, jlptLevels: ["N5"], srsGroups: ["apprentice", "guru"], criticalOnly: false },
    }]);
  });

  it("caps the number of pages", () => {
    const pages = Array.from({ length: MAX_LEARNING_PAGES + 1 }, (_, index) => ({ id: `${index}`, name: "Page" }));
    expect(normalizeLearningPages(pages)).toHaveLength(MAX_LEARNING_PAGES);
  });

  it("treats selecting every option as no restriction", () => {
    expect(isLearningPageFilterEmpty(filter({ subjectTypes: ["radical", "kanji", "vocabulary", "kana_vocabulary"] }))).toBe(true);
    expect(isLearningPageFilterEmpty(filter({ srsGroups: ["apprentice", "guru", "master", "enlightened"] }))).toBe(true);
    expect(isLearningPageFilterEmpty(filter({ srsGroups: ["apprentice", "guru", "master"] }))).toBe(false);
  });
});

it("describes the active filters", () => {
  expect(describeLearningPageFilter(filter({}))).toBe("All items");
  expect(describeLearningPageFilter(filter({ subjectTypes: ["radical", "kanji"], minLevel: 1, maxLevel: 10, jlptLevels: ["N5"], srsGroups: ["guru"], criticalOnly: true })))
    .toBe("Radicals, Kanji · Levels 1–10 · JLPT N5 · Guru · Critical items");
});

describe("createLearningPageSubjectMatcher", () => {
  it("filters by subject type, level and JLPT level", () => {
    expect(matchingIds({ subjectTypes: ["radical", "kanji"] })).toEqual([1, 2]);
    expect(matchingIds({ minLevel: 2, maxLevel: 9 })).toEqual([3, 4]);
    expect(matchingIds({ jlptLevels: ["N5"] })).not.toContain(1);
  });

  it("filters to critical items", () => {
    const statistics: any = [
      { data: { subject_id: 2, percentage_correct: 60 } },
      { data: { subject_id: 3, percentage_correct: 90 } },
      { data: { subject_id: 4, percentage_correct: 40, hidden: true } },
    ];
    expect(matchingIds({ criticalOnly: true }, statistics)).toEqual([2]);
  });

  it("filters by SRS stage but keeps unstarted and burned items", () => {
    const matches = createLearningPageSubjectMatcher(filter({ srsGroups: ["apprentice", "guru", "master"] }));
    expect([0, 1, 7, 8, 9].map((stage) => matches(kanji, stage))).toEqual([true, true, true, false, true]);
  });

  it("never matches unknown subjects", () => {
    expect(createLearningPageSubjectMatcher(filter({}))(undefined)).toBe(false);
  });
});

describe("applyLearningPageToDashboardData", () => {
  const now = new Date("2026-10-15T10:30:00Z");
  const started = { started_at: "2026-10-02T00:00:00Z" };
  const assignments = [
    { id: 10, data: { subject_id: 1, unlocked_at: "2026-10-01T00:00:00Z" } },
    { id: 11, data: { subject_id: 3, unlocked_at: "2026-10-01T00:00:00Z" } },
    { id: 12, data: { subject_id: 2, ...started, available_at: "2026-10-15T09:00:00Z", srs_stage: 2 } },
    { id: 13, data: { subject_id: 4, ...started, available_at: "2026-10-16T09:00:00Z", srs_stage: 5 } },
  ];
  const dashboardData = {
    lessonCount: 2,
    reviewCount: 1,
    forecast: [] as DayForecast[],
    recentMistakes: [{ id: 2 }, { id: 4 }],
    criticalItems: [{ id: 3 }],
    recentUnlocks: [{ id: 1 }],
    burnedItems: [],
    reviewStatistics: [],
    nextReviewDate: null,
    recentLessonCount: 1,
    subjects,
    assignments,
    dataLoadingState: { assignments: true, subjects: true },
  };
  const forecastTotal = (data: { forecast: DayForecast[] }) =>
    data.forecast.reduce((sum, day) => sum + day.totalCount, 0);

  beforeEach(() => jest.useFakeTimers({ now }));
  afterEach(() => jest.useRealTimers());

  it("returns the data unchanged without a page", () => {
    expect(applyLearningPageToDashboardData(dashboardData, null, now)).toBe(dashboardData);
  });

  it("limits counts, forecast and lists to matching items", () => {
    const kanjiPage = applyLearningPageToDashboardData(dashboardData, page({ subjectTypes: ["radical", "kanji"] }), now);
    expect(kanjiPage).toMatchObject({ lessonCount: 1, reviewCount: 1, recentMistakes: [{ id: 2 }], criticalItems: [], recentUnlocks: [{ id: 1 }] });
    expect(kanjiPage.assignments.map(({ id }) => id)).toEqual([10, 12]);
    expect(forecastTotal(kanjiPage)).toBe(0);

    const vocabularyPage = applyLearningPageToDashboardData(dashboardData, page({ subjectTypes: ["vocabulary", "kana_vocabulary"] }), now);
    expect(vocabularyPage).toMatchObject({ lessonCount: 1, reviewCount: 0, nextReviewDate: "2026-10-16T09:00:00Z" });
    expect(forecastTotal(vocabularyPage)).toBe(1);
  });

  it("excludes reviews outside the chosen SRS stages but keeps lessons", () => {
    const noGuru = applyLearningPageToDashboardData(dashboardData, page({ srsGroups: ["apprentice", "master", "enlightened"] }), now);
    expect(noGuru).toMatchObject({ lessonCount: 2, reviewCount: 1, nextReviewDate: null, recentMistakes: [{ id: 2 }] });
    expect(forecastTotal(noGuru)).toBe(0);
  });
});
