import {
  createReviewSubmissionGuard,
  releaseQuestionSubmissionForRetry,
  tryAdvanceQuestionOccurrence,
  tryRecordAnswerEmission,
  tryStartQuestionSubmission,
} from "../reviewSubmissionGuard";

describe("review submission guard", () => {
  it("rejects overlapping submissions for the same question", () => {
    const guard = createReviewSubmissionGuard();

    expect(tryStartQuestionSubmission(guard, "1:meaning:0")).toBe(true);
    expect(tryStartQuestionSubmission(guard, "1:meaning:0")).toBe(false);
    expect(tryStartQuestionSubmission(guard, "1:reading:1")).toBe(true);
  });

  it("allows another attempt after a retryable answer", () => {
    const guard = createReviewSubmissionGuard();

    expect(tryStartQuestionSubmission(guard, "1:reading:0")).toBe(true);
    releaseQuestionSubmissionForRetry(guard, "1:reading:0");
    expect(tryStartQuestionSubmission(guard, "1:reading:0")).toBe(true);
  });

  it("emits each answer part only once while allowing grouped answers", () => {
    const guard = createReviewSubmissionGuard();
    const questionKey = "1:meaning:0";

    expect(tryRecordAnswerEmission(guard, questionKey, "meaning")).toBe(true);
    expect(tryRecordAnswerEmission(guard, questionKey, "meaning")).toBe(false);
    expect(tryRecordAnswerEmission(guard, questionKey, "reading")).toBe(true);
    expect(tryRecordAnswerEmission(guard, questionKey, "reading")).toBe(false);
  });

  it("accepts a new occurrence of the same question while keeping the old one locked", () => {
    const guard = createReviewSubmissionGuard();
    const firstOccurrenceKey = "1:meaning:0:0";
    const secondOccurrenceKey = "1:meaning:0:1";

    expect(tryStartQuestionSubmission(guard, firstOccurrenceKey)).toBe(true);
    expect(
      tryRecordAnswerEmission(guard, firstOccurrenceKey, "meaning"),
    ).toBe(true);
    expect(tryAdvanceQuestionOccurrence(guard, firstOccurrenceKey)).toBe(true);

    expect(tryStartQuestionSubmission(guard, firstOccurrenceKey)).toBe(false);
    expect(
      tryRecordAnswerEmission(guard, firstOccurrenceKey, "reading"),
    ).toBe(false);
    expect(tryAdvanceQuestionOccurrence(guard, firstOccurrenceKey)).toBe(false);

    expect(tryStartQuestionSubmission(guard, secondOccurrenceKey)).toBe(true);
    expect(
      tryRecordAnswerEmission(guard, secondOccurrenceKey, "meaning"),
    ).toBe(true);
  });
});
