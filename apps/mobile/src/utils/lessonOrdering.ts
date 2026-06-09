export type LessonOrderSetting =
  | "random"
  | "currentLevelFirst"
  | "lowestLevelFirst"
  | "newestUnlockedFirst"
  | "oldestUnlockedFirst"
  | "ascendingSubjectId"
  | "descendingSubjectId";

export type LessonTypeOrderSetting = "radical" | "kanji" | "vocabulary";

export interface LessonOrderOption {
  value: LessonOrderSetting;
  label: string;
  description: string;
}

export const DEFAULT_LESSON_ORDER: LessonOrderSetting = "random";
export const LESSON_TYPE_ORDER_VALUES: readonly LessonTypeOrderSetting[] = [
  "radical",
  "kanji",
  "vocabulary",
];
export const DEFAULT_LESSON_TYPE_ORDER: LessonTypeOrderSetting[] = [
  ...LESSON_TYPE_ORDER_VALUES,
];

export const LESSON_ORDER_OPTIONS: readonly LessonOrderOption[] = [
  {
    value: "random",
    label: "Random",
    description: "Shuffle lessons with no fixed ordering.",
  },
  {
    value: "currentLevelFirst",
    label: "Current level first",
    description: "Prioritize higher-level lessons before older levels.",
  },
  {
    value: "lowestLevelFirst",
    label: "Lowest level first",
    description: "Prioritize lower-level (older) lessons first.",
  },
  {
    value: "newestUnlockedFirst",
    label: "Newest unlocked first",
    description: "Show lessons that became available most recently.",
  },
  {
    value: "oldestUnlockedFirst",
    label: "Oldest unlocked first",
    description: "Show lessons that have been waiting the longest.",
  },
  {
    value: "ascendingSubjectId",
    label: "Ascending subject ID",
    description: "Follow WaniKani's canonical subject ordering.",
  },
  {
    value: "descendingSubjectId",
    label: "Descending subject ID",
    description: "Start with the most recently added subjects.",
  },
];

export function getLessonOrderLabel(order: LessonOrderSetting): string {
  return (
    LESSON_ORDER_OPTIONS.find((option) => option.value === order)?.label ??
    LESSON_ORDER_OPTIONS[0].label
  );
}

type SubjectType = "radical" | "kanji" | "vocabulary" | "kana_vocabulary";

interface OrderableLessonSubject {
  id?: number;
  object: SubjectType;
  data: {
    level?: number;
  };
}

export interface OrderableLessonItem {
  id: number;
  subjectId: number;
  subject: OrderableLessonSubject;
  availableAt?: string | null;
}

interface SortLessonItemsOptions {
  lessonOrder?: LessonOrderSetting;
  lessonTypeOrderEnabled?: boolean;
  lessonTypeOrder?: LessonTypeOrderSetting[];
  interleaveLessonTypesEnabled?: boolean;
  minimumRadicalKanjiPerBatchEnabled?: boolean;
  lessonBatchSize?: number;
  prioritizeCriticalItems?: boolean;
  userLevel?: number;
  randomFn?: () => number;
}

const SUBJECT_TYPE_FALLBACK_ORDER: Record<SubjectType, number> = {
  radical: 0,
  kanji: 1,
  vocabulary: 2,
  kana_vocabulary: 3,
};

function shuffleArray<T>(array: T[], randomFn: () => number): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function isCriticalLesson(
  item: OrderableLessonItem,
  userLevel: number
): boolean {
  if (item.subject.data.level !== userLevel) return false;
  return (
    item.subject.object === "radical" || item.subject.object === "kanji"
  );
}

function getFallbackSubjectTypeOrder(item: OrderableLessonItem): number {
  return SUBJECT_TYPE_FALLBACK_ORDER[item.subject.object] ?? 0;
}

function getTypeOrderBucket(item: OrderableLessonItem): LessonTypeOrderSetting {
  if (item.subject.object === "kana_vocabulary") {
    return "vocabulary";
  }
  return item.subject.object;
}

export function normalizeLessonTypeOrder(
  lessonTypeOrder?: LessonTypeOrderSetting[]
): LessonTypeOrderSetting[] {
  if (!lessonTypeOrder || lessonTypeOrder.length === 0) {
    return [...DEFAULT_LESSON_TYPE_ORDER];
  }

  const seen = new Set<LessonTypeOrderSetting>();
  const normalized: LessonTypeOrderSetting[] = [];

  lessonTypeOrder.forEach((value) => {
    if (!LESSON_TYPE_ORDER_VALUES.includes(value) || seen.has(value)) {
      return;
    }
    seen.add(value);
    normalized.push(value);
  });

  LESSON_TYPE_ORDER_VALUES.forEach((value) => {
    if (!seen.has(value)) {
      normalized.push(value);
    }
  });

  return normalized;
}

function parseDateToMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareDateAscending(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  const leftTime = parseDateToMs(left);
  const rightTime = parseDateToMs(right);

  if (leftTime === null && rightTime === null) return 0;
  if (leftTime === null) return 1;
  if (rightTime === null) return -1;
  return leftTime - rightTime;
}

function compareDateDescending(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  return compareDateAscending(right, left);
}

function compareByLessonOrder(
  left: OrderableLessonItem,
  right: OrderableLessonItem,
  lessonOrder: LessonOrderSetting
): number {
  switch (lessonOrder) {
    case "random":
      return 0;
    case "currentLevelFirst":
      return (right.subject.data.level ?? 0) - (left.subject.data.level ?? 0);
    case "lowestLevelFirst":
      return (left.subject.data.level ?? 0) - (right.subject.data.level ?? 0);
    case "newestUnlockedFirst":
      return compareDateDescending(left.availableAt, right.availableAt);
    case "oldestUnlockedFirst":
      return compareDateAscending(left.availableAt, right.availableAt);
    case "ascendingSubjectId":
      return (left.subjectId ?? 0) - (right.subjectId ?? 0);
    case "descendingSubjectId":
      return (right.subjectId ?? 0) - (left.subjectId ?? 0);
    default:
      return 0;
  }
}

function compareByConfiguredOrder(
  left: OrderableLessonItem,
  right: OrderableLessonItem,
  options: {
    lessonOrder: LessonOrderSetting;
    prioritizeCriticalItems: boolean;
    userLevel: number;
    shuffledIndex: Map<number, number>;
    includeSubjectTypeFallback: boolean;
  }
): number {
  const {
    lessonOrder,
    prioritizeCriticalItems,
    userLevel,
    shuffledIndex,
    includeSubjectTypeFallback,
  } = options;

  if (prioritizeCriticalItems) {
    const leftIsCritical = isCriticalLesson(left, userLevel);
    const rightIsCritical = isCriticalLesson(right, userLevel);
    if (leftIsCritical && !rightIsCritical) return -1;
    if (!leftIsCritical && rightIsCritical) return 1;
  }

  const lessonOrderComparison = compareByLessonOrder(left, right, lessonOrder);
  if (lessonOrderComparison !== 0) return lessonOrderComparison;

  if (includeSubjectTypeFallback) {
    const subjectTypeComparison =
      getFallbackSubjectTypeOrder(left) - getFallbackSubjectTypeOrder(right);
    if (subjectTypeComparison !== 0) return subjectTypeComparison;
  }

  return (shuffledIndex.get(left.id) ?? 0) - (shuffledIndex.get(right.id) ?? 0);
}

function interleaveItemsBySubjectType<T extends OrderableLessonItem>(
  sortedItems: T[],
  lessonTypeOrder: LessonTypeOrderSetting[]
): T[] {
  if (sortedItems.length <= 1) {
    return [...sortedItems];
  }

  const buckets = new Map<LessonTypeOrderSetting, T[]>();
  const totalByType = new Map<LessonTypeOrderSetting, number>();
  const consumedByType = new Map<LessonTypeOrderSetting, number>();

  lessonTypeOrder.forEach((type) => {
    buckets.set(type, []);
    totalByType.set(type, 0);
    consumedByType.set(type, 0);
  });

  sortedItems.forEach((item) => {
    const bucket = getTypeOrderBucket(item);
    const targetBucket = buckets.get(bucket);
    if (!targetBucket) {
      return;
    }

    targetBucket.push(item);
    totalByType.set(bucket, (totalByType.get(bucket) ?? 0) + 1);
  });

  const totalItems = sortedItems.length;
  const interleaved: T[] = [];
  const epsilon = 1e-9;
  const typePriority = new Map<LessonTypeOrderSetting, number>();
  lessonTypeOrder.forEach((type, index) => {
    typePriority.set(type, index);
  });

  while (interleaved.length < totalItems) {
    const nextPosition = interleaved.length + 1;
    let selectedType: LessonTypeOrderSetting | null = null;
    let selectedDeficit = Number.NEGATIVE_INFINITY;

    lessonTypeOrder.forEach((type) => {
      const queue = buckets.get(type);
      if (!queue || queue.length === 0) {
        return;
      }

      const typeTotal = totalByType.get(type) ?? 0;
      if (typeTotal <= 0) {
        return;
      }

      const consumed = consumedByType.get(type) ?? 0;
      const expected = (nextPosition * typeTotal) / totalItems;
      const deficit = expected - consumed;

      if (deficit > selectedDeficit + epsilon) {
        selectedType = type;
        selectedDeficit = deficit;
        return;
      }

      if (
        selectedType &&
        Math.abs(deficit - selectedDeficit) <= epsilon &&
        (typePriority.get(type) ?? Number.POSITIVE_INFINITY) <
          (typePriority.get(selectedType) ?? Number.POSITIVE_INFINITY)
      ) {
        selectedType = type;
      }
    });

    if (!selectedType) {
      break;
    }

    const selectedQueue = buckets.get(selectedType);
    if (!selectedQueue || selectedQueue.length === 0) {
      break;
    }

    const nextItem = selectedQueue.shift();
    if (!nextItem) {
      break;
    }

    consumedByType.set(
      selectedType,
      (consumedByType.get(selectedType) ?? 0) + 1
    );
    interleaved.push(nextItem);
  }

  if (interleaved.length !== totalItems) {
    const remainder: T[] = [];
    lessonTypeOrder.forEach((type) => {
      const queue = buckets.get(type);
      if (!queue || queue.length === 0) {
        return;
      }
      remainder.push(...queue);
    });

    if (remainder.length > 0) {
      interleaved.push(...remainder);
    }
  }

  return interleaved;
}

function countBatchMinimumTypes<T extends OrderableLessonItem>(
  batch: T[],
  minimumTypes: LessonTypeOrderSetting[]
): Map<LessonTypeOrderSetting, number> {
  const counts = new Map<LessonTypeOrderSetting, number>();
  minimumTypes.forEach((type) => counts.set(type, 0));

  batch.forEach((item) => {
    const bucket = getTypeOrderBucket(item);
    if (counts.has(bucket)) {
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
  });

  return counts;
}

function findBatchMinimumReplacementIndex<T extends OrderableLessonItem>(
  batch: T[],
  minimumTypes: LessonTypeOrderSetting[]
): number {
  const minimumTypeSet = new Set(minimumTypes);

  for (let index = batch.length - 1; index >= 0; index -= 1) {
    if (!minimumTypeSet.has(getTypeOrderBucket(batch[index]))) {
      return index;
    }
  }

  const counts = countBatchMinimumTypes(batch, minimumTypes);
  for (let index = batch.length - 1; index >= 0; index -= 1) {
    const bucket = getTypeOrderBucket(batch[index]);
    if ((counts.get(bucket) ?? 0) > 1) {
      return index;
    }
  }

  return batch.length - 1;
}

function ensureMinimumTypesPerBatch<T extends OrderableLessonItem>(
  sortedItems: T[],
  batchSize: number,
  minimumTypes: LessonTypeOrderSetting[]
): T[] {
  const normalizedBatchSize = Math.floor(batchSize);
  if (
    sortedItems.length <= 1 ||
    normalizedBatchSize < minimumTypes.length ||
    minimumTypes.length === 0
  ) {
    return [...sortedItems];
  }

  const remaining = [...sortedItems];
  const arranged: T[] = [];

  while (remaining.length > 0) {
    const batch = remaining.splice(0, normalizedBatchSize);

    minimumTypes.forEach((minimumType) => {
      const hasMinimumType = batch.some(
        (item) => getTypeOrderBucket(item) === minimumType
      );
      if (hasMinimumType) {
        return;
      }

      const replacementSourceIndex = remaining.findIndex(
        (item) => getTypeOrderBucket(item) === minimumType
      );
      if (replacementSourceIndex === -1) {
        return;
      }

      const [minimumItem] = remaining.splice(replacementSourceIndex, 1);
      if (!minimumItem) {
        return;
      }

      if (batch.length < normalizedBatchSize) {
        batch.push(minimumItem);
        return;
      }

      const replacementIndex = findBatchMinimumReplacementIndex(
        batch,
        minimumTypes
      );
      const [displacedItem] = batch.splice(replacementIndex, 1, minimumItem);
      if (displacedItem) {
        remaining.unshift(displacedItem);
      }
    });

    arranged.push(...batch);
  }

  return arranged;
}

export function sortLessonItemsForQueue<T extends OrderableLessonItem>(
  items: T[],
  options: SortLessonItemsOptions = {}
): T[] {
  const {
    lessonOrder = DEFAULT_LESSON_ORDER,
    lessonTypeOrderEnabled = false,
    lessonTypeOrder = DEFAULT_LESSON_TYPE_ORDER,
    interleaveLessonTypesEnabled = false,
    minimumRadicalKanjiPerBatchEnabled = false,
    lessonBatchSize = 0,
    prioritizeCriticalItems = false,
    userLevel = 1,
    randomFn = Math.random,
  } = options;

  const normalizedTypeOrder = normalizeLessonTypeOrder(lessonTypeOrder);
  const typeOrderMap = new Map<LessonTypeOrderSetting, number>();
  normalizedTypeOrder.forEach((subjectType, index) => {
    typeOrderMap.set(subjectType, index);
  });

  const shuffledItems = shuffleArray(items, randomFn);
  const shuffledIndex = new Map<number, number>();
  shuffledItems.forEach((item, index) => {
    shuffledIndex.set(item.id, index);
  });

  let sortedItems: T[];

  if (interleaveLessonTypesEnabled && !lessonTypeOrderEnabled) {
    const baseSorted = [...shuffledItems].sort((left, right) =>
      compareByConfiguredOrder(left, right, {
        lessonOrder,
        prioritizeCriticalItems,
        userLevel,
        shuffledIndex,
        includeSubjectTypeFallback: false,
      })
    );

    if (!prioritizeCriticalItems) {
      sortedItems = interleaveItemsBySubjectType(
        baseSorted,
        normalizedTypeOrder
      );
    } else {
      const criticalItems: T[] = [];
      const nonCriticalItems: T[] = [];

      baseSorted.forEach((item) => {
        if (isCriticalLesson(item, userLevel)) {
          criticalItems.push(item);
          return;
        }
        nonCriticalItems.push(item);
      });

      sortedItems = [
        ...interleaveItemsBySubjectType(criticalItems, normalizedTypeOrder),
        ...interleaveItemsBySubjectType(nonCriticalItems, normalizedTypeOrder),
      ];
    }
  } else {
    sortedItems = [...shuffledItems].sort((left, right) => {
      if (prioritizeCriticalItems) {
        const leftIsCritical = isCriticalLesson(left, userLevel);
        const rightIsCritical = isCriticalLesson(right, userLevel);
        if (leftIsCritical && !rightIsCritical) return -1;
        if (!leftIsCritical && rightIsCritical) return 1;
      }

      if (lessonOrder === "random" && !lessonTypeOrderEnabled) {
        return (
          (shuffledIndex.get(left.id) ?? 0) - (shuffledIndex.get(right.id) ?? 0)
        );
      }

      if (lessonTypeOrderEnabled) {
        const leftTypeOrder = typeOrderMap.get(getTypeOrderBucket(left)) ?? 0;
        const rightTypeOrder = typeOrderMap.get(getTypeOrderBucket(right)) ?? 0;
        const typeOrderComparison = leftTypeOrder - rightTypeOrder;

        if (lessonOrder === "random") {
          if (typeOrderComparison !== 0) return typeOrderComparison;
          return (
            (shuffledIndex.get(left.id) ?? 0) -
            (shuffledIndex.get(right.id) ?? 0)
          );
        }

        if (typeOrderComparison !== 0) return typeOrderComparison;

        const lessonOrderComparison = compareByLessonOrder(
          left,
          right,
          lessonOrder
        );
        if (lessonOrderComparison !== 0) return lessonOrderComparison;

        return (
          (shuffledIndex.get(left.id) ?? 0) -
          (shuffledIndex.get(right.id) ?? 0)
        );
      }
      return compareByConfiguredOrder(left, right, {
        lessonOrder,
        prioritizeCriticalItems,
        userLevel,
        shuffledIndex,
        includeSubjectTypeFallback: true,
      });
    });
  }

  if (minimumRadicalKanjiPerBatchEnabled) {
    return ensureMinimumTypesPerBatch(sortedItems, lessonBatchSize, [
      "radical",
      "kanji",
    ]);
  }

  return sortedItems;
}
