import { eligibleReviewEntries, type ReviewRetry } from "./bunpro-review-retries";
import type { MixedReviewHead, MixedReviewLane } from "../types/mixedReviews";

export type MixedReviewState = {
  turn: number;
  retries: Record<string, ReviewRetry>;
  promotion?: { lane: MixedReviewLane; id: string };
  lanes: MixedReviewLane[];
  heads: Partial<Record<MixedReviewLane, MixedReviewHead | null>>;
  errors: Partial<Record<MixedReviewLane, string | null>>;
  active: MixedReviewLane;
  started: boolean;
  complete: boolean;
};

export function createMixedReviewState(mode: "all" | "grammar" | "vocab"): MixedReviewState {
  return {
    turn: 0, retries: {},
    lanes: mode === "all" ? ["wanikani", "grammar", "vocab"] : ["wanikani", mode],
    heads: {}, errors: {}, active: "wanikani", started: false, complete: false,
  };
}

export function recordMixedReviewAnswer(state: MixedReviewState, lane: MixedReviewLane, id: string, correct: boolean, random = Math.random()): MixedReviewState {
  const turn = state.turn + 1;
  const retries = { ...state.retries };
  const key = `${lane}:${id.replace(/^(bunpro|wanikani):/, "")}`;
  if (correct) delete retries[key];
  else retries[key] = { earliest: turn + 2, after: turn + 2 + Math.floor(random * 9), latest: turn + 10 };
  return { ...state, turn, retries };
}

export function chooseMixedReviewLane(
  available: { lane: MixedReviewLane; head: MixedReviewHead }[],
  previous: MixedReviewLane,
  keepPrevious: boolean,
  random = Math.random(),
): MixedReviewLane {
  if (keepPrevious && available.find(({ lane }) => lane === previous)?.head.keepTurn) return previous;
  const weights = available.map(({ head }) => Math.max(1, head.remaining ?? 1));
  let draw = Math.max(0, random) * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < available.length; index += 1) {
    draw -= weights[index];
    if (draw < 0) return available[index].lane;
  }
  return available[available.length - 1].lane;
}

export function reportMixedReviewHead(state: MixedReviewState, lane: MixedReviewLane, head: MixedReviewHead | null, random = Math.random()): MixedReviewState {
  const previous = state.heads[lane];
  if (previous !== undefined && previous?.id === head?.id && previous?.keepTurn === head?.keepTurn && previous?.remaining === head?.remaining && previous?.ready === head?.ready && JSON.stringify(previous?.pending) === JSON.stringify(head?.pending)) return state;
  const next = { ...state, heads: { ...state.heads, [lane]: head } };
  if (state.promotion?.lane === lane && state.promotion.id === head?.retryKey) return { ...next, promotion: undefined };
  const failed = state.lanes.find((source) => state.errors[source]);
  if (failed) return { ...next, active: failed, complete: false };
  if (state.lanes.some((source) => next.heads[source] === undefined)) return next;
  if (state.started && next.heads[state.active]?.ready !== false && (lane !== state.active || previous?.id === head?.id)) return next;
  const available = state.lanes.flatMap((source) => next.heads[source] ? [{ lane: source, head: next.heads[source]! }] : []);
  if (!available.length) return { ...next, started: true, complete: true };
  const ready = available.filter(({ head }) => head.ready !== false);
  const pool = ready.length ? ready : available;
  const entries = pool.flatMap(({ lane, head }) => (head.pending ?? [{ id: head.retryKey ?? head.id, subjectId: head.retryKey ?? head.id, open: false }]).map(question => ({ lane, head, question, subjectId: `${lane}:${question.subjectId}`, open: question.open, retry: state.retries[`${lane}:${question.id}`] })));
  const eligible = eligibleReviewEntries(entries, state.turn);
  const choices = pool.filter(value => eligible.some(entry => entry.lane === value.lane));
  const overdue = eligible.some(entry => entry.retry && state.turn >= entry.retry.latest);
  const active = chooseMixedReviewLane(choices.length ? choices : pool, state.active, !overdue && state.started && lane === state.active, random);
  const candidate = eligible.find(entry => entry.lane === active);
  const promotion = candidate && candidate.question.id !== (candidate.head.retryKey ?? candidate.head.id) && candidate.head.activate ? { lane: active, id: candidate.question.id } : undefined;
  return { ...next, started: true, complete: false, active, promotion };
}

export function reportMixedReviewError(state: MixedReviewState, lane: MixedReviewLane, message: string | null): MixedReviewState {
  if ((state.errors[lane] ?? null) === message) return state;
  const next = { ...state, errors: { ...state.errors, [lane]: message }, complete: false };
  if (message) return { ...next, active: lane };
  const stillFailed = state.lanes.find((source) => next.errors[source]);
  if (stillFailed) return { ...next, active: stillFailed };
  // Keep the current occurrence while retrying its save. Clearing an error is
  // not a new question and must not hand input to another provider mid-submit.
  // Initial load failures still have an undefined head until loading succeeds.
  return state.heads[lane] === null ? { ...next, heads: { ...next.heads, [lane]: undefined } } : next;
}

export function mixedWrapUpLimits(lanes: MixedReviewLane[], remaining: Partial<Record<MixedReviewLane, number>>, active: MixedReviewLane, limit: number, open: Partial<Record<MixedReviewLane, number>> = {}): Record<MixedReviewLane, number> {
  const allocation = { wanikani: 0, grammar: 0, vocab: 0 };
  for (const lane of lanes) allocation[lane] = Math.min(remaining[lane] ?? 0, open[lane] ?? 0);
  const ordered = [active, ...lanes.filter((lane) => lane !== active)];
  let slots = Math.max(0, Math.floor(limit) - lanes.reduce((sum, lane) => sum + allocation[lane], 0));
  while (slots > 0) {
    let assigned = false;
    for (const lane of ordered) {
      if (slots > 0 && allocation[lane] < (remaining[lane] ?? 0)) {
        allocation[lane] += 1;
        slots -= 1;
        assigned = true;
      }
    }
    if (!assigned) break;
  }
  return allocation;
}

/** Keep every started WK subject so wrapping up cannot discard half a review. */
export function trimMixedWaniKaniQueue<T extends { itemId: number }>(queue: T[], limit: number, partialIds: number[]): T[] {
  const chosen = new Set(partialIds);
  for (const question of queue) {
    if (chosen.size >= limit) break;
    chosen.add(question.itemId);
  }
  return queue.filter((question) => chosen.has(question.itemId));
}
