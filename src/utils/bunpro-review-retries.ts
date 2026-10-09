/** Keep retries near the front without interrupting an adjacent subject pair. */
export function insertReviewRetry<T>(pending: T[], retry: T[], options: {
  random?: number;
  subjectId?: (question: T) => string | number;
} = {}): T[] {
  const maximum = Math.min(10, pending.length);
  const minimum = Math.min(2, maximum);
  const positions: number[] = [];
  for (let index = minimum; index <= maximum; index++) {
    if (options.subjectId && index > 0 && index < pending.length && options.subjectId(pending[index - 1]) === options.subjectId(pending[index])) continue;
    positions.push(index);
  }
  const index = positions[Math.min(positions.length - 1, Math.floor((options.random ?? Math.random()) * positions.length))] ?? maximum;
  return [...pending.slice(0, index), ...retry, ...pending.slice(index)];
}

/** At capacity, finish an open subject before introducing another one. */
export function limitOpenReviews<T, K>(queue: T[], open: Set<K>, subjectId: (question: T) => K, limit = 10, canSelect: (question: T) => boolean = () => true): T[] {
  const pendingOpen = new Set(queue.map(subjectId).filter(id => open.has(id)));
  const atCapacity = pendingOpen.size >= limit;
  const eligible = (question: T) => (!atCapacity || pendingOpen.has(subjectId(question))) && canSelect(question);
  if (!queue.length || eligible(queue[0])) return queue;
  let index = queue.findIndex(eligible);
  // A shorter gap is unavoidable when there are no other eligible questions.
  if (index < 0 && atCapacity) index = queue.findIndex(question => pendingOpen.has(subjectId(question)));
  return index < 1 ? queue : [queue[index], ...queue.slice(0, index), ...queue.slice(index + 1)];
}

/** Wrap-up never drops an already-started subject or any of its pending sides. */
export function retainWrapUpReviews<T, K>(queue: T[], open: Set<K>, subjectId: (question: T) => K, limit: number): T[] {
  const keep = new Set(queue.map(subjectId).filter(id => open.has(id)));
  for (const question of queue) {
    if (keep.size >= limit) break;
    keep.add(subjectId(question));
  }
  return queue.filter(question => keep.has(subjectId(question)));
}

export type ReviewRetry = { after: number; earliest: number; latest: number };
export type ReviewRetrySchedule = { turn: number; retries: Map<string, ReviewRetry> };
export function createReviewRetrySchedule(): ReviewRetrySchedule { return { turn: 0, retries: new Map() }; }

export function advanceReviewRetrySchedule(previous: ReviewRetrySchedule, ids: string[], correct: boolean, random: number): ReviewRetrySchedule {
  const turn = previous.turn + 1;
  const retries = new Map(previous.retries);
  for (const id of ids) {
    if (correct) retries.delete(id);
    else retries.set(id, { earliest: turn + 2, after: turn + 2 + Math.floor(random * 9), latest: turn + 10 });
  }
  return { turn, retries };
}

export function eligibleReviewEntries<T extends { open: boolean; subjectId: string; retry?: ReviewRetry }>(entries: T[], turn: number): T[] {
  const open = new Set(entries.filter(entry => entry.open).map(entry => entry.subjectId));
  const pool = entries.filter(entry => open.size < 10 || entry.open);
  const eligible = pool.filter(entry => !entry.retry || turn >= entry.retry.after);
  const spaced = pool.filter(entry => !entry.retry || turn >= entry.retry.earliest);
  const candidates = eligible.length ? eligible : spaced.length ? spaced : pool;
  const due = candidates.filter(entry => entry.retry && turn >= entry.retry.after).sort((a, b) => a.retry!.latest - b.retry!.latest);
  return due.length ? [due[0]] : candidates;
}

/** Deadlines prevent newer retries from repeatedly pushing an older retry back. */
export function orderReviewRetries<T, K>(queue: T[], open: Set<K>, subjectId: (question: T) => K, questionId: (question: T) => string, schedule: ReviewRetrySchedule, immediate = false): T[] {
  if (immediate) return limitOpenReviews(queue, open, subjectId);
  const entries = queue.map(question => ({ question, subjectId: String(subjectId(question)), open: open.has(subjectId(question)), retry: schedule.retries.get(questionId(question)) }));
  const selected = eligibleReviewEntries(entries, schedule.turn)[0]?.question;
  return selected === undefined || selected === queue[0] ? queue : [selected, ...queue.filter(question => question !== selected)];
}
