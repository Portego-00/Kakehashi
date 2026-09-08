import { answerCustomSessionQuestion, confirmCustomSessionWord, createCustomSessionQuiz, customLessonBatch, customLessonBatchSize, customNextReviewLabel, customSessionStats, customWordHasReadingQuestion } from "../session";
import type { CustomVocabularyWord } from "../types";

const word = (id: string, characters = "どうぞ"): CustomVocabularyWord => ({
  id, characters, reading: characters === "どうぞ" ? "どうぞ" : "にっき", meanings: ["please"], partsOfSpeech: [], meaningMnemonic: "A mnemonic", contextSentences: [],
});

describe("custom vocabulary lesson and review queues", () => {
  it("batches sixteen words into 5, 5, 5, 1 without repeats", () => {
    let remaining = Array.from({ length: 16 }, (_, index) => word(`word-${index}`));
    const sizes: number[] = [];
    const ids: string[] = [];
    while (remaining.length) {
      const batch = customLessonBatch(remaining, 5);
      sizes.push(batch.length);
      ids.push(...batch.map((item) => item.id));
      remaining = remaining.filter((item) => !batch.includes(item));
    }
    expect(sizes).toEqual([5, 5, 5, 1]);
    expect(new Set(ids).size).toBe(16);
    expect(customLessonBatchSize(Number.NaN)).toBe(5);
    expect(customLessonBatchSize(0)).toBe(1);
  });

  it("only asks meanings for kana, and both parts for kanji vocabulary", () => {
    const kana = word("kana");
    const kanji = word("kanji", "日記");
    const quiz = createCustomSessionQuiz([kana, kanji], { ordered: true, random: () => 0.999 });
    expect(customWordHasReadingQuestion(kana)).toBe(false);
    expect(quiz.questions).toEqual([{ wordId: "kana", type: "meaning" }, { wordId: "kanji", type: "meaning" }, { wordId: "kanji", type: "reading" }]);
    expect(createCustomSessionQuiz([kanji], { ordered: true, meaningFirst: false }).questions[0].type).toBe("reading");
  });

  it("requeues wrong questions and preserves their mistakes through completion", () => {
    let quiz = createCustomSessionQuiz([word("kana")]);
    quiz = answerCustomSessionQuestion(quiz, quiz.questions[0], quiz.occurrence, false).quiz;
    quiz = answerCustomSessionQuestion(quiz, quiz.questions[0], quiz.occurrence, false).quiz;
    const answer = answerCustomSessionQuestion(quiz, quiz.questions[0], quiz.occurrence, true);
    expect(answer.completedWordId).toBe("kana");
    expect(answer.quiz.items[0].meaningIncorrect).toBe(2);
    expect(answer.quiz.items[0].saved).toBe(false);
    expect(customSessionStats(answer.quiz)).toEqual({ completed: 0, accuracy: 33, incorrect: 2 });
    expect(customSessionStats(confirmCustomSessionWord(answer.quiz, "kana")).completed).toBe(1);
  });

  it("does not commit a kanji word until both question types are answered", () => {
    const quiz = createCustomSessionQuiz([word("kanji", "日記")], { ordered: true });
    const meaning = answerCustomSessionQuestion(quiz, quiz.questions[0], quiz.occurrence, true);
    expect(meaning.completedWordId).toBeNull();
    const reading = answerCustomSessionQuestion(meaning.quiz, meaning.quiz.questions[0], meaning.quiz.occurrence, true);
    expect(reading.completedWordId).toBe("kanji");
  });

  it("ignores a duplicate callback even when the same question is requeued", () => {
    const quiz = createCustomSessionQuiz([word("kana")]);
    const wrong = answerCustomSessionQuestion(quiz, quiz.questions[0], 0, false);
    const duplicate = answerCustomSessionQuestion(wrong.quiz, quiz.questions[0], 0, false);
    expect(duplicate.quiz).toBe(wrong.quiz);
    expect(duplicate.quiz.items[0].meaningIncorrect).toBe(1);
  });

  it("starts a new batch with fresh statistics", () => {
    const quiz = createCustomSessionQuiz([word("next")]);
    expect(customSessionStats(quiz)).toEqual({ completed: 0, accuracy: 100, incorrect: 0 });
    expect(quiz.answeredCount).toBe(0);
  });

  it("formats actual server due dates instead of hard-coding WK intervals", () => {
    expect(customNextReviewLabel("2026-09-07T04:00:00Z", 1, Date.parse("2026-09-07T00:00:00Z"))).toBe("Next review in 4 hours");
    expect(customNextReviewLabel(null, 9)).toBe("No more reviews");
  });
});
