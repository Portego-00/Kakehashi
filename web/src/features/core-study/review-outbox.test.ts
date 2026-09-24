import { describe, expect, it, vi } from "vitest";
import type { Assignment } from "@/types/wanikani";
import { assignmentStillReviewable, deliverLesson, deliverReview, enqueueReview, loadReviewOutbox, removeReview } from "./review-outbox";

function assignment(available: boolean): Assignment {
  return { id: 9, object: "assignment", url: "", data_updated_at: "", data: { subject_id: 1, subject_type: "kanji", srs_stage: 2, available_at: available ? "2020-01-01T00:00:00.000Z" : "2099-01-01T00:00:00.000Z", started_at: "2020-01-01T00:00:00.000Z", unlocked_at: "2020-01-01T00:00:00.000Z", passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: "" } };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value) };
}

describe("review outbox", () => {
  it("persists one stable entry per assignment", () => {
    const storage = memoryStorage();
    const input = { assignmentId: 9, incorrectMeaningAnswers: 1, incorrectReadingAnswers: 0, createdAt: "2026-01-01T00:00:00.000Z" };
    enqueueReview(storage, "User", input);
    enqueueReview(storage, "User", { ...input, createdAt: "later" });
    expect(loadReviewOutbox(storage, "user")).toEqual([{ ...input, attempts: 0 }]);
    removeReview(storage, "user", 9);
    expect(loadReviewOutbox(storage, "user")).toEqual([]);
  });

  it("keeps pending lesson starts separate from regular reviews", () => {
    const storage = memoryStorage();
    const input = { assignmentId: 9, incorrectMeaningAnswers: 0, incorrectReadingAnswers: 0, createdAt: "2026-09-23T10:00:00.000Z" };
    enqueueReview(storage, "User", { ...input, operation: "lesson" }, "lesson");
    expect(loadReviewOutbox(storage, "User")).toEqual([]);
    enqueueReview(storage, "User", input);
    removeReview(storage, "User", 9);
    expect(loadReviewOutbox(storage, "User", "lesson")).toEqual([expect.objectContaining({ operation: "lesson", assignmentId: 9 })]);
  });

  it("reconciles an already-applied review without resubmitting", async () => {
    const submitReview = vi.fn();
    await expect(deliverReview({ assignmentId: 9, incorrectMeaningAnswers: 0, incorrectReadingAnswers: 0, createdAt: "", attempts: 1 }, { readAssignment: async () => assignment(false), submitReview })).resolves.toBe("already-applied");
    expect(submitReview).not.toHaveBeenCalled();
  });

  it("submits only while the assignment is still reviewable", async () => {
    expect(assignmentStillReviewable(assignment(true), new Date("2026-01-01"))).toBe(true);
    const submitReview = vi.fn(async () => undefined);
    await expect(deliverReview({ assignmentId: 9, incorrectMeaningAnswers: 0, incorrectReadingAnswers: 0, createdAt: "", attempts: 0 }, { readAssignment: async () => assignment(true), submitReview })).resolves.toBe("submitted");
    expect(submitReview).toHaveBeenCalledOnce();
  });

  it("reconciles a review accepted upstream when its submission response is lost", async () => {
    const readAssignment = vi.fn()
      .mockResolvedValueOnce(assignment(true))
      .mockResolvedValueOnce(assignment(false));
    const submitReview = vi.fn(async () => { throw new Error("Connection closed after upstream accepted the review."); });
    await expect(deliverReview({ assignmentId: 9, incorrectMeaningAnswers: 1, incorrectReadingAnswers: 0, createdAt: "", attempts: 0 }, { readAssignment, submitReview })).resolves.toBe("already-applied");
    expect(readAssignment).toHaveBeenCalledTimes(2);
    expect(submitReview).toHaveBeenCalledOnce();
  });
});


describe("lesson delivery", () => {
  const entry = { operation: "lesson" as const, assignmentId: 9, incorrectMeaningAnswers: 0, incorrectReadingAnswers: 0, createdAt: "2026-09-23T10:00:00.000Z", attempts: 0 };
  const unstarted = { ...assignment(false), data: { ...assignment(false).data, started_at: null, srs_stage: 0 } };

  it("does not start a lesson again after its response was lost", async () => {
    const startLesson = vi.fn().mockRejectedValue(new Error("Connection lost"));
    const readAssignment = vi.fn().mockResolvedValueOnce(unstarted).mockResolvedValueOnce(assignment(false));
    await expect(deliverLesson(entry, { readAssignment, startLesson })).resolves.toBeUndefined();
    expect(startLesson).toHaveBeenCalledExactlyOnceWith(entry);
    startLesson.mockClear();
    await deliverLesson(entry, { readAssignment: async () => assignment(false), startLesson });
    expect(startLesson).not.toHaveBeenCalled();
  });

  it("retains genuine start failures for retry", async () => {
    const failure = new Error("Offline");
    await expect(deliverLesson(entry, { readAssignment: async () => unstarted, startLesson: async () => { throw failure; } })).rejects.toBe(failure);
  });
});
