import type { BunproReviewQueueItem } from "../../types/bunpro";
import { orderBunproReviews } from "../bunproReviewOrdering";

const review = (id: number, stage: number, jlpt: string, due: string, updated: string): BunproReviewQueueItem => ({
  data: { id: String(id), type: "review", attributes: { id, ghost_count: 0, reviewable_id: id, reviewable_type: "GrammarPoint", streak: stage, next_review: due, updated_at: updated }, relationships: { reviewable: { data: { id: String(id), type: "grammar_point" } } } },
  included: [{ id: String(id), type: "grammar_point", attributes: { level: jlpt } }],
});
const items = [review(1, 8, "N1", "2026-01-01", "2025-12-01"), review(2, 2, "N5", "2026-01-03", "2026-01-02")];

it("matches stage, JLPT and due-date preferences without changing the original queue", () => {
  expect(orderBunproReviews(items, "ascendingSrsStage", () => 0.9).map((item) => item.data.id)).toEqual(["2", "1"]);
  expect(orderBunproReviews(items, "lowestLevelFirst", () => 0.9).map((item) => item.data.id)).toEqual(["2", "1"]);
  expect(orderBunproReviews(items, "currentLevelFirst", () => 0.9).map((item) => item.data.id)).toEqual(["1", "2"]);
  expect(orderBunproReviews(items, "oldestAvailableFirst", () => 0.9).map((item) => item.data.id)).toEqual(["1", "2"]);
  expect(orderBunproReviews(items, "newestAvailableFirst", () => 0.9).map((item) => item.data.id)).toEqual(["2", "1"]);
  expect(items.map((item) => item.data.id)).toEqual(["1", "2"]);
});

it("compares overdue time relative to each item's interval", () => {
  expect(orderBunproReviews(items, "longestRelativeWait", () => 0.9, Date.parse("2026-01-05")).map((item) => item.data.id)).toEqual(["2", "1"]);
});
