import {
  createReviewSubmissionGuard,
  releaseQuestionSubmissionForRetry,
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
});
