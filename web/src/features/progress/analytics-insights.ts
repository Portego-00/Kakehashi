import type { Assignment, Review, ReviewStatistic, SpacedRepetitionSystem, Subject, SubjectType } from "@/types/wanikani";
import { calculateAccuracy, calculateLevelTimings, srsBucketForStage, summarizeLevelTimings, type AccuracySummary, type LevelProgressionLike, type LevelTiming, type SrsBucket } from "./calculations";
import { calculateAnalyticsAchievements } from "./analytics-achievements";

const DAY = 86_400_000;
const HOUR = 3_600_000;
export const ANALYTICS_SUBJECT_TYPES: SubjectType[] = ["radical", "kanji", "vocabulary", "kana_vocabulary"];
export const ANALYTICS_SRS_BUCKETS: SrsBucket[] = ["Locked", "Apprentice", "Guru", "Master", "Enlightened", "Burned"];

export interface AnalyticsActivityDay {
  key: string;
  date: Date;
  count: number;
  lessons: number;
  reviews: number | null;
  errors: number | null;
  burns: number;
  accuracy: number | null;
  subjectIds: number[];
  reviewCoverage: "complete" | "partial" | "unavailable";
  lessonSubjectIds: number[];
  reviewSubjectIds: number[];
  burnSubjectIds: number[];
}

export interface AnalyticsAccuracyRow extends AccuracySummary {
  key: string;
  label: string;
  meaningPercentage: number | null;
  readingPercentage: number | null;
  subjects: number;
}

export interface AnalyticsSrsRow {
  type: SubjectType;
  total: number;
  learned: number;
  burned: number;
  stages: Record<SrsBucket, number>;
}

export interface DifficultItem {
  subject: Subject;
  assignment: Assignment | undefined;
  accuracy: number | null;
  meaningAccuracy: number | null;
  readingAccuracy: number | null;
  errors: number;
  score: number;
  weakest: "meaning" | "reading";
  meaningStreak: number;
  readingStreak: number | null;
}

export interface AnalyticsForecastBucket {
  key: string;
  date: Date;
  label: string;
  count: number;
  cumulative: number;
  subjectIds: number[];
  byType: Record<SubjectType, number>;
}

export interface AnalyticsForecast {
  dueNow: number;
  dueToday: number;
  next24Hours: number;
  next7Days: number;
  nextAt: string | null;
  daily: AnalyticsForecastBucket[];
  hourly: AnalyticsForecastBucket[];
}

export interface LevelProjection {
  level: number;
  date: string;
  daysFromNow: number;
  status: "reached" | "projected";
}

export interface LevelPace {
  timings: LevelTiming[];
  average: number | null;
  median: number | null;
  recentAverage: number | null;
  fastest: number | null;
  slowest: number | null;
  completedLevels: number;
  currentDays: number;
  earliestLevelUpAt: string | null;
  projections: LevelProjection[];
  finishAt: string | null;
  paceLowerQuartile: number | null;
  paceUpperQuartile: number | null;
  finishEarliestAt: string | null;
  finishLatestAt: string | null;
  requiredKanji: number;
  passedKanji: number;
  blockers: LevelBlocker[];
}

export interface LevelBlocker {
  subject: Subject;
  assignment: Assignment | undefined;
  status: "passed" | "started" | "lesson" | "locked";
  earliestGuruAt: string | null;
  blockedBy: number[];
}

export interface AnalyticsAchievement {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  achieved: boolean;
  percentage: number;
  category: "level" | "learning" | "mastery" | "time" | "pace" | "accuracy" | "consistency";
  tier: "bronze" | "silver" | "gold" | "platinum";
  earnedAt: string | null;
}

export interface BurnMonth {
  key: string;
  label: string;
  count: number;
  cumulative: number;
  subjectIds: number[];
}

export interface AnalyticsInsightsInput {
  assignments: Assignment[];
  subjects: Subject[];
  statistics: ReviewStatistic[];
  progressions: LevelProgressionLike[];
  reviews?: Review[];
  systems?: SpacedRepetitionSystem[];
  currentLevel?: number;
  maxLevel?: number;
  now?: Date;
  days?: number | "all";
  reviewHistoryAvailable?: boolean;
  reviewHistoryStartedAt?: string | null;
  excludedLevels?: ReadonlySet<number>;
  paceDays?: number;
}

export interface AnalyticsInsights {
  activity: AnalyticsActivityDay[];
  reviewSummary: {
    available: boolean;
    total: number | null;
    errors: number | null;
    perfectReviews: number | null;
    accuracy: number | null;
    lessons: number;
    activeDays: number;
    currentStreak: number;
    longestStreak: number;
    dailyAverage: number | null;
    trackingStartedAt: string | null;
    trackedDays: number;
  };
  accuracyByType: AnalyticsAccuracyRow[];
  accuracyByStage: AnalyticsAccuracyRow[];
  lifetimeAccuracy: AccuracySummary;
  srsByType: AnalyticsSrsRow[];
  difficultItems: DifficultItem[];
  forecast: AnalyticsForecast;
  hourlyActivity: Array<{ hour: number; reviews: number | null; lessons: number; errors: number | null; accuracy: number | null }>;
  levelPace: LevelPace;
  achievements: AnalyticsAchievement[];
  burns: { total: number; inPeriod: number; thisMonth: number; months: BurnMonth[]; projectedMonths: BurnMonth[]; nextAt: string | null };
}

export function analyticsDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function percentage(correct: number, incorrect: number): number | null {
  return correct + incorrect > 0 ? Math.round(correct / (correct + incorrect) * 1000) / 10 : null;
}

function round(value: number): number { return Math.round(value * 10) / 10; }
function typeCounts(): Record<SubjectType, number> { return { radical: 0, kanji: 0, vocabulary: 0, kana_vocabulary: 0 }; }
function stageCounts(): Record<SrsBucket, number> { return { Locked: 0, Apprentice: 0, Guru: 0, Master: 0, Enlightened: 0, Burned: 0 }; }
const TYPE_LABELS: Record<SubjectType, string> = { radical: "Radicals", kanji: "Kanji", vocabulary: "Vocabulary", kana_vocabulary: "Kana vocabulary" };

function accuracyRow(key: string, label: string, statistics: ReviewStatistic[]): AnalyticsAccuracyRow {
  const accuracy = calculateAccuracy(statistics);
  return { key, label, ...accuracy, subjects: statistics.length, meaningPercentage: percentage(accuracy.meaningCorrect, accuracy.meaningIncorrect), readingPercentage: percentage(accuracy.readingCorrect, accuracy.readingIncorrect) };
}

/** Each subject contributes its latest assignment, including lessons still locked. */
export function calculateSrsByType(subjects: Subject[], assignments: Assignment[]): AnalyticsSrsRow[] {
  const bySubject = new Map(assignments.filter((item) => !item.data.hidden).map((item) => [item.data.subject_id, item]));
  const rows = new Map(ANALYTICS_SUBJECT_TYPES.map((type) => [type, { type, total: 0, learned: 0, burned: 0, stages: stageCounts() }]));
  for (const subject of subjects) {
    if (subject.data.hidden_at) continue;
    const row = rows.get(subject.object)!;
    const stage = bySubject.get(subject.id)?.data.srs_stage ?? 0;
    row.total += 1;
    row.stages[srsBucketForStage(stage)] += 1;
    if (stage > 0) row.learned += 1;
    if (stage >= 9) row.burned += 1;
  }
  return [...rows.values()];
}

export function calculateDifficultItems(subjects: Subject[], assignments: Assignment[], statistics: ReviewStatistic[]): DifficultItem[] {
  const bySubject = new Map(subjects.filter((item) => !item.data.hidden_at).map((item) => [item.id, item]));
  const byAssignment = new Map(assignments.filter((item) => !item.data.hidden).map((item) => [item.data.subject_id, item]));
  return statistics.flatMap((statistic) => {
    const subject = bySubject.get(statistic.data.subject_id);
    const assignment = byAssignment.get(statistic.data.subject_id);
    const data = statistic.data;
    if (!subject || data.hidden) return [];
    const errors = data.meaning_incorrect + data.reading_incorrect;
    if (!errors) return [];
    const meaningAccuracy = percentage(data.meaning_correct, data.meaning_incorrect);
    const readingAccuracy = percentage(data.reading_correct, data.reading_incorrect);
    const meaningScore = data.meaning_incorrect / Math.pow(Math.max(1, data.meaning_current_streak), 1.5);
    const readingScore = data.reading_incorrect / Math.pow(Math.max(1, data.reading_current_streak), 1.5);
    return [{ subject, assignment, errors, accuracy: percentage(data.meaning_correct + data.reading_correct, errors), meaningAccuracy, readingAccuracy, score: round(Math.max(meaningScore, readingScore)), weakest: readingScore > meaningScore ? "reading" as const : "meaning" as const, meaningStreak: data.meaning_current_streak, readingStreak: readingAccuracy === null ? null : data.reading_current_streak }];
  }).sort((a, b) => b.score - a.score || b.errors - a.errors || a.subject.id - b.subject.id);
}

export function calculateAnalyticsForecast(assignments: Assignment[], now = new Date(), days = 14): AnalyticsForecast {
  const firstDay = new Date(now); firstDay.setHours(0, 0, 0, 0);
  const daily = Array.from({ length: days }, (_, offset): AnalyticsForecastBucket => {
    const date = new Date(firstDay); date.setDate(date.getDate() + offset);
    return { key: analyticsDayKey(date), date, label: offset === 0 ? "Today" : date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }), count: 0, cumulative: 0, subjectIds: [], byType: typeCounts() };
  });
  const firstHour = new Date(now); firstHour.setMinutes(0, 0, 0);
  const hourly = Array.from({ length: 24 }, (_, offset): AnalyticsForecastBucket => {
    const date = new Date(firstHour.getTime() + offset * HOUR);
    return { key: date.toISOString(), date, label: offset === 0 ? "Now" : date.toLocaleTimeString(undefined, { hour: "numeric" }), count: 0, cumulative: 0, subjectIds: [], byType: typeCounts() };
  });
  const dailyByKey = new Map(daily.map((bucket) => [bucket.key, bucket]));
  let dueNow = 0; let next24Hours = 0; let next7Days = 0; let nextAt: Date | null = null;
  for (const assignment of assignments) {
    const available = parseDate(assignment.data.available_at);
    if (assignment.data.hidden || assignment.data.srs_stage < 1 || assignment.data.srs_stage >= 9 || !available) continue;
    const time = available.getTime();
    if (time <= now.getTime()) dueNow += 1;
    else if (!nextAt || available < nextAt) nextAt = available;
    if (time <= now.getTime() + 24 * HOUR) next24Hours += 1;
    if (time <= now.getTime() + 7 * DAY) next7Days += 1;
    const scheduled = time < now.getTime() ? now : available;
    const day = dailyByKey.get(analyticsDayKey(scheduled));
    const hourIndex = Math.floor((scheduled.getTime() - firstHour.getTime()) / HOUR);
    const hour = hourly[hourIndex];
    for (const bucket of [day, hour]) {
      if (!bucket) continue;
      bucket.count += 1;
      bucket.subjectIds.push(assignment.data.subject_id);
      bucket.byType[assignment.data.subject_type] += 1;
    }
  }
  for (const buckets of [daily, hourly]) {
    let cumulative = 0;
    for (const bucket of buckets) { cumulative += bucket.count; bucket.cumulative = cumulative; }
  }
  return { dueNow, dueToday: daily[0]?.count ?? 0, next24Hours, next7Days, nextAt: nextAt?.toISOString() ?? null, daily, hourly };
}

/** Arrival dates, so level 60 is reached after 60 - currentLevel level-ups. */
export function calculateLevelProjection({ timings, currentLevel, paceDays, now = new Date(), maxLevel = 60 }: { timings: LevelTiming[]; currentLevel: number; paceDays: number | null; now?: Date; maxLevel?: number }): LevelProjection[] {
  const current = timings.findLast((timing) => timing.level === currentLevel);
  const elapsed = current?.passedAt ? 0 : current?.activeDays ?? 0;
  const pace = paceDays !== null && Number.isFinite(paceDays) && paceDays > 0 ? paceDays : null;
  return Array.from({ length: Math.max(0, maxLevel) }, (_, index) => index + 1).flatMap((level): LevelProjection[] => {
    if (level <= currentLevel) {
      const timing = timings.findLast((row) => row.level === level);
      return timing?.startedAt && parseDate(timing.startedAt) ? [{ level, date: timing.startedAt, daysFromNow: 0, status: "reached" }] : [];
    }
    if (pace === null) return [];
    const daysFromNow = round(Math.max(0, pace - elapsed) + Math.max(0, level - currentLevel - 1) * pace);
    return [{ level, date: new Date(now.getTime() + daysFromNow * DAY).toISOString(), daysFromNow, status: "projected" }];
  });
}

function intervalMilliseconds(interval: number | null, unit: string | null): number | null {
  if (interval === null || unit === null) return null;
  const multiplier = { milliseconds: 1, seconds: 1000, minutes: 60_000, hours: HOUR, days: DAY, weeks: 7 * DAY }[unit];
  return multiplier === undefined ? null : interval * multiplier;
}

/** Conditional on correct answers immediately when each review becomes due. */
export function earliestSrsDate(assignment: Assignment, subject: Subject, systems: SpacedRepetitionSystem[], target: "passed" | "burned", now = new Date()): string | null {
  if (assignment.data.hidden || subject.data.hidden_at || assignment.data.srs_stage < 1) return null;
  if (target === "passed" && assignment.data.passed_at) return assignment.data.passed_at;
  const system = systems.find((item) => item.id === subject.data.spaced_repetition_system_id);
  if (!system) return null;
  const targetStage = target === "passed" ? system.data.passing_stage_position : system.data.burning_stage_position;
  if (assignment.data.srs_stage >= targetStage) return target === "passed" ? assignment.data.passed_at ?? now.toISOString() : assignment.data.burned_at;
  const available = parseDate(assignment.data.available_at);
  if (!available) return null;
  let time = Math.max(now.getTime(), available.getTime());
  for (let stage = assignment.data.srs_stage + 1; stage < targetStage; stage += 1) {
    const interval = system.data.stages.find((item) => item.position === stage);
    const milliseconds = interval && intervalMilliseconds(interval.interval, interval.interval_unit);
    if (milliseconds === undefined || milliseconds === null) return null;
    time = Math.floor(time / HOUR) * HOUR + milliseconds;
  }
  return new Date(time).toISOString();
}

export function calculateLevelBlockers(assignments: Assignment[], subjects: Subject[], systems: SpacedRepetitionSystem[], level: number, now = new Date()): { earliestLevelUpAt: string | null; requiredKanji: number; passedKanji: number; blockers: LevelBlocker[] } {
  const kanji = subjects.filter((subject) => subject.object === "kanji" && subject.data.level === level && !subject.data.hidden_at);
  const bySubject = new Map(assignments.filter((item) => !item.data.hidden).map((item) => [item.data.subject_id, item]));
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
  const earliestGuru = (subject: Subject, visited: Set<number>): string | null => {
    if (visited.has(subject.id)) return null;
    visited.add(subject.id);
    const assignment = bySubject.get(subject.id);
    if (assignment && assignment.data.srs_stage > 0) return earliestSrsDate(assignment, subject, systems, "passed", now);
    const system = systems.find((item) => item.id === subject.data.spaced_repetition_system_id);
    if (!system) return null;
    let start = now.getTime();
    if (!assignment?.data.unlocked_at) {
      const components = subject.data.component_subject_ids ?? [];
      if (!components.length) return null;
      for (const id of components) {
        const component = subjectsById.get(id);
        const date = component ? parseDate(earliestGuru(component, new Set(visited))) : null;
        if (!date) return null;
        start = Math.max(start, date.getTime());
      }
    } else start = Math.max(start, parseDate(assignment.data.unlocked_at)?.getTime() ?? start);
    for (let stage = system.data.starting_stage_position; stage < system.data.passing_stage_position; stage += 1) {
      const interval = system.data.stages.find((item) => item.position === stage);
      const milliseconds = interval && intervalMilliseconds(interval.interval, interval.interval_unit);
      if (milliseconds === undefined || milliseconds === null) return null;
      start = Math.floor(start / HOUR) * HOUR + milliseconds;
    }
    return new Date(start).toISOString();
  };
  const blockers: LevelBlocker[] = kanji.map((subject) => {
    const assignment = bySubject.get(subject.id);
    const status = assignment && (assignment.data.passed_at || assignment.data.srs_stage >= 5) ? "passed" : assignment?.data.started_at ? "started" : assignment?.data.unlocked_at ? "lesson" : "locked";
    const blockedBy = (subject.data.component_subject_ids ?? []).filter((id) => { const component = bySubject.get(id); return !component?.data.passed_at && (component?.data.srs_stage ?? 0) < 5; });
    return { subject, assignment, status, earliestGuruAt: earliestGuru(subject, new Set()), blockedBy };
  });
  blockers.sort((a, b) => (parseDate(a.earliestGuruAt)?.getTime() ?? Infinity) - (parseDate(b.earliestGuruAt)?.getTime() ?? Infinity) || a.subject.id - b.subject.id);
  const dates = blockers.flatMap((item) => { const date = parseDate(item.earliestGuruAt); return date ? [date.getTime()] : []; });
  const required = Math.ceil(kanji.length * 0.9);
  return { earliestLevelUpAt: level < 60 && required > 0 && dates.length >= required ? new Date(Math.max(now.getTime(), dates[required - 1])).toISOString() : null, requiredKanji: required, passedKanji: blockers.filter((item) => item.status === "passed").length, blockers };
}

function calculateActivity(assignments: Assignment[], subjects: Map<number, Subject>, reviews: Review[], now: Date, days: number | "all", historyAvailable: boolean, historyStartedAt: string | null) {
  const historyStart = parseDate(historyStartedAt);
  const first = new Date(now); first.setHours(0, 0, 0, 0);
  const validReviewDates = reviews.flatMap((review) => { const date = parseDate(review.data.created_at); return date && date <= now ? [date] : []; });
  const lessonDates = assignments.flatMap((assignment) => { const date = parseDate(assignment.data.started_at); return date && date <= now ? [date] : []; });
  if (days === "all") {
    const earliest = [...validReviewDates, ...lessonDates].reduce<Date | null>((result, date) => !result || date < result ? date : result, null);
    if (earliest) first.setFullYear(earliest.getFullYear(), 0, 1);
    else first.setDate(first.getDate() - 364);
  } else first.setDate(first.getDate() - Math.max(0, Math.floor(days) - 1));
  const activity: AnalyticsActivityDay[] = [];
  const cursor = new Date(first);
  while (cursor <= now) {
    const nextDay = new Date(cursor); nextDay.setDate(nextDay.getDate() + 1);
    const reviewCoverage = !historyAvailable || (historyStart && nextDay <= historyStart) ? "unavailable" : historyStart && cursor < historyStart ? "partial" : "complete";
    activity.push({ key: analyticsDayKey(cursor), date: new Date(cursor), count: 0, lessons: 0, reviews: reviewCoverage === "unavailable" ? null : 0, errors: reviewCoverage === "unavailable" ? null : 0, burns: 0, accuracy: null, subjectIds: [], reviewCoverage, lessonSubjectIds: [], reviewSubjectIds: [], burnSubjectIds: [] });
    cursor.setDate(cursor.getDate() + 1);
  }
  const byDay = new Map(activity.map((day) => [day.key, day]));
  const answersByDay = new Map<string, { correct: number; incorrect: number }>();
  const burnSubjectsByDay = new Map<string, Set<number>>();
  const burnReviewsByDay = new Map<string, Set<number>>();
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, reviews: historyAvailable ? 0 : null, lessons: 0, errors: historyAvailable ? 0 : null, accuracy: null as number | null }));
  const answersByHour = Array.from({ length: 24 }, () => ({ correct: 0, incorrect: 0 }));
  for (const assignment of assignments) {
    const started = parseDate(assignment.data.started_at);
    const burned = parseDate(assignment.data.burned_at);
    if (started && started <= now) {
      const day = byDay.get(analyticsDayKey(started));
      if (day) { day.lessons += 1; day.count += 1; day.subjectIds.push(assignment.data.subject_id); day.lessonSubjectIds.push(assignment.data.subject_id); hourly[started.getHours()].lessons += 1; }
    }
    if (burned && burned <= now) {
      const day = byDay.get(analyticsDayKey(burned));
      if (day) {
        day.burns += 1;
        day.subjectIds.push(assignment.data.subject_id);
        day.burnSubjectIds.push(assignment.data.subject_id);
        const burnedSubjects = burnSubjectsByDay.get(day.key) ?? new Set<number>();
        burnedSubjects.add(assignment.data.subject_id); burnSubjectsByDay.set(day.key, burnedSubjects);
      }
    }
  }
  let perfectReviews = 0;
  for (const review of historyAvailable ? reviews : []) {
    const date = parseDate(review.data.created_at);
    if (!date || date > now || (historyStart && date < historyStart)) continue;
    const day = byDay.get(analyticsDayKey(date));
    if (!day) continue;
    const type = subjects.get(review.data.subject_id)?.object;
    const errors = review.data.incorrect_meaning_answers + review.data.incorrect_reading_answers;
    day.reviews = (day.reviews ?? 0) + 1; day.count += 1; day.errors = (day.errors ?? 0) + errors;
    day.subjectIds.push(review.data.subject_id);
    day.reviewSubjectIds.push(review.data.subject_id);
    if (review.data.ending_srs_stage >= 9 && burnSubjectsByDay.get(day.key)?.has(review.data.subject_id)) {
      const burnedSubjects = burnReviewsByDay.get(day.key) ?? new Set<number>();
      burnedSubjects.add(review.data.subject_id); burnReviewsByDay.set(day.key, burnedSubjects);
    }
    if (errors === 0) perfectReviews += 1;
    const hour = hourly[date.getHours()]; hour.reviews = (hour.reviews ?? 0) + 1; hour.errors = (hour.errors ?? 0) + errors;
    // Each completed review eventually has one correct response per required answer.
    // Unknown subjects cannot supply an accurate answer denominator.
    if (type) {
      const correct = type === "kanji" || type === "vocabulary" ? 2 : 1;
      const answers = answersByDay.get(day.key) ?? { correct: 0, incorrect: 0 };
      answers.correct += correct; answers.incorrect += errors; answersByDay.set(day.key, answers);
      answersByHour[date.getHours()].correct += correct; answersByHour[date.getHours()].incorrect += errors;
    }
  }
  for (const day of activity) {
    day.count = day.lessons + (day.reviews ?? 0) + day.burns - (burnReviewsByDay.get(day.key)?.size ?? 0);
    day.subjectIds = [...new Set(day.subjectIds)];
    day.lessonSubjectIds = [...new Set(day.lessonSubjectIds)];
    day.reviewSubjectIds = [...new Set(day.reviewSubjectIds)];
    day.burnSubjectIds = [...new Set(day.burnSubjectIds)];
    const answers = answersByDay.get(day.key); day.accuracy = answers ? percentage(answers.correct, answers.incorrect) : null;
  }
  for (const hour of hourly) { const answers = answersByHour[hour.hour]; hour.accuracy = percentage(answers.correct, answers.incorrect); }
  let longestStreak = 0; let runningStreak = 0;
  const streakActivity = (day: AnalyticsActivityDay) => day.count > 0 && (!historyStart || day.reviewCoverage !== "unavailable");
  for (const day of activity) { runningStreak = streakActivity(day) ? runningStreak + 1 : 0; longestStreak = Math.max(longestStreak, runningStreak); }
  let currentStreak = 0;
  const lastIndex = activity.at(-1) && streakActivity(activity.at(-1)!) ? activity.length - 1 : activity.length - 2;
  for (let index = lastIndex; index >= 0 && streakActivity(activity[index]); index -= 1) currentStreak += 1;
  const answers = [...answersByDay.values()].reduce((total, day) => ({ correct: total.correct + day.correct, incorrect: total.incorrect + day.incorrect }), { correct: 0, incorrect: 0 });
  const total = historyAvailable ? activity.reduce((sum, day) => sum + (day.reviews ?? 0), 0) : null;
  const trackedDays = activity.filter((day) => day.reviewCoverage !== "unavailable").length;
  return { activity, hourlyActivity: hourly, reviewSummary: { available: historyAvailable, total, errors: historyAvailable ? activity.reduce((sum, day) => sum + (day.errors ?? 0), 0) : null, perfectReviews: historyAvailable ? perfectReviews : null, accuracy: percentage(answers.correct, answers.incorrect), lessons: activity.reduce((sum, day) => sum + day.lessons, 0), activeDays: activity.filter((day) => day.count > 0).length, currentStreak, longestStreak, dailyAverage: total === null ? null : round(total / Math.max(1, trackedDays)), trackingStartedAt: historyStart?.toISOString() ?? null, trackedDays } };
}

function burnMonths(records: Array<{ date: Date; subjectId: number }>): BurnMonth[] {
  const months = new Map<string, BurnMonth>();
  for (const { date, subjectId } of records) {
    const key = analyticsDayKey(date).slice(0, 7);
    const month = months.get(key) ?? { key, label: date.toLocaleDateString(undefined, { month: "short", year: "numeric" }), count: 0, cumulative: 0, subjectIds: [] };
    month.count += 1; month.subjectIds.push(subjectId); months.set(key, month);
  }
  let cumulative = 0;
  return [...months.values()].sort((a, b) => a.key.localeCompare(b.key)).map((month) => { cumulative += month.count; return { ...month, cumulative }; });
}

export function calculateAnalyticsInsights(input: AnalyticsInsightsInput): AnalyticsInsights {
  const { subjects, progressions, reviews = [], systems = [], now = new Date(), days = 365, reviewHistoryAvailable = false } = input;
  const assignments = input.assignments.filter((item) => !item.data.hidden);
  const statistics = input.statistics.filter((item) => !item.data.hidden);
  const bySubject = new Map(subjects.filter((item) => !item.data.hidden_at).map((item) => [item.id, item]));
  const byAssignment = new Map(assignments.map((item) => [item.data.subject_id, item]));
  const activity = calculateActivity(assignments, bySubject, reviews, now, days, reviewHistoryAvailable, input.reviewHistoryStartedAt ?? null);
  const timings = calculateLevelTimings(progressions, now);
  const excludedLevels = input.excludedLevels ?? new Set([1, 2]);
  const summary = summarizeLevelTimings(timings, excludedLevels);
  const completed = timings.filter((timing) => timing.daysToPass !== null && !excludedLevels.has(timing.level));
  const recent = completed.slice(-5);
  const recentAverage = recent.length ? round(recent.reduce((sum, timing) => sum + timing.daysToPass!, 0) / recent.length) : null;
  const currentLevel = input.currentLevel ?? Math.max(1, ...timings.map((timing) => timing.level));
  const currentDays = timings.findLast((timing) => timing.level === currentLevel)?.activeDays ?? 0;
  const projections = calculateLevelProjection({ timings, currentLevel, paceDays: input.paceDays ?? summary.median, now, maxLevel: input.maxLevel });
  const durations = completed.map((timing) => timing.daysToPass!).sort((a, b) => a - b);
  const quantile = (fraction: number): number | null => {
    if (!durations.length) return null;
    const position = (durations.length - 1) * fraction;
    const lower = Math.floor(position); const upper = Math.ceil(position);
    return round(durations[lower] + (durations[upper] - durations[lower]) * (position - lower));
  };
  const paceLowerQuartile = quantile(0.25); const paceUpperQuartile = quantile(0.75);
  const finishFor = (paceDays: number | null) => calculateLevelProjection({ timings, currentLevel, paceDays, now, maxLevel: input.maxLevel }).find((projection) => projection.level === (input.maxLevel ?? 60))?.date ?? null;
  const blockers = calculateLevelBlockers(assignments, subjects, systems, currentLevel, now);
  const burns = assignments.flatMap((assignment) => { const date = parseDate(assignment.data.burned_at); return date && date <= now && assignment.data.srs_stage >= 9 ? [{ date, subjectId: assignment.data.subject_id }] : []; });
  const futureBurns = assignments.flatMap((assignment) => {
    if (assignment.data.srs_stage >= 9) return [];
    const subject = bySubject.get(assignment.data.subject_id);
    const date = subject ? parseDate(earliestSrsDate(assignment, subject, systems, "burned", now)) : null;
    return date ? [{ date, subjectId: assignment.data.subject_id }] : [];
  });
  const achievements = calculateAnalyticsAchievements({ assignments, statistics, timings, currentLevel, now, reviewHistoryAvailable, longestStreak: activity.reviewSummary.longestStreak });
  return {
    ...activity,
    accuracyByType: ANALYTICS_SUBJECT_TYPES.map((type) => accuracyRow(type, TYPE_LABELS[type], statistics.filter((item) => item.data.subject_type === type))),
    accuracyByStage: ANALYTICS_SRS_BUCKETS.filter((stage) => stage !== "Locked").map((stage) => accuracyRow(stage, stage, statistics.filter((item) => { const assignment = byAssignment.get(item.data.subject_id); return assignment && srsBucketForStage(assignment.data.srs_stage) === stage; }))),
    lifetimeAccuracy: calculateAccuracy(statistics),
    srsByType: calculateSrsByType(subjects, assignments),
    difficultItems: calculateDifficultItems(subjects, assignments, statistics),
    forecast: calculateAnalyticsForecast(assignments, now),
    levelPace: { timings, average: summary.average, median: summary.median, fastest: summary.fastest, slowest: summary.slowest, completedLevels: summary.count, recentAverage, currentDays, ...blockers, projections, finishAt: projections.find((projection) => projection.level === (input.maxLevel ?? 60))?.date ?? null, paceLowerQuartile, paceUpperQuartile, finishEarliestAt: finishFor(paceLowerQuartile), finishLatestAt: finishFor(paceUpperQuartile) },
    achievements,
    burns: { total: burns.length, inPeriod: activity.activity.reduce((sum, day) => sum + day.burns, 0), thisMonth: burns.filter(({ date }) => date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()).length, months: burnMonths(burns), projectedMonths: burnMonths(futureBurns), nextAt: futureBurns.length ? new Date(Math.min(...futureBurns.map(({ date }) => date.getTime()))).toISOString() : null },
  };
}
