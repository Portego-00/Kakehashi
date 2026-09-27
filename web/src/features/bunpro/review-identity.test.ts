import { describe, expect, it } from "vitest";
import {
  buildReviewQueue,
  loadedReviewIds,
  reviewContent,
  reviewKey,
  reviewType,
  type BunproReviewQueueItem,
} from "./model";

function review(
  id: string,
  type = "review",
  attributes: Record<string, unknown> = type === "review" ? { ghost_count: 0 } : {},
): BunproReviewQueueItem {
  return {
    data: {
      id,
      type,
      attributes: { id: Number(id), reviewable_id: 1, reviewable_type: "GrammarPoint", ...attributes },
    },
  };
}

describe("Bunpro review identity", () => {
  it("uses explicit special review types even when normal review attributes are present", () => {
    expect(reviewType(review("12", "ghost_review", { ghost_count: 0 }))).toBe("ghost_review");
    expect(reviewType(review("12", "self_study_review", { ghost_count: 0 }))).toBe("self_study_review");
  });

  it("uses Bunpro's distinguishing attributes for records without a recognized type", () => {
    expect(reviewType(review("12", "quiz_item", { user_study_question_id: 50, ghost_count: 0 }))).toBe("self_study_review");
    expect(reviewType(review("12", "quiz_item", { ghost_count: 0 }))).toBe("review");
    expect(reviewType(review("12", "quiz_item", { streak: 1 }))).toBe("ghost_review");
  });

  it("recognizes a ghost without ghost_count even when the resource has the generic review type", () => {
    expect(reviewType(review("12", "review", { streak: 1 }))).toBe("ghost_review");
  });

  it("recognizes self-study attributes on the generic review type", () => {
    expect(reviewType(review("12", "review", { user_study_question_id: 50 }))).toBe("self_study_review");
  });

  it("keeps normal and special reviews distinct when numeric IDs overlap", () => {
    expect(reviewKey(review("12"))).toBe("12");
    expect(reviewKey(review("12", "ghost_review"))).toBe("ghost_review:12");
    expect(reviewKey(review("12", "self_study_review"))).toBe("self_study_review:12");
  });

  it("retains each review kind while deduplicating the same review across pending buckets", () => {
    const normal = review("12");
    const ghost = review("12", "ghost_review");
    const selfStudy = review("12", "self_study_review");

    expect(buildReviewQueue({
      pending_wrapup: [ghost],
      pending_attempt: [normal, ghost, selfStudy, normal],
    })).toEqual([ghost, normal, selfStudy]);
  });

  it("partitions loaded IDs by review kind and deduplicates each partition", () => {
    expect(loadedReviewIds([
      review("12"),
      review("12", "ghost_review"),
      review("12", "self_study_review"),
      review("13", "quiz_item", { user_study_question_id: 50 }),
      review("12"),
      review("12", "ghost_review"),
      review("12", "self_study_review"),
      review("invalid", "ghost_review"),
    ])).toEqual({ loadedIds: [12], loadedGhostIds: [12], loadedSelfStudyIds: [12, 13] });
  });
});

describe("self-study question content", () => {
  it("reads the related user study question when included IDs overlap", () => {
    const item = review("12", "self_study_review");
    item.data.relationships = {
      user_study_question: { data: { id: "50", type: "user_study_question" } },
      study_question: { data: { id: "50", type: "study_question" } },
    };
    item.included = [
      { id: "50", type: "study_question", attributes: { content: "Standard sentence" } },
      { id: "50", type: "user_study_question", attributes: { content: "My sentence", answer: "です" } },
    ];

    expect(reviewContent(item).question).toEqual({ content: "My sentence", answer: "です" });
  });

  it("does not grade a standard sentence when the custom question is unavailable", () => {
    const item = review("12", "self_study_review");
    item.data.relationships = {
      user_study_question: { data: { id: "51", type: "user_study_question" } },
      study_question: { data: { id: "50", type: "study_question" } },
    };
    item.included = [{ id: "50", type: "study_question", attributes: { content: "Standard sentence" } }];

    expect(reviewContent(item).question).toEqual({});
  });

  it("recovers the custom question by its attribute ID when its relationship is omitted", () => {
    const item = review("12", "self_study_review", { user_study_question_id: 51 });
    item.included = [{ id: "51", type: "user_study_question", attributes: { content: "My sentence", answer: "です" } }];

    expect(reviewContent(item).question).toEqual({ content: "My sentence", answer: "です" });
  });
});
