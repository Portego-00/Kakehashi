export type LessonFrequencyFilter =
  | "all"
  | "top-1000"
  | "top-2500"
  | "top-5000"
  | "top-10000"
  | "over-10000";

export const LESSON_FREQUENCY_FILTER_OPTIONS: readonly {
  id: LessonFrequencyFilter;
  label: string;
}[] = [
  { id: "all", label: "Any" },
  { id: "top-1000", label: "Top 1,000" },
  { id: "top-2500", label: "Top 2,500" },
  { id: "top-5000", label: "Top 5,000" },
  { id: "top-10000", label: "Top 10,000" },
  { id: "over-10000", label: "10,001+" },
];

interface FrequencyFilterableLesson {
  subjectId: number;
  subject: {
    object: string;
  };
}

export function getLessonFrequencyFilterLabel(
  filter: LessonFrequencyFilter,
): string {
  return (
    LESSON_FREQUENCY_FILTER_OPTIONS.find((option) => option.id === filter)
      ?.label ?? "Any"
  );
}

export function matchesLessonFrequencyFilter(
  frequencyRank: number,
  filter: LessonFrequencyFilter,
): boolean {
  if (!Number.isFinite(frequencyRank) || frequencyRank <= 0) {
    return false;
  }

  switch (filter) {
    case "all":
      return true;
    case "top-1000":
      return frequencyRank <= 1_000;
    case "top-2500":
      return frequencyRank <= 2_500;
    case "top-5000":
      return frequencyRank <= 5_000;
    case "top-10000":
      return frequencyRank <= 10_000;
    case "over-10000":
      return frequencyRank > 10_000;
  }
}

export function filterLessonsByFrequency<T extends FrequencyFilterableLesson>(
  lessons: readonly T[],
  frequencyRanks: ReadonlyMap<number, number | null>,
  filter: LessonFrequencyFilter,
): T[] {
  if (filter === "all") {
    return [...lessons];
  }

  return lessons.filter((lesson) => {
    if (
      lesson.subject.object !== "vocabulary" &&
      lesson.subject.object !== "kana_vocabulary"
    ) {
      return false;
    }

    const rank = frequencyRanks.get(lesson.subjectId);
    return typeof rank === "number" && matchesLessonFrequencyFilter(rank, filter);
  });
}
