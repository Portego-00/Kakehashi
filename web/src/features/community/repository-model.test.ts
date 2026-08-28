import { describe, expect, it } from "vitest";
import { applyLocalLikeToggle, findMutationReceipt } from "./repository-model";

describe("community mutation repository", () => {
  it("makes a retried like toggle idempotent and recomputes the count", () => {
    const likes: Array<Record<string, unknown>> = [];
    const targets: Array<Record<string, unknown>> = [{ id: "issue-1", likes_count: 9 }];
    const receipts: Array<Record<string, unknown>> = [];
    const input = { kind: "issue" as const, targetId: "issue-1", requestId: "request-1", userId: "learner", likes, targets, receipts, likeId: "like-1", now: "2026-08-07T00:00:00.000Z" };
    expect(applyLocalLikeToggle(input)).toEqual({ liked: true, likes_count: 1 });
    expect(applyLocalLikeToggle(input)).toEqual({ liked: true, likes_count: 1 });
    expect(likes).toHaveLength(1);
    expect(targets[0].likes_count).toBe(1);
  });

  it("returns the stored result for a repeated comment request", () => {
    expect(findMutationReceipt([{ id: "request-2", result: { id: "comment-1" } }], "request-2")).toEqual({ id: "comment-1" });
  });
});
