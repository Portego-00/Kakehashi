import type { BunproReviewQueueItem } from "../../types/bunpro";
import { getBunproReviewKey, getBunproReviewType, getBunproLoadedReviewIds } from "../bunproReviewIdentity";

function item(type: string, attributes: Record<string, unknown>, id = "10"): BunproReviewQueueItem {
  return { data: { id, type, attributes: { id: Number(id), reviewable_id: 20, reviewable_type: "GrammarPoint", ...attributes } } };
}

it("keeps special reviews distinct from normal reviews when IDs overlap", () => {
  const normal = item("review", { ghost_count: 0 });
  const ghost = item("review", { streak: 0 });
  const selfStudy = item("review", { user_study_question_id: 30 });
  expect([normal, ghost, selfStudy].map(getBunproReviewType)).toEqual(["review", "ghost_review", "self_study_review"]);
  expect([normal, ghost, selfStudy].map(getBunproReviewKey)).toEqual(["10", "ghost_review:10", "self_study_review:10"]);
});

it("recognizes explicit special types and keeps reviews that own ghosts normal", () => {
  expect(getBunproReviewType(item("ghost_review", { ghost_count: 0 }))).toBe("ghost_review");
  expect(getBunproReviewType(item("self_study_review", { ghost_count: 0 }))).toBe("self_study_review");
  expect(getBunproReviewType(item("quiz_item", { ghost_count: 3 }))).toBe("review");
  expect(getBunproReviewType(item("quiz_item", { ghost_count: 0, user_study_question_id: 30 }))).toBe("self_study_review");
});

it("partitions loaded IDs by category without losing overlapping IDs", () => {
  expect(getBunproLoadedReviewIds([
    item("review", { ghost_count: 0 }),
    item("ghost_review", {}),
    item("self_study_review", {}),
    item("review", { ghost_count: 0 }),
    item("ghost_review", {}, "11"),
    item("ghost_review", {}, "invalid"),
  ])).toEqual({ loaded_review_ids: [10], loaded_ghost_review_ids: [10, 11], loaded_self_study_review_ids: [10] });
});
