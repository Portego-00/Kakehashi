export interface ReviewSubmissionGuard {
  // Keep completed keys too, so a delayed callback from an old question cannot
  // mutate the queue after the UI has already advanced.
  startedQuestionKeys: Set<string>;
  emittedAnswerKeys: Set<string>;
  advancedQuestionKeys: Set<string>;
}

export function createReviewSubmissionGuard(): ReviewSubmissionGuard {
  return {
    startedQuestionKeys: new Set<string>(),
    emittedAnswerKeys: new Set<string>(),
    advancedQuestionKeys: new Set<string>(),
  };
}

export function tryStartQuestionSubmission(
  guard: ReviewSubmissionGuard,
  questionKey: string,
): boolean {
  if (
    guard.startedQuestionKeys.has(questionKey) ||
    guard.advancedQuestionKeys.has(questionKey)
  ) {
    return false;
  }

  guard.startedQuestionKeys.add(questionKey);
  return true;
}

export function releaseQuestionSubmissionForRetry(
  guard: ReviewSubmissionGuard,
  questionKey: string,
): void {
  // Retryable validation results stay on the same question and must be allowed
  // through the submission gate again.
  guard.startedQuestionKeys.delete(questionKey);
}

export function tryRecordAnswerEmission(
  guard: ReviewSubmissionGuard,
  questionKey: string,
  answerPart: "meaning" | "reading",
): boolean {
  const answerKey = `${questionKey}:${answerPart}`;
  if (
    guard.advancedQuestionKeys.has(questionKey) ||
    guard.emittedAnswerKeys.has(answerKey)
  ) {
    return false;
  }

  guard.emittedAnswerKeys.add(answerKey);
  return true;
}

export function tryAdvanceQuestionOccurrence(
  guard: ReviewSubmissionGuard,
  questionKey: string,
): boolean {
  if (guard.advancedQuestionKeys.has(questionKey)) {
    return false;
  }

  guard.advancedQuestionKeys.add(questionKey);
  return true;
}
