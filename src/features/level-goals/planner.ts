/** A what-if plan. Session size never changes the SRS schedule. */
export type StudyPlan = {
  daysPerLevel: number;
  dailyLessons: number;
  reviewBatch: number;
};
export type PlannerSubject = {
  id: number;
  object?: string;
  data: { level?: number; hidden_at?: string | null };
};
export type PlannerAssignment = {
  data_updated_at?: string;
  data: {
    subject_id: number;
    subject_type?: string;
    srs_stage: number;
    available_at?: string | null;
    started_at?: string | null;
    hidden?: boolean;
  };
};
export type PlanDay = {
  date: string;
  existing: number;
  lessons: number;
  known: number;
  total: number;
};
const HOUR = 3_600_000;
// https://knowledge.wanikani.com/wanikani/srs-stages/ (wait after entering each stage)
const NORMAL = [0, 4, 8, 24, 48, 168, 336, 720, 2880];
const FAST = [0, 2, 4, 8, 24, 168, 336, 720, 2880];
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));
export function isStudyPlan(value: unknown): value is StudyPlan {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<StudyPlan>;
  return (
    Number.isInteger(p.daysPerLevel) &&
    p.daysPerLevel! >= 3 &&
    p.daysPerLevel! <= 365 &&
    Number.isInteger(p.dailyLessons) &&
    p.dailyLessons! >= 1 &&
    p.dailyLessons! <= 50 &&
    Number.isInteger(p.reviewBatch) &&
    p.reviewBatch! >= 5 &&
    p.reviewBatch! <= 100 &&
    p.reviewBatch! % 5 === 0
  );
}
/** Count the current level and up to two following levels from the real catalog. */
export function subjectsPerLevel(
  subjects: readonly PlannerSubject[],
  currentLevel: number,
): number | null {
  const unique = new Map(subjects.map((subject) => [subject.id, subject]));
  const counts = new Map<number, number>();
  for (const subject of unique.values()) {
    const level = subject.data.level;
    if (
      !level ||
      level < currentLevel ||
      level > Math.min(60, currentLevel + 2) ||
      subject.data.hidden_at ||
      !["radical", "kanji", "vocabulary", "kana_vocabulary"].includes(
        subject.object ?? "",
      )
    )
      continue;
    counts.set(level, (counts.get(level) ?? 0) + 1);
  }
  return counts.size
    ? Math.round([...counts.values()].reduce((a, b) => a + b, 0) / counts.size)
    : null;
}
export function planForPace(
  plan: StudyPlan,
  days: number,
  count: number | null,
): StudyPlan {
  const daysPerLevel = clamp(days, 3, 365);
  return {
    ...plan,
    daysPerLevel,
    dailyLessons: count
      ? clamp(Math.ceil(count / daysPerLevel), 1, 50)
      : plan.dailyLessons,
  };
}
export function planForLessons(
  plan: StudyPlan,
  lessons: number,
  count: number | null,
): StudyPlan {
  const dailyLessons = clamp(lessons, 1, 50);
  return {
    ...plan,
    dailyLessons,
    daysPerLevel: count
      ? clamp(Math.ceil(count / dailyLessons), 3, 365)
      : plan.daysPerLevel,
  };
}
/** Model repeat reviews with correct, on-time answers and new lessons available daily.
 * Calendar boundaries preserve local days across DST; existing inputs are never mutated.
 */
export function projectStudyWorkload(
  assignments: readonly PlannerAssignment[],
  subjects: readonly PlannerSubject[],
  plan: StudyPlan,
  currentLevel: number,
  now: Date,
  paused = false,
): PlanDay[] {
  const dates = Array.from(
    { length: 15 },
    (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i),
  );
  const days = dates
    .slice(0, 14)
    .map((date) => ({
      date: dateKey(date),
      existing: 0,
      lessons: 0,
      known: 0,
      total: 0,
    }));
  if (paused || !isStudyPlan(plan) || !Number.isFinite(now.getTime()))
    return days;
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  const unique = new Map<number, PlannerAssignment>();
  for (const assignment of assignments) {
    const previous = unique.get(assignment.data.subject_id);
    if (
      !previous ||
      !(
        Date.parse(previous.data_updated_at ?? "") >
        Date.parse(assignment.data_updated_at ?? "")
      )
    )
      unique.set(assignment.data.subject_id, assignment);
  }
  const add = (
    time: number,
    count: number,
    field: "existing" | "lessons",
    known = false,
  ) => {
    const index = dates.findIndex(
      (date, i) =>
        i < 14 && time >= date.getTime() && time < dates[i + 1].getTime(),
    );
    if (index < 0) return;
    days[index][field] += count;
    days[index].total += count;
    if (known) days[index].known += count;
  };
  const simulate = (
    start: number,
    stage: number,
    count: number,
    field: "existing" | "lessons",
    intervals: number[],
  ) => {
    let time = start;
    for (let s = stage; s <= 8 && time < dates[14].getTime(); s++) {
      add(time, count, field, field === "existing" && s === stage);
      time = Math.floor(time / HOUR) * HOUR + (intervals[s + 1] ?? 0) * HOUR;
    }
  };
  let startedToday = 0;
  for (const { data } of unique.values()) {
    const subject = byId.get(data.subject_id);
    if (data.hidden || subject?.data.hidden_at) continue;
    const started = Date.parse(data.started_at ?? "");
    if (started >= dates[0].getTime() && started <= now.getTime())
      startedToday++;
    const due = Date.parse(data.available_at ?? "");
    if (
      !data.started_at ||
      !Number.isInteger(data.srs_stage) ||
      data.srs_stage < 1 ||
      data.srs_stage > 8 ||
      !Number.isFinite(due)
    )
      continue;
    const intervals =
      subject?.data.level && subject.data.level <= 2 ? FAST : NORMAL;
    simulate(
      Math.max(now.getTime(), due),
      data.srs_stage,
      1,
      "existing",
      intervals,
    );
  }
  const intervals = currentLevel <= 2 ? FAST : NORMAL;
  for (let i = 0; i < 14; i++) {
    const count =
      i === 0
        ? Math.max(0, plan.dailyLessons - startedToday)
        : plan.dailyLessons;
    const cohort = new Date(dates[i]);
    cohort.setHours(now.getHours(), now.getMinutes(), 0, 0);
    const start = cohort.getTime();
    simulate(
      Math.floor(start / HOUR) * HOUR + intervals[1] * HOUR,
      1,
      count,
      "lessons",
      intervals,
    );
  }
  return days;
}
