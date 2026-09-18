import type { Subject } from "@/types/wanikani";
import type { WebStudyPreferences } from "@/features/settings/settings";
import type { QuestionKind } from "./answer-checker";
import type { QueueOptions } from "./queue";

export function questionOrderForMode(mode: "lessons" | "reviews", preferences: WebStudyPreferences) {
  return mode === "lessons" ? preferences.lessonQuestionOrder : preferences.reviewQuestionOrder;
}

export function coreQueueOptionsForMode(mode: "lessons" | "reviews", preferences: WebStudyPreferences): QueueOptions {
  const groupedAnki = preferences.ankiMode === "both" && preferences.ankiGroupQuestions;
  return {
    mode,
    shuffleSubjects: false,
    answerOrder: questionOrderForMode(mode, preferences),
    reviewQuestionOrderEnabled: mode === "reviews" && preferences.reviewQuestionOrderEnabled && !groupedAnki,
    backToBackQuestions: preferences.backToBackQuestions && !groupedAnki,
    maxQuestionGap: 10,
  };
}

export function usesSelfAssessment(kind: QuestionKind, preferences: WebStudyPreferences) {
  return preferences.ankiMode === "both" || preferences.ankiMode === kind;
}

export function shouldPauseAfterResult(status: "correct" | "close" | "incorrect" | "blocked", preferences: WebStudyPreferences) {
  if (status === "blocked") return false;
  const configured = status === "incorrect" ? preferences.pauseOnWrong : status === "close" ? preferences.pauseOnClose : preferences.pauseOnCorrect;
  if (typeof configured === "boolean") return configured;
  return preferences.answerStopBehavior === "always" || (preferences.answerStopBehavior === "incorrect" && status === "incorrect");
}

export function canonicalAnswer(subject: Subject, kind: QuestionKind) {
  if (kind === "reading") return subject.data.readings?.find((reading) => reading.primary)?.reading || subject.data.readings?.find((reading) => reading.accepted_answer)?.reading || "No reading available";
  return subject.data.meanings.find((meaning) => meaning.primary)?.meaning || subject.data.meanings.find((meaning) => meaning.accepted_answer)?.meaning || subject.data.slug;
}
