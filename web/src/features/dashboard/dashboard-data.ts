import type { Assignment, LevelProgression, ReviewStatistic, Subject, WKSummary } from "@/types/wanikani";

export function isReviewAvailable(assignment: Assignment, now = new Date(), currentVacationStartedAt?: string | null) {
  if (currentVacationStartedAt) return false;
  const data = assignment.data;
  return Boolean(data.started_at && !data.hidden && data.srs_stage > 0 && data.srs_stage < 9 && data.available_at && new Date(data.available_at) <= now);
}

export function isLessonAvailable(assignment: Assignment, currentVacationStartedAt?: string | null) {
  if (currentVacationStartedAt) return false;
  const data = assignment.data;
  return Boolean(data.unlocked_at && !data.started_at && !data.hidden && data.srs_stage === 0);
}

export function srsBuckets(assignments: Assignment[]) {
  const buckets = { apprentice: 0, guru: 0, master: 0, enlightened: 0, burned: 0 };
  assignments.forEach(({ data }) => {
    if (data.hidden || !data.started_at) return;
    if (data.srs_stage <= 4) buckets.apprentice += 1;
    else if (data.srs_stage <= 6) buckets.guru += 1;
    else if (data.srs_stage === 7) buckets.master += 1;
    else if (data.srs_stage === 8) buckets.enlightened += 1;
    else buckets.burned += 1;
  });
  return buckets;
}

const SRS_STAGE_LABELS = [
  ["Apprentice I", "I"],
  ["Apprentice II", "II"],
  ["Apprentice III", "III"],
  ["Apprentice IV", "IV"],
  ["Guru I", "V"],
  ["Guru II", "VI"],
  ["Master", "VII"],
  ["Enlightened", "VIII"],
  ["Burned", "IX"],
] as const;

export type SrsStageSpreadRow = {
  stage: number;
  label: string;
  roman: string;
  radical: number;
  kanji: number;
  vocabulary: number;
  total: number;
};

export function srsStageSpread(assignments: Assignment[]): SrsStageSpreadRow[] {
  const rows = SRS_STAGE_LABELS.map(([label, roman], index) => ({ stage: index + 1, label, roman, radical: 0, kanji: 0, vocabulary: 0, total: 0 }));
  assignments.forEach(({ data }) => {
    if (data.hidden || !data.started_at || data.srs_stage < 1 || data.srs_stage > 9) return;
    const row = rows[data.srs_stage - 1];
    const type = data.subject_type === "kana_vocabulary" ? "vocabulary" : data.subject_type;
    if (type !== "radical" && type !== "kanji" && type !== "vocabulary") return;
    row[type] += 1;
    row.total += 1;
  });
  return rows;
}

export function levelProgress(subjects: Subject[], assignments: Assignment[]) {
  const assignmentBySubject = new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment]));
  const counts = { radical: { passed: 0, total: 0 }, kanji: { passed: 0, total: 0 }, vocabulary: { passed: 0, total: 0 } };
  subjects.forEach((subject) => {
    const type = subject.object === "kana_vocabulary" ? "vocabulary" : subject.object;
    if (!(type in counts)) return;
    counts[type as keyof typeof counts].total += 1;
    if ((assignmentBySubject.get(subject.id)?.data.srs_stage || 0) >= 5) counts[type as keyof typeof counts].passed += 1;
  });
  return counts;
}

export type LevelWidgetSubject = {
  id: number;
  characters: string;
  meaning: string;
  type: "radical" | "kanji";
  stage: number;
};

export function levelWidgetSubjects(subjects: Subject[], assignments: Assignment[]): LevelWidgetSubject[] {
  const assignmentBySubject = new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment]));
  return subjects.flatMap((subject) => {
    if (subject.data.hidden_at || (subject.object !== "radical" && subject.object !== "kanji")) return [];
    const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.meanings[0]?.meaning ?? subject.data.slug;
    return [{
      id: subject.id,
      characters: subject.data.characters ?? meaning.slice(0, 2),
      meaning,
      type: subject.object,
      stage: assignmentBySubject.get(subject.id)?.data.srs_stage ?? 0,
    } satisfies LevelWidgetSubject];
  }).sort((left, right) => right.stage - left.stage || left.id - right.id);
}

export function forecastRows(summary?: WKSummary, now = new Date()) {
  const hours = Array.from({ length: 12 }, (_, index) => {
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + index);
    return { start, count: 0 };
  });
  summary?.data.reviews.forEach((row) => {
    const time = new Date(row.available_at);
    const index = Math.floor((time.getTime() - hours[0].start.getTime()) / 3_600_000);
    if (index >= 0 && index < hours.length) hours[index].count += row.subject_ids.length;
  });
  return hours;
}

export function accuracy(statistics: ReviewStatistic[]) {
  let correct = 0;
  let total = 0;
  statistics.forEach(({ data }) => {
    correct += data.meaning_correct + data.reading_correct;
    total += data.meaning_correct + data.meaning_incorrect + data.reading_correct + data.reading_incorrect;
  });
  return total ? Math.round((correct / total) * 100) : 0;
}

export function scheduleSummary(reviewCount: number, nextReviewsAt: string | null | undefined, now = new Date()) {
  if (reviewCount > 0) return `${reviewCount.toLocaleString()} review${reviewCount === 1 ? "" : "s"} ready now`;
  if (!nextReviewsAt) return "review schedule is clear";
  const difference = new Date(nextReviewsAt).getTime() - now.getTime();
  if (difference <= 0) return "reviews are ready now";
  const minutes = Math.max(1, Math.round(difference / 60_000));
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (minutes < 90) return `next review ${formatter.format(minutes, "minute")}`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `next review ${formatter.format(hours, "hour")}`;
  return `next review ${formatter.format(Math.round(hours / 24), "day")}`;
}

export type DashboardSubjectRow = {
  id: number;
  characters: string;
  meaning: string;
  type: "radical" | "kanji" | "vocabulary";
  level: number;
  value?: number;
  date?: string;
};

function subjectRowsById(subjects: Subject[]) {
  return new Map(subjects.map((subject) => [subject.id, subject]));
}

function subjectRow(subject: Subject): DashboardSubjectRow {
  return {
    id: subject.id,
    characters: subject.data.characters || subject.data.meanings.find((meaning) => meaning.primary)?.meaning || subject.data.slug,
    meaning: subject.data.meanings.find((meaning) => meaning.primary)?.meaning || subject.data.meanings[0]?.meaning || subject.data.slug,
    type: subject.object === "kana_vocabulary" ? "vocabulary" : subject.object,
    level: subject.data.level,
  };
}

export function recentMistakeRows(statistics: ReviewStatistic[], subjects: Subject[], now = new Date()) {
  const subjectsById = subjectRowsById(subjects);
  const cutoff = now.getTime() - 7 * 24 * 60 * 60_000;
  return statistics.flatMap((statistic) => {
    const updatedAt = Date.parse(statistic.data_updated_at);
    const hasRecentMeaningMistake = statistic.data.meaning_incorrect > 0 && statistic.data.meaning_current_streak <= 1;
    const hasRecentReadingMistake = statistic.data.reading_incorrect > 0 && statistic.data.reading_current_streak <= 1;
    const subject = subjectsById.get(statistic.data.subject_id);
    if (!subject || (!Number.isNaN(updatedAt) && updatedAt < cutoff) || (!hasRecentMeaningMistake && !hasRecentReadingMistake)) return [];
    return [{ ...subjectRow(subject), value: statistic.data.percentage_correct, date: statistic.data_updated_at }];
  }).sort((a, b) => Date.parse(b.date || "") - Date.parse(a.date || "")).slice(0, 8);
}

export function recentUnlockRows(assignments: Assignment[], subjects: Subject[]) {
  const subjectsById = subjectRowsById(subjects);
  return assignments.flatMap((assignment) => {
    const subject = subjectsById.get(assignment.data.subject_id);
    return assignment.data.unlocked_at && subject ? [{ ...subjectRow(subject), date: assignment.data.unlocked_at }] : [];
  }).sort((a, b) => Date.parse(b.date || "") - Date.parse(a.date || "")).slice(0, 8);
}

export function burnedSubjectRows(assignments: Assignment[], subjects: Subject[], now = new Date()) {
  const subjectsById = subjectRowsById(subjects);
  const cutoff = now.getTime() - 30 * 24 * 60 * 60_000;
  return assignments.flatMap((assignment) => {
    const subject = subjectsById.get(assignment.data.subject_id);
    const burnedAt = assignment.data.burned_at;
    return subject && burnedAt && Date.parse(burnedAt) >= cutoff ? [{ ...subjectRow(subject), date: burnedAt }] : [];
  }).sort((a, b) => Date.parse(b.date || "") - Date.parse(a.date || "")).slice(0, 8);
}

export function criticalSubjectRows(statistics: ReviewStatistic[], subjects: Subject[]) {
  const subjectsById = subjectRowsById(subjects);
  return statistics.flatMap((statistic) => {
    const subject = subjectsById.get(statistic.data.subject_id);
    return subject && !statistic.data.hidden ? [{ ...subjectRow(subject), value: statistic.data.percentage_correct }] : [];
  }).sort((a, b) => (a.value ?? 100) - (b.value ?? 100)).slice(0, 8);
}

export type IncompleteLevelTypeRow = { passed: number; total: number };
export type IncompleteLevelRow = {
  level: number;
  passed: number;
  total: number;
  radical: IncompleteLevelTypeRow;
  kanji: IncompleteLevelTypeRow;
  vocabulary: IncompleteLevelTypeRow;
};
export function incompleteLevelRows(subjects: Subject[], assignments: Assignment[], currentLevel: number): IncompleteLevelRow[] {
  const assignmentBySubject = new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment]));
  const levels = new Map<number, IncompleteLevelRow>();
  for (const subject of subjects) {
    if (subject.data.level >= currentLevel || subject.data.hidden_at) continue;
    const row = levels.get(subject.data.level) ?? {
      level: subject.data.level,
      passed: 0,
      total: 0,
      radical: { passed: 0, total: 0 },
      kanji: { passed: 0, total: 0 },
      vocabulary: { passed: 0, total: 0 },
    };
    const type = subject.object === "kana_vocabulary" ? "vocabulary" : subject.object;
    if (type !== "radical" && type !== "kanji" && type !== "vocabulary") continue;
    const passed = (assignmentBySubject.get(subject.id)?.data.srs_stage ?? 0) >= 5;
    row.total += 1;
    row[type].total += 1;
    if (passed) {
      row.passed += 1;
      row[type].passed += 1;
    }
    levels.set(row.level, row);
  }
  return [...levels.values()].filter((row) => row.passed < row.total).sort((a, b) => b.level - a.level);
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type ActivityDay = { date: Date; key: string; count: number };
export function assignmentActivityDays(assignments: Assignment[], dayCount: number | "all" = 98, now = new Date()): ActivityDay[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (dayCount === "all") {
    const activityDates = assignments.flatMap((assignment) => assignment.data.started_at && !assignment.data.hidden
      ? [assignment.data_updated_at, assignment.data.started_at, assignment.data.passed_at, assignment.data.burned_at]
        .filter((value): value is string => Boolean(value))
        .map((value) => new Date(value))
        .filter((date) => !Number.isNaN(date.getTime()) && date <= now)
      : []);
    const earliest = activityDates.length ? new Date(Math.min(...activityDates.map((date) => date.getTime()))) : null;
    if (earliest) start.setFullYear(earliest.getFullYear(), 0, 1);
    else start.setDate(start.getDate() - 364);
  } else {
    start.setDate(start.getDate() - Math.max(0, dayCount - 1));
  }
  const resolvedDayCount = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86_400_000) + 1;
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const assignment of assignments) {
    if (!assignment.data.started_at || assignment.data.hidden) continue;
    const timestamps = [assignment.data_updated_at, assignment.data.started_at, assignment.data.passed_at, assignment.data.burned_at];
    for (const value of timestamps) {
      if (!value) continue;
      const date = new Date(value);
      if (Number.isNaN(date.getTime()) || date < start || date > now) continue;
      const key = localDateKey(date);
      const uniqueKey = `${assignment.id}:${key}`;
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return Array.from({ length: resolvedDayCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = localDateKey(date);
    return { date, key, count: counts.get(key) ?? 0 };
  });
}

export function usageStreak(activity: ActivityDay[]) {
  let longest = 0;
  let run = 0;
  for (const day of activity) {
    run = day.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let cursor = activity.length - 1;
  if (cursor >= 0 && activity[cursor].count === 0) cursor -= 1;
  let current = 0;
  while (cursor >= 0 && activity[cursor].count > 0) {
    current += 1;
    cursor -= 1;
  }
  return { current, longest };
}

export function todayStudyActivity(assignments: Assignment[], statistics: ReviewStatistic[], now = new Date()) {
  const today = localDateKey(now);
  const lessons = assignments.filter((assignment) => assignment.data.started_at && localDateKey(new Date(assignment.data.started_at)) === today).length;
  const reviewStats = statistics.filter((statistic) => {
    const answers = statistic.data.meaning_correct + statistic.data.meaning_incorrect + statistic.data.reading_correct + statistic.data.reading_incorrect;
    return answers > 0 && localDateKey(new Date(statistic.data_updated_at)) === today;
  }).length;
  const assignmentReviews = assignments.filter((assignment) => assignment.data.started_at && assignment.data.srs_stage > 1 && localDateKey(new Date(assignment.data_updated_at)) === today && Date.parse(assignment.data_updated_at) - Date.parse(assignment.data.started_at) > 60_000).length;
  return { lessons, reviews: Math.max(reviewStats, assignmentReviews) };
}

export type LevelTimingRow = { level: number; days: number; current: boolean };
export function levelTimingRows(progressions: LevelProgression[], currentLevel: number, now = new Date()): LevelTimingRow[] {
  const latestByLevel = new Map<number, LevelProgression>();
  for (const progression of progressions) {
    if (progression.data.abandoned_at) continue;
    const existing = latestByLevel.get(progression.data.level);
    if (!existing || Date.parse(progression.data.created_at) > Date.parse(existing.data.created_at)) latestByLevel.set(progression.data.level, progression);
  }
  return [...latestByLevel.values()].flatMap((progression) => {
    const startedAt = progression.data.started_at || progression.data.unlocked_at;
    const endedAt = progression.data.passed_at || progression.data.completed_at || (progression.data.level === currentLevel ? now.toISOString() : null);
    if (!startedAt || !endedAt) return [];
    return [{ level: progression.data.level, days: Math.max(0.1, (Date.parse(endedAt) - Date.parse(startedAt)) / 86_400_000), current: progression.data.level === currentLevel }];
  }).sort((a, b) => a.level - b.level).slice(-12);
}
