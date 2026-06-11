import type {
  PersistedLessonItem,
  PersistedLessonSessionState,
} from "../lessonSessionPersistence";
import { revalidatePersistedLessonState } from "../lessonSessionRevalidation";

const makeItem = (
  id: number,
  overrides: Partial<PersistedLessonItem> = {}
): PersistedLessonItem => ({
  id,
  assignmentId: 1000 + id,
  subjectId: 2000 + id,
  availableAt: null,
  subject: { object: "kanji", data: {} },
  meaningDone: false,
  readingDone: false,
  meaningIncorrect: 0,
  readingIncorrect: 0,
  submitted: false,
  ...overrides,
});

const makeState = (
  batches: { items: PersistedLessonItem[]; completed: boolean }[],
  overrides: Partial<PersistedLessonSessionState> = {}
): PersistedLessonSessionState => {
  const allLessons = batches.flatMap((batch) => batch.items);
  return {
    allLessons,
    lessonBatches: batches,
    currentBatchIndex: 0,
    currentItemIndex: 0,
    mode: "lesson",
    reviewItems: [],
    masterQueue: [],
    activeQueue: [],
    currentQuestion: null,
    completedBatchStats: null,
    isFinalBatchComplete: false,
    progress: {
      totalItems: allLessons.length,
      completedItems: 0,
      currentBatch: 1,
      totalBatches: batches.length,
    },
    typeCounts: { radical: 0, kanji: allLessons.length, vocabulary: 0 },
    relatedSubjects: {},
    ...overrides,
  };
};

const availableIdsFor = (items: PersistedLessonItem[]) =>
  new Set(items.map((item) => item.assignmentId));

describe("revalidatePersistedLessonState", () => {
  it("returns the state unchanged when every item is still available", () => {
    const items = [makeItem(0), makeItem(1), makeItem(2)];
    const state = makeState([{ items, completed: false }]);

    const result = revalidatePersistedLessonState(state, {
      availableAssignmentIds: availableIdsFor(items),
    });

    expect(result.removedCount).toBe(0);
    expect(result.state).toBe(state);
  });

  it("clears the session when every unstarted lesson was finished elsewhere", () => {
    const items = [makeItem(0), makeItem(1)];
    const state = makeState([{ items, completed: false }]);

    const result = revalidatePersistedLessonState(state, {
      availableAssignmentIds: new Set<number>(),
    });

    expect(result.removedCount).toBe(2);
    expect(result.state).toBeNull();
  });

  it("keeps items completed in-app even when WaniKani no longer lists them", () => {
    const completedItems = [
      makeItem(0, { submitted: true, meaningDone: true, readingDone: true }),
      makeItem(1, { submitted: true, meaningDone: true, readingDone: true }),
    ];
    const upcomingItems = [makeItem(2), makeItem(3)];
    const state = makeState(
      [
        { items: completedItems, completed: true },
        { items: upcomingItems, completed: false },
      ],
      { currentBatchIndex: 1 }
    );

    const result = revalidatePersistedLessonState(state, {
      availableAssignmentIds: availableIdsFor(upcomingItems),
    });

    expect(result.removedCount).toBe(0);
    expect(result.state).toBe(state);
  });

  it("keeps items whose completion is queued for offline sync", () => {
    const items = [makeItem(0), makeItem(1)];
    const state = makeState([{ items, completed: false }]);

    const result = revalidatePersistedLessonState(state, {
      availableAssignmentIds: new Set([items[1].assignmentId]),
      pendingLessonAssignmentIds: new Set([items[0].assignmentId]),
    });

    expect(result.removedCount).toBe(0);
    expect(result.state).toBe(state);
  });

  it("reads the submitted flag from reviewItems copies after the JSON round-trip", () => {
    const batchItem = makeItem(0, { submitted: false });
    const reviewCopy = makeItem(0, {
      submitted: true,
      meaningDone: true,
      readingDone: true,
    });
    const otherItem = makeItem(1);
    const state = makeState(
      [{ items: [batchItem, otherItem], completed: false }],
      { mode: "review", reviewItems: [reviewCopy, makeItem(1)] }
    );

    const result = revalidatePersistedLessonState(state, {
      availableAssignmentIds: new Set([otherItem.assignmentId]),
    });

    expect(result.removedCount).toBe(0);
    expect(result.state).toBe(state);
  });

  it("drops a lesson finished elsewhere and remaps the current item index", () => {
    const items = [
      makeItem(0, { subject: { object: "radical", data: {} } }),
      makeItem(1),
      makeItem(2, { subject: { object: "vocabulary", data: {} } }),
    ];
    const state = makeState([{ items, completed: false }], {
      currentItemIndex: 2,
      typeCounts: { radical: 1, kanji: 1, vocabulary: 1 },
    });

    const result = revalidatePersistedLessonState(state, {
      availableAssignmentIds: availableIdsFor([items[0], items[2]]),
    });

    expect(result.removedCount).toBe(1);
    expect(result.state).not.toBeNull();
    const newState = result.state!;
    expect(newState.allLessons.map((item) => item.id)).toEqual([0, 2]);
    expect(newState.lessonBatches[0].items.map((item) => item.id)).toEqual([
      0, 2,
    ]);
    expect(newState.currentItemIndex).toBe(1);
    expect(newState.progress).toEqual({
      totalItems: 2,
      completedItems: 0,
      currentBatch: 1,
      totalBatches: 1,
    });
    expect(newState.typeCounts).toEqual({
      radical: 1,
      kanji: 0,
      vocabulary: 1,
    });
  });

  it("rebuilds review queues without dropped or already-answered questions", () => {
    const itemDoneMeaning = makeItem(0, { meaningDone: true });
    const itemFinishedElsewhere = makeItem(1);
    const itemFresh = makeItem(2);
    const items = [itemDoneMeaning, itemFinishedElsewhere, itemFresh];
    const state = makeState([{ items, completed: false }], {
      mode: "review",
      reviewItems: items,
      masterQueue: [
        { type: "meaning", itemId: 0 },
        { type: "reading", itemId: 0 },
        { type: "meaning", itemId: 1 },
        { type: "reading", itemId: 1 },
        { type: "meaning", itemId: 2 },
        { type: "reading", itemId: 2 },
      ],
      activeQueue: [
        { type: "meaning", itemId: 1 },
        { type: "reading", itemId: 0 },
        { type: "meaning", itemId: 2 },
        { type: "reading", itemId: 2 },
      ],
      currentQuestion: { type: "meaning", itemId: 1 },
    });

    const result = revalidatePersistedLessonState(state, {
      availableAssignmentIds: availableIdsFor([itemDoneMeaning, itemFresh]),
    });

    expect(result.removedCount).toBe(1);
    const newState = result.state!;
    expect(newState.mode).toBe("review");
    expect(newState.reviewItems.map((item) => item.id)).toEqual([0, 2]);
    expect(newState.masterQueue).toEqual([
      { type: "reading", itemId: 0 },
      { type: "meaning", itemId: 2 },
      { type: "reading", itemId: 2 },
    ]);
    expect(newState.activeQueue).toEqual(newState.masterQueue);
    expect(newState.currentQuestion).toEqual({ type: "reading", itemId: 0 });
  });

  it("keeps the current question when it survives revalidation", () => {
    const itemFresh = makeItem(0);
    const itemFinishedElsewhere = makeItem(1);
    const items = [itemFresh, itemFinishedElsewhere];
    const state = makeState([{ items, completed: false }], {
      mode: "review",
      reviewItems: items,
      masterQueue: [
        { type: "meaning", itemId: 0 },
        { type: "reading", itemId: 0 },
        { type: "meaning", itemId: 1 },
        { type: "reading", itemId: 1 },
      ],
      activeQueue: [
        { type: "meaning", itemId: 0 },
        { type: "reading", itemId: 0 },
        { type: "meaning", itemId: 1 },
        { type: "reading", itemId: 1 },
      ],
      currentQuestion: { type: "meaning", itemId: 0 },
    });

    const result = revalidatePersistedLessonState(state, {
      availableAssignmentIds: availableIdsFor([itemFresh]),
    });

    const newState = result.state!;
    expect(newState.currentQuestion).toEqual({ type: "meaning", itemId: 0 });
    expect(newState.activeQueue[0]).toEqual({ type: "meaning", itemId: 0 });
  });

  it("falls back to the next batch in lesson mode when the quiz batch is gone", () => {
    const doneItems = [
      makeItem(0, { submitted: true, meaningDone: true, readingDone: true }),
    ];
    const quizItems = [makeItem(1), makeItem(2)];
    const futureItems = [makeItem(3), makeItem(4)];
    const state = makeState(
      [
        { items: doneItems, completed: true },
        { items: quizItems, completed: false },
        { items: futureItems, completed: false },
      ],
      {
        currentBatchIndex: 1,
        mode: "review",
        reviewItems: quizItems,
        masterQueue: [
          { type: "meaning", itemId: 1 },
          { type: "meaning", itemId: 2 },
        ],
        activeQueue: [
          { type: "meaning", itemId: 1 },
          { type: "meaning", itemId: 2 },
        ],
        currentQuestion: { type: "meaning", itemId: 1 },
      }
    );

    const result = revalidatePersistedLessonState(state, {
      availableAssignmentIds: availableIdsFor(futureItems),
    });

    expect(result.removedCount).toBe(2);
    const newState = result.state!;
    expect(newState.mode).toBe("lesson");
    expect(newState.currentBatchIndex).toBe(1);
    expect(newState.currentItemIndex).toBe(0);
    expect(newState.lessonBatches).toHaveLength(2);
    expect(newState.lessonBatches[1].items.map((item) => item.id)).toEqual([
      3, 4,
    ]);
    expect(newState.reviewItems).toEqual([]);
    expect(newState.activeQueue).toEqual([]);
    expect(newState.currentQuestion).toBeNull();
    expect(newState.progress.completedItems).toBe(1);
  });

  it("marks the quiz batch complete when only in-app-finished items remain", () => {
    const finishedInApp = makeItem(0, {
      submitted: true,
      meaningDone: true,
      readingDone: true,
    });
    const finishedElsewhere = makeItem(1);
    const futureItems = [makeItem(2)];
    const state = makeState(
      [
        { items: [finishedInApp, finishedElsewhere], completed: false },
        { items: futureItems, completed: false },
      ],
      {
        mode: "review",
        reviewItems: [finishedInApp, finishedElsewhere],
        masterQueue: [
          { type: "meaning", itemId: 1 },
          { type: "reading", itemId: 1 },
        ],
        activeQueue: [
          { type: "meaning", itemId: 1 },
          { type: "reading", itemId: 1 },
        ],
        currentQuestion: { type: "meaning", itemId: 1 },
      }
    );

    const result = revalidatePersistedLessonState(state, {
      availableAssignmentIds: availableIdsFor(futureItems),
    });

    expect(result.removedCount).toBe(1);
    const newState = result.state!;
    expect(newState.lessonBatches[0].completed).toBe(true);
    expect(newState.mode).toBe("lesson");
    expect(newState.currentBatchIndex).toBe(1);
    expect(newState.progress.completedItems).toBe(1);
  });

  it("clears the session when the quiz batch is gone and no batches remain", () => {
    const quizItems = [makeItem(0), makeItem(1)];
    const state = makeState([{ items: quizItems, completed: false }], {
      mode: "review",
      reviewItems: quizItems,
      masterQueue: [{ type: "meaning", itemId: 0 }],
      activeQueue: [{ type: "meaning", itemId: 0 }],
      currentQuestion: { type: "meaning", itemId: 0 },
    });

    const result = revalidatePersistedLessonState(state, {
      availableAssignmentIds: new Set<number>(),
    });

    expect(result.state).toBeNull();
    expect(result.removedCount).toBe(2);
  });

  it("flips isFinalBatchComplete when remaining batches vanish on the completion screen", () => {
    const completedItems = [
      makeItem(0, { submitted: true, meaningDone: true, readingDone: true }),
    ];
    const futureItems = [makeItem(1), makeItem(2)];
    const state = makeState(
      [
        { items: completedItems, completed: true },
        { items: futureItems, completed: false },
      ],
      {
        mode: "batch_complete",
        isFinalBatchComplete: false,
        completedBatchStats: {
          batchNumber: 1,
          itemCount: 1,
          typeCounts: { radical: 0, kanji: 1, vocabulary: 0 },
        },
      }
    );

    const result = revalidatePersistedLessonState(state, {
      availableAssignmentIds: new Set<number>(),
    });

    expect(result.removedCount).toBe(2);
    const newState = result.state!;
    expect(newState.mode).toBe("batch_complete");
    expect(newState.isFinalBatchComplete).toBe(true);
    expect(newState.lessonBatches).toHaveLength(1);
    expect(newState.progress).toEqual({
      totalItems: 1,
      completedItems: 1,
      currentBatch: 1,
      totalBatches: 1,
    });
  });
});
