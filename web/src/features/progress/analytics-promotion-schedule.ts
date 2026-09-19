import type { Assignment, SpacedRepetitionSystem, Subject } from "@/types/wanikani";
import { calculateLevelBlockers } from "./analytics-insights";
import { srsBucketForStage, type SrsBucket } from "./calculations";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
type ScheduleInput = { assignments: Assignment[]; subjects: Subject[]; systems: SpacedRepetitionSystem[]; currentLevel: number; now?: Date };
export interface ScheduledStudyAction { subjectId: number; kind: "lesson" | "review"; at: string; startingStage: number; endingStage: number; isKanjiPass: boolean }
export interface PlannedReviewSession { at: string; reviewSubjectIds: number[]; lessonSubjectIds: number[]; actions: ScheduledStudyAction[]; passedKanji: number; completesLevel: boolean }
export interface FastestLevelRoute { available: boolean; earliestLevelUpAt: string | null; focusSubjectIds: number[]; requiredKanji: number; passedKanji: number; reviewCount: number; lessonCount: number; sessions: PlannedReviewSession[] }
export interface SrsPromotion { subject: Subject; assignment: Assignment; at: string; from: SrsBucket; to: SrsBucket; overdue: boolean }

function validDate(value: string | null | undefined): number | null { const time = value ? Date.parse(value) : NaN; return Number.isFinite(time) ? time : null; }
function nextReviewAt(timestamp: number, system: SpacedRepetitionSystem, stage: number): number | null {
  const interval = system.data.stages.find((item) => item.position === stage);
  if (!interval || interval.interval === null || interval.interval_unit === null) return null;
  const factor = { milliseconds: 1, seconds: 1000, minutes: 60_000, hours: HOUR, days: DAY, weeks: 7 * DAY }[interval.interval_unit];
  return factor === undefined ? null : Math.floor(timestamp / HOUR) * HOUR + interval.interval * factor;
}

export function calculateFastestLevelRoute(input: ScheduleInput): FastestLevelRoute {
  const now = input.now ?? new Date();
  const blockers = calculateLevelBlockers(input.assignments, input.subjects, input.systems, input.currentLevel, now);
  const result: FastestLevelRoute = { available: Boolean(blockers.earliestLevelUpAt), earliestLevelUpAt: blockers.earliestLevelUpAt, focusSubjectIds: [], requiredKanji: blockers.requiredKanji, passedKanji: blockers.passedKanji, reviewCount: 0, lessonCount: 0, sessions: [] };
  if (!blockers.earliestLevelUpAt) return result;
  const needed = Math.max(0, blockers.requiredKanji - blockers.passedKanji);
  const selected = blockers.blockers.filter((item) => item.status !== "passed").slice(0, needed);
  const subjects = new Map(input.subjects.filter((item) => !item.data.hidden_at).map((item) => [item.id, item]));
  const assignments = new Map(input.assignments.filter((item) => !item.data.hidden).map((item) => [item.data.subject_id, item]));
  const systems = new Map(input.systems.map((item) => [item.id, item]));
  const actions = new Map<string, ScheduledStudyAction>();
  const planned = new Map<number, number>();
  const planSubject = (subjectId: number, visited = new Set<number>()): number | null => {
    if (planned.has(subjectId)) return planned.get(subjectId)!;
    if (visited.has(subjectId)) return null;
    visited.add(subjectId);
    const subject = subjects.get(subjectId); const assignment = assignments.get(subjectId);
    if (!subject) return null;
    const passedAt = validDate(assignment?.data.passed_at);
    if (passedAt !== null) return passedAt;
    const system = systems.get(subject.data.spaced_repetition_system_id ?? -1);
    if (!system) return null;
    let stage = assignment?.data.srs_stage ?? 0;
    if (stage >= system.data.passing_stage_position) return now.getTime();
    let due: number | null;
    if (stage > 0) {
      due = validDate(assignment?.data.available_at);
      if (due === null) return null;
      due = Math.max(now.getTime(), due);
    } else {
      let lessonAt = Math.max(now.getTime(), validDate(assignment?.data.unlocked_at) ?? now.getTime());
      if (!assignment?.data.unlocked_at) {
        const components = subject.data.component_subject_ids ?? [];
        if (!components.length) return null;
        for (const component of components) { const date = planSubject(component, new Set(visited)); if (date === null) return null; lessonAt = Math.max(lessonAt, date); }
      }
      actions.set(`lesson:${subjectId}`, { subjectId, kind: "lesson", at: new Date(lessonAt).toISOString(), startingStage: 0, endingStage: system.data.starting_stage_position, isKanjiPass: false });
      stage = system.data.starting_stage_position;
      due = nextReviewAt(lessonAt, system, stage);
      if (due === null) return null;
    }
    while (stage < system.data.passing_stage_position) {
      const nextStage = stage + 1;
      actions.set(`review:${subjectId}:${stage}`, { subjectId, kind: "review", at: new Date(due).toISOString(), startingStage: stage, endingStage: nextStage, isKanjiPass: subject.object === "kanji" && subject.data.level === input.currentLevel && nextStage === system.data.passing_stage_position });
      stage = nextStage;
      if (stage < system.data.passing_stage_position) { due = nextReviewAt(due, system, stage); if (due === null) return null; }
    }
    planned.set(subjectId, due);
    return due;
  };
  for (const blocker of selected) {
    if (planSubject(blocker.subject.id) === null) return { ...result, available: false, earliestLevelUpAt: null };
    result.focusSubjectIds.push(blocker.subject.id);
  }
  const sessions = new Map<string, PlannedReviewSession>();
  for (const action of [...actions.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || (a.kind === b.kind ? a.subjectId - b.subjectId : a.kind === "review" ? -1 : 1))) {
    const session = sessions.get(action.at) ?? { at: action.at, reviewSubjectIds: [], lessonSubjectIds: [], actions: [], passedKanji: 0, completesLevel: false };
    session.actions.push(action);
    if (action.kind === "review") { session.reviewSubjectIds.push(action.subjectId); result.reviewCount += 1; }
    else { session.lessonSubjectIds.push(action.subjectId); result.lessonCount += 1; }
    sessions.set(action.at, session);
  }
  let passedKanji = blockers.passedKanji;
  result.sessions = [...sessions.values()].map((session) => {
    passedKanji += session.actions.filter((action) => action.isKanjiPass).length;
    return { ...session, passedKanji, completesLevel: passedKanji >= blockers.requiredKanji };
  });
  return result;
}

export function calculateSrsPromotions(input: Omit<ScheduleInput, "currentLevel"> & { horizonDays?: number }): SrsPromotion[] {
  const now = input.now ?? new Date();
  const until = now.getTime() + Math.max(1, Math.min(30, input.horizonDays ?? 30)) * DAY;
  const subjects = new Map(input.subjects.filter((subject) => !subject.data.hidden_at).map((subject) => [subject.id, subject]));
  const systems = new Map(input.systems.map((system) => [system.id, system]));
  const result: SrsPromotion[] = [];
  for (const assignment of input.assignments) {
    if (assignment.data.hidden || assignment.data.srs_stage < 1 || assignment.data.srs_stage >= 9) continue;
    const subject = subjects.get(assignment.data.subject_id);
    const system = subject && systems.get(subject.data.spaced_repetition_system_id ?? -1);
    let due = validDate(assignment.data.available_at);
    if (!subject || !system || due === null) continue;
    const overdue = due < now.getTime();
    due = Math.max(due, now.getTime());
    let stage = assignment.data.srs_stage;
    while (due <= until && stage < system.data.burning_stage_position) {
      const nextStage = stage + 1;
      const from = srsBucketForStage(stage); const to = srsBucketForStage(nextStage);
      if (from !== to) result.push({ subject, assignment, at: new Date(due).toISOString(), from, to, overdue: overdue && stage === assignment.data.srs_stage });
      stage = nextStage;
      if (stage >= system.data.burning_stage_position) break;
      due = nextReviewAt(due, system, stage);
      if (due === null) break;
    }
  }
  return result.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.subject.id - b.subject.id);
}

export function fastestRouteCalendar(route: FastestLevelRoute, now = new Date()): string {
  const stamp = (value: string) => value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kakehashi//Review plan//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  route.sessions.forEach((session, index) => {
    lines.push("BEGIN:VEVENT", `UID:kakehashi-review-plan-${stamp(session.at)}-${index}`, `DTSTAMP:${stamp(now.toISOString())}`, `DTSTART:${stamp(session.at)}`, `SUMMARY:WaniKani focus: ${session.reviewSubjectIds.length} reviews and ${session.lessonSubjectIds.length} lessons`, "DESCRIPTION:Conditional plan assuming correct answers at each due time. Recheck Kakehashi after any delay or mistake.", "TRANSP:TRANSPARENT", "END:VEVENT");
  });
  return [...lines, "END:VCALENDAR", ""].join("\r\n");
}
