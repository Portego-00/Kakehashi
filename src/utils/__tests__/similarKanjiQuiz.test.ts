import {
  buildSimilarKanjiQuestions,
  getPrimaryKanjiMeaning,
} from "../similarKanjiQuiz";

const makeKanjiSubject = (id: number, characters: string, meaning: string) => ({
  id,
  object: "kanji",
  data: {
    characters,
    meanings: [{ meaning, primary: true, accepted_answer: true }],
  },
});

describe("similarKanjiQuiz", () => {
  it("uses the primary meaning for choices", () => {
    expect(
      getPrimaryKanjiMeaning({
        id: 1,
        object: "kanji",
        data: {
          characters: "土",
          meanings: [
            { meaning: "Ground", primary: false, accepted_answer: true },
            { meaning: "Soil", primary: true, accepted_answer: true },
          ],
        },
      }),
    ).toBe("Soil");
  });

  it("excludes unlearned similar kanji when requested", () => {
    const target = makeKanjiSubject(1, "土", "Soil");
    const learnedSimilar = makeKanjiSubject(2, "士", "Gentleman");
    const unlearnedSimilar = makeKanjiSubject(3, "干", "Dry");

    const questions = buildSimilarKanjiQuestions({
      targetSubjects: [target],
      allKanjiSubjects: [target, learnedSimilar, unlearnedSimilar],
      learnedKanjiSubjectIds: new Set([1, 2]),
      includeUnlearnedSimilarKanji: false,
      numberOfQuestions: 1,
      getSimilarKanji: () => ["干", "士"],
      randomFn: () => 0,
    });

    expect(questions).toHaveLength(1);
    expect(questions[0].similarSubject.id).toBe(2);
  });

  it("can include unlearned similar kanji", () => {
    const target = makeKanjiSubject(1, "土", "Soil");
    const unlearnedSimilar = makeKanjiSubject(3, "干", "Dry");

    const questions = buildSimilarKanjiQuestions({
      targetSubjects: [target],
      allKanjiSubjects: [target, unlearnedSimilar],
      learnedKanjiSubjectIds: new Set([1]),
      includeUnlearnedSimilarKanji: true,
      numberOfQuestions: 1,
      getSimilarKanji: () => ["干"],
      randomFn: () => 0,
    });

    expect(questions).toHaveLength(1);
    expect(questions[0].similarSubject.id).toBe(3);
  });

  it("skips ambiguous pairs with the same primary meaning", () => {
    const target = makeKanjiSubject(1, "力", "Power");
    const sameMeaningSimilar = makeKanjiSubject(2, "刀", "Power");

    const questions = buildSimilarKanjiQuestions({
      targetSubjects: [target],
      allKanjiSubjects: [target, sameMeaningSimilar],
      learnedKanjiSubjectIds: new Set([1, 2]),
      includeUnlearnedSimilarKanji: false,
      numberOfQuestions: 1,
      getSimilarKanji: () => ["刀"],
      randomFn: () => 0,
    });

    expect(questions).toEqual([]);
  });

  it("limits generated questions to the requested count", () => {
    const targets = [
      makeKanjiSubject(1, "土", "Soil"),
      makeKanjiSubject(2, "大", "Big"),
    ];
    const similar = [
      makeKanjiSubject(3, "士", "Gentleman"),
      makeKanjiSubject(4, "犬", "Dog"),
    ];

    const questions = buildSimilarKanjiQuestions({
      targetSubjects: targets,
      allKanjiSubjects: [...targets, ...similar],
      learnedKanjiSubjectIds: new Set([1, 2, 3, 4]),
      includeUnlearnedSimilarKanji: false,
      numberOfQuestions: 1,
      getSimilarKanji: (kanji) => (kanji === "土" ? ["士"] : ["犬"]),
      randomFn: () => 0,
    });

    expect(questions).toHaveLength(1);
  });
});
