import type { BunproReviewQueueItem, BunproReviewType } from "../types/bunpro";

export function getBunproReviewType(item: BunproReviewQueueItem): BunproReviewType {
  const { type, attributes } = item.data;
  if (type === "ghost_review" || type === "self_study_review") return type;
  if ("user_study_question_id" in attributes) return "self_study_review";
  // The official review client distinguishes normal records by this attribute.
  return "ghost_count" in attributes ? "review" : "ghost_review";
}

export function getBunproReviewKey(item: BunproReviewQueueItem): string {
  const type = getBunproReviewType(item);
  return type === "review" ? String(item.data.id) : `${type}:${item.data.id}`;
}

export function getBunproLoadedReviewIds(items: BunproReviewQueueItem[]): {
  loaded_review_ids: number[];
  loaded_ghost_review_ids: number[];
  loaded_self_study_review_ids: number[];
} {
  const ids: Record<BunproReviewType, Set<number>> = {
    review: new Set(),
    ghost_review: new Set(),
    self_study_review: new Set(),
  };
  for (const item of items) {
    const id = Number(item.data.id);
    if (Number.isSafeInteger(id) && id > 0) ids[getBunproReviewType(item)].add(id);
  }
  return {
    loaded_review_ids: [...ids.review],
    loaded_ghost_review_ids: [...ids.ghost_review],
    loaded_self_study_review_ids: [...ids.self_study_review],
  };
}
