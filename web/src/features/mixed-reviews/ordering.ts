import type { Subject } from "@/types/wanikani";
import type { WebStudyPreferences } from "@/features/settings/settings";
import type { CoreQuestion } from "@/features/core-study/queue";
import { reviewContent, type BunproReviewQueueItem } from "@/features/bunpro/model";
export type ReviewSource = "wanikani" | "bunpro";
export type MixedHead = { id: string; source: ReviewSource; stage: number; level: number; available: number; interval: number; subjectType: string; critical?: boolean; keepTurn?: boolean };
export type MixedPreviousAnswer = { id: string; source: ReviewSource; title: string; correct: boolean; subject?: Subject };
export type MixedBridge = { active: boolean; previous?: MixedPreviousAnswer | null; onAnswer?: (answer: MixedPreviousAnswer) => void; report: (head: MixedHead | null) => void; reportError?: (failed: boolean) => void };
const wkHours = [0, 4, 8, 23, 47, 167, 335, 719, 2879];
export function wkHead(question: CoreQuestion | undefined, userLevel: number, keepTurn = false): MixedHead | null {
  if (!question) return null;
  const { assignment, subject } = question;
  return { id: question.id, source: "wanikani", stage: assignment.data.srs_stage, level: subject.data.level, available: Date.parse(assignment.data.available_at ?? "") || 0, interval: (wkHours[assignment.data.srs_stage] || 4) * 3600000, subjectType: subject.object, critical: subject.data.level === userLevel && ["radical", "kanji"].includes(subject.object) && assignment.data.srs_stage <= 4, keepTurn };
}
export function bpHead(item: BunproReviewQueueItem | undefined, keepTurn = false): MixedHead | null {
  if (!item) return null;
  const attributes = item.data.attributes;
  const content = reviewContent(item);
  const available = Date.parse(String(attributes.next_review ?? "")) || 0;
  const previous = Date.parse(String(attributes.updated_at ?? attributes.started_studying_at ?? "")) || 0;
  const jlpt = Number(String(content.attributes.level ?? content.attributes.jlpt_level ?? "").match(/[1-5]/)?.[0]);
  return { id: item.data.id, source: "bunpro", stage: Number(attributes.streak) || 0, level: jlpt ? 6 - jlpt : 0, available, interval: available > previous && previous > 0 ? available - previous : 86400000, subjectType: "vocabulary", keepTurn };
}
export function compareMixedHeads(a: MixedHead, b: MixedHead, settings: WebStudyPreferences, now = Date.now()): number {
  if (settings.prioritizeCriticalItems && Boolean(a.critical) !== Boolean(b.critical)) return a.critical ? -1 : 1;
  if (settings.reviewTypeOrderEnabled) {
    const ranks = settings.reviewTypeOrder;
    const rank = (head: MixedHead) => { const type = head.subjectType === "kana_vocabulary" ? "vocabulary" : head.subjectType; const i = ranks.indexOf(type as "radical" | "kanji" | "vocabulary"); return i < 0 ? ranks.length : i; };
    const difference = rank(a) - rank(b); if (difference) return difference;
  }
  switch (settings.reviewOrder) {
    case "ascendingSrsStage": return a.stage - b.stage;
    case "descendingSrsStage": return b.stage - a.stage;
    // JLPT and WaniKani levels are not comparable; preserve level order inside each queue.
    case "currentLevelFirst": return a.source === b.source ? b.level - a.level : 0;
    case "lowestLevelFirst": return a.source === b.source ? a.level - b.level : 0;
    case "newestAvailableFirst": return b.available - a.available;
    case "oldestAvailableFirst": return a.available - b.available;
    case "longestRelativeWait": return (now - b.available) / b.interval - (now - a.available) / a.interval;
    default: return 0;
  }
}
export function chooseMixedLane<T extends string>(available: { lane: T; head: MixedHead }[], settings: WebStudyPreferences, previous: T, keepPrevious: boolean, random = Math.random()): T {
  if (keepPrevious && available.find(({ lane }) => lane === previous)?.head.keepTurn) return previous;
  // Each provider has already applied the user's ordering preferences. Mix those
  // ordered queues here, rather than draining one provider by comparing unlike SRS scales.
  const others = keepPrevious ? available.filter(({ lane }) => lane !== previous) : available;
  const candidates = others.length ? others : available;
  return candidates[Math.min(candidates.length - 1, Math.floor(random * candidates.length))].lane;
}
export function orderBunproReviews(items: BunproReviewQueueItem[], settings: WebStudyPreferences) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  return shuffled.sort((a, b) => compareMixedHeads(bpHead(a)!, bpHead(b)!, settings));
}
