import {
  buildKanjiMeaningMatchRounds,
  buildSimilarKanjiRounds,
  getPrimaryKanjiMeaning,
  getPrimaryKanjiReading,
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

  it("uses primary readings for the answered-state reveal", () => {
    expect(
      getPrimaryKanjiReading({
        data: {
          readings: [
            {
              reading: "えが",
              primary: false,
              accepted_answer: true,
              type: "kunyomi",
            },
            {
              reading: "が",
              primary: true,
              accepted_answer: true,
              type: "onyomi",
            },
          ],
        },
      }),
    ).toBe("が");
  });

  it("falls back to accepted readings and handles missing readings", () => {
    expect(
      getPrimaryKanjiReading({
        data: {
          readings: [
            {
              reading: "かく",
              primary: false,
              accepted_answer: true,
              type: "onyomi",
            },
            {
              reading: "えがく",
              primary: false,
              accepted_answer: true,
              type: "kunyomi",
            },
          ],
        },
      }),
    ).toBe("かく ・ えがく");
    expect(getPrimaryKanjiReading({ data: { readings: null } })).toBeNull();
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

  it("builds custom kanji-to-meaning rounds from the selected subjects", () => {
    const subjects = [
      makeKanjiSubject(1, "一", "One"),
      makeKanjiSubject(2, "二", "Two"),
      makeKanjiSubject(3, "三", "Three"),
      makeKanjiSubject(4, "四", "Four"),
      makeKanjiSubject(5, "五", "Five"),
    ];

    const rounds = buildKanjiMeaningMatchRounds({
      subjects,
      maxKanjiPerRound: 4,
      randomFn: () => 0,
    });

    expect(rounds.map((round) => round.items.length)).toEqual([3, 2]);
    expect(
      rounds
        .flatMap((round) => round.items.map((item) => item.subject.id))
        .sort((left, right) => left - right),
    ).toEqual([1, 2, 3, 4, 5]);
    rounds.forEach((round) => {
      expect(round.meaningChoices.map((choice) => choice.id).sort()).toEqual(
        round.items.map((item) => item.id).sort(),
      );
    });
  });

  it("requires at least two usable kanji for a custom match", () => {
    expect(
      buildKanjiMeaningMatchRounds({
        subjects: [makeKanjiSubject(1, "一", "One")],
        maxKanjiPerRound: 4,
      }),
    ).toEqual([]);
  });

  it("separates duplicate meanings across custom match rounds", () => {
    const rounds = buildKanjiMeaningMatchRounds({
      subjects: [
        makeKanjiSubject(1, "上", "Above"),
        makeKanjiSubject(2, "昇", "Above"),
        makeKanjiSubject(3, "下", "Below"),
        makeKanjiSubject(4, "左", "Left"),
      ],
      maxKanjiPerRound: 2,
      randomFn: () => 0,
    });

    expect(rounds).toHaveLength(2);
    rounds.forEach((round) => {
      expect(new Set(round.items.map((item) => item.meaning)).size).toBe(
        round.items.length,
      );
    });
  });
});
