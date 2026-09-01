import { describe, expect, it } from "vitest";
import { customLessonWords, customPackProgress, customReviewWords, completeCustomLesson, createCustomSrsState, enrollCustomVocabularyPack, recordCustomReview } from "./model";
import { nextCustomSrsStage } from "./scheduler";
import type { CustomVocabularyPack } from "./types";

const pack: CustomVocabularyPack = {
  id: "starter",
  title: "Starter",
  description: "Test words",
  script: "hiragana",
  words: [
    { id: "starter:こんにちは", characters: "こんにちは", reading: "こんにちは", meanings: ["hello"], partsOfSpeech: ["expression"], meaningMnemonic: "Say hello.", readingMnemonic: "It is already written in kana.", contextSentences: [{ ja: "こんにちは。", en: "Hello." }] },
    { id: "starter:すごい", characters: "すごい", reading: "すごい", meanings: ["amazing"], partsOfSpeech: ["i_adjective"], meaningMnemonic: "That is amazing.", readingMnemonic: "It is already written in kana.", contextSentences: [{ ja: "すごいですね。", en: "That is amazing." }] },
  ],
};

describe("custom SRS model", () => {
  it("enrolls a pack idempotently and creates a lesson for every word", () => {
    const now = new Date("2026-08-31T10:30:00Z");
    const enrolled = enrollCustomVocabularyPack(createCustomSrsState(now), pack, now);
    const enrolledAgain = enrollCustomVocabularyPack(enrolled, pack, now);

    expect(enrolledAgain).toBe(enrolled);
    expect(enrolledAgain.enrolledPackIds).toEqual(["starter"]);
    expect(customLessonWords(enrolledAgain, [pack]).map((word) => word.id)).toEqual(["starter:こんにちは", "starter:すごい"]);
    expect(customPackProgress(enrolledAgain, pack, now)).toMatchObject({ total: 2, lessons: 2, due: 0 });
  });

  it("schedules the first review four hours after a completed lesson at the top of the hour", () => {
    const lessonAt = new Date("2026-08-31T10:30:00Z");
    const enrolled = enrollCustomVocabularyPack(createCustomSrsState(lessonAt), pack, lessonAt);
    const learned = completeCustomLesson(enrolled, pack.words[0].id, lessonAt);

    expect(learned.assignments[pack.words[0].id]).toMatchObject({ stage: 1, startedAt: lessonAt.toISOString(), availableAt: "2026-08-31T14:00:00.000Z" });
    expect(learned.assignments[pack.words[0].id].card).toMatchObject({ state: "Learning", reps: 0, difficulty: 0, stability: 0 });
    expect(learned.policy.bootstrapStrategy).toBe("explicit-learning-card");
    expect(customReviewWords(learned, [pack], new Date("2026-08-31T13:59:59Z"))).toEqual([]);
    expect(customReviewWords(learned, [pack], new Date("2026-08-31T14:00:00Z"))).toEqual([pack.words[0]]);
  });

  it("uses pass/fail review grades while preserving WK-shaped stage progression", () => {
    const lessonAt = new Date("2026-08-31T10:30:00Z");
    const enrolled = enrollCustomVocabularyPack(createCustomSrsState(lessonAt), pack, lessonAt);
    const learned = completeCustomLesson(enrolled, pack.words[0].id, lessonAt);
    const firstReviewAt = new Date(learned.assignments[pack.words[0].id].availableAt!);
    const passed = recordCustomReview(learned, pack.words[0].id, 0, firstReviewAt, "first-review");

    expect(passed.assignments[pack.words[0].id]).toMatchObject({ stage: 2, availableAt: "2026-08-31T22:00:00.000Z", correctReviews: 1, incorrectReviews: 0 });
    const secondPass = recordCustomReview(passed, pack.words[0].id, 0, new Date("2026-08-31T22:00:00.000Z"), "second-pass");
    expect(secondPass.assignments[pack.words[0].id]).toMatchObject({ stage: 3, availableAt: "2026-09-02T22:00:00.000Z", correctReviews: 2, incorrectReviews: 0 });
    const secondReviewAt = new Date(passed.assignments[pack.words[0].id].availableAt!);
    const failed = recordCustomReview(passed, pack.words[0].id, 1, secondReviewAt, "second-review");
    expect(failed.assignments[pack.words[0].id]).toMatchObject({ stage: 1, correctReviews: 1, incorrectReviews: 1 });
    expect(failed.reviewLog.map((log) => log.rating)).toEqual(["Good", "Again"]);
    expect(recordCustomReview(failed, pack.words[0].id, 1, new Date(failed.assignments[pack.words[0].id].availableAt!), "second-review")).toBe(failed);
  });

  it("applies WaniKani's stronger post-Guru penalty and stops burned reviews", () => {
    expect(nextCustomSrsStage(4, 1)).toBe(3);
    expect(nextCustomSrsStage(5, 1)).toBe(3);
    expect(nextCustomSrsStage(8, 3)).toBe(4);
    expect(nextCustomSrsStage(8, 0)).toBe(9);
  });

  it("refuses early reviews at the module interface", () => {
    const lessonAt = new Date("2026-08-31T10:30:00Z");
    const enrolled = enrollCustomVocabularyPack(createCustomSrsState(lessonAt), pack, lessonAt);
    const learned = completeCustomLesson(enrolled, pack.words[0].id, lessonAt);
    expect(() => recordCustomReview(learned, pack.words[0].id, 0, new Date("2026-08-31T12:00:00Z"))).toThrow(/not due yet/);
  });
});
