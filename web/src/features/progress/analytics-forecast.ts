import type { Assignment, ReviewStatistic, SpacedRepetitionSystem, Subject, SubjectType } from "@/types/wanikani";
import { calculateAccuracy } from "./calculations";
import { analyticsDayKey } from "./analytics-insights";

const HOUR = 3_600_000;
const round = (value: number) => Math.round(value * 10) / 10;

export interface WorkloadDay {
  key: string;
  date: Date;
  knownReviews: number;
  modeledReviews: number;
  reviews: number;
  lessons: number;
  expectedBurns: number;
  byType: Record<SubjectType, number>;
}

export interface WorkloadForecast {
  daily: WorkloadDay[];
  weekly: WorkloadDay[];
  totalReviews: number;
  knownReviews: number;
  modeledReviews: number;
  averageDailyReviews: number;
  peakDailyReviews: number;
  totalLessons: number;
  lessonsPerDay: number;
  accuracyPercent: number;
  assumedAccuracy: boolean;
  incompleteSystems: boolean;
  assumptions: string[];
}

export interface WorkloadForecastInput {
  assignments: Assignment[];
  subjects: Subject[];
  statistics?: ReviewStatistic[];
  systems: SpacedRepetitionSystem[];
  now?: Date;
  horizonDays?: number;
  lessonsPerDay?: number;
  accuracyPercent?: number;
  currentLevel?: number;
  paceDays?: number | null;
}

type Event = { weight: number; systemId: number; stage: number; type: SubjectType; known: boolean };

function intervalHours(system: SpacedRepetitionSystem, position: number): number | null {
  const stage = system.data.stages.find((item) => item.position === position);
  if (!stage || stage.interval === null || stage.interval_unit === null) return null;
  const factor = { milliseconds: 1 / HOUR, seconds: 1 / 3600, minutes: 1 / 60, hours: 1, days: 24, weeks: 168 }[stage.interval_unit];
  return factor === undefined ? null : Math.max(1, Math.ceil(stage.interval * factor));
}

function addDay(target: WorkloadDay, source: WorkloadDay) {
  target.knownReviews += source.knownReviews;
  target.modeledReviews += source.modeledReviews;
  target.reviews += source.reviews;
  target.lessons += source.lessons;
  target.expectedBurns += source.expectedBurns;
  for (const type of ["radical", "kanji", "vocabulary", "kana_vocabulary"] as const) target.byType[type] += source.byType[type];
}

function emptyDay(date: Date): WorkloadDay {
  return { key: analyticsDayKey(date), date, knownReviews: 0, modeledReviews: 0, reviews: 0, lessons: 0, expectedBurns: 0, byType: { radical: 0, kanji: 0, vocabulary: 0, kana_vocabulary: 0 } };
}

/** An hourly expectation model aggregates success/failure branches by SRS stage. */
export function calculateWorkloadForecast(input: WorkloadForecastInput): WorkloadForecast {
  const now = input.now ?? new Date();
  const horizonDays = Math.max(1, Math.min(180, Math.floor(input.horizonDays ?? 30)));
  const lessonsPerDay = Math.max(0, Math.min(100, Math.floor(input.lessonsPerDay ?? 10)));
  const measuredAccuracy = calculateAccuracy(input.statistics ?? []).percentage;
  const accuracyPercent = Math.max(1, Math.min(100, input.accuracyPercent ?? measuredAccuracy ?? 90));
  const daily = Array.from({ length: horizonDays }, (_, index) => { const date = new Date(now); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + index); return emptyDay(date); });
  const dayByKey = new Map(daily.map((day) => [day.key, day]));
  const horizonEnd = new Date(daily[daily.length - 1].date); horizonEnd.setDate(horizonEnd.getDate() + 1);
  const firstHourDate = new Date(now); firstHourDate.setMinutes(0, 0, 0);
  const firstHour = firstHourDate.getTime();
  const hours = Math.ceil((horizonEnd.getTime() - firstHour) / HOUR);
  const queue = Array.from({ length: hours }, () => new Map<string, Event>());
  const systems = new Map(input.systems.map((system) => [system.id, system]));
  const subjects = new Map(input.subjects.filter((subject) => !subject.data.hidden_at).map((subject) => [subject.id, subject]));
  const assignments = new Map(input.assignments.filter((assignment) => !assignment.data.hidden).map((assignment) => [assignment.data.subject_id, assignment]));
  let incompleteSystems = false;
  const schedule = (hour: number, event: Event) => {
    if (hour < 0 || hour >= hours || event.weight < 0.00001) return;
    const key = `${event.systemId}:${event.stage}:${event.type}:${event.known ? 1 : 0}`;
    const existing = queue[hour].get(key);
    if (existing) existing.weight += event.weight;
    else queue[hour].set(key, { ...event });
  };
  for (const assignment of assignments.values()) {
    const data = assignment.data;
    if (!data.available_at || data.srs_stage < 1 || data.srs_stage >= 9) continue;
    const due = Date.parse(data.available_at);
    if (!Number.isFinite(due)) continue;
    const subject = subjects.get(data.subject_id);
    if (!subject) continue;
    const systemId = subject.data.spaced_repetition_system_id ?? -1;
    if (!systems.has(systemId)) incompleteSystems = true;
    // Preserve the exact local day of known dates, including overdue work today.
    const hour = Math.max(0, Math.floor((due - firstHour) / HOUR));
    schedule(hour, { weight: 1, systemId, stage: data.srs_stage, type: data.subject_type, known: true });
  }

  const currentLevel = input.currentLevel ?? Math.max(1, ...input.subjects.filter((subject) => assignments.get(subject.id)?.data.unlocked_at).map((subject) => subject.data.level));
  const typeOrder: Record<SubjectType, number> = { radical: 0, kanji: 1, vocabulary: 2, kana_vocabulary: 3 };
  const lessonCandidates = [...subjects.values()].filter((subject) => !assignments.get(subject.id)?.data.started_at)
    .sort((a, b) => a.data.level - b.data.level || typeOrder[a.object] - typeOrder[b.object] || (a.data.lesson_position ?? a.id) - (b.data.lesson_position ?? b.id));
  const lessoned = new Set<number>();
  const nextLevelDays = input.paceDays && input.paceDays > 0 ? input.paceDays : null;
  // Lesson planning follows the chosen level pace; exact future unlocks depend
  // on the learner's choices, so all resulting reviews remain modeled.
  for (let dayIndex = 0; dayIndex < daily.length; dayIndex += 1) {
    let count = 0;
    const modeledLevel = Math.min(60, currentLevel + (nextLevelDays ? Math.floor(dayIndex / nextLevelDays) : 0));
    const timestamp = dayIndex === 0 ? now.getTime() : daily[dayIndex].date.getTime() + now.getHours() * HOUR;
    const hour = Math.max(0, Math.floor((timestamp - firstHour) / HOUR));
    for (const subject of lessonCandidates) {
      if (count >= lessonsPerDay) break;
      if (lessoned.has(subject.id) || subject.data.level > modeledLevel) continue;
      const assignment = assignments.get(subject.id);
      // Without a projected level pace, only already-unlocked lessons qualify.
      if (!nextLevelDays && (!assignment?.data.unlocked_at || Date.parse(assignment.data.unlocked_at) > timestamp)) continue;
      const system = systems.get(subject.data.spaced_repetition_system_id ?? -1);
      if (!system) { incompleteSystems = true; continue; }
      const interval = intervalHours(system, system.data.starting_stage_position);
      if (interval === null) { incompleteSystems = true; continue; }
      lessoned.add(subject.id); count += 1;
      schedule(hour + interval, { weight: 1, systemId: system.id, stage: system.data.starting_stage_position, type: subject.object, known: false });
    }
    daily[dayIndex].lessons = count;
  }

  for (let hour = 0; hour < queue.length; hour += 1) {
    const date = new Date(firstHour + hour * HOUR);
    const day = dayByKey.get(analyticsDayKey(date));
    if (!day) continue;
    for (const event of queue[hour].values()) {
      day.reviews += event.weight;
      if (event.known) day.knownReviews += event.weight;
      else day.modeledReviews += event.weight;
      day.byType[event.type] += event.weight;
      const system = systems.get(event.systemId);
      if (!system) continue;
      const answerCount = event.type === "kanji" || event.type === "vocabulary" ? 2 : 1;
      const passProbability = (accuracyPercent / 100) ** answerCount;
      const passedWeight = event.weight * passProbability;
      const failedWeight = event.weight - passedWeight;
      const promotedStage = event.stage + 1;
      if (promotedStage >= system.data.burning_stage_position) day.expectedBurns += passedWeight;
      else {
        const interval = intervalHours(system, promotedStage);
        if (interval !== null) schedule(hour + interval, { ...event, stage: promotedStage, weight: passedWeight, known: false });
        else incompleteSystems = true;
      }
      if (failedWeight > 0) {
        const failedStage = Math.max(system.data.starting_stage_position, event.stage - (event.stage >= system.data.passing_stage_position ? 2 : 1));
        const interval = intervalHours(system, failedStage);
        if (interval !== null) schedule(hour + interval, { ...event, stage: failedStage, weight: failedWeight, known: false });
        else incompleteSystems = true;
      }
    }
    queue[hour].clear();
  }
  const weekly: WorkloadDay[] = [];
  daily.forEach((day, index) => { if (index % 7 === 0) weekly.push(emptyDay(day.date)); addDay(weekly[weekly.length - 1], day); });
  const totalReviews = daily.reduce((sum, day) => sum + day.reviews, 0);
  const knownReviews = daily.reduce((sum, day) => sum + day.knownReviews, 0);
  const totalLessons = daily.reduce((sum, day) => sum + day.lessons, 0);
  return { daily, weekly, totalReviews: round(totalReviews), knownReviews, modeledReviews: round(totalReviews - knownReviews), averageDailyReviews: round(totalReviews / horizonDays), peakDailyReviews: round(Math.max(0, ...daily.map((day) => day.reviews))), totalLessons, lessonsPerDay, accuracyPercent: round(accuracyPercent), assumedAccuracy: input.accuracyPercent === undefined && measuredAccuracy === null, incompleteSystems, assumptions: [
    "Reviews are completed as soon as they become due.",
    "Meaning and reading outcomes are independent; each miss drops one Apprentice stage or two higher stages.",
    nextLevelDays ? `Future lesson access follows a modeled ${round(nextLevelDays)}-day level pace.` : "New lessons are limited to subjects already unlocked.",
    "Future reviews and burns are estimates, with no vacation or extra review delays.",
  ] };
}

export interface ReviewBudgetResult { lessonsPerDay: number; averageDailyReviews: number; peakDailyReviews: number; budget: number; achievable: boolean; forecast: WorkloadForecast }

/** Finds the highest whole lesson pace whose mean workload meets the budget. */
export function solveReviewBudget(input: WorkloadForecastInput, budget: number): ReviewBudgetResult {
  const safeBudget = Math.max(0, Number.isFinite(budget) ? budget : 0);
  const baseline = calculateWorkloadForecast({ ...input, lessonsPerDay: 0 });
  const meanReviews = (forecast: WorkloadForecast) => forecast.daily.reduce((sum, day) => sum + day.reviews, 0) / forecast.daily.length;
  if (meanReviews(baseline) > safeBudget) return { lessonsPerDay: 0, averageDailyReviews: baseline.averageDailyReviews, peakDailyReviews: baseline.peakDailyReviews, budget: safeBudget, achievable: false, forecast: baseline };
  let low = 0; let high = 60; let best = baseline;
  while (low < high) {
    const candidate = Math.ceil((low + high) / 2);
    const forecast = calculateWorkloadForecast({ ...input, lessonsPerDay: candidate });
    if (meanReviews(forecast) <= safeBudget) { low = candidate; best = forecast; }
    else high = candidate - 1;
  }
  if (best.lessonsPerDay !== low) best = calculateWorkloadForecast({ ...input, lessonsPerDay: low });
  return { lessonsPerDay: low, averageDailyReviews: best.averageDailyReviews, peakDailyReviews: best.peakDailyReviews, budget: safeBudget, achievable: true, forecast: best };
}
