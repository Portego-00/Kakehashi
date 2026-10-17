import type { BunproLearnContentItem, BunproReviewQueueItem } from "../../../../src/types/bunpro";
import { pickCanonicalAnswer, sanitizeQuestionContent, shuffleReviewQueue } from "./model";

export const BUNPRO_PRACTICE_MODES = [
  { id: "sentence-drill", title: "Sentence drill", description: "A shuffled round of grammar sentences. Practice whenever you like." },
  { id: "mastery-loop", title: "Mastery loop", description: "Keep each sentence in play until you answer it correctly twice in a row." },
  { id: "no-hints", title: "No-hints challenge", description: "Fill the blank without English or grammar hints. Reveal help when you need it." },
  { id: "listening-cloze", title: "Listening cloze", description: "Listen to a sentence and supply the missing grammar before revealing the text." },
] as const;
export type BunproPracticeMode = (typeof BUNPRO_PRACTICE_MODES)[number]["id"];
export type BunproPracticeSession = { mode: BunproPracticeMode; items: BunproReviewQueueItem[] };
export type PracticeGrammar = { id: string; slug: string; title: string; meaning: string; level: string; streak: number | null };
export const PRACTICE_SRS_GROUPS = [
  { label: "Beginner", stages: [0, 1, 2, 3] },
  { label: "Adept", stages: [4, 5, 6] },
  { label: "Seasoned", stages: [7, 8, 9] },
  { label: "Expert", stages: [10, 11] },
  { label: "Master", stages: [12] },
] as const;
export type PracticeFilters = { pool: "studied" | "all" | "new"; levels: string[]; stages: number[]; query: string; size: number; sentences: number };
export const DEFAULT_PRACTICE_FILTERS: PracticeFilters = { pool: "studied", levels: ["N5", "N4", "N3", "N2", "N1"], stages: Array.from({ length: 13 }, (_, index) => index), query: "", size: 10, sentences: 3 };

export function filterPracticeGrammar(grammar: PracticeGrammar[], filters: PracticeFilters) {
  const query = filters.query.trim().toLocaleLowerCase();
  return grammar.filter(item => {
    const level = item.level.match(/(?:JLPT|N)\s*([1-5])/i)?.[1];
    if (!level || !filters.levels.includes(`N${level}`)) return false;
    if (item.streak === null) { if (filters.pool === "studied") return false; }
    else if (filters.pool === "new" || !filters.stages.includes(item.streak)) return false;
    return !query || `${item.title} ${item.meaning}`.toLocaleLowerCase().includes(query);
  });
}

/** Fisher–Yates on a copy: every round samples the whole filtered pool, regardless of due date. */
export function shuffledPracticeGrammar(grammar: PracticeGrammar[]): PracticeGrammar[] {
  const shuffled = [...grammar];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

export function canAccessBunproPractice(username?: string | null) {
  return username?.trim().toLowerCase() === "portego";
}
export function isBunproPracticeMode(value: string): value is BunproPracticeMode {
  return BUNPRO_PRACTICE_MODES.some(mode => mode.id === value);
}

/** Adapt Bunpro's example questions to the existing review screen, with local IDs only. */
export function buildBunproPracticeQueue(contents: BunproLearnContentItem[], mode: BunproPracticeMode, sentencesPerGrammar: number): BunproReviewQueueItem[] {
  const items: BunproReviewQueueItem[] = [];
  const seen = new Set<string>();
  for (const content of contents) {
    if (content.data.type !== "grammar_point") continue;
    const candidates = (content.included ?? []).filter(question => question.type === "study_question"
      && question.attributes.question_type !== "readonly"
      && /(?:_{2,}|＿{2,})/.test(sanitizeQuestionContent(question.attributes.content))
      && Boolean(pickCanonicalAnswer(question.attributes))
      && (mode !== "listening-cloze" || [question.attributes.female_audio_url, question.attributes.male_audio_url].some(url => typeof url === "string" && /^https:\/\//i.test(url))));
    const shuffled = shuffleReviewQueue(candidates.map(question => ({
      data: {
        id: `practice:${content.data.id}:${question.id}`, type: "review",
        attributes: { id: 0, ghost_count: 0, reviewable_id: Number(content.data.id), reviewable_type: "GrammarPoint" },
        relationships: { study_question: { data: { id: question.id, type: question.type } }, reviewable: { data: { id: content.data.id, type: content.data.type } } },
      },
      included: [content.data, question],
    })));
    for (const item of shuffled.slice(0, Math.max(1, Math.min(10, Math.floor(sentencesPerGrammar) || 1)))) {
      if (!seen.has(item.data.id)) { seen.add(item.data.id); items.push(item); }
    }
  }
  return shuffleReviewQueue(items);
}

/** A miss resets mastery; practice never submits a grade or changes Bunpro's SRS. */
export function advanceBunproPractice(queue: BunproReviewQueueItem[], streaks: Map<string, number>, correct: boolean, mode: BunproPracticeMode) {
  const current = queue[0];
  if (!current) return { queue, streaks, completed: false };
  const nextStreaks = new Map(streaks);
  const streak = correct ? (streaks.get(current.data.id) ?? 0) + 1 : 0;
  nextStreaks.set(current.data.id, streak);
  const completed = mode !== "mastery-loop" || streak >= 2;
  const next = queue.slice(1);
  if (!completed) next.splice(Math.min(3, next.length), 0, current);
  return { queue: next, streaks: nextStreaks, completed };
}
