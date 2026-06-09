import { AnswerCheckerResult } from "./answerChecker";

const JAPANESE_CHAR_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/;
const KANJI_CHAR_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF]/;
const READING_QUIZ_ALLOWED_JAPANESE_REGEX =
  /^[\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFFー〜々〆〇・]+$/;

interface ResolveReadingModeResultArgs {
  result: AnswerCheckerResult;
  answer: string;
  questionType: "meaning" | "reading";
  acceptCharactersAsCorrectForReading: boolean;
  requireSubjectCharactersForReading?: boolean;
  subjectCharacters?: string | null;
}

function compactJapaneseText(text: string | null | undefined): string {
  return (text ?? "").trim().replace(/\s/g, "");
}

function matchesSubjectCharacters(
  compactAnswer: string,
  compactSubjectCharacters: string,
): boolean {
  return (
    compactAnswer === compactSubjectCharacters ||
    compactAnswer.replace(/^〜/, "") === compactSubjectCharacters.replace(/^〜/, "")
  );
}

export function resolveReadingModeResult({
  result,
  answer,
  questionType,
  acceptCharactersAsCorrectForReading,
  requireSubjectCharactersForReading = false,
  subjectCharacters,
}: ResolveReadingModeResultArgs): AnswerCheckerResult {
  if (questionType !== "reading") {
    return result;
  }

  let resolvedResult = result;

  if (acceptCharactersAsCorrectForReading) {
    // Optional mode: accept subject characters as correct on reading questions.
    if (resolvedResult === AnswerCheckerResult.IsKanjiButWantReading) {
      resolvedResult = AnswerCheckerResult.Precise;
    }

    // In English -> Japanese mode, wrong answers made only of kana/kanji should be graded
    // as incorrect (not warning). Keep warnings for non-kana/kanji characters (e.g. "j").
    if (resolvedResult === AnswerCheckerResult.ContainsInvalidCharacters) {
      const compactAnswer = compactJapaneseText(answer);
      const hasJapaneseChars = JAPANESE_CHAR_REGEX.test(compactAnswer);
      const hasOnlyAllowedJapaneseChars =
        compactAnswer.length > 0 &&
        READING_QUIZ_ALLOWED_JAPANESE_REGEX.test(compactAnswer);

      if (hasJapaneseChars && hasOnlyAllowedJapaneseChars) {
        resolvedResult = AnswerCheckerResult.Incorrect;
      }
    }
  }

  if (!requireSubjectCharactersForReading) {
    return resolvedResult;
  }

  const compactSubjectCharacters = compactJapaneseText(subjectCharacters);
  if (!compactSubjectCharacters) {
    return resolvedResult;
  }

  const compactAnswer = compactJapaneseText(answer);
  if (!compactAnswer) {
    return resolvedResult;
  }

  if (matchesSubjectCharacters(compactAnswer, compactSubjectCharacters)) {
    return AnswerCheckerResult.Precise;
  }

  // Kana-only vocabulary should still accept kana answers.
  if (!KANJI_CHAR_REGEX.test(compactSubjectCharacters)) {
    return resolvedResult;
  }

  // In Kana -> Kanji mode, a kana reading alone is not enough when the vocab contains kanji.
  if (
    resolvedResult === AnswerCheckerResult.Precise ||
    resolvedResult === AnswerCheckerResult.Imprecise
  ) {
    return AnswerCheckerResult.Incorrect;
  }

  if (resolvedResult === AnswerCheckerResult.ContainsInvalidCharacters) {
    const compactAnswer = answer.replace(/\s/g, "");
    const hasJapaneseChars = JAPANESE_CHAR_REGEX.test(compactAnswer);
    const hasOnlyAllowedJapaneseChars =
      compactAnswer.length > 0 &&
      READING_QUIZ_ALLOWED_JAPANESE_REGEX.test(compactAnswer);

    if (hasJapaneseChars && hasOnlyAllowedJapaneseChars) {
      return AnswerCheckerResult.Incorrect;
    }
  }

  return resolvedResult;
}
