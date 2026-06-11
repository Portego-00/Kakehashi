import type {
  PersistedLessonBatch,
  PersistedLessonItem,
  PersistedLessonQuestion,
  PersistedLessonSessionState,
  PersistedLessonTypeCounts,
} from "./lessonSessionPersistence";

// Mirrors ACTIVE_QUEUE_SIZE in app/(app)/lessons.tsx.
const ACTIVE_QUEUE_SIZE = 10;

export interface RevalidateLessonSessionOptions {
  /** Assignment IDs WaniKani currently reports as available for lessons. */
  availableAssignmentIds: Set<number>;
  /** Assignment IDs with locally queued lesson completions awaiting sync. */
  pendingLessonAssignmentIds?: Set<number>;
}

export interface RevalidateLessonSessionResult {
  /** Cleaned state, or null when nothing in the session is left to study. */
  state: PersistedLessonSessionState | null;
  /** Lesson items dropped because they were finished outside this session. */
  removedCount: number;
}

/**
 * Drops lesson items from a persisted session that were completed elsewhere
 * (e.g. on the WaniKani website) since the session was saved. An item is kept
 * if it was completed in this session, has a completion queued for sync, or is
 * still in WaniKani's lesson queue.
 */
export function revalidatePersistedLessonState(
  state: PersistedLessonSessionState,
  options: RevalidateLessonSessionOptions
): RevalidateLessonSessionResult {
  const { availableAssignmentIds } = options;
  const pendingLessonAssignmentIds =
    options.pendingLessonAssignmentIds ?? new Set<number>();

  // The submitted flag is written to reviewItems copies during a batch quiz,
  // and the JSON round-trip breaks the object sharing with lessonBatches, so
  // merge the flag across every copy of an item before deciding its fate.
  const finishedLocallyIds = new Set<number>();
  const collectFinished = (item: PersistedLessonItem) => {
    if (item.submitted === true) {
      finishedLocallyIds.add(item.id);
    }
  };
  state.allLessons.forEach(collectFinished);
  state.lessonBatches.forEach((batch) => batch.items.forEach(collectFinished));
  state.reviewItems.forEach(collectFinished);

  const shouldKeepItem = (item: PersistedLessonItem) =>
    finishedLocallyIds.has(item.id) ||
    availableAssignmentIds.has(item.assignmentId) ||
    pendingLessonAssignmentIds.has(item.assignmentId);

  const keptItemIds = new Set<number>();
  state.allLessons.forEach((item) => {
    if (shouldKeepItem(item)) {
      keptItemIds.add(item.id);
    }
  });

  const removedCount = state.allLessons.length - keptItemIds.size;
  if (removedCount === 0) {
    return { state, removedCount: 0 };
  }

  const allLessons = state.allLessons.filter((item) =>
    keptItemIds.has(item.id)
  );
  if (allLessons.length === 0) {
    return { state: null, removedCount };
  }

  const newBatches: PersistedLessonBatch[] = [];
  let currentBatchSurvived = false;
  let currentBatchIndex = 0;
  let currentItemIndex = 0;
  let survivingBatchesBeforeCurrent = 0;

  state.lessonBatches.forEach((batch, batchIndex) => {
    const items = batch.items.filter((item) => keptItemIds.has(item.id));
    if (items.length === 0) {
      return;
    }

    if (batchIndex < state.currentBatchIndex) {
      survivingBatchesBeforeCurrent += 1;
    }

    if (batchIndex === state.currentBatchIndex) {
      currentBatchSurvived = true;
      currentBatchIndex = newBatches.length;
      const removedBeforeCurrentItem = batch.items
        .slice(0, state.currentItemIndex)
        .filter((item) => !keptItemIds.has(item.id)).length;
      currentItemIndex = Math.min(
        Math.max(state.currentItemIndex - removedBeforeCurrentItem, 0),
        items.length - 1
      );
    }

    newBatches.push({ items, completed: batch.completed });
  });

  if (newBatches.length === 0) {
    return { state: null, removedCount };
  }

  if (!currentBatchSurvived) {
    // Index of the first surviving batch after the dropped current one (may
    // equal newBatches.length when the current batch was the last).
    currentBatchIndex = survivingBatchesBeforeCurrent;
  }

  const findUncompletedBatchIndex = (fromIndex: number) => {
    for (
      let index = Math.max(fromIndex, 0);
      index < newBatches.length;
      index += 1
    ) {
      if (!newBatches[index].completed) {
        return index;
      }
    }
    return -1;
  };

  let mode = state.mode;
  let reviewItems = state.reviewItems.filter((item) =>
    keptItemIds.has(item.id)
  );
  let masterQueue = state.masterQueue.filter((question) =>
    keptItemIds.has(question.itemId)
  );
  let activeQueue = state.activeQueue.filter((question) =>
    keptItemIds.has(question.itemId)
  );
  let currentQuestion =
    state.currentQuestion && keptItemIds.has(state.currentQuestion.itemId)
      ? state.currentQuestion
      : null;
  let completedBatchStats = state.completedBatchStats;
  let isFinalBatchComplete = state.isFinalBatchComplete;

  const advanceToLessonBatch = (index: number) => {
    mode = "lesson";
    currentBatchIndex = index;
    currentItemIndex = 0;
    reviewItems = [];
    masterQueue = [];
    activeQueue = [];
    currentQuestion = null;
    completedBatchStats = null;
    isFinalBatchComplete = false;
  };

  if (mode === "review" && currentBatchSurvived) {
    const reviewItemById = new Map(reviewItems.map((item) => [item.id, item]));
    const isOutstanding = (question: PersistedLessonQuestion) => {
      const item = reviewItemById.get(question.itemId);
      if (!item) {
        return false;
      }
      return question.type === "meaning" ? !item.meaningDone : !item.readingDone;
    };

    // Rebuild the queues the same way a fresh quiz initializes them: the
    // master queue holds every outstanding question with the active window at
    // its head, which keeps the refill/completion length checks valid.
    const seenQuestions = new Set<string>();
    const outstanding: PersistedLessonQuestion[] = [];
    [...state.activeQueue, ...state.masterQueue].forEach((question) => {
      const key = `${question.itemId}:${question.type}`;
      if (seenQuestions.has(key) || !isOutstanding(question)) {
        return;
      }
      seenQuestions.add(key);
      outstanding.push(question);
    });

    if (outstanding.length === 0) {
      // Every remaining quiz item was already completed in-app; treat the
      // batch as done and move on to the next one.
      newBatches[currentBatchIndex] = {
        ...newBatches[currentBatchIndex],
        completed: true,
      };
      const nextIndex = findUncompletedBatchIndex(currentBatchIndex + 1);
      if (nextIndex === -1) {
        return { state: null, removedCount };
      }
      advanceToLessonBatch(nextIndex);
    } else {
      masterQueue = outstanding;
      activeQueue = outstanding.slice(0, ACTIVE_QUEUE_SIZE);
      currentQuestion = activeQueue[0] ?? null;
    }
  } else if (!currentBatchSurvived) {
    const nextIndex = findUncompletedBatchIndex(currentBatchIndex);
    if (nextIndex === -1) {
      return { state: null, removedCount };
    }
    advanceToLessonBatch(nextIndex);
  } else if (mode === "batch_complete") {
    isFinalBatchComplete =
      findUncompletedBatchIndex(currentBatchIndex + 1) === -1;
  }

  const completedItems = newBatches.reduce(
    (sum, batch) => (batch.completed ? sum + batch.items.length : sum),
    0
  );

  const typeCounts: PersistedLessonTypeCounts = {
    radical: 0,
    kanji: 0,
    vocabulary: 0,
  };
  newBatches.forEach((batch) => {
    if (batch.completed) {
      return;
    }
    batch.items.forEach((item) => {
      const subjectType = item.subject?.object;
      if (subjectType === "radical") {
        typeCounts.radical += 1;
      } else if (subjectType === "kanji") {
        typeCounts.kanji += 1;
      } else if (
        subjectType === "vocabulary" ||
        subjectType === "kana_vocabulary"
      ) {
        typeCounts.vocabulary += 1;
      }
    });
  });

  const totalBatches = newBatches.length;
  const currentBatchNumber =
    mode === "batch_complete"
      ? isFinalBatchComplete
        ? totalBatches
        : Math.min(currentBatchIndex + 2, totalBatches)
      : currentBatchIndex + 1;

  return {
    removedCount,
    state: {
      allLessons,
      lessonBatches: newBatches,
      currentBatchIndex,
      currentItemIndex,
      mode,
      reviewItems,
      masterQueue,
      activeQueue,
      currentQuestion,
      completedBatchStats,
      isFinalBatchComplete,
      progress: {
        totalItems: allLessons.length,
        completedItems,
        currentBatch: currentBatchNumber,
        totalBatches,
      },
      typeCounts,
      relatedSubjects: state.relatedSubjects,
    },
  };
}
