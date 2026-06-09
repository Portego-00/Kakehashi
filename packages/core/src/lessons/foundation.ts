export type LessonQueueSummary = {
  available: number;
  selected: number;
};

export function createLessonQueueSummary(
  available: number,
  selected: number
): LessonQueueSummary {
  return {
    available: Math.max(0, Math.floor(available)),
    selected: Math.max(0, Math.min(Math.floor(selected), Math.floor(available))),
  };
}
