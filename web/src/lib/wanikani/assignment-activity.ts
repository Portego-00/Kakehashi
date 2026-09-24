import type { Assignment } from "@/types/wanikani";

export type ActivityDay = { date: Date; key: string; count: number };

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function assignmentActivityDays(assignments: Assignment[], dayCount: number | "all" = 98, now = new Date()): ActivityDay[] {
  // Generic assignment updates include vacation rescheduling. Only these
  // milestones establish study activity; they are not a complete review log.
  const milestones = assignments.flatMap((assignment) => {
    if (!assignment.data.started_at || assignment.data.hidden) return [];
    return [assignment.data.started_at, assignment.data.passed_at, assignment.data.burned_at]
      .flatMap((value) => {
        if (!value) return [];
        const date = new Date(value);
        return Number.isFinite(date.getTime()) && date <= now ? [{ assignmentId: assignment.id, date }] : [];
      });
  });

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (dayCount === "all") {
    let earliest: Date | null = null;
    for (const { date } of milestones) {
      if (!earliest || date < earliest) earliest = date;
    }
    if (earliest) start.setFullYear(earliest.getFullYear(), 0, 1);
    else start.setDate(start.getDate() - 364);
  } else {
    start.setDate(start.getDate() - Math.max(0, dayCount - 1));
  }

  const resolvedDayCount = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86_400_000) + 1;
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const { assignmentId, date } of milestones) {
    if (date < start) continue;
    const key = localDateKey(date);
    const uniqueKey = `${assignmentId}:${key}`;
    if (seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from({ length: resolvedDayCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = localDateKey(date);
    return { date, key, count: counts.get(key) ?? 0 };
  });
}
