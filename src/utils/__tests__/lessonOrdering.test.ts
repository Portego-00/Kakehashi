import { describe, it, expect } from "@jest/globals";
import {
  DEFAULT_LESSON_ORDER,
  LESSON_ORDER_OPTIONS,
  LESSON_TYPE_ORDER_VALUES,
  normalizeLessonTypeOrder,
  sortLessonItemsForQueue,
  type OrderableLessonItem,
} from "../lessonOrdering";

type SubjectType = "radical" | "kanji" | "vocabulary" | "kana_vocabulary";

interface TestLessonItem extends OrderableLessonItem {
  id: number;
  subjectId: number;
  availableAt: string;
  subject: {
    id: number;
    object: SubjectType;
    data: {
      level: number;
    };
  };
}

function createTestItem({
  id,
  subjectType = "kanji",
  level = 1,
  availableAt = "2026-03-05T08:00:00.000Z",
  subjectId,
}: {
  id: number;
  subjectType?: SubjectType;
  level?: number;
  availableAt?: string;
  subjectId?: number;
}): TestLessonItem {
  return {
    id,
    subjectId: subjectId ?? id,
    availableAt,
    subject: {
      id: subjectId ?? id,
      object: subjectType,
      data: { level },
    },
  };
}

function constantRandom(value: number): () => number {
  return () => value;
}

describe("lessonOrdering", () => {
  it("defaults to random lesson order", () => {
    expect(DEFAULT_LESSON_ORDER).toBe("random");
  });

  it("includes the expected lesson-order options", () => {
    expect(LESSON_ORDER_OPTIONS.map((option) => option.value)).toEqual([
      "random",
      "currentLevelFirst",
      "lowestLevelFirst",
      "newestUnlockedFirst",
      "oldestUnlockedFirst",
      "ascendingSubjectId",
      "descendingSubjectId",
    ]);
  });

  it("sorts by current level first when configured", () => {
    const items = [
      createTestItem({ id: 1, level: 5 }),
      createTestItem({ id: 2, level: 10 }),
      createTestItem({ id: 3, level: 7 }),
    ];

    const sorted = sortLessonItemsForQueue(items, {
      lessonOrder: "currentLevelFirst",
      randomFn: constantRandom(0),
    });

    expect(sorted.map((item) => item.id)).toEqual([2, 3, 1]);
  });

  it("sorts by lowest level first when configured", () => {
    const items = [
      createTestItem({ id: 1, level: 5 }),
      createTestItem({ id: 2, level: 10 }),
      createTestItem({ id: 3, level: 7 }),
    ];

    const sorted = sortLessonItemsForQueue(items, {
      lessonOrder: "lowestLevelFirst",
      randomFn: constantRandom(0),
    });

    expect(sorted.map((item) => item.id)).toEqual([1, 3, 2]);
  });

  it("prioritizes critical (current level radical/kanji) items", () => {
    const items = [
      createTestItem({ id: 1, subjectType: "vocabulary", level: 10 }),
      createTestItem({ id: 2, subjectType: "radical", level: 10 }),
      createTestItem({ id: 3, subjectType: "kanji", level: 10 }),
      createTestItem({ id: 4, subjectType: "kanji", level: 5 }),
    ];

    const sorted = sortLessonItemsForQueue(items, {
      lessonOrder: "random",
      prioritizeCriticalItems: true,
      userLevel: 10,
      randomFn: constantRandom(0),
    });

    const criticalIds = sorted.slice(0, 2).map((item) => item.id).sort();
    expect(criticalIds).toEqual([2, 3]);
  });

  it("groups by type order when enabled", () => {
    const items = [
      createTestItem({ id: 1, subjectType: "vocabulary", level: 5 }),
      createTestItem({ id: 2, subjectType: "kanji", level: 5 }),
      createTestItem({ id: 3, subjectType: "radical", level: 5 }),
    ];

    const sorted = sortLessonItemsForQueue(items, {
      lessonOrder: "random",
      lessonTypeOrderEnabled: true,
      lessonTypeOrder: ["radical", "kanji", "vocabulary"],
      randomFn: constantRandom(0),
    });

    expect(sorted.map((item) => item.subject.object)).toEqual([
      "radical",
      "kanji",
      "vocabulary",
    ]);
  });

  it("interleaves lesson types in a balanced cycle when counts are even", () => {
    const items = [
      createTestItem({ id: 1, subjectType: "vocabulary" }),
      createTestItem({ id: 2, subjectType: "radical" }),
      createTestItem({ id: 3, subjectType: "kanji" }),
      createTestItem({ id: 4, subjectType: "vocabulary" }),
      createTestItem({ id: 5, subjectType: "radical" }),
      createTestItem({ id: 6, subjectType: "kanji" }),
    ];

    const sorted = sortLessonItemsForQueue(items, {
      lessonOrder: "random",
      interleaveLessonTypesEnabled: true,
      randomFn: constantRandom(0),
    });

    expect(sorted.map((item) => item.subject.object)).toEqual([
      "radical",
      "kanji",
      "vocabulary",
      "radical",
      "kanji",
      "vocabulary",
    ]);
  });

  it("interleaves lesson types proportionally when counts are uneven", () => {
    const items = [
      createTestItem({ id: 1, subjectType: "vocabulary" }),
      createTestItem({ id: 2, subjectType: "vocabulary" }),
      createTestItem({ id: 3, subjectType: "kanji" }),
      createTestItem({ id: 4, subjectType: "vocabulary" }),
      createTestItem({ id: 5, subjectType: "radical" }),
      createTestItem({ id: 6, subjectType: "vocabulary" }),
      createTestItem({ id: 7, subjectType: "kanji" }),
      createTestItem({ id: 8, subjectType: "vocabulary" }),
      createTestItem({ id: 9, subjectType: "vocabulary" }),
    ];

    const sorted = sortLessonItemsForQueue(items, {
      lessonOrder: "random",
      interleaveLessonTypesEnabled: true,
      randomFn: constantRandom(0),
    });

    expect(sorted.map((item) => item.subject.object)).toEqual([
      "vocabulary",
      "kanji",
      "vocabulary",
      "vocabulary",
      "radical",
      "vocabulary",
      "vocabulary",
      "kanji",
      "vocabulary",
    ]);
  });

  it("keeps critical current-level radicals/kanji at the top when interleaving", () => {
    const items = [
      createTestItem({ id: 1, subjectType: "vocabulary", level: 10 }),
      createTestItem({ id: 2, subjectType: "radical", level: 10 }),
      createTestItem({ id: 3, subjectType: "kanji", level: 10 }),
      createTestItem({ id: 4, subjectType: "vocabulary", level: 9 }),
      createTestItem({ id: 5, subjectType: "vocabulary", level: 8 }),
    ];

    const sorted = sortLessonItemsForQueue(items, {
      lessonOrder: "random",
      interleaveLessonTypesEnabled: true,
      prioritizeCriticalItems: true,
      userLevel: 10,
      randomFn: constantRandom(0),
    });

    const topTwoIds = sorted.slice(0, 2).map((item) => item.id).sort();
    expect(topTwoIds).toEqual([2, 3]);
  });

  it("pulls radicals and kanji into each batch when minimum type coverage is enabled", () => {
    const items = [
      createTestItem({ id: 1, subjectType: "vocabulary", subjectId: 1 }),
      createTestItem({ id: 2, subjectType: "vocabulary", subjectId: 2 }),
      createTestItem({ id: 3, subjectType: "vocabulary", subjectId: 3 }),
      createTestItem({ id: 4, subjectType: "vocabulary", subjectId: 4 }),
      createTestItem({ id: 5, subjectType: "vocabulary", subjectId: 5 }),
      createTestItem({ id: 6, subjectType: "radical", subjectId: 6 }),
      createTestItem({ id: 7, subjectType: "kanji", subjectId: 7 }),
      createTestItem({ id: 8, subjectType: "vocabulary", subjectId: 8 }),
      createTestItem({ id: 9, subjectType: "radical", subjectId: 9 }),
      createTestItem({ id: 10, subjectType: "kanji", subjectId: 10 }),
    ];

    const sorted = sortLessonItemsForQueue(items, {
      lessonOrder: "ascendingSubjectId",
      minimumRadicalKanjiPerBatchEnabled: true,
      lessonBatchSize: 5,
      randomFn: constantRandom(0),
    });

    const firstBatchTypes = sorted
      .slice(0, 5)
      .map((item) => item.subject.object);
    const secondBatchTypes = sorted
      .slice(5, 10)
      .map((item) => item.subject.object);

    expect(firstBatchTypes).toContain("radical");
    expect(firstBatchTypes).toContain("kanji");
    expect(secondBatchTypes).toContain("radical");
    expect(secondBatchTypes).toContain("kanji");
    expect(sorted.map((item) => item.id).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("only pulls item types that are available for minimum batch coverage", () => {
    const items = [
      createTestItem({ id: 1, subjectType: "vocabulary", subjectId: 1 }),
      createTestItem({ id: 2, subjectType: "vocabulary", subjectId: 2 }),
      createTestItem({ id: 3, subjectType: "vocabulary", subjectId: 3 }),
      createTestItem({ id: 4, subjectType: "vocabulary", subjectId: 4 }),
      createTestItem({ id: 5, subjectType: "kanji", subjectId: 5 }),
      createTestItem({ id: 6, subjectType: "vocabulary", subjectId: 6 }),
    ];

    const sorted = sortLessonItemsForQueue(items, {
      lessonOrder: "ascendingSubjectId",
      minimumRadicalKanjiPerBatchEnabled: true,
      lessonBatchSize: 4,
      randomFn: constantRandom(0),
    });

    const firstBatchTypes = sorted
      .slice(0, 4)
      .map((item) => item.subject.object);

    expect(firstBatchTypes).toContain("kanji");
    expect(firstBatchTypes).not.toContain("radical");
  });

  it("keeps explicit type grouping as the higher-priority mode", () => {
    const items = [
      createTestItem({ id: 1, subjectType: "vocabulary" }),
      createTestItem({ id: 2, subjectType: "kanji" }),
      createTestItem({ id: 3, subjectType: "radical" }),
    ];

    const sorted = sortLessonItemsForQueue(items, {
      lessonOrder: "random",
      lessonTypeOrderEnabled: true,
      lessonTypeOrder: ["kanji", "vocabulary", "radical"],
      interleaveLessonTypesEnabled: true,
      randomFn: constantRandom(0),
    });

    expect(sorted.map((item) => item.subject.object)).toEqual([
      "kanji",
      "vocabulary",
      "radical",
    ]);
  });

  it("normalizes a custom type order with missing values", () => {
    const normalized = normalizeLessonTypeOrder(["vocabulary"]);
    expect(normalized).toEqual([
      "vocabulary",
      ...LESSON_TYPE_ORDER_VALUES.filter((v) => v !== "vocabulary"),
    ]);
  });

  it("sorts by ascending subject id", () => {
    const items = [
      createTestItem({ id: 1, subjectId: 30 }),
      createTestItem({ id: 2, subjectId: 10 }),
      createTestItem({ id: 3, subjectId: 20 }),
    ];

    const sorted = sortLessonItemsForQueue(items, {
      lessonOrder: "ascendingSubjectId",
      randomFn: constantRandom(0),
    });

    expect(sorted.map((item) => item.subjectId)).toEqual([10, 20, 30]);
  });

  it("sorts by newest unlocked first", () => {
    const items = [
      createTestItem({ id: 1, availableAt: "2026-03-01T00:00:00.000Z" }),
      createTestItem({ id: 2, availableAt: "2026-03-05T00:00:00.000Z" }),
      createTestItem({ id: 3, availableAt: "2026-03-03T00:00:00.000Z" }),
    ];

    const sorted = sortLessonItemsForQueue(items, {
      lessonOrder: "newestUnlockedFirst",
      randomFn: constantRandom(0),
    });

    expect(sorted.map((item) => item.id)).toEqual([2, 3, 1]);
  });
});
