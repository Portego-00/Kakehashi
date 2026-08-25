import type { Assignment, ReviewStatistic, Subject, SubjectType } from "@/types/wanikani";

export type SrsBucket = "Locked" | "Apprentice" | "Guru" | "Master" | "Enlightened" | "Burned";

export interface AccuracySummary {
  correct: number;
  incorrect: number;
  meaningCorrect: number;
  meaningIncorrect: number;
  readingCorrect: number;
  readingIncorrect: number;
  percentage: number | null;
}

export interface ForecastBucket {
  key: string;
  label: string;
  count: number;
  subjectIds: number[];
}

export interface ActivityDay {
  key: string;
  date: Date;
  count: number;
}

export interface LevelTiming {
  level: number;
  startedAt: string | null;
  passedAt: string | null;
  completedAt: string | null;
  daysToPass: number | null;
  daysToComplete: number | null;
  activeDays: number;
}

export interface LevelProgressionLike {
  data: {
    level: number;
    unlocked_at: string | null;
    started_at: string | null;
    passed_at: string | null;
    completed_at: string | null;
    abandoned_at: string | null;
  };
}

export function srsBucketForStage(stage: number): SrsBucket {
  if (stage <= 0) return "Locked";
  if (stage <= 4) return "Apprentice";
  if (stage <= 6) return "Guru";
  if (stage === 7) return "Master";
  if (stage === 8) return "Enlightened";
  return "Burned";
}

export function calculateAccuracy(statistics: ReviewStatistic[]): AccuracySummary {
  let meaningCorrect = 0;
  let meaningIncorrect = 0;
  let readingCorrect = 0;
  let readingIncorrect = 0;

  for (const statistic of statistics) {
    if (statistic.data.hidden) continue;
    meaningCorrect += statistic.data.meaning_correct;
    meaningIncorrect += statistic.data.meaning_incorrect;
    readingCorrect += statistic.data.reading_correct;
    readingIncorrect += statistic.data.reading_incorrect;
  }

  const correct = meaningCorrect + readingCorrect;
  const incorrect = meaningIncorrect + readingIncorrect;
  const attempts = correct + incorrect;
  return {
    correct,
    incorrect,
    meaningCorrect,
    meaningIncorrect,
    readingCorrect,
    readingIncorrect,
    percentage: attempts > 0 ? Math.round((correct / attempts) * 1000) / 10 : null,
  };
}

export function calculateSrsBreakdown(assignments: Assignment[]): Record<SrsBucket, number> {
  const result: Record<SrsBucket, number> = {
    Locked: 0,
    Apprentice: 0,
    Guru: 0,
    Master: 0,
    Enlightened: 0,
    Burned: 0,
  };
  for (const assignment of assignments) {
    if (!assignment.data.hidden) result[srsBucketForStage(assignment.data.srs_stage)] += 1;
  }
  return result;
}

function localDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calculateForecast(assignments: Assignment[], start = new Date(), days = 7): ForecastBucket[] {
  const buckets: ForecastBucket[] = [];
  const byKey = new Map<string, ForecastBucket>();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    const key = localDayKey(date);
    const bucket = {
      key,
      label: offset === 0 ? "Today" : date.toLocaleDateString(undefined, { weekday: "short" }),
      count: 0,
      subjectIds: [],
    };
    buckets.push(bucket);
    byKey.set(key, bucket);
  }

  for (const assignment of assignments) {
    if (!assignment.data.available_at || assignment.data.hidden || assignment.data.srs_stage >= 9) continue;
    const bucket = byKey.get(localDayKey(new Date(assignment.data.available_at)));
    if (bucket) {
      bucket.count += 1;
      bucket.subjectIds.push(assignment.data.subject_id);
    }
  }
  return buckets;
}

export function calculateApproximateActivity(statistics: ReviewStatistic[], start = new Date(), days = 112): ActivityDay[] {
  const result: ActivityDay[] = [];
  const byKey = new Map<string, ActivityDay>();
  const first = new Date(start);
  first.setHours(0, 0, 0, 0);
  first.setDate(first.getDate() - (days - 1));

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(first);
    date.setDate(date.getDate() + offset);
    const day = { key: localDayKey(date), date, count: 0 };
    result.push(day);
    byKey.set(day.key, day);
  }

  // WaniKani no longer exposes review history. A statistic's update time is the
  // best available signal for the most recent activity on that subject.
  for (const statistic of statistics) {
    if (statistic.data.hidden) continue;
    const day = byKey.get(localDayKey(new Date(statistic.data_updated_at)));
    if (day) day.count += 1;
  }
  return result;
}

function daysBetween(start: string | null, end: string | null, now: Date): number | null {
  if (!start) return null;
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : now.getTime();
  return Math.max(0, Math.round(((endMs - startMs) / 86_400_000) * 10) / 10);
}

export function calculateLevelTimings(progressions: LevelProgressionLike[], now = new Date()): LevelTiming[] {
  return progressions
    .filter((progression) => !progression.data.abandoned_at)
    .map((progression) => {
      const startedAt = progression.data.started_at ?? progression.data.unlocked_at;
      return {
        level: progression.data.level,
        startedAt,
        passedAt: progression.data.passed_at,
        completedAt: progression.data.completed_at,
        daysToPass: progression.data.passed_at ? daysBetween(startedAt, progression.data.passed_at, now) : null,
        daysToComplete: progression.data.completed_at ? daysBetween(startedAt, progression.data.completed_at, now) : null,
        activeDays: daysBetween(startedAt, progression.data.passed_at ?? progression.data.completed_at, now) ?? 0,
      };
    })
    .sort((a, b) => a.level - b.level);
}

export interface LevelSubjectProgress {
  level: number;
  type: SubjectType;
  total: number;
  unlocked: number;
  started: number;
  passed: number;
  burned: number;
}

export function calculateLevelProgress(subjects: Subject[], assignments: Assignment[], level: number): LevelSubjectProgress[] {
  const assignmentBySubject = new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment]));
  const types: SubjectType[] = ["radical", "kanji", "vocabulary", "kana_vocabulary"];
  return types.map((type) => {
    const matching = subjects.filter((subject) => subject.data.level === level && subject.object === type && !subject.data.hidden_at);
    let unlocked = 0;
    let started = 0;
    let passed = 0;
    let burned = 0;
    for (const subject of matching) {
      const assignment = assignmentBySubject.get(subject.id);
      if (!assignment) continue;
      if (assignment.data.unlocked_at) unlocked += 1;
      if (assignment.data.started_at) started += 1;
      if (assignment.data.passed_at) passed += 1;
      if (assignment.data.burned_at) burned += 1;
    }
    return { level, type, total: matching.length, unlocked, started, passed, burned };
  }).filter((progress) => progress.total > 0);
}

export function weightedAverageLevelDays(timings: LevelTiming[]): number | null {
  const completed = timings.filter((timing) => timing.passedAt && timing.daysToPass !== null);
  if (completed.length === 0) return null;
  return Math.round((completed.reduce((sum, timing) => sum + (timing.daysToPass ?? 0), 0) / completed.length) * 10) / 10;
}
