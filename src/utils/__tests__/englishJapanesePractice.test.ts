import { Subject } from "../../types/wanikani";
import {
  buildEnglishJapaneseMeaningGroups,
  matchesAcceptedJapaneseAnswer,
  selectEnglishJapaneseQuestions,
} from "../englishJapanesePractice";

function vocabulary(
  id: number,
  characters: string,
  reading: string,
  meanings: Subject["data"]["meanings"],
): Subject {
  return {
    id,
    object: "vocabulary",
    data: {
      characters,
      meanings,
      readings: [
        {
          reading,
          primary: true,
          accepted_answer: true,
        },
      ],
    },
  };
}

describe("English to Japanese practice", () => {
  const subjects = [
    vocabulary(1, "引き算", "ひきざん", [
      { meaning: "Subtraction", primary: true, accepted_answer: true },
    ]),
    vocabulary(2, "減法", "げんぽう", [
      { meaning: "Subtraction", primary: true, accepted_answer: true },
    ]),
    vocabulary(3, "喜劇", "きげき", [
      { meaning: "Comedy", primary: true, accepted_answer: true },
    ]),
    vocabulary(4, "お笑い", "おわらい", [
      { meaning: "Comedy", primary: true, accepted_answer: true },
    ]),
  ];

  it("groups every Japanese translation under the shared English meaning", () => {
    const groups = buildEnglishJapaneseMeaningGroups(subjects);
    const subtraction = groups.find(
      (group) => group.normalizedMeaning === "subtraction",
    );
    const comedy = groups.find((group) => group.normalizedMeaning === "comedy");

    expect(subtraction?.subjects.map((subject) => subject.id)).toEqual([1, 2]);
    expect(subtraction?.acceptedAnswers).toEqual([
      "引き算",
      "ひきざん",
      "減法",
      "げんぽう",
    ]);
    expect(comedy?.acceptedAnswers).toEqual([
      "喜劇",
      "きげき",
      "お笑い",
      "おわらい",
    ]);
  });

  it("selects unique English meanings rather than duplicate subjects", () => {
    const questions = selectEnglishJapaneseQuestions(subjects, 10, () => 0);

    expect(questions).toHaveLength(2);
    expect(questions.map((question) => question.promptMeaning)).toEqual([
      "Subtraction",
      "Comedy",
    ]);
    expect(questions[0].acceptedAnswerDisplayText).toBe(
      "引き算 (ひきざん), 減法 (げんぽう)",
    );
  });

  it("matches characters, kana, katakana, and romaji alternatives", () => {
    const acceptedAnswers = ["引き算", "ひきざん", "減法", "げんぽう"];

    expect(matchesAcceptedJapaneseAnswer("減法", acceptedAnswers)).toBe(true);
    expect(matchesAcceptedJapaneseAnswer("ゲンポウ", acceptedAnswers)).toBe(true);
    expect(matchesAcceptedJapaneseAnswer("genpou", acceptedAnswers)).toBe(true);
    expect(matchesAcceptedJapaneseAnswer("足し算", acceptedAnswers)).toBe(false);
  });

  it("does not group rejected meanings", () => {
    const rejected = vocabulary(5, "寸法", "すんぽう", [
      { meaning: "Measurement", primary: true, accepted_answer: true },
      { meaning: "Subtraction", accepted_answer: false },
    ]);

    const subtraction = buildEnglishJapaneseMeaningGroups([
      ...subjects,
      rejected,
    ]).find((group) => group.normalizedMeaning === "subtraction");

    expect(subtraction?.subjects.map((subject) => subject.id)).toEqual([1, 2]);
  });
});
