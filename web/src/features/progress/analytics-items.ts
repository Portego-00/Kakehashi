import type { Assignment, Subject } from "@/types/wanikani";
import { searchSubjects, type SubjectSearchFilters } from "@/features/subjects/search";
import { toHiragana } from "wanakana";

export type AnalyticsItemFilters = SubjectSearchFilters & {
  substage: number | null;
  due: "all" | "now" | "today";
  reading: string;
  sort: "level" | "stage";
};

export function filterAnalyticsItems(subjects: Subject[], assignments: Assignment[], filters: AnalyticsItemFilters, now: Date) {
  const hidden = new Set(assignments.filter((assignment) => assignment.data.hidden).map((assignment) => assignment.data.subject_id));
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
  const reading = toHiragana(filters.reading.trim());
  return searchSubjects(subjects, assignments.filter((assignment) => !assignment.data.hidden), filters).filter(({ subject, assignment }) => {
    if (hidden.has(subject.id) || (filters.substage !== null && (assignment?.data.srs_stage ?? 0) !== filters.substage)) return false;
    if (reading && !subject.data.readings?.some((entry) => entry.reading.includes(reading))) return false;
    if (filters.due !== "all") {
      const stage = assignment?.data.srs_stage ?? 0;
      if (stage < 1 || stage >= 9 || !assignment?.data.available_at) return false;
      const due = Date.parse(assignment.data.available_at);
      if (!Number.isFinite(due) || due > (filters.due === "today" ? endOfDay.getTime() : now.getTime())) return false;
    }
    return true;
  }).sort((a, b) => filters.sort === "stage" ? (a.assignment?.data.srs_stage ?? 0) - (b.assignment?.data.srs_stage ?? 0) || a.subject.data.level - b.subject.data.level || a.subject.id - b.subject.id : a.subject.data.level - b.subject.data.level || b.score - a.score || a.subject.id - b.subject.id);
}
