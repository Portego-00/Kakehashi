import { AnswerCheckerResult } from "../answerChecker";
import { resolveReadingModeResult } from "../readingAnswerMode";

describe("resolveReadingModeResult", () => {
  it("keeps default behavior when mode flag is disabled", () => {
    const result = resolveReadingModeResult({
      result: AnswerCheckerResult.ContainsInvalidCharacters,
      answer: "計算",
      questionType: "reading",
      acceptCharactersAsCorrectForReading: false,
    });

    expect(result).toBe(AnswerCheckerResult.ContainsInvalidCharacters);
  });

  it("accepts kanji characters as correct in English -> Japanese mode", () => {
    const result = resolveReadingModeResult({
      result: AnswerCheckerResult.IsKanjiButWantReading,
      answer: "計算",
      questionType: "reading",
      acceptCharactersAsCorrectForReading: true,
    });

    expect(result).toBe(AnswerCheckerResult.Precise);
  });

  it("treats wrong Japanese-only input as incorrect in English -> Japanese mode", () => {
    const result = resolveReadingModeResult({
      result: AnswerCheckerResult.ContainsInvalidCharacters,
      answer: "受験々",
      questionType: "reading",
      acceptCharactersAsCorrectForReading: true,
    });

    expect(result).toBe(AnswerCheckerResult.Incorrect);
  });

  it("keeps non-kana/kanji input as warning in English -> Japanese mode", () => {
    const result = resolveReadingModeResult({
      result: AnswerCheckerResult.ContainsInvalidCharacters,
      answer: "j",
      questionType: "reading",
      acceptCharactersAsCorrectForReading: true,
    });

    expect(result).toBe(AnswerCheckerResult.ContainsInvalidCharacters);
  });

  it("does not change non-reading questions", () => {
    const result = resolveReadingModeResult({
      result: AnswerCheckerResult.ContainsInvalidCharacters,
      answer: "計算",
      questionType: "meaning",
      acceptCharactersAsCorrectForReading: true,
    });

    expect(result).toBe(AnswerCheckerResult.ContainsInvalidCharacters);
  });

  it("requires subject characters when Kana -> Kanji mode is enabled", () => {
    const result = resolveReadingModeResult({
      result: AnswerCheckerResult.Precise,
      answer: "けいさん",
      questionType: "reading",
      acceptCharactersAsCorrectForReading: true,
      requireSubjectCharactersForReading: true,
      subjectCharacters: "計算",
    });

    expect(result).toBe(AnswerCheckerResult.Incorrect);
  });

  it("accepts exact kanji answer in Kana -> Kanji mode", () => {
    const result = resolveReadingModeResult({
      result: AnswerCheckerResult.IsKanjiButWantReading,
      answer: "計算",
      questionType: "reading",
      acceptCharactersAsCorrectForReading: true,
      requireSubjectCharactersForReading: true,
      subjectCharacters: "計算",
    });

    expect(result).toBe(AnswerCheckerResult.Precise);
  });

  it("keeps kana-only vocabulary answers valid in Kana -> Kanji mode", () => {
    const result = resolveReadingModeResult({
      result: AnswerCheckerResult.Precise,
      answer: "ありがとう",
      questionType: "reading",
      acceptCharactersAsCorrectForReading: true,
      requireSubjectCharactersForReading: true,
      subjectCharacters: "ありがとう",
    });

    expect(result).toBe(AnswerCheckerResult.Precise);
  });
});
