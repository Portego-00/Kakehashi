import type { Assignment, Subject, SubjectType } from "@/types/wanikani";
import { customWordUsesKanji } from "@/features/custom-srs/subject-adapter";
import type { CustomSrsState, CustomVocabularyPack } from "@/features/custom-srs/types";

const HOUR_MS = 3_600_000;
const SUBJECT_TYPES: readonly SubjectType[] = ["radical", "kanji", "vocabulary", "kana_vocabulary"];
const SRS_GROUPS = ["apprentice", "guru", "master", "enlightened"] as const;

export type ForecastSrsGroup = typeof SRS_GROUPS[number];
export type ForecastSubjectBreakdown = Record<SubjectType, number>;
export type ForecastSrsBreakdown = Record<ForecastSrsGroup, number>;

export interface ReviewForecastEntry {
  id: string;
  availableAt: string;
  subjectType: SubjectType;
  srsStage: number;
  critical?: boolean;
}

export interface ForecastCounts {
  count: number;
  subjectBreakdown: ForecastSubjectBreakdown;
  srsBreakdown: ForecastSrsBreakdown;
  critical: boolean;
}

export interface ReviewForecastPoint extends ForecastCounts {
  key: string;
  start: Date;
  end: Date;
  label: string;
  dayLabel: string;
  isToday: boolean;
  cumulativeCount: number;
  cumulativeSubjectBreakdown: ForecastSubjectBreakdown;
  cumulativeSrsBreakdown: ForecastSrsBreakdown;
}

export interface ReviewForecastDay extends ReviewForecastPoint {
  hours: ReviewForecastPoint[];
}

export interface ReviewForecast {
  now: Date;
  dueNow: ForecastCounts;
  days: ReviewForecastDay[];
  /** The mobile chart's 48 columns, including the explicit Now anchor. */
  hourly: ReviewForecastPoint[];
  nextReviewAt: Date | null;
  laterCount: number;
}

function srsGroup(stage: number): ForecastSrsGroup | null {
  if (!Number.isInteger(stage) || stage < 1 || stage > 8) return null;
  if (stage <= 4) return "apprentice";
  if (stage <= 6) return "guru";
  return stage === 7 ? "master" : "enlightened";
}

function emptyCounts(): ForecastCounts {
  return {
    count: 0,
    subjectBreakdown: { radical: 0, kanji: 0, vocabulary: 0, kana_vocabulary: 0 },
    srsBreakdown: { apprentice: 0, guru: 0, master: 0, enlightened: 0 },
    critical: false,
  };
}

function addCounts(target: ForecastCounts, source: ForecastCounts) {
  target.count += source.count;
  for (const type of SUBJECT_TYPES) target.subjectBreakdown[type] += source.subjectBreakdown[type];
  for (const group of SRS_GROUPS) target.srsBreakdown[group] += source.srsBreakdown[group];
  target.critical ||= source.critical;
}

function addEntry(target: ForecastCounts, entry: ReviewForecastEntry) {
  const group = srsGroup(entry.srsStage);
  if (!group) return;
  target.count += 1;
  target.subjectBreakdown[entry.subjectType] += 1;
  target.srsBreakdown[group] += 1;
  target.critical ||= entry.critical === true;
}

function cumulativeFields(counts: ForecastCounts) {
  return {
    cumulativeCount: counts.count,
    cumulativeSubjectBreakdown: { ...counts.subjectBreakdown },
    cumulativeSrsBreakdown: { ...counts.srsBreakdown },
  };
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function nextLocalDay(date: Date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
}

function hourLabel(date: Date) {
  const hour = date.getHours();
  return `${hour % 12 || 12}${hour < 12 ? "A" : "P"}`;
}

/** Retain the latest resource before filtering, so a newer hidden/burned state wins. */
export function wanikaniReviewForecastEntries(
  assignments: readonly Assignment[],
  subjects: readonly Subject[],
  currentLevel?: number,
): ReviewForecastEntry[] {
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
  const latestAssignments = new Map<number, Assignment>();
  for (const assignment of assignments) {
    const previous = latestAssignments.get(assignment.data.subject_id);
    if (!previous || !(Date.parse(previous.data_updated_at) > Date.parse(assignment.data_updated_at))) {
      latestAssignments.set(assignment.data.subject_id, assignment);
    }
  }
  return [...latestAssignments.values()].flatMap(({ data }) => {
    const subject = subjectsById.get(data.subject_id);
    // burned_at can retain the first burn after resurrection; current stage wins.
    if (data.hidden || subject?.data.hidden_at || !data.started_at || !data.available_at || !srsGroup(data.srs_stage)) return [];
    if (!Number.isFinite(Date.parse(data.available_at))) return [];
    const subjectType = subject?.object ?? data.subject_type;
    if (!SUBJECT_TYPES.includes(subjectType)) return [];
    return [{
      id: String(data.subject_id),
      availableAt: data.available_at,
      subjectType,
      srsStage: data.srs_stage,
      critical: Boolean(currentLevel && subject?.data.level === currentLevel && (subjectType === "radical" || subjectType === "kanji") && data.srs_stage <= 4),
    }];
  });
}

export function customReviewForecastEntries(state: CustomSrsState, packs: readonly CustomVocabularyPack[]): ReviewForecastEntry[] {
  const enrolledPackIds = new Set(state.enrolledPackIds);
  const activeWords = new Map(packs.flatMap((pack) => enrolledPackIds.has(pack.id)
    ? pack.words.map((word) => [word.id, { word, packId: pack.id }] as const)
    : []));
  return Object.values(state.assignments).flatMap((assignment) => {
    const active = activeWords.get(assignment.wordId);
    if (!active || active.packId !== assignment.packId || !assignment.startedAt || assignment.burnedAt || !assignment.availableAt || !srsGroup(assignment.stage)) return [];
    if (!Number.isFinite(Date.parse(assignment.availableAt))) return [];
    return [{
      id: assignment.wordId,
      availableAt: assignment.availableAt,
      subjectType: customWordUsesKanji(active.word) ? "vocabulary" : "kana_vocabulary",
      srsStage: assignment.stage,
    } satisfies ReviewForecastEntry];
  });
}

/** One source of counts for chart/list views, with each scheduled review counted once. */
export function createReviewForecast(entries: readonly ReviewForecastEntry[], now = new Date()): ReviewForecast {
  if (!Number.isFinite(now.getTime())) throw new RangeError("A valid forecast date is required.");
  const nowMs = now.getTime();
  const uniqueEntries = new Map(entries.map((entry) => [entry.id, entry]));
  const schedule = [...uniqueEntries.values()]
    .filter((entry) => entry.id && SUBJECT_TYPES.includes(entry.subjectType) && srsGroup(entry.srsStage))
    .map((entry) => ({ entry, timestamp: Date.parse(entry.availableAt) }))
    .filter(({ timestamp }) => Number.isFinite(timestamp))
    .sort((left, right) => left.timestamp - right.timestamp);
  const dueNow = emptyCounts();
  const future = schedule.filter(({ entry, timestamp }) => {
    if (timestamp > nowMs) return true;
    addEntry(dueNow, entry);
    return false;
  });

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayKey = localDateKey(today);
  const tomorrowKey = localDateKey(nextLocalDay(today));
  const runningDaily = emptyCounts();
  addCounts(runningDaily, dueNow);
  const days: ReviewForecastDay[] = [];
  let dayStart = today;
  let futureIndex = 0;

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const dayEnd = nextLocalDay(dayStart);
    const counts = emptyCounts();
    const hours: ReviewForecastPoint[] = [];
    const key = localDateKey(dayStart);
    const label = dayIndex === 0 ? "Today" : dayIndex === 1 ? "Tomorrow" : dayStart.toLocaleDateString("en-US", { weekday: "long" });
    // Advance elapsed hours between local midnights: DST days have 23 or 25 rows.
    for (let startMs = dayStart.getTime(); startMs < dayEnd.getTime(); startMs += HOUR_MS) {
      const start = new Date(startMs);
      const end = new Date(Math.min(startMs + HOUR_MS, dayEnd.getTime()));
      const hourCounts = emptyCounts();
      while (futureIndex < future.length && future[futureIndex].timestamp < end.getTime()) {
        addEntry(hourCounts, future[futureIndex].entry);
        futureIndex += 1;
      }
      addCounts(counts, hourCounts);
      addCounts(runningDaily, hourCounts);
      hours.push({
        ...hourCounts,
        key: start.toISOString(),
        start,
        end,
        label: hourLabel(start),
        dayLabel: label,
        isToday: dayIndex === 0,
        ...cumulativeFields(runningDaily),
      });
    }
    days.push({
      ...counts,
      key,
      start: dayStart,
      end: dayEnd,
      label,
      dayLabel: label,
      isToday: dayIndex === 0,
      hours,
      ...cumulativeFields(runningDaily),
    });
    dayStart = dayEnd;
  }

  const runningHourly = emptyCounts();
  addCounts(runningHourly, dueNow);
  const hourly: ReviewForecastPoint[] = [{
    ...dueNow,
    count: 0,
    key: "now",
    start: new Date(now),
    end: new Date(now),
    label: "Now",
    dayLabel: "",
    isToday: true,
    ...cumulativeFields(dueNow),
  }];
  // Preserve the repeated fall-back hour by subtracting minutes from the instant,
  // rather than resetting local hours (which selects the earlier repeated hour).
  const currentHourStart = nowMs - now.getMinutes() * 60_000 - now.getSeconds() * 1_000 - now.getMilliseconds();
  futureIndex = 0;
  for (let index = 1; index < 48; index += 1) {
    const end = new Date(currentHourStart + index * HOUR_MS);
    const counts = emptyCounts();
    while (futureIndex < future.length && future[futureIndex].timestamp <= end.getTime()) {
      addEntry(counts, future[futureIndex].entry);
      futureIndex += 1;
    }
    addCounts(runningHourly, counts);
    const key = localDateKey(end);
    hourly.push({
      ...counts,
      key: end.toISOString(),
      start: index === 1 ? new Date(now) : new Date(end.getTime() - HOUR_MS),
      end,
      label: hourLabel(end),
      dayLabel: key === todayKey ? "" : key === tomorrowKey ? "(T)" : "(+2)",
      isToday: key === todayKey,
      ...cumulativeFields(runningHourly),
    });
  }
  return {
    now: new Date(now),
    dueNow,
    days,
    hourly,
    nextReviewAt: future.length ? new Date(future[0].timestamp) : null,
    laterCount: future.filter(({ timestamp }) => timestamp >= dayStart.getTime()).length,
  };
}

export function getHourlyReviewForecast(forecast: ReviewForecast, count: 24 | 48 = 24): ReviewForecastPoint[] {
  return forecast.hourly.slice(0, count);
}

export function getDailyReviewForecast(forecast: ReviewForecast): ReviewForecastDay[] {
  return forecast.days;
}
