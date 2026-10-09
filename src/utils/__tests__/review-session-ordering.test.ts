import { reorderPendingReviewSession } from "../review-session-ordering";
const items = [1, 2, 3].map(id => ({ id, subject: { object: "vocabulary" as const, data: { level: 1, readings: [{ reading: "ねこ" }] } }, srsStage: id === 1 ? 8 : id === 2 ? 1 : 5, meaningDone: id === 1, readingDone: false, submitted: false }));
const head = { itemId: 1, type: "reading" as const };
const queue = [head, { itemId: 2, type: "meaning" as const }, { itemId: 2, type: "reading" as const }, { itemId: 3, type: "meaning" as const }, { itemId: 3, type: "reading" as const }];
it("reorders remaining reviews while retaining the exact active occurrence and completed sides", () => {
  const next = reorderPendingReviewSession(queue, items, head, { reviewOrder: "descendingSrsStage" }, { backToBack: true });
  expect(next[0]).toBe(head);
  expect(next.slice(1).map(question => question.itemId)).toEqual([3, 3, 2, 2]);
  expect(next.filter(question => question.itemId === 1)).toEqual([head]);
});
it("regroups only pending questions without reopening a finished item or changing the current reading", () => {
  const next = reorderPendingReviewSession(queue, items.map(item => ({ ...item, submitted: item.id === 3 })), head, { reviewOrder: "ascendingSrsStage" }, { groupQuestions: true });
  expect(next).toEqual([head, { itemId: 2, type: "meaning" }]);
});
