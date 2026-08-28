import { toHiragana } from "wanakana";
import type { StudyMaterial, Subject } from "@/types/wanikani";
import {
  AnswerCheckerResult,
  checkAnswerWithDetails,
  getAnswerFeedback,
  type AnswerCheckerContext as MobileAnswerCheckerContext,
} from "../../../../src/utils/answerChecker";

export { AnswerCheckerResult } from "../../../../src/utils/answerChecker";

export type QuestionKind = "meaning" | "reading";
export type AnswerCheckerContext = MobileAnswerCheckerContext;
export type AnswerResult = {
  status: "correct" | "close" | "incorrect" | "blocked";
  message: string;
  canonical?: string;
  checkerResult?: AnswerCheckerResult;
};

const punctuation = /[\s.,/#!$%^&*;:{}=\-_`~()'"?]/g;
const retryableResults = new Set<AnswerCheckerResult>([
  AnswerCheckerResult.OtherKanjiReading,
  AnswerCheckerResult.WrongReadingType,
  AnswerCheckerResult.MismatchingOkurigana,
  AnswerCheckerResult.ContainsInvalidCharacters,
  AnswerCheckerResult.IsKanjiButWantReading,
  AnswerCheckerResult.IsReadingButWantMeaning,
  AnswerCheckerResult.IsMeaningButWantReading,
  AnswerCheckerResult.IncorrectNConversion,
]);

// Retained for callers that use the lightweight normalization helpers directly.
export function normalizeMeaning(value: string) {
  return value.trim().toLocaleLowerCase().replace(punctuation, "");
}

export function normalizeReading(value: string) {
  return toHiragana(value.normalize("NFKC").trim(), { IMEMode: false }).replace(/[\s・]/g, "");
}

export function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

function canonicalAnswer(subject: Subject, kind: QuestionKind) {
  if (kind === "reading") {
    return subject.data.readings?.find((reading) => reading.primary)?.reading
      || subject.data.readings?.[0]?.reading;
  }

  return subject.data.meanings.find((meaning) => meaning.primary)?.meaning
    || subject.data.meanings[0]?.meaning;
}

export function checkAnswer(
  subject: Subject,
  kind: QuestionKind,
  raw: string,
  material?: StudyMaterial,
  context?: AnswerCheckerContext,
): AnswerResult {
  if (!raw.trim()) {
    return { status: "blocked", message: "Type an answer before checking it." };
  }

  // The mobile screen converts typed romaji before calling its checker. Do the
  // equivalent at this web boundary so both screens feed the canonical checker
  // the same reading input.
  const answer = kind === "reading" ? normalizeReading(raw) : raw;
  const checkerResult = checkAnswerWithDetails(
    answer,
    subject,
    kind,
    material ? { meaning_synonyms: material.data.meaning_synonyms } : undefined,
    context,
  );
  const canonical = canonicalAnswer(subject, kind);

  if (checkerResult === AnswerCheckerResult.Precise) {
    return { status: "correct", message: getAnswerFeedback(checkerResult, kind), canonical, checkerResult };
  }
  if (checkerResult === AnswerCheckerResult.Imprecise) {
    return { status: "close", message: getAnswerFeedback(checkerResult, kind), canonical, checkerResult };
  }
  if (retryableResults.has(checkerResult)) {
    return { status: "blocked", message: getAnswerFeedback(checkerResult, kind), canonical, checkerResult };
  }

  return { status: "incorrect", message: getAnswerFeedback(checkerResult, kind), canonical, checkerResult };
}
