import { expect, it } from "vitest";
import { advanceReviewRetrySchedule, createReviewRetrySchedule, insertReviewRetry, limitOpenReviews, orderReviewRetries, retainWrapUpReviews } from "./review-queue";

it("uses every random retry position from two through ten", () => {
  const pending = Array.from({ length: 30 }, (_, index) => index);
  const positions = Array.from({ length: 9 }, (_, index) => insertReviewRetry(pending, [-1], { random: (index + .5) / 9 }).indexOf(-1));
  expect(positions).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(pending).toHaveLength(30);
});

it.each([0, 1, 2])("uses the available gap near session completion with %i other questions", length => {
  const pending = Array.from({ length }, (_, index) => index);
  expect(insertReviewRetry(pending, [-1], { random: .9 })).toEqual([...pending, -1]);
});

it("keeps adjacent subject pairs intact and grouped retries together", () => {
  const pending = Array.from({ length: 12 }, (_, index) => ({ subject: Math.floor(index / 2), kind: index % 2 }));
  for (let index = 0; index < 9; index++) {
    const retry = [{ subject: -1, kind: 0 }, { subject: -1, kind: 1 }];
    const queue = insertReviewRetry(pending, retry, { random: (index + .5) / 9, subjectId: question => question.subject });
    const position = queue.indexOf(retry[0]);
    expect(position).toBeGreaterThanOrEqual(2);
    expect(position).toBeLessThanOrEqual(10);
    expect(position % 2).toBe(0);
    expect(queue[position + 1]).toBe(retry[1]);
  }
});

it("caps open subjects at ten even after repeated incorrect answers", () => {
  let queue = Array.from({ length: 100 }, (_, index) => index);
  const open = new Set<number>();
  for (let index = 0; index < 80; index++) {
    const current = queue[0];
    open.add(current);
    expect(open.size).toBeLessThanOrEqual(10);
    queue = limitOpenReviews(insertReviewRetry(queue.slice(1), [current], { random: .99 }), open, id => id);
  }
});

it("retains every open subject and its unanswered sides when wrapping up", () => {
  const queue = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12];
  expect(retainWrapUpReviews(queue, new Set([10, 12]), id => id, 5)).toEqual([1, 2, 3, 10, 12, 12]);
  expect(retainWrapUpReviews(queue, new Set([10, 12]), id => id, 0)).toEqual([10, 12, 12]);
  expect(retainWrapUpReviews(queue, new Set(), id => id, 0)).toEqual([]);
});


it("keeps a two-question gap when enforcing the open-subject cap", () => {
  const open = new Set(Array.from({ length: 10 }, (_, index) => index));
  const queue = [20, 21, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const next = limitOpenReviews(queue, open, id => id, 10, id => ![0, 1].includes(id));
  expect(next[0]).toBe(2);
});


it("prevents newer mistakes from postponing an older retry beyond ten questions", () => {
  let queue = Array.from({ length: 100 }, (_, index) => index);
  let schedule = createReviewRetrySchedule();
  const open = new Set<number>();
  const seen = new Map<number, number>();
  for (let turn = 0; turn < 100; turn++) {
    const current = queue[0];
    const previous = seen.get(current);
    if (previous !== undefined) {
      expect(turn - previous - 1).toBeGreaterThanOrEqual(2);
      expect(turn - previous - 1).toBeLessThanOrEqual(10);
    }
    seen.set(current, turn);
    open.add(current);
    expect(open.size).toBeLessThanOrEqual(10);
    const random = turn % 7 === 0 ? .99 : 0;
    schedule = advanceReviewRetrySchedule(schedule, [String(current)], false, random);
    queue = orderReviewRetries(insertReviewRetry(queue.slice(1), [current], { random }), open, id => id, String, schedule);
    for (const answered of open) expect(turn - seen.get(answered)!).toBeLessThanOrEqual(10);
  }
});
