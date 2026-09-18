export const LESSON_SESSION_MAX_AGE = 60 * 60_000;
export function pickedLessonsKey(username: string) { return `kakehashi:core-study:${username}:picked-lessons`; }

export function loadPickedLessons(storage: Pick<Storage, "getItem">, username: string): number[] | null {
  try {
    const raw = storage.getItem(pickedLessonsKey(username));
    if (!raw) return null;
    const { subjectIds, savedAt } = JSON.parse(raw);
    if (!Array.isArray(subjectIds) || !subjectIds.length || !subjectIds.every((id) => Number.isInteger(id) && id > 0) || !Number.isFinite(savedAt) || Date.now() - savedAt > LESSON_SESSION_MAX_AGE || savedAt > Date.now()) return null;
    return [...new Set<number>(subjectIds)];
  } catch { return null; }
}

export function savePickedLessons(storage: Pick<Storage, "setItem" | "removeItem">, username: string, subjectIds: number[]) {
  try {
    if (subjectIds.length) storage.setItem(pickedLessonsKey(username), JSON.stringify({ subjectIds, savedAt: Date.now() }));
    else storage.removeItem(pickedLessonsKey(username));
  } catch { /* Keep the selection usable in memory when storage is unavailable. */ }
}

export function pickedLessonBatch(subjectIds: number[], availableIds: number[], batchSize: number, dailyRemaining: number) {
  const available = new Set(availableIds);
  return [...new Set(subjectIds)].filter((id) => available.has(id)).slice(0, Math.max(0, Math.min(batchSize, dailyRemaining)));
}
