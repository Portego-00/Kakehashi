import type { Assignment, Subject } from "@/types/wanikani";
import type { WebStudyPreferences } from "@/features/settings/settings";

const TYPE_ORDER: Record<Assignment["data"]["subject_type"], number> = { radical: 0, kanji: 1, vocabulary: 2, kana_vocabulary: 3 };

export function orderCoreAssignments(assignments: Assignment[], subjects: Subject[], mode: "lessons" | "reviews", settings: WebStudyPreferences) {
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const ordered = [...assignments];
  if (mode === "lessons") {
    if (settings.lessonOrder === "subject-type") ordered.sort((a, b) => TYPE_ORDER[a.data.subject_type] - TYPE_ORDER[b.data.subject_type] || a.id - b.id);
    if (settings.lessonOrder === "level") ordered.sort((a, b) => (subjectById.get(a.data.subject_id)?.data.level || 0) - (subjectById.get(b.data.subject_id)?.data.level || 0) || a.id - b.id);
    if (settings.lessonOrder === "available") ordered.sort((a, b) => String(a.data.unlocked_at).localeCompare(String(b.data.unlocked_at)) || a.id - b.id);
  } else {
    if (settings.reviewOrder === "available") ordered.sort((a, b) => String(a.data.available_at).localeCompare(String(b.data.available_at)) || a.id - b.id);
    if (settings.reviewOrder === "srs") ordered.sort((a, b) => a.data.srs_stage - b.data.srs_stage || a.id - b.id);
    if (settings.reviewOrder === "subject-type") ordered.sort((a, b) => TYPE_ORDER[a.data.subject_type] - TYPE_ORDER[b.data.subject_type] || a.id - b.id);
    if (settings.reviewOrder === "random") shuffle(ordered);
  }
  if (settings.shuffleSubjects && !(mode === "reviews" && settings.reviewOrder === "random")) shuffle(ordered);
  return ordered;
}

export function selectCoreAssignments(assignments: Assignment[], subjects: Subject[], mode: "lessons" | "reviews", settings: WebStudyPreferences, limit: number) {
  return orderCoreAssignments(assignments, subjects, mode, settings).slice(0, limit);
}

function shuffle<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [items[index], items[next]] = [items[next], items[index]];
  }
}

const LESSON_HISTORY_PREFIX = "kakehashi-core-lessons-started";
export function lessonHistoryKey(username: string) { return `${LESSON_HISTORY_PREFIX}:${encodeURIComponent(username.toLocaleLowerCase())}`; }
export function coreSessionKey(username: string, mode: "lessons" | "reviews") { return `kakehashi-core-session:${encodeURIComponent(username.trim().toLocaleLowerCase())}:${mode}`; }
export function localDay(value = new Date()) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }

export function lessonsStartedToday(storage: Pick<Storage, "getItem">, username: string, now = new Date()) {
  try {
    const rows = JSON.parse(storage.getItem(lessonHistoryKey(username)) || "[]") as Array<{ assignmentId: number; day: string }>;
    return new Set(rows.filter((row) => row.day === localDay(now)).map((row) => row.assignmentId)).size;
  } catch { return 0; }
}

export function recordLessonStarted(storage: Pick<Storage, "getItem" | "setItem">, username: string, assignmentId: number, now = new Date()) {
  let rows: Array<{ assignmentId: number; day: string }> = [];
  try { rows = JSON.parse(storage.getItem(lessonHistoryKey(username)) || "[]"); } catch { /* Start a clean local history. */ }
  const day = localDay(now);
  const next = [...rows.filter((row) => row.day === day && row.assignmentId !== assignmentId), { assignmentId, day }];
  storage.setItem(lessonHistoryKey(username), JSON.stringify(next));
}
