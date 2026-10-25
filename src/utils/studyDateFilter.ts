export type StudyDateField = "started_at" | "unlocked_at";
export type StudyDatePeriod = "today" | "yesterday" | "7d" | "30d" | "custom";

export interface StudyDateFilter {
  field: StudyDateField;
  period: StudyDatePeriod;
  from: string;
  to: string;
}

export const STUDY_DATE_PERIODS: { value: StudyDatePeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];

export function localStudyDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseStudyDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return localStudyDate(date) === value ? date : null;
}

export function createStudyDateFilter(field: StudyDateField, now = new Date()): StudyDateFilter {
  const from = new Date(now);
  from.setDate(from.getDate() - 6);
  return { field, period: "7d", from: localStudyDate(from), to: localStudyDate(now) };
}

export function sanitizeStudyDateFilter(value: unknown): StudyDateFilter | null {
  if (!value || typeof value !== "object") return null;
  const filter = value as Partial<StudyDateFilter>;
  if (filter.field !== "started_at" && filter.field !== "unlocked_at") return null;
  if (!STUDY_DATE_PERIODS.some(({ value }) => value === filter.period)) return null;
  if (typeof filter.from !== "string" || typeof filter.to !== "string" || !parseStudyDate(filter.from) || !parseStudyDate(filter.to) || filter.from > filter.to) return null;
  return { field: filter.field, period: filter.period!, from: filter.from, to: filter.to };
}

export function studyDateBounds(filter: StudyDateFilter, now = new Date()): { from: Date; to: Date } {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  if (filter.period === "custom") {
    const customFrom = parseStudyDate(filter.from);
    const customTo = parseStudyDate(filter.to);
    if (!customFrom || !customTo || customFrom > customTo) return { from: new Date(NaN), to: new Date(NaN) };
    customTo.setDate(customTo.getDate() + 1);
    return { from: customFrom, to: customTo };
  }
  if (filter.period === "yesterday") {
    from.setDate(from.getDate() - 1);
    to.setDate(to.getDate() - 1);
  } else if (filter.period === "7d" || filter.period === "30d") {
    from.setDate(from.getDate() - (filter.period === "7d" ? 6 : 29));
  }
  return { from, to };
}

/** Resolve saved relative periods into the dates shown by the range pickers. */
export function studyDateRange(filter: StudyDateFilter, now = new Date()): StudyDateFilter {
  if (filter.period === "custom") return filter;
  const { from, to } = studyDateBounds(filter, now);
  to.setDate(to.getDate() - 1);
  return { ...filter, period: "custom", from: localStudyDate(from), to: localStudyDate(to) };
}

export function matchesStudyDate(
  assignment: { data: { started_at?: string | null; unlocked_at?: string | null; hidden?: boolean } } | undefined,
  filter: StudyDateFilter | null | undefined,
  now = new Date(),
): boolean {
  if (!filter) return true;
  if (!assignment || assignment.data.hidden) return false;
  const timestamp = assignment.data[filter.field];
  if (!timestamp) return false;
  const date = new Date(timestamp);
  const { from, to } = studyDateBounds(filter, now);
  return date >= from && date < to && date <= now;
}
