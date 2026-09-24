import type { MixedReviewHead, MixedReviewLane } from "../types/mixedReviews";

export type MixedReviewState = {
  lanes: MixedReviewLane[];
  heads: Partial<Record<MixedReviewLane, MixedReviewHead | null>>;
  errors: Partial<Record<MixedReviewLane, string | null>>;
  active: MixedReviewLane;
  started: boolean;
  complete: boolean;
};

export function createMixedReviewState(mode: "all" | "grammar" | "vocab"): MixedReviewState {
  return {
    lanes: mode === "all" ? ["wanikani", "grammar", "vocab"] : ["wanikani", mode],
    heads: {}, errors: {}, active: "wanikani", started: false, complete: false,
  };
}

export function chooseMixedReviewLane(
  available: { lane: MixedReviewLane; head: MixedReviewHead }[],
  previous: MixedReviewLane,
  keepPrevious: boolean,
  random = Math.random(),
): MixedReviewLane {
  if (keepPrevious && available.find(({ lane }) => lane === previous)?.head.keepTurn) return previous;
  const others = keepPrevious ? available.filter(({ lane }) => lane !== previous) : available;
  const candidates = others.length ? others : available;
  return candidates[Math.min(candidates.length - 1, Math.floor(Math.max(0, random) * candidates.length))].lane;
}

export function reportMixedReviewHead(state: MixedReviewState, lane: MixedReviewLane, head: MixedReviewHead | null, random = Math.random()): MixedReviewState {
  const previous = state.heads[lane];
  if (previous !== undefined && previous?.id === head?.id && previous?.keepTurn === head?.keepTurn) return state;
  const next = { ...state, heads: { ...state.heads, [lane]: head } };
  const failed = state.lanes.find((source) => state.errors[source]);
  if (failed) return { ...next, active: failed, complete: false };
  if (state.lanes.some((source) => next.heads[source] === undefined)) return next;
  if (state.started && lane !== state.active) return next;
  const available = state.lanes.flatMap((source) => next.heads[source] ? [{ lane: source, head: next.heads[source]! }] : []);
  if (!available.length) return { ...next, started: true, complete: true };
  return { ...next, started: true, complete: false, active: chooseMixedReviewLane(available, state.active, state.started && lane === state.active, random) };
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

export function mixedWrapUpLimits(lanes: MixedReviewLane[], remaining: Partial<Record<MixedReviewLane, number>>, active: MixedReviewLane, limit: number): Record<MixedReviewLane, number> {
  const allocation = { wanikani: 0, grammar: 0, vocab: 0 };
  const ordered = [active, ...lanes.filter((lane) => lane !== active)];
  let slots = Math.max(0, Math.floor(limit));
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
