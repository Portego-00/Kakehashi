import {
  buildSimilarKanjiRounds,
  getPrimaryKanjiMeaning,
} from "../similarKanjiQuiz";

const makeKanjiSubject = (
  id: number,
  characters: string,
  meaning: string,
  visuallySimilarSubjectIds: number[] = [],
) => ({
  id,
  object: "kanji",
  data: {
    characters,
    meanings: [{ meaning, primary: true, accepted_answer: true }],
    visually_similar_subject_ids: visuallySimilarSubjectIds,
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
          visually_similar_subject_ids: [],
        },
      }),
    ).toBe("Soil");
  });

  it("excludes unlearned similar kanji when requested", () => {
    const target = makeKanjiSubject(1, "土", "Soil");
    const learnedSimilar = makeKanjiSubject(2, "士", "Gentleman");
    const unlearnedSimilar = makeKanjiSubject(3, "干", "Dry");

    const rounds = buildSimilarKanjiRounds({
      targetSubjects: [target],
      allKanjiSubjects: [target, learnedSimilar, unlearnedSimilar],
      learnedKanjiSubjectIds: new Set([1, 2]),
      includeUnlearnedSimilarKanji: false,
      numberOfRounds: 1,
      maxKanjiPerRound: 3,
      source: "niai",
      getNiaiSimilarKanji: () => ["干", "士"],
      randomFn: () => 0,
    });

    expect(rounds).toHaveLength(1);
    expect(rounds[0].items.map((item) => item.subject.id)).toEqual([1, 2]);
  });

  it("can include unlearned similar kanji", () => {
    const target = makeKanjiSubject(1, "土", "Soil");
    const unlearnedSimilar = makeKanjiSubject(3, "干", "Dry");

    const rounds = buildSimilarKanjiRounds({
      targetSubjects: [target],
      allKanjiSubjects: [target, unlearnedSimilar],
      learnedKanjiSubjectIds: new Set([1]),
      includeUnlearnedSimilarKanji: true,
      numberOfRounds: 1,
      maxKanjiPerRound: 3,
      source: "niai",
      getNiaiSimilarKanji: () => ["干"],
      randomFn: () => 0,
    });

    expect(rounds).toHaveLength(1);
    expect(rounds[0].items.map((item) => item.subject.id)).toEqual([1, 3]);
  });

  it("uses WaniKani visually similar subject ids when selected", () => {
    const target = makeKanjiSubject(1, "土", "Soil", [4]);
    const niaiSimilar = makeKanjiSubject(2, "士", "Gentleman");
    const wkSimilar = makeKanjiSubject(4, "圭", "Jewel");

    const rounds = buildSimilarKanjiRounds({
      targetSubjects: [target],
      allKanjiSubjects: [target, niaiSimilar, wkSimilar],
      learnedKanjiSubjectIds: new Set([1, 2, 4]),
      includeUnlearnedSimilarKanji: false,
      numberOfRounds: 1,
      maxKanjiPerRound: 3,
      source: "wanikani",
      getNiaiSimilarKanji: () => ["士"],
      randomFn: () => 0,
    });

    expect(rounds).toHaveLength(1);
    expect(rounds[0].items.map((item) => item.subject.id)).toEqual([1, 4]);
  });

  it("skips ambiguous rounds with no distinct similar meaning", () => {
    const target = makeKanjiSubject(1, "力", "Power");
    const sameMeaningSimilar = makeKanjiSubject(2, "刀", "Power");

    const rounds = buildSimilarKanjiRounds({
      targetSubjects: [target],
      allKanjiSubjects: [target, sameMeaningSimilar],
      learnedKanjiSubjectIds: new Set([1, 2]),
      includeUnlearnedSimilarKanji: false,
      numberOfRounds: 1,
      maxKanjiPerRound: 2,
      source: "niai",
      getNiaiSimilarKanji: () => ["刀"],
      randomFn: () => 0,
    });

    expect(rounds).toEqual([]);
  });

  it("limits rounds and kanji per round to the requested counts", () => {
    const targets = [
      makeKanjiSubject(1, "土", "Soil"),
      makeKanjiSubject(2, "大", "Big"),
    ];
    const similar = [
      makeKanjiSubject(3, "士", "Gentleman"),
      makeKanjiSubject(4, "干", "Dry"),
      makeKanjiSubject(5, "犬", "Dog"),
    ];

    const rounds = buildSimilarKanjiRounds({
      targetSubjects: targets,
      allKanjiSubjects: [...targets, ...similar],
      learnedKanjiSubjectIds: new Set([1, 2, 3, 4, 5]),
      includeUnlearnedSimilarKanji: false,
      numberOfRounds: 1,
      maxKanjiPerRound: 2,
      source: "niai",
      getNiaiSimilarKanji: (kanji) =>
        kanji === "土" ? ["士", "干"] : ["犬"],
      randomFn: () => 0,
    });

    expect(rounds).toHaveLength(1);
    expect(rounds[0].items).toHaveLength(2);
    expect(rounds[0].meaningChoices).toHaveLength(2);
  });
});
