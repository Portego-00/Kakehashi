import { describe, it, expect } from "@jest/globals";
import {
  buildReviewQuestionQueue,
  DEFAULT_REVIEW_ORDER,
  REVIEW_ORDER_OPTIONS,
  REVIEW_TYPE_ORDER_VALUES,
  rebuildReviewQueueAfterSkip,
  sortReviewItemsForQueue,
  type OrderableReviewItem,
} from "../reviewOrdering";

type SubjectType = "radical" | "kanji" | "vocabulary" | "kana_vocabulary";

interface TestReviewItem extends OrderableReviewItem {
  id: number;
  srsStage: number;
  availableAt: string;
  subject: {
    object: SubjectType;
    data: {
      level: number;
      readings?: { reading: string }[] | null;
    };
  };
}

const NOW = new Date("2026-03-05T12:00:00.000Z");

function createTestItem({
  id,
  subjectType = "kanji",
  level = 1,
  srsStage = 1,
  availableAt = "2026-03-05T08:00:00.000Z",
  hasReading = true,
}: {
  id: number;
  subjectType?: SubjectType;
  level?: number;
  srsStage?: number;
  availableAt?: string;
  hasReading?: boolean;
}): TestReviewItem {
  const readings =
    hasReading && subjectType !== "radical" ? [{ reading: "テスト" }] : null;

  return {
    id,
    srsStage,
    availableAt,
    subject: {
      object: subjectType,
      data: {
        level,
        readings,
      },
    },
  };
}

function constantRandom(value: number): () => number {
  return () => value;
}

function toReviewTypeBucket(subjectType: SubjectType): "radical" | "kanji" | "vocabulary" {
  if (subjectType === "kana_vocabulary") {
    return "vocabulary";
  }
  return subjectType;
}

describe("reviewOrdering", () => {
  it("defaults to random review order", () => {
    expect(DEFAULT_REVIEW_ORDER).toBe("random");
  });

  it("includes the expected review-order options", () => {
    expect(REVIEW_ORDER_OPTIONS.map((option) => option.value)).toEqual([
      "random",
      "ascendingSrsStage",
      "descendingSrsStage",
      "currentLevelFirst",
      "lowestLevelFirst",
      "newestAvailableFirst",
      "oldestAvailableFirst",
      "longestRelativeWait",
    ]);
  });

  it("includes the expected review-type options", () => {
    expect(REVIEW_TYPE_ORDER_VALUES).toEqual([
      "radical",
      "kanji",
      "vocabulary",
    ]);
  });

  it("uses a fully random item order when random mode is selected", () => {
    const items = [
      createTestItem({ id: 1, subjectType: "radical", hasReading: false }),
      createTestItem({ id: 2, subjectType: "kanji" }),
      createTestItem({ id: 3, subjectType: "vocabulary" }),
      createTestItem({ id: 4, subjectType: "radical", hasReading: false }),
    ];

    const randomSorted = sortReviewItemsForQueue(items, {
      reviewOrder: "random",
      randomFn: constantRandom(0),
      now: NOW,
    });

    expect(randomSorted.map((item) => item.id)).toEqual([2, 3, 4, 1]);
  });

  it("supports random mode grouped by custom item type order", () => {
    const items = [
      createTestItem({ id: 1, subjectType: "radical", hasReading: false }),
      createTestItem({ id: 2, subjectType: "kanji" }),
      createTestItem({ id: 3, subjectType: "vocabulary" }),
      createTestItem({ id: 4, subjectType: "radical", hasReading: false }),
      createTestItem({ id: 5, subjectType: "kana_vocabulary", hasReading: false }),
      createTestItem({ id: 6, subjectType: "kanji" }),
    ];

    const sorted = sortReviewItemsForQueue(items, {
      reviewOrder: "random",
      reviewTypeOrderEnabled: true,
      reviewTypeOrder: ["kanji", "vocabulary", "radical"],
      randomFn: constantRandom(0),
      now: NOW,
    });

    const buckets = sorted.map((item) => toReviewTypeBucket(item.subject.object));
    expect(buckets).toEqual([
      "kanji",
      "kanji",
      "vocabulary",
      "vocabulary",
      "radical",
      "radical",
    ]);
  });

  it("sorts by ascending SRS stage and subject type", () => {
    const items = [
      createTestItem({ id: 1, subjectType: "vocabulary", srsStage: 1 }),
      createTestItem({ id: 2, subjectType: "radical", srsStage: 1, hasReading: false }),
      createTestItem({ id: 3, subjectType: "kanji", srsStage: 1 }),
      createTestItem({ id: 4, subjectType: "radical", srsStage: 2, hasReading: false }),
    ];

    const sorted = sortReviewItemsForQueue(items, {
      reviewOrder: "ascendingSrsStage",
      randomFn: constantRandom(0),
      now: NOW,
    });

    expect(sorted.map((item) => item.id)).toEqual([2, 3, 1, 4]);
  });

  it("sorts by descending SRS stage", () => {
    const items = [
      createTestItem({ id: 1, srsStage: 1 }),
      createTestItem({ id: 2, srsStage: 5 }),
      createTestItem({ id: 3, srsStage: 3 }),
    ];

    const sorted = sortReviewItemsForQueue(items, {
      reviewOrder: "descendingSrsStage",
      randomFn: constantRandom(0),
      now: NOW,
    });

    expect(sorted.map((item) => item.id)).toEqual([2, 3, 1]);
  });

  it("groups by custom item type order before applying the selected review order", () => {
    const items = [
      createTestItem({ id: 1, subjectType: "kanji", srsStage: 1 }),
      createTestItem({ id: 2, subjectType: "radical", srsStage: 2, hasReading: false }),
      createTestItem({ id: 3, subjectType: "vocabulary", srsStage: 4 }),
      createTestItem({ id: 4, subjectType: "kana_vocabulary", srsStage: 1, hasReading: false }),
      createTestItem({ id: 5, subjectType: "vocabulary", srsStage: 2 }),
    ];

    const sorted = sortReviewItemsForQueue(items, {
      reviewOrder: "ascendingSrsStage",
      reviewTypeOrderEnabled: true,
      reviewTypeOrder: ["vocabulary", "radical", "kanji"],
      randomFn: constantRandom(0),
      now: NOW,
    });

    expect(sorted.map((item) => toReviewTypeBucket(item.subject.object))).toEqual([
      "vocabulary",
      "vocabulary",
      "vocabulary",
      "radical",
      "kanji",
    ]);
    expect(sorted.map((item) => item.id)).toEqual([4, 5, 3, 2, 1]);
  });

  it("keeps item type groups while sorting most overdue items inside each group", () => {
    const items = [
      // 8 hours / 4-hour interval = 2x, but kanji is configured after radicals.
      createTestItem({
        id: 1,
        subjectType: "kanji",
        srsStage: 1,
        availableAt: "2026-03-05T04:00:00.000Z",
      }),
      // 24 hours / 167-hour interval ~= 0.14x
      createTestItem({
        id: 2,
        subjectType: "radical",
        srsStage: 5,
        availableAt: "2026-03-04T12:00:00.000Z",
        hasReading: false,
      }),
      // 4 hours / 4-hour interval = 1x
      createTestItem({
        id: 3,
        subjectType: "radical",
        srsStage: 1,
        availableAt: "2026-03-05T08:00:00.000Z",
        hasReading: false,
      }),
      // 24 hours / 4-hour interval = 6x, but vocabulary is configured last.
      createTestItem({
        id: 4,
        subjectType: "vocabulary",
        srsStage: 1,
        availableAt: "2026-03-04T12:00:00.000Z",
      }),
    ];

    const sorted = sortReviewItemsForQueue(items, {
      reviewOrder: "longestRelativeWait",
      reviewTypeOrderEnabled: true,
      reviewTypeOrder: ["radical", "kanji", "vocabulary"],
      randomFn: constantRandom(0),
      now: NOW,
    });

    expect(sorted.map((item) => item.id)).toEqual([3, 2, 1, 4]);
  });

  it("sorts by current level first and lowest level first", () => {
    const items = [
      createTestItem({ id: 1, level: 12 }),
      createTestItem({ id: 2, level: 5 }),
      createTestItem({ id: 3, level: 9 }),
    ];

    const currentLevelFirst = sortReviewItemsForQueue(items, {
      reviewOrder: "currentLevelFirst",
      randomFn: constantRandom(0),
      now: NOW,
    });
    const lowestLevelFirst = sortReviewItemsForQueue(items, {
      reviewOrder: "lowestLevelFirst",
      randomFn: constantRandom(0),
      now: NOW,
    });

    expect(currentLevelFirst.map((item) => item.id)).toEqual([1, 3, 2]);
    expect(lowestLevelFirst.map((item) => item.id)).toEqual([2, 3, 1]);
  });

  it("sorts by newest/oldest available timestamp", () => {
    const items = [
      createTestItem({ id: 1, availableAt: "2026-03-05T06:00:00.000Z" }),
      createTestItem({ id: 2, availableAt: "2026-03-05T11:00:00.000Z" }),
      createTestItem({ id: 3, availableAt: "2026-03-05T09:00:00.000Z" }),
    ];

    const newest = sortReviewItemsForQueue(items, {
      reviewOrder: "newestAvailableFirst",
      randomFn: constantRandom(0),
      now: NOW,
    });
    const oldest = sortReviewItemsForQueue(items, {
      reviewOrder: "oldestAvailableFirst",
      randomFn: constantRandom(0),
      now: NOW,
    });

    expect(newest.map((item) => item.id)).toEqual([2, 3, 1]);
    expect(oldest.map((item) => item.id)).toEqual([1, 3, 2]);
  });

  it("sorts by longest relative wait ratio", () => {
    const items = [
      // 8 hours / 8-hour interval = 1x
      createTestItem({
        id: 1,
        srsStage: 2,
        availableAt: "2026-03-05T04:00:00.000Z",
      }),
      // 8 hours / 4-hour interval = 2x
      createTestItem({
        id: 2,
        srsStage: 1,
        availableAt: "2026-03-05T04:00:00.000Z",
      }),
      // 24 hours / 167-hour interval ~= 0.14x
      createTestItem({
        id: 3,
        srsStage: 5,
        availableAt: "2026-03-04T12:00:00.000Z",
      }),
    ];

    const sorted = sortReviewItemsForQueue(items, {
      reviewOrder: "longestRelativeWait",
      randomFn: constantRandom(0),
      now: NOW,
    });

    expect(sorted.map((item) => item.id)).toEqual([2, 1, 3]);
  });

  it("applies critical-item priority before the selected order", () => {
    const items = [
      // Not critical (level mismatch)
      createTestItem({
        id: 1,
        subjectType: "radical",
        level: 9,
        srsStage: 1,
        hasReading: false,
      }),
      // Critical (current level radical in apprentice)
      createTestItem({
        id: 2,
        subjectType: "radical",
        level: 10,
        srsStage: 2,
        hasReading: false,
      }),
      // Not critical (vocabulary)
      createTestItem({
        id: 3,
        subjectType: "vocabulary",
        level: 10,
        srsStage: 1,
      }),
    ];

    const sorted = sortReviewItemsForQueue(items, {
      reviewOrder: "lowestLevelFirst",
      prioritizeCriticalItems: true,
      userLevel: 10,
      randomFn: constantRandom(0),
      now: NOW,
    });

    expect(sorted.map((item) => item.id)).toEqual([2, 1, 3]);
  });

  it("builds back-to-back queues in item order", () => {
    const items = [
      createTestItem({ id: 11 }),
      createTestItem({ id: 12 }),
      createTestItem({ id: 13 }),
    ];

    const queue = buildReviewQuestionQueue(items, {
      backToBack: true,
      groupQuestions: false,
    });

    expect(queue).toEqual([
      { type: "meaning", itemId: 11 },
      { type: "reading", itemId: 11 },
      { type: "meaning", itemId: 12 },
      { type: "reading", itemId: 12 },
      { type: "meaning", itemId: 13 },
      { type: "reading", itemId: 13 },
    ]);
  });

  it("supports forcing reading before meaning in back-to-back mode", () => {
    const items = [
      createTestItem({ id: 14 }),
      createTestItem({ id: 15 }),
    ];

    const queue = buildReviewQuestionQueue(items, {
      backToBack: true,
      groupQuestions: false,
      questionTypeOrderEnabled: true,
      questionTypeOrder: "reading",
    });

    expect(queue).toEqual([
      { type: "reading", itemId: 14 },
      { type: "meaning", itemId: 14 },
      { type: "reading", itemId: 15 },
      { type: "meaning", itemId: 15 },
    ]);
  });

  it("returns only meaning questions when grouping is enabled", () => {
    const items = [
      createTestItem({ id: 21 }),
      createTestItem({ id: 22, subjectType: "radical", hasReading: false }),
      createTestItem({ id: 23, subjectType: "vocabulary", hasReading: false }),
    ];

    const queue = buildReviewQuestionQueue(items, {
      backToBack: true,
      groupQuestions: true,
    });

    expect(queue).toEqual([
      { type: "meaning", itemId: 21 },
      { type: "meaning", itemId: 22 },
      { type: "meaning", itemId: 23 },
    ]);
  });

  it("keeps paired questions within the configured max gap in spread mode", () => {
    const items = [
      createTestItem({ id: 31 }),
      createTestItem({ id: 32 }),
      createTestItem({ id: 33 }),
      createTestItem({ id: 34 }),
    ];

    const queue = buildReviewQuestionQueue(items, {
      backToBack: false,
      groupQuestions: false,
      maxQuestionGap: 3,
      randomFn: constantRandom(0),
    });

    const firstOccurrenceOrder = Array.from(new Set(queue.map((q) => q.itemId)));
    expect(firstOccurrenceOrder).toEqual([31, 32, 33, 34]);

    for (const itemId of [31, 32, 33, 34]) {
      const meaningIndex = queue.findIndex(
        (question) => question.itemId === itemId && question.type === "meaning"
      );
      const readingIndex = queue.findIndex(
        (question) => question.itemId === itemId && question.type === "reading"
      );
      expect(Math.abs(meaningIndex - readingIndex)).toBeLessThanOrEqual(3);
    }
  });

  it("supports forcing reading before meaning in spread mode", () => {
    const items = [
      createTestItem({ id: 35 }),
      createTestItem({ id: 36 }),
      createTestItem({ id: 37 }),
    ];

    const queue = buildReviewQuestionQueue(items, {
      backToBack: false,
      groupQuestions: false,
      maxQuestionGap: 4,
      questionTypeOrderEnabled: true,
      questionTypeOrder: "reading",
      randomFn: constantRandom(0),
    });

    for (const itemId of [35, 36, 37]) {
      const meaningIndex = queue.findIndex(
        (question) => question.itemId === itemId && question.type === "meaning"
      );
      const readingIndex = queue.findIndex(
        (question) => question.itemId === itemId && question.type === "reading"
      );
      expect(readingIndex).toBeLessThan(meaningIndex);
      expect(Math.abs(meaningIndex - readingIndex)).toBeLessThanOrEqual(4);
    }
  });

  it("keeps selected ordering even when back-to-back mode is enabled", () => {
    const sortedItems = sortReviewItemsForQueue(
      [
        createTestItem({
          id: 41,
          subjectType: "radical",
          level: 4,
          srsStage: 1,
          hasReading: false,
        }),
        createTestItem({
          id: 42,
          subjectType: "radical",
          level: 10,
          srsStage: 2,
          hasReading: false,
        }),
        createTestItem({
          id: 43,
          subjectType: "kanji",
          level: 7,
          srsStage: 3,
        }),
      ],
      {
        reviewOrder: "lowestLevelFirst",
        prioritizeCriticalItems: true,
        userLevel: 10,
        randomFn: constantRandom(0),
        now: NOW,
      }
    );

    const queue = buildReviewQuestionQueue(sortedItems, {
      backToBack: true,
      groupQuestions: false,
    });

    expect(Array.from(new Set(queue.map((question) => question.itemId)))).toEqual(
      sortedItems.map((item) => item.id)
    );
    expect(queue[0]?.itemId).toBe(42);
  });

  it("keeps preview-skipped review items spread instead of pairing each item", () => {
    const items = Array.from({ length: 10 }, (_, index) =>
      createTestItem({ id: index + 1 })
    );
    let queue = [
      ...items.map((item) => ({ type: "meaning" as const, itemId: item.id })),
      ...items.map((item) => ({ type: "reading" as const, itemId: item.id })),
    ];
    let skippedItemIds: number[] = [];

    items.forEach((item) => {
      expect(queue[0]).toEqual({ type: "meaning", itemId: item.id });

      const result = rebuildReviewQueueAfterSkip({
        items,
        remainingQuestions: queue.slice(1),
        skippedItemId: item.id,
        skippedItemIds,
        skippedQuestionType: queue[0]?.type,
        questionTypeOrderEnabled: true,
        questionTypeOrder: "meaning",
        maxQuestionGap: 10,
        randomFn: constantRandom(0),
      });

      queue = result.queue;
      skippedItemIds = result.skippedItemIds;
    });

    expect(queue).toEqual([
      ...items.map((item) => ({ type: "meaning" as const, itemId: item.id })),
      ...items.map((item) => ({ type: "reading" as const, itemId: item.id })),
    ]);

    for (let index = 0; index < queue.length - 1; index += 1) {
      expect(queue[index].itemId === queue[index + 1].itemId).toBe(false);
    }
  });

  it("keeps skipped review items paired when back-to-back mode is enabled", () => {
    const items = [createTestItem({ id: 51 }), createTestItem({ id: 52 })];
    let queue = [
      { type: "meaning" as const, itemId: 51 },
      { type: "meaning" as const, itemId: 52 },
      { type: "reading" as const, itemId: 51 },
      { type: "reading" as const, itemId: 52 },
    ];
    let skippedItemIds: number[] = [];

    [51, 52].forEach((itemId) => {
      const result = rebuildReviewQueueAfterSkip({
        items,
        remainingQuestions: queue.slice(1),
        skippedItemId: itemId,
        skippedItemIds,
        skippedQuestionType: queue[0]?.type,
        backToBack: true,
        questionTypeOrderEnabled: true,
        questionTypeOrder: "meaning",
        maxQuestionGap: 10,
        randomFn: constantRandom(0),
      });

      queue = result.queue;
      skippedItemIds = result.skippedItemIds;
    });

    expect(queue).toEqual([
      { type: "meaning", itemId: 51 },
      { type: "reading", itemId: 51 },
      { type: "meaning", itemId: 52 },
      { type: "reading", itemId: 52 },
    ]);
  });

  it("drops stale preview-skipped ids that are no longer queued", () => {
    const items = [
      createTestItem({ id: 61 }),
      createTestItem({ id: 62 }),
      createTestItem({ id: 63 }),
    ];

    const result = rebuildReviewQueueAfterSkip({
      items,
      remainingQuestions: [
        { type: "meaning", itemId: 63 },
        { type: "reading", itemId: 63 },
      ],
      skippedItemId: 62,
      skippedItemIds: [61],
      skippedQuestionType: "meaning",
      questionTypeOrderEnabled: true,
      questionTypeOrder: "meaning",
      maxQuestionGap: 10,
      randomFn: constantRandom(0),
    });

    expect(result.skippedItemIds).toEqual([62]);
    expect(result.queue).toEqual([
      { type: "meaning", itemId: 63 },
      { type: "reading", itemId: 63 },
      { type: "meaning", itemId: 62 },
      { type: "reading", itemId: 62 },
    ]);
  });
});
